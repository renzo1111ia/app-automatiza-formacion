/**
 * HubSpot CRM provider — Sprint 2 Phase 03.
 *
 * Public App OAuth 2.0 multi-tenant. Fetch puro (no SDK — see researcher-01 §7).
 * Endpoints v3. Token TTL 30 min. Refresh con posible rotation. Custom properties
 * `af_origen` + `af_metadata_extra` auto-provisionadas en init().
 */
import { CRMCapabilities, CRMLead, CRMTokens, ICRMProvider } from "../interface";
import { CRMError, mapHubSpotError, networkError } from "../crm-error";
import { getValidTokens, invalidateToken, registerRefresher } from "../token-manager";
import {
  DEFAULT_HUBSPOT_PROPERTIES,
  mapHubSpotContactToLead,
  mapLeadToHubSpotProperties,
} from "./hubspot-mappers";
import { ensureCustomProperties } from "./hubspot-properties";

const API_BASE = "https://api.hubapi.com";
const OAUTH_AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = `${API_BASE}/oauth/v1/token`;
const TOKEN_INTROSPECT_URL = (token: string) =>
  `${API_BASE}/oauth/v1/access-tokens/${encodeURIComponent(token)}`;

const SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.tasks.write",
  "crm.lists.read",
  "crm.lists.write",
];

const MAX_RETRIES_5XX = 3;
const BACKOFF_STEPS_MS = [250, 2000, 8000];
const RATE_LIMIT_CAP_MS = 60_000;
const LIST_CACHE_TTL_MS = 15 * 60 * 1000;

// HubSpot associationTypeIds (contact → task: 204; contact → meeting: 212).
const ASSOC_TYPE_CONTACT_TO_TASK = 204;
const ASSOC_TYPE_CONTACT_TO_MEETING = 212;

export interface HubSpotProviderOptions {
  tokens?: CRMTokens;
  metadata?: { portal_id?: string | number; custom_field_map?: Record<string, string> };
  integrationId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  onTokenRotated?: (next: { refreshToken: string }) => void | Promise<void>;
}

export class HubSpotCRMProvider implements ICRMProvider {
  private integrationId?: string;
  private clientId?: string;
  private clientSecret?: string;
  private redirectUri?: string;
  private fallbackTokens?: CRMTokens;
  private portalId?: string;
  private onTokenRotated?: HubSpotProviderOptions["onTokenRotated"];
  private listIdCache = new Map<string, { id: string; expiresAt: number }>();

  constructor(opts: HubSpotProviderOptions = {}) {
    this.integrationId = opts.integrationId;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.redirectUri = opts.redirectUri;
    this.fallbackTokens = opts.tokens;
    this.portalId = opts.metadata?.portal_id ? String(opts.metadata.portal_id) : undefined;
    this.onTokenRotated = opts.onTokenRotated;
  }

  // ── Capabilities + lifecycle ──────────────────────────────────────────────

  getCapabilities(): CRMCapabilities {
    return {
      hasBlueprints: false, // HubSpot usa workflows, no blueprints.
      hasCustomFields: true,
      hasWebhooks: true,
      hasDeals: true,
      hasTags: false, // No "tags" nativos — usar Lists API.
      hasDataCenters: false, // single-region api.hubapi.com.
      oauthFlow: "authorization_code",
    };
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.request("/crm/v3/objects/contacts?limit=1");
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // HubSpot no expone endpoint público de revoke; el usuario debe desinstalar
    // la app desde su portal HubSpot UI. Limpiamos cache local.
    if (this.integrationId) invalidateToken(this.integrationId);
  }

  /**
   * Provisiona custom properties idempotentes. Llamado tras OAuth callback exitoso.
   */
  async init(): Promise<{ created: string[]; existing: string[] }> {
    return ensureCustomProperties((path, options) => this.request(path, options));
  }

