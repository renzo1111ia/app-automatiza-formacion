# Researcher-03: Multi-CRM Adapter Pattern + write_policy + OAuth UI Flow

**Date:** 2026-05-24
**Sources consulted:** HubSpot Developers Blog (token management, OAuth guide), Zoho CRM Docs v8 (multi-DC, token validity), MartinFowler.com (AuditLog pattern), Nango Blog (concurrent token refresh), brainsandbeards.com (mutex token renewal), MSW docs, bocoup.com (adapter pattern), existing codebase `interface.ts` / `factory.ts` / `zoho.ts` / `integrations_table.sql` / `token-crypto.ts`

---

## TLDR (5 bullets)

1. **Interface is 80% there** — missing `healthcheck()`, OAuth handshake methods, `capabilities`, and `createLead()`. Add them without breaking existing Zoho impl.
2. **write_policy belongs on the adapter call, not the interface** — enforce in a `WriteGuard` middleware wrapper so adapters stay dumb; audit goes to `crm_write_audit` via service_role.
3. **append-only ≠ never UPDATE** — it means: skip CRM field if field already has a non-null value in local system; permit UPDATE only when `write_policy: overwrite_with_audit` is set AND field is whitelisted.
4. **OAuth flow**: full-page redirect (not popup) is simpler, more reliable, and the correct default for server-side Next.js. State = HMAC-SHA256(tenantId + nonce), stored in httpOnly cookie for CSRF.
5. **Token refresh lock**: use a module-level `Map<string, Promise>` as in-process mutex (single Next.js instance). If ever scaling horizontally, Redis lock is the upgrade path. The existing `factory.ts` cache needs TTL.

---

## 1. Updated `IntegrationAdapter` Interface (TypeScript)

The current `ICRMProvider` covers day-to-day CRM ops but misses lifecycle hooks, OAuth, and capability discovery. Proposed complete interface:

```typescript
// src/lib/integrations/crm/interface.ts — Sprint 2 update

/** Normalized lead in internal system format */
export interface CRMLead {
  id: string;
  fields: Record<string, unknown>; // uses VARIABLES DEFINIDAS nomenclature
  raw?: unknown;
}

/** Write context injected by WriteGuard — never set by caller directly */
export interface WriteContext {
  tenantId: string;
  actorId: string;
  writePolicy: "append_only" | "overwrite_with_audit";
  allowedOverrideFields?: string[]; // only honored when overwrite_with_audit
}

/** Per-CRM capability flags — used by UI to show/hide features */
export interface CRMCapabilities {
  hasBlueprints: boolean; // Zoho: yes. HubSpot: no (Workflows instead)
  hasCustomFields: boolean; // Both: yes
  hasWebhooks: boolean; // Both: yes
  hasDeals: boolean; // HubSpot: yes. Zoho: yes (as Potentials)
  hasTags: boolean; // Both: yes
  hasDataCenters: boolean; // Zoho: yes (multi-DC). HubSpot: no
  oauthFlow: "authorization_code" | "refresh_token_only";
}

/** Stored OAuth tokens (decrypted in-memory only, never persisted plain) */
export interface CRMTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  apiBase?: string; // Zoho multi-DC: from api_domain response field
}

export interface ICRMProvider {
  // ── Capabilities ────────────────────────────────────────────────────────

  /** Returns static capability flags. No network call. */
  getCapabilities(): CRMCapabilities;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Validates connection: calls a lightweight CRM endpoint (e.g. /Leads?per_page=1).
   * Returns true if authenticated and reachable.
   */
  healthcheck(): Promise<boolean>;

  /**
   * Revokes tokens in the CRM provider and clears local state.
   * Called on user-initiated disconnect. Does NOT delete DB row (caller's job).
   */
  disconnect(): Promise<void>;

  // ── OAuth Handshake ──────────────────────────────────────────────────────

  /**
   * Returns the authorization URL to redirect the user to.
   * @param state - HMAC-signed opaque state for CSRF + tenantId
   * @param redirectUri - must match the registered callback URI
   */
  getAuthorizationUrl(state: string, redirectUri: string): string;

  /**
   * Exchanges the authorization code for access + refresh tokens.
   * Persists encrypted tokens to DB internally via IntegrationRepository.
   * Returns the normalized tokens for caller confirmation.
   */
  completeOAuth(code: string, redirectUri: string): Promise<CRMTokens>;

  // ── Lead Operations ──────────────────────────────────────────────────────

  /** Fetch single lead by CRM ID */
  getLead(leadId: string): Promise<CRMLead | null>;

  /** Search leads by criteria string (provider-specific syntax) */
  searchLeads(criteria: string): Promise<CRMLead[]>;

  /**
   * Create a new lead.
   * Absent from v1 — needed for inbound webhook flows.
   */
  createLead(data: Record<string, unknown>): Promise<CRMLead>;

  /**
   * Update lead fields.
   * WriteGuard enforces write_policy BEFORE calling this.
   * Adapter trusts that guard has already run.
   */
  updateLead(leadId: string, data: Record<string, unknown>): Promise<unknown>;

  /** Append tags. Always append-safe by nature. */
  addTags(leadId: string, tags: string[]): Promise<unknown>;

  // ── CRM-Specific Actions ─────────────────────────────────────────────────

  /**
   * Trigger CRM-native automation.
   * Zoho: actionId = 'BLUEPRINT', data = { transitionId }
   * HubSpot: actionId = 'WORKFLOW_ENROLL', data = { workflowId }
   */
  executeAction(leadId: string, actionId: string, data?: unknown): Promise<unknown>;

  // ── Activities ───────────────────────────────────────────────────────────

  createEvent(
    leadId: string,
    eventData: { subject: string; startTime: string; durationMinutes: number; description?: string }
  ): Promise<unknown>;

  createTask(
    leadId: string,
    taskData: { subject: string; description?: string; dueDate?: string; priority?: string }
  ): Promise<unknown>;
}
```

