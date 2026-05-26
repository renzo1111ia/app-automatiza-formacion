/**
 * Higher-Order Function `withRateLimit` para Server Actions críticas (SP-4-08).
 *
 * Sprint 3 phase-05 Hardening (4-08, informe Renzo §3 🔴).
 *
 * Problema: el middleware de Next.js NO intercepta Server Actions (viajan por POST a la
 * ruta de la página con header `Next-Action`). El rate limit global de /api/* no las cubre.
 * Generaliza el fix puntual de 1-27 (widget rateLimit) a cualquier Server Action que llama
 * a LLMs o realiza escrituras costosas (simulator, playground, knowledge embeddings, etc).
 *
 * Uso:
 *
 * ```ts
 * import { withRateLimit } from "@/lib/api/with-rate-limit";
 *
 * async function _generateSimulatorResponse(...args) { ... }
 *
 * export const generateSimulatorResponse = withRateLimit(_generateSimulatorResponse, {
 *   key: "simulator",
 *   perMinute: 10,
 *   identify: async () => {
 *     const tenantId = await getActiveTenantId();
 *     return tenantId; // identifica el bucket por tenant
 *   },
 * });
 * ```
 *
 * El wrapper devuelve `{ success: false, error: "Rate limit exceeded" }` con metadata
 * (`remaining`, `resetSec`) si se excede el límite. El consumidor (UI) muestra mensaje
 * al usuario.
 *
 * Detalles:
 * - Si `identify()` lanza (ej: no hay tenant en sesión), se asume "unknown" y se aplica
 *   un límite agresivo (1 req/min) para evitar abuso pre-auth.
 * - Falla open si Redis cae (ver `rate-limiter.ts` — política consciente).
 * - Tests: cada Server Action wrapped DEBE tener un test que verifica el rate limit.
 */

import { rateLimit, type RateLimitResult } from "@/lib/rate-limiter";

export interface WithRateLimitOptions<TArgs extends unknown[]> {
  /** Identificador del bucket. Usado como prefijo de la key Redis (`rl:sa:{key}:...`). */
  key: string;
  /** Máximo de invocaciones por minuto y por identidad. */
  perMinute: number;
  /**
   * Función que recibe los mismos args que la action y devuelve un identificador único
   * del bucket de rate limiting (ej: `tenantId`, `widgetId:ip`, `userId`).
   * Si lanza, se usa "unknown" + límite agresivo.
   */
  identify: (...args: TArgs) => Promise<string> | string;
}

export interface RateLimitedError {
  success: false;
  error: "rate_limit_exceeded";
  message: string;
  remaining: number;
  resetSec: number;
}

/**
 * Wrap una Server Action con rate limiting. Devuelve el resultado normal de la action
 * o un objeto `{ success: false, error: "rate_limit_exceeded", ... }` si se supera el límite.
 *
 * NOTA: si tu Server Action ya retorna un objeto con `success`, considera unirlos en el caller
 * (`if ("error" in result && result.error === "rate_limit_exceeded") { ... }`).
 */
export function withRateLimit<TArgs extends unknown[], TResult>(
  actionFn: (...args: TArgs) => Promise<TResult>,
  opts: WithRateLimitOptions<TArgs>
): (...args: TArgs) => Promise<TResult | RateLimitedError> {
  return async (...args: TArgs): Promise<TResult | RateLimitedError> => {
    let identity: string;
    let appliedLimit = opts.perMinute;
    try {
      identity = await opts.identify(...args);
      if (!identity) {
        identity = "unknown";
        appliedLimit = 1; // sin identidad: límite agresivo anti-abuso pre-auth
      }
    } catch {
      identity = "unknown";
      appliedLimit = 1;
    }

    const result: RateLimitResult = await rateLimit(
      `sa:${opts.key}:${identity}`,
      appliedLimit,
      60_000
    );

    if (!result.allowed) {
      return {
        success: false,
        error: "rate_limit_exceeded",
        message: `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil(result.resetMs / 1000)}s.`,
        remaining: 0,
        resetSec: Math.ceil(result.resetMs / 1000),
      };
    }

    return actionFn(...args);
  };
}
