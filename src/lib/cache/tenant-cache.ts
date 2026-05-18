/**
 * TENANT CONFIG CACHE — Redis
 *
 * Caches tenant orchestrator configuration in Redis to avoid hitting
 * Supabase on every lead event. With 100+ clients and high-frequency
 * webhook calls, this is critical for performance and cost reduction.
 *
 * TTL: 5 minutes — balances freshness vs. DB load.
 * Invalidation: call invalidateTenantConfigCache(tenantId) after config updates.
 *
 * Requires: REDIS_URL env var (e.g. redis://localhost:6379)
 */

import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const CACHE_PREFIX = "esden:tenant:config:";

// Singleton Redis client
let redisClient: RedisClientType | null = null;
let connectionAttempted = false;

async function getRedisClient(): Promise<RedisClientType | null> {
    if (redisClient?.isOpen) return redisClient;
    if (connectionAttempted) return null;

    connectionAttempted = true;

    try {
        const isTLS = REDIS_URL.startsWith("rediss://");

        const client = createClient({
            url: REDIS_URL,
            socket: isTLS ? {
                tls: true,
                rejectUnauthorized: false,
            } : undefined,
        }) as RedisClientType;

        client.on("error", (err: Error) => {
            console.warn("[TENANT-CACHE] Redis error:", err.message);
        });

        await client.connect();
        redisClient = client;
        console.log(`[TENANT-CACHE] Redis connected (${isTLS ? "TLS/Upstash" : "local"})`);
        return redisClient;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[TENANT-CACHE] Redis unavailable — falling back to DB:", msg);
        return null;
    }
}

/**
 * Gets a cached value for a tenant config key.
 * Returns null if Redis is unavailable or key doesn't exist.
 */
export async function getTenantConfigCache<T>(tenantId: string, key: string): Promise<T | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const cacheKey = `${CACHE_PREFIX}${tenantId}:${key}`;
        const raw = await redis.get(cacheKey);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch (err) {
        console.warn("[TENANT-CACHE] Read error:", err);
        return null;
    }
}

/**
 * Stores a value in the tenant config cache.
 * Silently skips if Redis is unavailable.
 */
export async function setTenantConfigCache<T>(
    tenantId: string,
    key: string,
    value: T,
    ttlSeconds = CACHE_TTL_SECONDS
): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
        const cacheKey = `${CACHE_PREFIX}${tenantId}:${key}`;
        await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        console.warn("[TENANT-CACHE] Write error:", err);
    }
}

/**
 * Invalidates ALL cached config keys for a specific tenant.
 * Call this whenever a tenant's configuration is updated.
 */
export async function invalidateTenantConfigCache(tenantId: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
        const pattern = `${CACHE_PREFIX}${tenantId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[TENANT-CACHE] Invalidated ${keys.length} keys for tenant ${tenantId}`);
        }
    } catch (err) {
        console.warn("[TENANT-CACHE] Invalidation error:", err);
    }
}

/**
 * Utility: wraps a DB fetch function with Redis caching.
 * If cache miss → calls fetcher → stores result → returns.
 *
 * Usage:
 *   const config = await withTenantCache(tenantId, "orch_config", () =>
 *     getOrchestratorConfigForTenant(tenantId)
 *   );
 */
export async function withTenantCache<T>(
    tenantId: string,
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = CACHE_TTL_SECONDS
): Promise<T> {
    // Try cache first
    const cached = await getTenantConfigCache<T>(tenantId, key);
    if (cached !== null) {
        console.log(`[TENANT-CACHE] HIT: ${tenantId}:${key}`);
        return cached;
    }

    // Cache miss — fetch from DB
    console.log(`[TENANT-CACHE] MISS: ${tenantId}:${key} → fetching from DB`);
    const result = await fetcher();

    // Store in cache (non-blocking)
    setTenantConfigCache(tenantId, key, result, ttlSeconds).catch(() => {});

    return result;
}