**Key decisions:**

- `getCapabilities()` is sync/static — no network, called by UI at render time.
- `createLead()` added — inbound webhook flows need it.
- OAuth methods on interface = mandatory contract. HubSpot and Zoho both implement them; future providers (Salesforce, GoHighLevel) must too.
- `WriteContext` is injected by `WriteGuard`, never accepted as a param on individual methods. Adapters stay dumb.

---

## 2. WriteGuard — Enforcing write_policy

`updateLead` is the only mutating method that needs policy enforcement (tags are append-safe, createLead is always additive, createEvent/Task are activities).

```typescript
// src/lib/integrations/crm/write-guard.ts

import { supabaseAdmin } from "@/lib/supabase/server-admin";

export type WritePolicy = "append_only" | "overwrite_with_audit";

interface WriteGuardOptions {
  tenantId: string;
  integrationId: string;
  provider: string;
  leadId: string;
  fields: Record<string, unknown>;
  currentCRMFields?: Record<string, unknown>; // fetched from CRM if needed
  actorId: string;
  policy: WritePolicy;
  allowedOverrideFields?: string[];
}

/**
 * Returns the filtered field set that is safe to write, based on policy.
 * Also writes the audit row for overwrite_with_audit fields.
 */
export async function applyWritePolicy(opts: WriteGuardOptions): Promise<Record<string, unknown>> {
  const {
    fields,
    currentCRMFields = {},
    policy,
    allowedOverrideFields = [],
    tenantId,
    integrationId,
    provider,
    leadId,
    actorId,
  } = opts;

  if (policy === "append_only") {
    // Only write fields that are null/empty in the CRM
    const safeFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      const existing = currentCRMFields[key];
      if (existing === null || existing === undefined || existing === "") {
        safeFields[key] = value;
      }
      // Silently skip — do NOT throw. Append-only violations are expected.
    }
    return safeFields;
  }

  // overwrite_with_audit: only allowed fields, always audit
  const safeFields: Record<string, unknown> = {};
  const auditRows = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!allowedOverrideFields.includes(key)) continue; // skip non-whitelisted
    const oldValue = currentCRMFields[key];
    safeFields[key] = value;
    auditRows.push({
      tenant_id: tenantId,
      integration_id: integrationId,
      provider,
      lead_id: leadId,
      field_name: key,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: String(value),
      write_policy: policy,
      actor_id: actorId,
    });
  }

  if (auditRows.length > 0) {
    // fire-and-forget is acceptable: audit failure should not block the write
    supabaseAdmin
      .from("crm_write_audit")
      .insert(auditRows)
      .then(({ error }) => {
        if (error) console.error("[WriteGuard] audit insert failed:", error);
      });
  }

  return safeFields;
}
```