  // ── OAuth handshake ───────────────────────────────────────────────────────

  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (!this.clientId)
      throw new Error("HubSpotCRMProvider.getAuthorizationUrl: clientId requerido");
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
    });
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  async completeOAuth(
    code: string,
    redirectUri: string
  ): Promise<CRMTokens & { portalId?: string }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("HubSpotCRMProvider.completeOAuth: clientId/clientSecret requeridos");
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err) {
      throw networkError("hubspot", err);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new CRMError({
        code: "AUTH_FAILED",
        message: `HubSpot token exchange failed (${res.status}): ${data.message ?? res.statusText}`,
        provider: "hubspot",
        originalError: data,
      });
    }

    const accessToken = String(data.access_token ?? "");
    const refreshToken = String(data.refresh_token ?? "");
    const expiresIn = Number(data.expires_in ?? 1800);

    // Algunos portales devuelven `hub_id` directo; otros requieren introspect.
    let portalId: string | undefined;
    if (data.hub_id !== undefined) portalId = String(data.hub_id);
    else {
      try {
        const ir = await fetch(TOKEN_INTROSPECT_URL(accessToken));
        const ij = (await ir.json().catch(() => ({}))) as Record<string, unknown>;
        if (ij.hub_id !== undefined) portalId = String(ij.hub_id);
      } catch {
        // intentional: introspect best-effort.
      }
    }
    this.portalId = portalId ?? this.portalId;

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      scopes: SCOPES,
      apiBase: API_BASE,
      portalId,
    };
  }

  // ── Lead operations ───────────────────────────────────────────────────────

  async createLead(data: Record<string, unknown>): Promise<CRMLead> {
    const properties = mapLeadToHubSpotProperties(data);
    const raw = (await this.request("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties }),
    })) as Record<string, unknown>;
    return mapHubSpotContactToLead(raw);
  }

  async getLead(leadId: string): Promise<CRMLead | null> {
    try {
      const props = DEFAULT_HUBSPOT_PROPERTIES.join(",");
      const raw = (await this.request(
        `/crm/v3/objects/contacts/${encodeURIComponent(leadId)}?properties=${props}`
      )) as Record<string, unknown>;
      return mapHubSpotContactToLead(raw);
    } catch (err) {
      if (err instanceof CRMError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  async searchLeads(criteria: string): Promise<CRMLead[]> {
    const filters = parseCriteriaToFilters(criteria);
    const body = {
      filterGroups: [{ filters }],
      properties: DEFAULT_HUBSPOT_PROPERTIES,
      limit: 50,
    };
    const res = (await this.request("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify(body),
    })) as { results?: Array<Record<string, unknown>> };
    return (res.results ?? []).map(mapHubSpotContactToLead);
  }

  async findLeadByEmail(email: string): Promise<CRMLead | null> {
    const body = {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: DEFAULT_HUBSPOT_PROPERTIES,
      limit: 1,
    };
    const res = (await this.request("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify(body),
    })) as { results?: Array<Record<string, unknown>> };
    return res.results?.[0] ? mapHubSpotContactToLead(res.results[0]) : null;
  }

  async updateLead(leadId: string, data: Record<string, unknown>): Promise<unknown> {
    const properties = mapLeadToHubSpotProperties(data);
    return this.request(`/crm/v3/objects/contacts/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
  }

  async addTags(leadId: string, tagNames: string[]): Promise<unknown> {
    const results: unknown[] = [];
    for (const name of tagNames) {
      const listId = await this.resolveListId(name);
      const r = await this.request(`/crm/v3/lists/${listId}/memberships/add`, {
        method: "PUT",
        body: JSON.stringify([leadId]),
      });
      results.push(r);
    }
    return results;
  }

  async executeAction(
    leadId: string,
    actionId: string,
    data: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (actionId === "WORKFLOW_ENROLL") {
      const propertyName = String(data.propertyName ?? "af_workflow_trigger");
      const value = String(data.value ?? "true");
      return this.request(`/crm/v3/objects/contacts/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { [propertyName]: value } }),
      });
    }
    return null;
  }

  async createEvent(
    leadId: string,
    eventData: {
      subject: string;
      startTime: string;
      durationMinutes: number;
      description?: string;
    }
  ): Promise<unknown> {
    const startMs = new Date(eventData.startTime).getTime();
    const endMs = startMs + eventData.durationMinutes * 60_000;
    return this.request("/crm/v3/objects/meetings", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_meeting_title: eventData.subject,
          hs_meeting_start_time: String(startMs),
          hs_meeting_end_time: String(endMs),
          hs_meeting_body: eventData.description ?? "",
          hs_timestamp: String(startMs),
        },
        associations: [
          {
            to: { id: leadId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: ASSOC_TYPE_CONTACT_TO_MEETING,
              },
            ],
          },
        ],
      }),
    });
  }

  async createTask(
    leadId: string,
    taskData: { subject: string; description?: string; dueDate?: string; priority?: string }
  ): Promise<unknown> {
    const due = taskData.dueDate ? new Date(taskData.dueDate).getTime() : Date.now() + 86400_000;
    return this.request("/crm/v3/objects/tasks", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_task_subject: taskData.subject,
          hs_task_body: taskData.description ?? "",
          hs_task_status: "NOT_STARTED",
          hs_task_priority: (taskData.priority ?? "MEDIUM").toUpperCase(),
          hs_timestamp: String(due),
        },
        associations: [
          {
            to: { id: leadId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: ASSOC_TYPE_CONTACT_TO_TASK,
              },
            ],
          },
        ],
      }),
    });
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async resolveListId(name: string): Promise<string> {
    const cached = this.listIdCache.get(name);
    if (cached && cached.expiresAt > Date.now()) return cached.id;
    const res = (await this.request("/crm/v3/lists/?objectTypeId=0-1")) as {
      lists?: Array<{ listId: string | number; name: string }>;
    };
    let foundId: string | null = null;
    for (const l of res.lists ?? []) {
      this.listIdCache.set(l.name, {
        id: String(l.listId),
        expiresAt: Date.now() + LIST_CACHE_TTL_MS,
      });
      if (l.name === name) foundId = String(l.listId);
    }
    if (!foundId) {
      throw new CRMError({
        code: "NOT_FOUND",
        message: `HubSpot list '${name}' no encontrada`,
        provider: "hubspot",
      });
    }
    return foundId;
  }

  private async getAccessToken(): Promise<string> {
    if (this.integrationId) {
      const tokens = await getValidTokens(this.integrationId);
      return tokens.accessToken;
    }
    if (this.fallbackTokens?.accessToken) return this.fallbackTokens.accessToken;
    throw new CRMError({
      code: "AUTH_FAILED",
      message: "HubSpotCRMProvider: no integrationId ni tokens en memoria",
      provider: "hubspot",
    });
  }

  private async request(
    path: string,
    options: RequestInit = {},
    attempt = 0,
    retriedAfter401 = false
  ): Promise<unknown> {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const accessToken = await this.getAccessToken();

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      throw networkError("hubspot", err);
    }

    if (res.status === 204) return null;

    if (res.status === 401 && !retriedAfter401 && this.integrationId) {
      invalidateToken(this.integrationId);
      return this.request(path, options, attempt, true);
    }

    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
      const waitMs = Math.min(retryAfter ?? 10_000, RATE_LIMIT_CAP_MS);
      if (attempt < MAX_RETRIES_5XX) {
        await sleep(waitMs);
        return this.request(path, options, attempt + 1, retriedAfter401);
      }
      throw mapHubSpotError(429, await safeJson(res));
    }

    if (res.status >= 500 && attempt < MAX_RETRIES_5XX) {
      await sleep(BACKOFF_STEPS_MS[attempt] ?? 8000);
      return this.request(path, options, attempt + 1, retriedAfter401);
    }

    const body = await safeJson(res);
    if (!res.ok) {
      throw mapHubSpotError(res.status, body);
    }
    return body;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Register refresh callback for TokenManager (side-effect at import)
