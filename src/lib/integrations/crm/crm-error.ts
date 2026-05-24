/**
 * CRM error tipado unificado.
 *
 * Cada provider (HubSpot, Zoho) tiene formato propio de error. Para que el resto
 * del sistema reaccione de forma uniforme (retry, surface al usuario, audit),
 * los errores se mapean a `CRMError` con un `code` taxonomizado.
 *
 * Ref:
 *   plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §6
 */

export type CRMErrorCode =
  | "AUTH_FAILED" // 401 / 403 / invalid_grant — requiere re-auth
  | "RATE_LIMITED" // 429 — usar `retryAfterMs`
  | "NOT_FOUND" // 404 — record no existe en el CRM
  | "VALIDATION" // 422 / payload inválido
  | "NETWORK" // fetch falló / timeout
  | "PROVIDER_ERROR"; // 5xx — retryable

export interface CRMErrorOptions {
  code: CRMErrorCode;
  message: string;
  provider: string;
  retryable?: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

export class CRMError extends Error {
  readonly code: CRMErrorCode;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly originalError?: unknown;
  readonly provider: string;

  constructor(opts: CRMErrorOptions) {
    super(opts.message);
    this.name = "CRMError";
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
    this.originalError = opts.originalError;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

/** HubSpot HTTP status + body → `CRMError`. */
export function mapHubSpotError(status: number, body: unknown, provider = "hubspot"): CRMError {
  const b = (body ?? {}) as Record<string, unknown>;
  if (status === 401 || status === 403) {
    return new CRMError({
      code: "AUTH_FAILED",
      message: String(b.message ?? "HubSpot unauthorized"),
      provider,
    });
  }
  if (status === 404) {
    return new CRMError({ code: "NOT_FOUND", message: "HubSpot record not found", provider });
  }
  if (status === 429) {
    // HubSpot devuelve a veces `policyName` indicando DAILY (24h) vs second-level.
    const isDaily = b.policyName === "DAILY";
    const retryAfterMs = isDaily ? 86400000 : 10000;
    return new CRMError({
      code: "RATE_LIMITED",
      message: "HubSpot rate limited",
      provider,
      retryable: true,
      retryAfterMs,
    });
  }
  if (status === 422 || status === 400) {
    return new CRMError({
      code: "VALIDATION",
      message: String(b.message ?? "HubSpot validation error"),
      provider,
      originalError: b,
    });
  }
  if (status >= 500) {
    return new CRMError({
      code: "PROVIDER_ERROR",
      message: `HubSpot ${status}`,
      provider,
      retryable: true,
    });
  }
  return new CRMError({
    code: "PROVIDER_ERROR",
    message: `Unexpected status ${status}`,
    provider,
    originalError: b,
  });
}

/** Zoho HTTP status + body.code → `CRMError`. */
export function mapZohoError(status: number, body: unknown, provider = "zoho"): CRMError {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code : undefined;

  if (
    status === 401 ||
    code === "INVALID_TOKEN" ||
    code === "OAUTH_SCOPE_MISMATCH" ||
    code === "AUTHENTICATION_FAILURE"
  ) {
    return new CRMError({
      code: "AUTH_FAILED",
      message: String(b.message ?? "Zoho auth failed"),
      provider,
    });
  }
  if (status === 404 || code === "RECORD_NOT_FOUND") {
    return new CRMError({ code: "NOT_FOUND", message: "Zoho record not found", provider });
  }
  if (status === 429) {
    return new CRMError({
      code: "RATE_LIMITED",
      message: "Zoho rate limited",
      provider,
      retryable: true,
      retryAfterMs: 60000,
    });
  }
  if (code === "MANDATORY_NOT_FOUND" || code === "INVALID_DATA") {
    return new CRMError({
      code: "VALIDATION",
      message: String(b.message ?? "Zoho invalid data"),
      provider,
      originalError: b,
    });
  }
  if (status >= 500) {
    return new CRMError({
      code: "PROVIDER_ERROR",
      message: `Zoho ${status}`,
      provider,
      retryable: true,
    });
  }
  return new CRMError({
    code: "PROVIDER_ERROR",
    message: `Unexpected Zoho status ${status}`,
    provider,
    originalError: b,
  });
}

/** Helper para errores de red (fetch failed / timeout). */
export function networkError(provider: string, originalError: unknown): CRMError {
  return new CRMError({
    code: "NETWORK",
    message: "Network error contacting CRM",
    provider,
    retryable: true,
    originalError,
  });
}