**append-only semantics clarification:**

- "Append-only" does NOT mean the adapter never calls `updateLead`. It means: skip any field that already has a non-null value. The CRM record can grow (new fields filled in) but existing data is never overwritten.
- This requires fetching `currentCRMFields` before the update. Caller should `getLead()` first; WriteGuard accepts the result. Do NOT round-trip to CRM inside WriteGuard itself.

---

## 3. SQL Schema — `integrations` table (additions) + `crm_write_audit`

### 3a. Additions to `integrations` table (migration patch)

The existing `20260522220003_integrations_table.sql` schema is solid. Missing columns for Sprint 2:

```sql
-- Sprint 2 — additions to integrations table
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS write_policy TEXT NOT NULL DEFAULT 'append_only'
    CHECK (write_policy IN ('append_only', 'overwrite_with_audit')),
  ADD COLUMN IF NOT EXISTS override_fields TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS oauth_state TEXT,          -- ephemeral: cleared after callback
  ADD COLUMN IF NOT EXISTS last_healthcheck_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS healthcheck_status TEXT    -- 'ok' | 'error' | NULL
    CHECK (healthcheck_status IN ('ok', 'error') OR healthcheck_status IS NULL);

COMMENT ON COLUMN public.integrations.write_policy IS
  'append_only = never overwrite existing CRM fields. overwrite_with_audit = overwrite allowed fields with audit trail.';
COMMENT ON COLUMN public.integrations.override_fields IS
  'Fields allowed to overwrite when write_policy = overwrite_with_audit. Empty = block all overwrites.';
COMMENT ON COLUMN public.integrations.oauth_state IS
  'Ephemeral HMAC state token used during OAuth handshake. Cleared after successful callback.';
```

### 3b. `crm_write_audit` table (new)

```sql
-- Sprint 2 — crm_write_audit
CREATE TABLE IF NOT EXISTS public.crm_write_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  lead_id        TEXT NOT NULL,         -- CRM-side ID (string, not UUID)
  field_name     TEXT NOT NULL,
  old_value      TEXT,                  -- NULL means field was empty
  new_value      TEXT NOT NULL,
  write_policy   TEXT NOT NULL,
  actor_id       UUID,                  -- auth.uid() of user who triggered; NULL = system/agent
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only: no UPDATE, no DELETE in RLS
ALTER TABLE public.crm_write_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_owner_or_admin"
  ON public.crm_write_audit FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "audit_insert_service_role"
  ON public.crm_write_audit FOR INSERT TO service_role
  WITH CHECK (true);

-- Authenticated users cannot insert directly (only via service_role from server action)
-- No UPDATE, no DELETE policies = effectively append-only at DB level

CREATE INDEX idx_crm_write_audit_tenant_lead
  ON public.crm_write_audit(tenant_id, lead_id, created_at DESC);

CREATE INDEX idx_crm_write_audit_integration
  ON public.crm_write_audit(integration_id, created_at DESC);
```

**RLS note:** Only `service_role` can INSERT into `crm_write_audit`. Authenticated users can SELECT (to see their own audit trail). No UPDATE/DELETE policies = append-only enforced at DB level, not just application level.

---

## 4. OAuth Flow — Full ASCII Diagram