// ───────────────────────────────────────────────────────────────────────────

registerRefresher("hubspot", async (current) => {
  const clientId = process.env.HUBSPOT_CLIENT_ID ?? "";
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET missing");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: current.refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`HubSpot refresh failed (${res.status}): ${data.message ?? res.statusText}`);
  }
  const accessToken = String(data.access_token ?? "");
  const refreshToken =
    typeof data.refresh_token === "string" ? data.refresh_token : current.refreshToken;
  const expiresIn = Number(data.expires_in ?? 1800);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    apiBase: API_BASE,
  };
});

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

interface FilterClause {
  propertyName: string;
  operator: "EQ" | "CONTAINS_TOKEN" | "HAS_PROPERTY";
  value?: string;
}

/**
 * Parsea criteria del proyecto al formato HubSpot filterGroups.
 * Sintaxis soportada:
 *   - `email:foo@bar.com` → EQ email foo@bar.com.
 *   - `firstname:Pepe`    → EQ firstname Pepe.
 *   - múltiples: `email:a AND firstname:Pepe`.
 *   - fallback: si criteria no contiene `:`, se trata como email (legacy).
 */
function parseCriteriaToFilters(criteria: string): FilterClause[] {
  const trimmed = criteria.trim();
  if (!trimmed) return [];
  if (!trimmed.includes(":")) {
    return [{ propertyName: "email", operator: "EQ", value: trimmed }];
  }
  const parts = trimmed.split(/\s+AND\s+/i);
  return parts.map((part) => {
    const [propRaw, ...rest] = part.split(":");
    return {
      propertyName: propRaw.trim(),
      operator: "EQ",
      value: rest.join(":").trim(),
    } as FilterClause;
  });
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
