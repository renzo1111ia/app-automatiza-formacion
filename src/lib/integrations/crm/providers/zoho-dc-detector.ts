/**
 * Zoho multi-datacenter detector.
 *
 * Zoho tiene 9 data centers (US/EU/IN/AU/JP/CA/SA/UK/CN) — cada uno con su
 * propio `accounts.zoho.{ext}` y `www.zohoapis.{ext}`. El DC del tenant viene
 * en los params del OAuth callback (`location=eu&accounts-server=...`).
 *
 * Refs:
 *   - https://www.zoho.com/crm/developer/docs/api/v8/multi-dc.html
 *   - plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-02-zoho-multidc.md §1, §2, §9
 */

/** Mapa location → accounts server URL. */
export const LOCATION_TO_ACCOUNTS: Record<string, string> = {
  us: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.com.au",
  jp: "https://accounts.zoho.jp",
  ca: "https://accounts.zohocloud.ca",
  sa: "https://accounts.zoho.sa",
  uk: "https://accounts.zoho.uk",
  cn: "https://accounts.zoho.com.cn",
};

/** Default DC cuando el callback no trae info (fallback conservador). */
export const DEFAULT_LOCATION = "us";

export interface ZohoDCContext {
  /** ej. "eu", "us", "in" — tal como Zoho lo envía en `?location=`. */
  location: string;
  /** ej. "https://accounts.zoho.eu". Viene del callback (`?accounts-server=...`). */
  accountsServer: string;
}

/**
 * Extrae `{ location, accountsServer }` del query del callback OAuth.
 *
 * Zoho envía:
 *   ?code=...&state=...&location=eu&accounts-server=https%3A%2F%2Faccounts.zoho.eu
 *
 * Si falta info → cae a default US (caller debe validar antes de invocar).
 */
export function extractDCFromCallback(params: URLSearchParams): ZohoDCContext {
  const location = (params.get("location") || DEFAULT_LOCATION).toLowerCase();
  const callbackAccounts = params.get("accounts-server");
  const accountsServer =
    callbackAccounts && /^https:\/\//.test(callbackAccounts)
      ? callbackAccounts
      : (LOCATION_TO_ACCOUNTS[location] ?? LOCATION_TO_ACCOUNTS[DEFAULT_LOCATION]);
  return { location, accountsServer };
}

export interface ExchangeCodeOptions {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsServer: string;
}

export interface ZohoTokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  apiDomain: string; // viene en el response del token exchange
  scope: string[];
}

/**
 * POST {accountsServer}/oauth/v2/token grant_type=authorization_code.
 *
 * Devuelve tokens + `api_domain` (clave para multi-DC: futuras llamadas API van
 * a ese host, NO al default US). Caller persiste `api_domain` + `accountsServer`
 * en `integrations.metadata`.
 */
export async function exchangeCodeForTokens(
  opts: ExchangeCodeOptions
): Promise<ZohoTokenExchangeResult> {
  const tokenUrl = `${opts.accountsServer}/oauth/v2/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Zoho token exchange failed (${res.status}): ${data.error ?? res.statusText}`);
  }

  const accessToken = String(data.access_token ?? "");
  const refreshToken = String(data.refresh_token ?? "");
  const apiDomain = String(data.api_domain ?? "");
  const expiresIn = Number(data.expires_in ?? 3600);
  const scope = String(data.scope ?? "")
    .split(/[ ,]+/)
    .filter(Boolean);

  if (!accessToken || !refreshToken || !apiDomain) {
    throw new Error("Zoho token exchange response missing access_token/refresh_token/api_domain");
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    apiDomain,
    scope,
  };
}

/**
 * Refresca el access_token contra el DC correcto.
 * Zoho NO rota refresh_token automáticamente — se queda fijo hasta revoke.
 */
export interface RefreshTokenOptions {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  accountsServer: string;
}

export interface ZohoRefreshResult {
  accessToken: string;
  refreshToken?: string; // Zoho típicamente NO devuelve nuevo refresh, pero si lo hace, lo persistimos.
  expiresAt: number;
  apiDomain?: string;
}

export async function refreshAccessToken(opts: RefreshTokenOptions): Promise<ZohoRefreshResult> {
  const tokenUrl = `${opts.accountsServer}/oauth/v2/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Zoho refresh failed (${res.status}): ${data.error ?? res.statusText}`);
  }

  const accessToken = String(data.access_token ?? "");
  if (!accessToken) throw new Error("Zoho refresh response missing access_token");
  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    accessToken,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expiresAt: Date.now() + expiresIn * 1000,
    apiDomain: typeof data.api_domain === "string" ? data.api_domain : undefined,
  };
}