```
Browser                 Next.js (server)              CRM OAuth Server        DB (integrations)
  |                          |                               |                       |
  | Click "Connect HubSpot"  |                               |                       |
  |------------------------->|                               |                       |
  |                          | 1. Generate nonce (crypto.randomUUID)                 |
  |                          | 2. state = HMAC-SHA256(tenantId + ":" + nonce)       |
  |                          | 3. Store state in httpOnly cookie (15min TTL)        |
  |                          | 4. Save state to integrations.oauth_state in DB      |
  |                          |------------------------------------------------>|    |
  |   302 → CRM auth URL     |                               |                       |
  |<-------------------------|                               |                       |
  |                          |                               |                       |
  | User authenticates + approves scopes                     |                       |
  |--------------------------------------------------------->|                       |
  |                          |                               |                       |
  |                          | Redirect to /api/integrations/{provider}/auth/callback|
  |                          |<------------------------------|                       |
  |                          | ?code=AUTH_CODE&state=SIGNED_STATE                   |
  |                          |                               |                       |
  |                          | 5. Validate state:            |                       |
  |                          |    a) Compare with cookie value (HMAC verify)        |
  |                          |    b) Compare with DB oauth_state column             |
  |                          |    c) If mismatch → 400, log security event          |
  |                          |                               |                       |
  |                          | 6. POST code to CRM token endpoint                   |
  |                          |------------------------------>|                       |
  |                          |    {access_token, refresh_token, expires_in,         |
  |                          |     api_domain (Zoho only)}   |                       |
  |                          |<------------------------------|                       |
  |                          |                               |                       |
  |                          | 7. encryptJson({access_token, refresh_token})        |
  |                          | 8. UPDATE integrations SET                           |
  |                          |    credentials_cipher = encrypted,                   |
  |                          |    scopes = [...],                                   |
  |                          |    expires_at = NOW() + expires_in,                  |
  |                          |    metadata = { api_domain (Zoho) },                 |
  |                          |    oauth_state = NULL,  -- clear ephemeral state      |
  |                          |    is_active = true                                  |
  |                          |------------------------------------------------>|   |
  |                          |                               |                   |   |
  |   302 → /dashboard/settings?section=integrations&success=hubspot            |   |
  |<-------------------------|                               |                       |
  |                          |                               |                       |

ERROR PATHS (step 5 or 6 fail):
  - State mismatch → 302 /settings?error=csrf_mismatch
  - User cancelled → code absent → 302 /settings?error=oauth_cancelled
  - CRM error → token endpoint returns error → 302 /settings?error=oauth_failed&provider={provider}
  - Network error → 302 /settings?error=oauth_network
  All errors read from URL query param in IntegrationsManager and show toast.
```

### State token signing (HMAC-SHA256)

```typescript
// src/lib/integrations/crm/oauth-state.ts
import { createHmac, randomBytes } from "crypto";

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET!; // 32+ chars random

export function generateOAuthState(tenantId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${tenantId}:${nonce}`;
  const sig = createHmac("sha256", OAUTH_STATE_SECRET).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function verifyOAuthState(state: string, expectedTenantId: string): boolean {
  const parts = state.split(":");
  if (parts.length !== 3) return false;
  const [tenantId, nonce, sig] = parts;
  if (tenantId !== expectedTenantId) return false;
  const expected = createHmac("sha256", OAUTH_STATE_SECRET)
    .update(`${tenantId}:${nonce}`)
    .digest("hex");
  // Constant-time comparison (prevent timing attack)
  return (
    sig.length === expected.length && Buffer.from(sig, "hex").equals(Buffer.from(expected, "hex"))
  );
}
```

**Full-page redirect vs popup:** Full-page redirect is the standard for server-side Next.js. Popup (postMessage) adds complexity (cross-origin iframe restrictions, mobile blockers) for marginal UX gain. Use full-page redirect in MVP. Popup can be added as enhancement in Sprint 3.

---

## 5. Token Cache + Refresh-with-Lock

### Problem with current `factory.ts`

`CRMFactory.instances` is a static `Record` with no TTL and no refresh awareness. If the process runs for hours, the cached `ZohoCRMProvider` instance holds a stale `accessToken` and a `tokenExpiry` in the past. The provider's own `refreshAccessToken()` handles it for single requests, but:

1. **Concurrent requests** on the same tenant all call `refreshAccessToken()` simultaneously → race to Zoho/HubSpot → one succeeds, rest get `invalid_grant`.
2. **Factory never updates DB** — when the provider refreshes a token in memory, the persisted `credentials_cipher` in DB is still the old token. On next cold start (redeploy), provider reads old token from DB, Zoho rejects it.

### Solution: in-process Promise deduplication + DB write-back

```typescript
// src/lib/integrations/crm/token-manager.ts

