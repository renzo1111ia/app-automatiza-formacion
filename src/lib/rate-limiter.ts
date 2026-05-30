/**
 * Rate limiter — sliding window con Redis (ioredis).
 *
 * Sprint 3 phase-05 Hardening (4-06).
 *
 * RUNTIME: Node.js únicamente (ioredis requiere TCP sockets). NO usar en middleware
 * Edge ni en Edge route handlers. Apto para API Routes Node + Server Actions.
 *
 * Algoritmo: counter window con TTL automático.
 * - Cada ventana de `windowMs` tiene una key separada: `rl:{key}:{floor(now/windowMs)}`.
 * - Pipeline INCR + PEXPIRE en una sola roundtrip Redis (O(1)).
 * - Coste por check: ~1-2ms en local Redis, ~5-10ms con Redis remoto.
 *
 * Convención de keys:
 * - `rl:ip:{ip}:{bucket}` — rate limit por IP en /api/{bucket}/*
 * - `rl:widget:{widget_id}:{ip}` — rate limit anti-abuso del widget público
 * - `rl:sa:{action_name}:{tenant_id}` — rate limit Server Actions tenant-scoped (4-08)
 *
 * Prefijo `rl:` separa estas keys del namespace BullMQ (`bull:*`).
 */

import { Redis } from "ioredis";

/* eslint-disable @typescript-eslint/no-explicit-any -- global cache fallback typed loosely */
declare global {
  var __af_rate_limiter_redis: Redis | undefined;
}

function getRedisClient(): Redis {
  // Reutilizar conexión global en dev (evita leak de conexiones en HMR de Next.js).
  if (globalThis.__af_rate_limiter_redis) return globalThis.__af_rate_limiter_redis;

  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 2000),
  });

  client.on("error", (err) => {
    // No log spam: solo primer error de cada minuto.
    if (
      !(globalThis as any).__af_rl_last_err ||
      Date.now() - (globalThis as any).__af_rl_last_err > 60_000
    ) {
      console.warn(`[rate-limiter] Redis error: ${err.message}`);
      (globalThis as any).__af_rl_last_err = Date.now();
    }
  });

  globalThis.__af_rate_limiter_redis = client;
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

/**
 * Timeout duro para operaciones Redis. Si ioredis no responde en este tiempo
 * (ej. ECONNRESET con retryStrategy reconectando), `rateLimit()` hace fail-open
 * inmediato — NUNCA bloquea al usuario > 100ms.
 *
 * Detectado en /e2etotal local 27-05-2026 (run 260527-2056): Redis ECONNRESET
 * dejó loginAction colgado >1.5min porque ioredis reconectaba bloqueante.
 * El comportamiento fail-open conceptualmente correcto necesitaba timeout
 * duro para garantizar UX.
 */
const RATE_LIMIT_TIMEOUT_MS = 100;

/**
 * Aplica un rate limit y retorna si la request actual está dentro del límite.
 *
 * Si Redis falla (conexión caída, timeout), retorna `{ allowed: true }` — fail-open.
 * Esto es decisión consciente: NO bloqueamos al usuario por un fallo de infra del rate limiter.
 * Los logs Pino capturan el fallo para investigación post-incident.
 *
 * @param key Identificador único del bucket (ej: `ip:1.2.3.4:auth`, `widget:abc123:1.2.3.4`).
 * @param limit Máximo de requests permitidas en la ventana.
 * @param windowMs Tamaño de la ventana en milisegundos (típicamente 60_000 = 1 min).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const redis = getRedisClient();
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const windowKey = `rl:${key}:${bucket}`;
    const ttlMs = windowMs - (now % windowMs);

    const pipe = redis.pipeline();
    pipe.incr(windowKey);
    pipe.pexpire(windowKey, ttlMs);

    // Promise.race con timeout duro: si Redis reconecta o tarda > RATE_LIMIT_TIMEOUT_MS,
    // forzamos fail-open inmediato. Detectado en /e2etotal local 27-05-2026 cuando
    // ioredis ECONNRESET dejaba loginAction colgado >1.5min reintentando reconexión.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`rate-limit timeout >${RATE_LIMIT_TIMEOUT_MS}ms`)),
        RATE_LIMIT_TIMEOUT_MS
      )
    );

    const results = await Promise.race([pipe.exec(), timeoutPromise]);
    const count = (results?.[0]?.[1] as number) ?? 1;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetMs: ttlMs,
      limit,
    };
  } catch (err) {
    // Fail-open: NO bloquear al usuario si el rate limiter está caído O lento.
    console.warn(
      `[rate-limiter] check failed for ${key}, allowing through:`,
      err instanceof Error ? err.message : err
    );
    return { allowed: true, remaining: limit, resetMs: windowMs, limit };
  }
}

/**
 * Extrae la IP del request de forma defensiva.
 *
 * BUG-SEC-01 fix (29-05-2026): prioriza `X-Real-IP` sobre `X-Forwarded-For`.
 * Razón: en el stack AF, traefik (Dokploy) inyecta `X-Real-IP` desde la conexión TCP
 * real y la sobreescribe en cada hop. `X-Forwarded-For` lo puede falsificar el cliente
 * añadiendo el header antes — traefik solo lo concatena. Si el proceso Node se expone
 * directamente sin traefik (dev local), `X-Real-IP` no llega y caemos al fallback XFF
 * con conciencia explícita de que en ese caso el header puede ser falsificable.
 *
 * Pre-fix: leer XFF primero abría puerta a IP spoofing por bypass del bucket rate-limit
 * (ver `plans/reports/security-delta-sprint-3-20260528.md` § BUG-SEC-01).
 *
 * Nunca falla; retorna "unknown" si no hay ningún header útil.
 */
export function extractClientIp(request: Request): string {
  // X-Real-IP: inyectado por el proxy de confianza desde la conexión TCP. No propagable.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }
  // Fallback: X-Forwarded-For (primer hop = cliente). Solo de fiar si NO está expuesto
  // directo (sin proxy). En producción Dokploy traefik fija X-Real-IP y este path no se usa.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
