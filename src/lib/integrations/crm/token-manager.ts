/**
 * TokenManager — cache in-process + dedup de refreshes concurrentes + DB writeback.
 *
 * Problema que resuelve:
 *   - El antiguo `factory.ts` cacheaba la instance del provider con el `accessToken`
 *     embebido. Si N requests concurrentes encuentran token expirado, las N llaman
 *     a refresh → race → 1 gana, las otras N-1 reciben `invalid_grant` del provider.
 *   - Cuando el provider refrescaba en memoria, NO persistía el nuevo `refresh_token`
 *     (Zoho/HubSpot a veces rotan refresh_token). En cold start (redeploy) cargaba
 *     el viejo de DB y moría.
 *
 * Diseño:
 *   - `tokenCache: Map<integrationId, TokenState>` con TTL implícito por `expiresAt`.
 *   - `refreshInFlight: Map<integrationId, Promise<TokenState>>` deduplica refreshes
 *     simultáneos sobre la misma integración (lock in-process).
 *   - `doRefresh()` lee DB → decrypta → llama provider refresh → cifra → persiste DB.
 *
 * Escalado horizontal (post-MVP):
 *   - Sustituir `refreshInFlight` Map por un Redis lock `SET NX EX 30`. La interface
 *     `getValidTokens` no cambia. No añadir Redis al MVP (YAGNI).
 *
 * Ref:
 *   plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §5
 */

import { decryptJson, encryptJson } from "@/lib/crypto/token-crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

// ───────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────

export interface TokenState {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms del momento de expiración del access_token. */
  expiresAt: number;
  /** Base URL de la API del provider (Zoho multi-DC: api_domain). */
  apiBase: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiBase: string;
}

/**
 * Función que cada provider implementa para refrescar tokens vía su endpoint OAuth.
 * Recibe las credenciales actuales (descifradas) + apiBase actual.
 * Devuelve los nuevos tokens. Si el refresh_token rotó, devuelve el nuevo.
 */
export type RefreshCallback = (current: {
  accessToken: string;
  refreshToken: string;
  apiBase: string;
}) => Promise<RefreshResult>;

// ───────────────────────────────────────────────────────────────────────────
// Module-level cache + refresh lock
// ───────────────────────────────────────────────────────────────────────────

const tokenCache = new Map<string, TokenState>();
const refreshInFlight = new Map<string, Promise<TokenState>>();

/**
 * Margen antes del expiry real para considerar el token "a punto de caducar".
 * 5 minutos cubre clock drift + latencia del request HTTP.
 */
const BUFFER_MS = 5 * 60 * 1000;

/**
 * Provider-refresh registry: cada `crm_type` se registra una vez al boot
 * (en `providers/hubspot.ts` y `providers/zoho.ts` via import side-effect),
 * y aquí se busca por tipo cuando hay que refrescar.
 */
const providerRefreshers = new Map<string, RefreshCallback>();

export function registerRefresher(crmType: string, fn: RefreshCallback): void {
  providerRefreshers.set(crmType, fn);
}

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Devuelve tokens válidos (no caducados) para la integración.
 * - Si están cacheados y vigentes: devuelve cache.
 * - Si caducados o a punto de caducar (<5min): dispara refresh.
 * - Si ya hay un refresh in-flight para esta integración: espera al existente
 *   (deduplica = lock in-process).
 */
export async function getValidTokens(integrationId: string): Promise<TokenState> {
  if (!integrationId) throw new Error("getValidTokens: integrationId requerido");

  const cached = tokenCache.get(integrationId);
  if (cached && Date.now() < cached.expiresAt - BUFFER_MS) {
    return cached;
  }

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

/**
 * Limpia cache para una integración (e.g. tras un disconnect o force-rotate).
 * No afecta a DB ni dispara llamadas remotas.
 */
export function invalidateToken(integrationId: string): void {
  tokenCache.delete(integrationId);
}

/** Helper de tests: limpia TODO el estado in-memory. NO usar en prod. */
export function __resetTokenManagerForTests(): void {
  tokenCache.clear();
  refreshInFlight.clear();
}

// ───────────────────────────────────────────────────────────────────────────
// Internal
// ───────────────────────────────────────────────────────────────────────────

interface IntegrationRow {
  id: string;
  crm_type: string;
  data_center: string | null;
  credentials_cipher: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

async function doRefresh(integrationId: string): Promise<TokenState> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("integrations")
    .select("id, crm_type, data_center, credentials_cipher, expires_at, metadata")
    .eq("id", integrationId)
    .single();

  if (error || !data) {
    throw new Error(`Integration ${integrationId} not found: ${error?.message ?? "no row"}`);
  }

  const row = data as IntegrationRow;
  if (!row.credentials_cipher) {
    throw new Error(`Integration ${integrationId} has no credentials_cipher`);
  }

  const creds = decryptJson<{ accessToken: string; refreshToken: string }>(row.credentials_cipher);
  const currentApiBase = resolveApiBase(row.crm_type, row.data_center, row.metadata ?? {});

  const refresher = providerRefreshers.get(row.crm_type);
  if (!refresher) {
    throw new Error(
      `No refresh callback registered for crm_type='${row.crm_type}'. ` +
        `Provider should call registerRefresher() at module import.`
    );
  }

  const refreshed = await refresher({
    accessToken: creds.accessToken,
    refreshToken: creds.refreshToken,
    apiBase: currentApiBase,
  });

  const newCipher = encryptJson({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  });

  const updatePayload: Record<string, unknown> = {
    credentials_cipher: newCipher,
    expires_at: new Date(refreshed.expiresAt).toISOString(),
  };
  // Persistir api_domain rotado (Zoho multi-DC) en metadata si cambió.
  if (refreshed.apiBase && refreshed.apiBase !== currentApiBase) {
    const existingMeta = row.metadata ?? {};
    updatePayload.metadata = { ...existingMeta, api_domain: refreshed.apiBase };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await supabase
    .from("integrations")
    .update(updatePayload)
    .eq("id", integrationId);

  if (updateErr) {
    // No rompemos el flujo principal — el token in-memory ya es válido — pero log.
    console.error(`[TokenManager] DB writeback failed for ${integrationId}:`, updateErr.message);
  }

  return refreshed;
}

/**
 * Resuelve la API base a usar:
 *   - Zoho: prefiere `metadata.api_domain` (vino del token response).
 *     Si no, mapeo por `data_center`. Default US.
 *   - HubSpot: única región (`api.hubspot.com`).
 *   - Otros: throw (no debería llamarse desde token-manager para providers no-OAuth).
 */
export function resolveApiBase(
  crmType: string,
  dataCenter: string | null,
  metadata: Record<string, unknown>
): string {
  if (crmType === "zoho") {
    const fromToken = metadata?.api_domain;
    if (typeof fromToken === "string" && fromToken.length > 0) return fromToken;
    return zohoDcApiBase(dataCenter);
  }
  if (crmType === "hubspot") return "https://api.hubapi.com";
  throw new Error(`resolveApiBase: crm_type='${crmType}' not supported`);
}

function zohoDcApiBase(dc: string | null): string {
  const map: Record<string, string> = {
    us: "https://www.zohoapis.com",
    eu: "https://www.zohoapis.eu",
    in: "https://www.zohoapis.in",
    au: "https://www.zohoapis.com.au",
    jp: "https://www.zohoapis.jp",
    cn: "https://www.zohoapis.com.cn",
  };
  return map[dc ?? "us"] ?? map.us;
}