import { decryptJson, encryptJson } from "@/lib/crypto/token-crypto";
import { supabaseAdmin } from "@/lib/supabase/server-admin";

interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  apiBase: string;
}

// Module-level cache + refresh lock
// Key: integrationId (UUID from DB — unique per tenant+provider row)
const tokenCache = new Map<string, TokenState>();
const refreshInFlight = new Map<string, Promise<TokenState>>();

const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export async function getValidTokens(integrationId: string): Promise<TokenState> {
  const cached = tokenCache.get(integrationId);
  if (cached && Date.now() < cached.expiresAt - BUFFER_MS) {
    return cached;
  }

  // Already refreshing? Await existing promise (deduplication = lock)
  const inFlight = refreshInFlight.get(integrationId);
  if (inFlight) return inFlight;

  const refreshPromise = doRefresh(integrationId);
  refreshInFlight.set(integrationId, refreshPromise);

  try {
    const tokens = await refreshPromise;
    tokenCache.set(integrationId, tokens);
    return tokens;
  } finally {
    refreshInFlight.delete(integrationId);
  }
}

async function doRefresh(integrationId: string): Promise<TokenState> {
  // 1. Load integration row
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("credentials_cipher, metadata, crm_type, data_center")
    .eq("id", integrationId)
    .single();

  if (error || !data) throw new Error(`Integration ${integrationId} not found`);

  const creds = decryptJson<{ accessToken: string; refreshToken: string }>(data.credentials_cipher);
  const apiBase = resolveApiBase(data.crm_type, data.data_center, data.metadata);

  // 2. Call provider-specific refresh
  const refreshed = await callRefreshEndpoint(data.crm_type, creds, apiBase);

  // 3. Persist new tokens encrypted
  const newCipher = encryptJson({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  });

  await supabaseAdmin
    .from("integrations")
    .update({
      credentials_cipher: newCipher,
      expires_at: new Date(refreshed.expiresAt).toISOString(),
    })
    .eq("id", integrationId);

  return refreshed;
}

/** Zoho multi-DC: api_domain from token response → stored in metadata */
function resolveApiBase(
  crmType: string,
  dataCenter: string | null,
  metadata: Record<string, unknown>
): string {
  if (crmType === "zoho") {
    return (metadata?.api_domain as string) || zohoApiBase(dataCenter);
  }
  if (crmType === "hubspot") return "https://api.hubspot.com";
  return "";
}

function zohoApiBase(dc: string | null): string {
  const map: Record<string, string> = {
    eu: "https://www.zohoapis.eu/crm/v2",
    in: "https://www.zohoapis.in/crm/v2",
    au: "https://www.zohoapis.com.au/crm/v2",
    jp: "https://www.zohoapis.jp/crm/v2",
    cn: "https://www.zohoapis.com.cn/crm/v2",
  };
  return map[dc ?? "us"] ?? "https://www.zohoapis.com/crm/v2";
}
```

**Scaling note:** This in-process Map lock works for a single Next.js instance. With horizontal scaling (multiple pods), use Redis `SET NX EX 30` as lock. The interface is the same — replace `Map` with Redis calls. Do NOT add Redis to MVP — YAGNI.

**Factory refactor:** Replace `CRMFactory.instances` static Record with `getValidTokens(integrationId)` called in constructor. Factory still caches provider instances but providers now pull tokens from `TokenManager` on each request batch.

---

## 6. Standardized CRM Error Type

```typescript
// src/lib/integrations/crm/crm-error.ts

