/**
 * Zoho CRM provider — Sprint 2 Phase 02 (multi-DC + v8 + refresh-retry + pagination).
 *
 * Bugfixes vs Sprint 1:
 *   B-01 hardcoded US DC → ahora apiBase viene de metadata.api_domain.
 *   B-02 hardcoded tokenUrl → ahora desde metadata.accounts_server.
 *   B-03 no 401→refresh→retry → request() invalida cache + retry una vez.
 *   B-04 no OAuth init flow → getAuthorizationUrl + completeOAuth reales.
 *   B-05 no paginación searchLeads → soporta page + perPage.
 *   B-06 módulo Leads hardcoded → moduleName configurable via metadata.
 *   B-07 email "contains" → findLeadByEmail con `?email=` exact match.
 *   B-08 v2 → migrado a /crm/v8/.
 */
import { CRMCapabilities, CRMLead, CRMTokens, ICRMProvider } from "../interface";
import { CRMError, mapZohoError, networkError } from "../crm-error";
import { getValidTokens, invalidateToken, registerRefresher } from "../token-manager";
import {
  DEFAULT_LOCATION,
  LOCATION_TO_ACCOUNTS,
  ZohoDCContext,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "./zoho-dc-detector";

// ───────────────────────────────────────────────────────────────────────────
// Constructor options
// ───────────────────────────────────────────────────────────────────────────

export interface ZohoProviderOptions {
  /** Tokens iniciales (cuando no se usa TokenManager — flow OAuth start o tests). */
  tokens?: CRMTokens;
  /** Metadata persistida en `integrations.metadata` (api_domain, accounts_server, location, module_name). */
  metadata?: {
    api_domain?: string;
    accounts_server?: string;
    location?: string;
    module_name?: string;
  };
  /** UUID del row `integrations` — usado por TokenManager. */
  integrationId?: string;
  /** Callback opcional cuando refresh rota refresh_token (no típico en Zoho pero soportado). */
  onTokenRotated?: (next: { refreshToken: string; apiDomain?: string }) => void | Promise<void>;
  /** Sólo para flow pre-OAuth: clientId/secret + redirectUri. */
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

const DEFAULT_MODULE = "Leads";
const DEFAULT_PER_PAGE = 200;
const MAX_RETRIES_5XX = 3;
const BACKOFF_STEPS_MS = [250, 2000, 8000];
const RATE_LIMIT_DEFAULT_MS = 60_000;

const REQUIRED_SCOPES = [
  "ZohoCRM.modules.leads.READ",
  "ZohoCRM.modules.leads.WRITE",
  "ZohoCRM.modules.contacts.READ",
  "ZohoCRM.modules.contacts.WRITE",
  "ZohoCRM.modules.tasks.WRITE",
  "ZohoCRM.modules.events.WRITE",
  "ZohoCRM.settings.fields.READ",
];

// ───────────────────────────────────────────────────────────────────────────
// Provider class
// ───────────────────────────────────────────────────────────────────────────

export class ZohoCRMProvider implements ICRMProvider {
  private apiBase: string;
  private tokenUrl: string;
  private moduleName: string;
  private integrationId?: string;
  private accountsServer: string;
  private location: string;
  private clientId?: string;
  private clientSecret?: string;
  private redirectUri?: string;
  private fallbackTokens?: CRMTokens;
  private onTokenRotated?: ZohoProviderOptions["onTokenRotated"];

  constructor(opts: ZohoProviderOptions = {}) {
    const meta = opts.metadata ?? {};
    const apiDomain = meta.api_domain;
    const accountsServer =
      meta.accounts_server ?? LOCATION_TO_ACCOUNTS[meta.location ?? DEFAULT_LOCATION];

    if (opts.integrationId && !apiDomain) {
      throw new Error("ZohoCRMProvider: metadata.api_domain requerido para llamadas API");
    }

    this.apiBase = apiDomain ? `${apiDomain}/crm/v8` : "";
    this.tokenUrl = `${accountsServer}/oauth/v2/token`;
    this.moduleName = meta.module_name || DEFAULT_MODULE;
    this.integrationId = opts.integrationId;
    this.accountsServer = accountsServer;
    this.location = meta.location ?? DEFAULT_LOCATION;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.redirectUri = opts.redirectUri;
    this.fallbackTokens = opts.tokens;
    this.onTokenRotated = opts.onTokenRotated;
  }

  // ── Capabilities + lifecycle ──────────────────────────────────────────────

  getCapabilities(): CRMCapabilities {
    return {
      hasBlueprints: true,
      hasCustomFields: true,
      hasWebhooks: true,
      hasDeals: true,
      hasTags: true,
      hasDataCenters: true,
      oauthFlow: "authorization_code",
    };
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.request(`/${this.moduleName}?per_page=1`);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.integrationId) return;
    try {
      const tokens = await getValidTokens(this.integrationId);
      const url = `${this.accountsServer}/oauth/v2/token/revoke?token=${encodeURIComponent(tokens.refreshToken)}`;
      await fetch(url, { method: "POST" });
    } catch (err) {
      console.error("[ZohoProvider] disconnect revoke failed:", (err as Error).message);
      // Igualmente limpiamos cache local — los tokens son inútiles si el adapter
      // no funciona; el caller borra/marca la row de integrations.
    }
    if (this.integrationId) invalidateToken(this.integrationId);
  }

  // ── OAuth handshake ───────────────────────────────────────────────────────

  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (!this.clientId) throw new Error("ZohoCRMProvider.getAuthorizationUrl: clientId requerido");
    const accounts = this.accountsServer || LOCATION_TO_ACCOUNTS[DEFAULT_LOCATION];
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: REQUIRED_SCOPES.join(","),
      redirect_uri: redirectUri,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${accounts}/oauth/v2/auth?${params.toString()}`;
  }

  async completeOAuth(code: string, redirectUri: string): Promise<CRMTokens> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("ZohoCRMProvider.completeOAuth: clientId/clientSecret requeridos");
    }
    const result = await exchangeCodeForTokens({
      code,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri,
      accountsServer: this.accountsServer,
    });
    // Persistir el apiDomain detectado para que el caller actualice integrations.metadata.
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: new Date(result.expiresAt),
      scopes: result.scope,
      apiBase: result.apiDomain,
    };
  }

  /**
   * Variante interna que devuelve también el contexto DC. Útil para callers
   * que necesitan persistir `accounts_server` + `location` + `api_domain` (Phase 05 route).
   */
  async completeOAuthWithContext(
    code: string,
    redirectUri: string,
    dc: ZohoDCContext
  ): Promise<CRMTokens & { dc: ZohoDCContext }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("ZohoCRMProvider.completeOAuthWithContext: clientId/clientSecret requeridos");
    }
    const result = await exchangeCodeForTokens({
      code,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri,
      accountsServer: dc.accountsServer,
    });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: new Date(result.expiresAt),
      scopes: result.scope,
      apiBase: result.apiDomain,
      dc,
    };
  }

  // ── Lead operations ───────────────────────────────────────────────────────

  async createLead(data: Record<string, unknown>): Promise<CRMLead> {
    const response = (await this.request(`/${this.moduleName}`, {
      method: "POST",
      body: JSON.stringify({ data: [data] }),
    })) as { data?: Array<{ details?: { id?: string }; code?: string; message?: string }> };
    const created = response?.data?.[0];
    if (!created?.details?.id) {
      throw new CRMError({
        code: "VALIDATION",
        message: `Zoho createLead: respuesta sin id (${created?.code ?? "unknown"})`,
        provider: "zoho",
        originalError: response,
      });
    }
    const full = await this.getLead(created.details.id);
    if (!full) {
      throw new CRMError({
        code: "PROVIDER_ERROR",
        message: "Zoho createLead: getLead tras POST devolvió null",
        provider: "zoho",
      });
    }
    return full;
  }

  async getLead(leadId: string): Promise<CRMLead | null> {
    try {
      const data = (await this.request(`/${this.moduleName}/${leadId}`)) as {
        data?: Array<Record<string, unknown>>;
      };
      return data?.data?.[0] ? this.mapToLead(data.data[0]) : null;
    } catch (err) {
      if (err instanceof CRMError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  async searchLeads(
    criteria: string,
    page: number = 1,
    perPage: number = DEFAULT_PER_PAGE
  ): Promise<CRMLead[]> {
    const qs = new URLSearchParams({
      criteria,
      page: String(page),
      per_page: String(perPage),
    });
    const data = (await this.request(`/${this.moduleName}/search?${qs.toString()}`)) as {
      data?: Array<Record<string, unknown>>;
    };
    return (data?.data ?? []).map((lead) => this.mapToLead(lead));
  }

  async findLeadByEmail(email: string): Promise<CRMLead | null> {
    const qs = new URLSearchParams({ email });
    try {
      const data = (await this.request(`/${this.moduleName}/search?${qs.toString()}`)) as {
        data?: Array<Record<string, unknown>>;
      };
      return data?.data?.[0] ? this.mapToLead(data.data[0]) : null;
    } catch (err) {
      if (err instanceof CRMError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  async updateLead(leadId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/${this.moduleName}/${leadId}`, {
      method: "PUT",
      body: JSON.stringify({ data: [data] }),
    });
  }

  async addTags(leadId: string, tags: string[]): Promise<unknown> {
    const qs = new URLSearchParams({ tag_names: tags.join(",") });
    return this.request(`/${this.moduleName}/${leadId}/actions/add_tags?${qs.toString()}`, {
      method: "POST",
    });
  }

  async executeAction(
    leadId: string,
    actionId: string,
    data: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (actionId === "BLUEPRINT") {
      const { transitionId, transition_id } = data as {
        transitionId?: string;
        transition_id?: string;
      };
      return this.request(`/${this.moduleName}/${leadId}/actions/blueprint`, {
        method: "PUT",
        body: JSON.stringify({
          blueprint: [{ transition_id: transitionId || transition_id, data }],
        }),
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
    const endTime = new Date(
      new Date(eventData.startTime).getTime() + eventData.durationMinutes * 60000
    ).toISOString();
    return this.request(`/Events`, {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            Event_Title: eventData.subject,
            Start_DateTime: eventData.startTime,
            End_DateTime: endTime,
            Description: eventData.description ?? "",
            What_Id: { id: leadId, name: this.moduleName },
            $se_module: this.moduleName,
          },
        ],
      }),
    });
  }

  async createTask(
    leadId: string,
    taskData: { subject: string; description?: string; dueDate?: string; priority?: string }
  ): Promise<unknown> {
    return this.request(`/Tasks`, {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            Subject: taskData.subject,
            Description: taskData.description ?? "",
            Due_Date: taskData.dueDate ?? new Date().toISOString().split("T")[0],
            Priority: taskData.priority ?? "Normal",
            Status: "Not Started",
            What_Id: { id: leadId, name: this.moduleName },
            $se_module: this.moduleName,
          },
        ],
      }),
    });
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private mapToLead(raw: Record<string, unknown>): CRMLead {
    return {
      id: String(raw.id ?? ""),
      fields: {
        nombre: raw.First_Name ?? "",
        apellido: raw.Last_Name ?? "",
        email: raw.Email ?? "",
        telefono: raw.Phone ?? "",
        pais: raw.Country ?? "",
        source: raw.Lead_Source ?? "",
      },
      raw,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.integrationId) {
      const tokens = await getValidTokens(this.integrationId);
      // Mantén apiBase fresco si TokenManager rotó api_domain.
      if (tokens.apiBase && !this.apiBase.startsWith(tokens.apiBase)) {
        this.apiBase = `${tokens.apiBase}/crm/v8`;
      }
      return tokens.accessToken;
    }
    if (this.fallbackTokens?.accessToken) return this.fallbackTokens.accessToken;
    throw new CRMError({
      code: "AUTH_FAILED",
      message: "ZohoCRMProvider: no integrationId ni tokens en memoria",
      provider: "zoho",
    });
  }

  private async request(
    path: string,
    options: RequestInit = {},
    attempt = 0,
    retriedAfter401 = false
  ): Promise<unknown> {
    if (!this.apiBase) {
      throw new CRMError({
        code: "AUTH_FAILED",
        message: "ZohoCRMProvider: apiBase no configurado (metadata.api_domain missing)",
        provider: "zoho",
      });
    }
    const url = path.startsWith("http") ? path : `${this.apiBase}${path}`;
    const accessToken = await this.getAccessToken();

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      throw networkError("zoho", err);
    }

    if (res.status === 204) return null;

    // 401 → invalidate + retry once (B-03)
    if (res.status === 401 && !retriedAfter401 && this.integrationId) {
      invalidateToken(this.integrationId);
      return this.request(path, options, attempt, true);
    }

    // 429 → respect Retry-After (Zoho típicamente no envía → default 60s)
    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
      const waitMs = Math.min(retryAfter ?? RATE_LIMIT_DEFAULT_MS, RATE_LIMIT_DEFAULT_MS);
      if (attempt < MAX_RETRIES_5XX) {
        await sleep(waitMs);
        return this.request(path, options, attempt + 1, retriedAfter401);
      }
      throw mapZohoError(429, await safeJson(res));
    }

    // 5xx → exponential backoff
    if (res.status >= 500 && attempt < MAX_RETRIES_5XX) {
      await sleep(BACKOFF_STEPS_MS[attempt] ?? 8000);
      return this.request(path, options, attempt + 1, retriedAfter401);
    }

    const body = await safeJson(res);
    if (!res.ok) {
      throw mapZohoError(res.status, body);
    }
    return body;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Register refresh callback for TokenManager (side-effect at import)
// ───────────────────────────────────────────────────────────────────────────

registerRefresher("zoho", async (current) => {
  const clientId = process.env.ZOHO_CLIENT_ID ?? "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET missing");
  }
  // Derivar accounts server desde apiBase (Zoho multi-DC):
  //   https://www.zohoapis.eu → https://accounts.zoho.eu
  const accountsServer = deriveAccountsServerFromApiBase(current.apiBase);
  const result = await refreshAccessToken({
    refreshToken: current.refreshToken,
    clientId,
    clientSecret,
    accountsServer,
  });
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? current.refreshToken,
    expiresAt: result.expiresAt,
    apiBase: result.apiDomain ?? current.apiBase,
  };
});

function deriveAccountsServerFromApiBase(apiBase: string): string {
  // apiBase llega como "https://www.zohoapis.eu" o "https://www.zohoapis.eu/crm/v8".
  try {
    const host = new URL(apiBase).host; // www.zohoapis.eu
    const tail = host.replace(/^www\.zohoapis\./, "");
    return `https://accounts.zoho.${tail}`;
  } catch {
    return "https://accounts.zoho.com";
  }
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
