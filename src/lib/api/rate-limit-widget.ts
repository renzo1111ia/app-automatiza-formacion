/**
 * Sprint 0 tarea 1-27: Rate limit por (widgetId, IP) para el Widget Chatbot.
 *
 * Origen: Informe técnico de Renzo Módulo Chatbot Web V1 §3 🔴.
 * Documentación: plans/260520-1342-sprint-0-hotfixes-seguridad/phase-06-otros-criticos.md §1-27.
 *
 * Implementación: sliding window simple sobre Redis usando INCR + EXPIRE (atómico
 * con MULTI). Reusa ioredis ya en stack vía BullMQ (no añade dep nueva).
 *
 * Política ante errores de Redis:
 *   ALLOW + log. El rate limit es defense-in-depth, no la única capa de protección.
 *   Si Redis está caído por un fallo transitorio, no queremos romper el flujo del
 *   widget en producción. En 4-08 (Sprint 3) el wrapper genérico podrá refinar
 *   esta política con circuit breaker.
 */

import IORedis from 'ioredis';

let sharedClient: IORedis | null = null;

function getRedisClient(): IORedis | null {
  if (sharedClient) return sharedClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const isTLS = url.startsWith('rediss://');
    sharedClient = new IORedis({
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      ...(isTLS && { tls: {} }),
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });
    sharedClient.on('error', err => {
      console.warn('[rate-limit-widget] redis error:', err.message);
    });
    return sharedClient;
  } catch {
    return null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Cuando `degraded === true` significa que Redis falló y se aplicó fallback ALLOW. */
  degraded?: boolean;
}

/**
 * Comprueba (e incrementa) el contador de peticiones para `widgetId:clientIp`.
 * Devuelve `{ allowed: false }` si se ha excedido `perMinute`.
 *
 * Si Redis no está disponible o falla: ALLOW con `degraded: true` (log de aviso).
 */
export async function rateLimitWidget(
  widgetId: string,
  clientIp: string,
  perMinute: number,
): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(perMinute));
  const client = getRedisClient();
  if (!client) {
    return { allowed: true, remaining: safeLimit, degraded: true };
  }

  const key = `rl:widget:${widgetId}:${clientIp}`;
  try {
    const [incrRes, expireRes] = (await client
      .multi()
      .incr(key)
      .expire(key, 60, 'NX' as never) // sólo setea TTL si no existe (preserva ventana)
      .exec()) as [[Error | null, number], [Error | null, number]] | null ?? [];

    const incrErr = incrRes?.[0] ?? null;
    const count = (incrRes?.[1] as number) ?? 0;
    if (incrErr) throw incrErr;
    void expireRes;

    if (count > safeLimit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, safeLimit - count) };
  } catch (err) {
    console.warn(
      '[rate-limit-widget] redis op failed, fallback ALLOW:',
      err instanceof Error ? err.message : String(err),
    );
    return { allowed: true, remaining: safeLimit, degraded: true };
  }
}

/**
 * Sólo para tests. Cierra el cliente Redis compartido para no dejar conexiones
 * abiertas tras ejecutar la suite.
 */
export async function __closeRateLimitClient(): Promise<void> {
  if (sharedClient) {
    try {
      await sharedClient.quit();
    } catch {
      sharedClient.disconnect();
    }
    sharedClient = null;
  }
}