export type CRMErrorCode =
  | "AUTH_FAILED" // 401/403 or invalid_grant — requires re-auth
  | "RATE_LIMITED" // 429 — check retryAfterMs
  | "NOT_FOUND" // 404 — lead/record does not exist
  | "VALIDATION" // 422 / field error — bad data sent
  | "NETWORK" // fetch failed / timeout
  | "PROVIDER_ERROR"; // 5xx from CRM — retryable

export class CRMError extends Error {
  readonly code: CRMErrorCode;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly originalError?: unknown;
  readonly provider: string;

  constructor(opts: {
    code: CRMErrorCode;
    message: string;
    provider: string;
    retryable?: boolean;
    retryAfterMs?: number;
    originalError?: unknown;
  }) {
    super(opts.message);
    this.name = "CRMError";
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
    this.originalError = opts.originalError;
  }
}

/** HubSpot HTTP status → CRMError */
export function mapHubSpotError(status: number, body: unknown, provider = "hubspot"): CRMError {
  const b = body as Record<string, unknown>;
  if (status === 401 || status === 403)
    return new CRMError({
      code: "AUTH_FAILED",
      message: String(b?.message ?? "Unauthorized"),
      provider,
    });
  if (status === 404)
    return new CRMError({ code: "NOT_FOUND", message: "Record not found", provider });
  if (status === 429) {
    const retryAfter = Number(b?.policyName === "DAILY" ? 86400000 : 10000);
    return new CRMError({
      code: "RATE_LIMITED",
      message: "Rate limited",
      provider,
      retryable: true,
      retryAfterMs: retryAfter,
    });
  }
  if (status === 422)
    return new CRMError({
      code: "VALIDATION",
      message: String(b?.message ?? "Validation error"),
      provider,
      originalError: b,
    });
  if (status >= 500)
    return new CRMError({
      code: "PROVIDER_ERROR",
      message: `HubSpot ${status}`,
      provider,
      retryable: true,
    });
  return new CRMError({ code: "PROVIDER_ERROR", message: `Unexpected status ${status}`, provider });
}

/** Zoho HTTP status + data.code → CRMError */
export function mapZohoError(status: number, body: unknown, provider = "zoho"): CRMError {
  const b = body as Record<string, unknown>;
  const code = b?.code as string;
  if (status === 401 || code === "INVALID_TOKEN" || code === "OAUTH_SCOPE_MISMATCH") {
    return new CRMError({
      code: "AUTH_FAILED",
      message: String(b?.message ?? "Auth failed"),
      provider,
    });
  }
  if (status === 404 || code === "RECORD_NOT_FOUND") {
    return new CRMError({ code: "NOT_FOUND", message: "Record not found", provider });
  }
  if (status === 429)
    return new CRMError({
      code: "RATE_LIMITED",
      message: "Zoho rate limit",
      provider,
      retryable: true,
      retryAfterMs: 60000,
    });
  if (code === "MANDATORY_NOT_FOUND" || code === "INVALID_DATA") {
    return new CRMError({
      code: "VALIDATION",
      message: String(b?.message ?? "Invalid data"),
      provider,
      originalError: b,
    });
  }
  if (status >= 500)
    return new CRMError({
      code: "PROVIDER_ERROR",
      message: `Zoho ${status}`,
      provider,
      retryable: true,
    });
  return new CRMError({ code: "PROVIDER_ERROR", message: `Unexpected ${status}`, provider });
}
```

---

## 7. CRM Capability Matrix (HubSpot vs Zoho)

| Capability              | HubSpot                                | Zoho CRM                                 |
| ----------------------- | -------------------------------------- | ---------------------------------------- |
| OAuth flow              | Authorization Code (no PKCE natively)  | Authorization Code + multi-DC            |
| Token expiry            | 30 min access / refresh long-lived     | 60 min access / refresh non-expiring     |
| Data centers            | Single (US-hosted)                     | US, EU, IN, AU, JP, CA, SA, UK           |
| Contacts/Leads          | Contacts (unified with Deals)          | Leads + Contacts (separate)              |
| Deals/Opportunities     | Deals object                           | Potentials module                        |
| Custom fields           | Yes (Properties API)                   | Yes (up to 300 per module on Enterprise) |
| Process automation      | Workflows (trigger via API enroll)     | Blueprints (state-machine transitions)   |
| Tags                    | Lists / Labels                         | Tags API                                 |
| Webhooks (inbound)      | Yes (CRM webhooks)                     | Yes (Notifications)                      |
| Webhooks (outbound)     | Yes (Timeline events)                  | Yes (Functions + Webhooks)               |
| API versioning          | Date-based (/YYYY-MM/) since 2025      | v8 (stable)                              |
| Association model       | Object associations (flexible graph)   | Module relationships (structured)        |
| `executeAction` mapping | `WORKFLOW_ENROLL`                      | `BLUEPRINT`                              |
| Rate limits             | 110 req/10s (free), 150 req/10s (paid) | 100 req/min (Standard), 200 (Enterprise) |

**Critical Zoho multi-DC gotcha:** `api_domain` is returned in the token exchange response and must be persisted to `integrations.metadata`. If the tenant is in EU, all API calls must go to `https://www.zohoapis.eu/crm/v2` — not the US base. Current `ZohoCRMProvider` hardcodes US. This must be fixed in Sprint 2.

---

## 8. Testing Pattern

**Recommendation: MSW v2 (`msw/node`) for unit + integration tests; real sandbox for E2E**

```typescript
// tests/mocks/hubspot-handlers.ts
import { http, HttpResponse } from "msw";

export const hubspotHandlers = [
  http.post("https://api.hubspot.com/oauth/v1/token", () =>
    HttpResponse.json({ access_token: "test_at", refresh_token: "test_rt", expires_in: 1800 })
  ),
  http.get("https://api.hubspot.com/crm/v3/objects/contacts/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, properties: { email: "test@example.com" } })
  ),
  http.post("https://api.hubspot.com/crm/v3/objects/contacts/:id", () =>
    HttpResponse.json({ id: "hs-1", updatedAt: new Date().toISOString() })
  ),
];

// tests/mocks/zoho-handlers.ts
export const zohoHandlers = [
  http.post("https://accounts.zoho.com/oauth/v2/token", () =>
    HttpResponse.json({
      access_token: "zoho_at",
      expires_in: 3600,
      api_domain: "https://www.zohoapis.com",
    })
  ),
  http.get("https://www.zohoapis.com/crm/v2/Leads/:id", ({ params }) =>
    HttpResponse.json({ data: [{ id: params.id, Email: "test@test.com", First_Name: "Juan" }] })
  ),
];
```

**Test categories:**

- **Unit (MSW + Vitest):** adapter method mapping (verify request body shape matches CRM API spec). Use snapshot for request body.
- **Integration (MSW + Vitest):** full flow through `TokenManager` + adapter + `WriteGuard`. No real HTTP.
- **E2E (skip-by-env):** `HUBSPOT_TEST_PORTAL_ID` env var gates real sandbox tests. CI skips unless explicitly enabled.

**Snapshot pattern for request body validation:**

```typescript
it("maps internal lead fields to Zoho format", async () => {
  let capturedBody: unknown;
  server.use(
    http.put("*/Leads/lead-1", async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json({ data: [{ code: "SUCCESS", details: {} }] });
    })
  );

  await zohoProvider.updateLead("lead-1", { Email: "new@test.com" });
  expect(capturedBody).toMatchSnapshot();
});
```

---

## 9. UI Pattern — IntegrationsManager CRM Section

Current `IntegrationsManager.tsx` handles Retell/Ultravox/WhatsApp/Sheets. Sprint 2 adds CRM section.

**Card states per integration:**

```
┌─────────────────────────────────────────────┐
│  [CRM Icon] HubSpot CRM          [CONNECTED]│
│  test@company.com · Expires 12h  [·········]│
│                                             │
│  [Test Connection] [Disconnect]             │
│  Write policy: append_only  [Change ▾]      │
│  Last sync: hace 3 min                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [CRM Icon] Zoho CRM             [CONNECT]  │
│  Sin conectar                               │
│                                             │
│  [Conectar con Zoho →]                      │
└─────────────────────────────────────────────┘
```

**write_policy UI:** Global switch per integration (not per-field in MVP). Field-level overrides go to `override_fields[]` as a JSON textarea for admin power users. Full field-mapping UI deferred to Sprint 3.

**"Test connection" button:** calls `/api/integrations/{provider}/healthcheck` (Server Action) → returns `{ ok: boolean, latencyMs: number, error?: string }`. Shows green checkmark or red error inline.

**Field mapping (MVP):** Show current mapping as read-only JSON. Allow admin to paste override JSON. Validate with Zod. Store in `integrations.metadata.field_map`.

---

## 10. Antipatterns — Confirmed + Mitigated

| Antipattern                            | Status                                                               | Mitigation                                                      |
| -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Hardcoded secrets/URLs                 | ❌ Present (Zoho hardcodes US apiBase)                               | Fix in Sprint 2: read from `metadata.api_domain`                |
| Shared adapter between tenants         | ⚠️ Risk (factory static cache with no TTL)                           | Token manager keyed by `integrationId`, not `tenantId:provider` |
| Mock data without switch               | ✅ MSW approach allows real switch via `INTEGRATION_TEST_REAL=1` env |                                                                 |
| Lazy token refresh without lock        | ❌ Current ZohoProvider has race risk                                | `refreshInFlight` Map deduplication                             |
| write_policy skipped in seed/migration | Document rule                                                        | WriteGuard must be called even in seeder scripts                |
| oauth_state not cleared after callback | New risk                                                             | Clear `oauth_state = NULL` on successful callback               |

---

## Unknowns / Preguntas para el equipo

1. **Zoho scopes needed:** Which specific Zoho OAuth scopes does the product require? `ZohoCRM.modules.ALL` or granular? This affects the authorization URL and the `scopes[]` column.
2. **HubSpot app type:** Public app (OAuth per customer) or Private app (single API key per installation)? If private app, OAuth flow is unnecessary — use API key directly. Confirm with Bea.
3. **write_policy granularity decision:** Global per integration (MVP recommendation) vs per-field. If a tenant needs field-level control in MVP, the `override_fields[]` array covers it but the UI needs more work.
4. **Refresh token rotation:** HubSpot may issue a new refresh token on each use (depends on app settings). Zoho refresh tokens don't expire but are single-use in some configurations. Need to confirm app settings before implementing `doRefresh`.
5. **Multiple CRM per tenant:** Current schema allows multiple rows per tenant (via `integrations` table). Is this in scope for Sprint 2, or is it 1 active CRM per tenant max?
6. **`OAUTH_STATE_SECRET` env var:** Needs to be generated and added to `.env.example` + Easypanel. Confirm with Javi HP.
7. **On 401 from CRM during a regular API call:** Should the adapter auto-retry after refresh, or surface `AUTH_FAILED` to the caller? Recommendation is auto-retry once, then surface error.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Full adapter pattern design researched and documented. Interface, WriteGuard, SQL schemas, OAuth flow, token lock, CRM capability matrix, testing pattern, and error types are all covered. Concerns: (1) HubSpot public vs private app type must be confirmed before implementing OAuth — it changes the entire flow; (2) Zoho multi-DC apiBase bug in current code is a Sprint 2 blocker that must be fixed before any EU/IN/AU tenant goes live.
