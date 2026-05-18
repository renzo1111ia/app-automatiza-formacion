import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * TENANT CLIENT — Dynamic per-tenant Supabase connection
 *
 * Creates a Supabase client targeting the tenant's OWN Supabase project.
 * This is used when `supabase_url` and `supabase_service_key` are stored
 * in the tenant record (i.e., the client opted for their own Supabase).
 *
 * SECURITY: Uses the service_role key stored encrypted in the tenant config.
 * The client Supabase has RLS enabled — only service_role can read/write.
 */

// Cache per tenant to avoid creating a new client on every request
const clientCache = new Map<string, { client: SupabaseClient; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TenantConnectionConfig {
    tenantId: string;
    supabaseUrl: string;
    supabaseServiceKey: string; // service_role key of the CLIENT's Supabase
}

/**
 * Returns a cached Supabase client for a specific tenant's external Supabase.
 * Automatically refreshes after TTL.
 */
export function getTenantExternalClient(config: TenantConnectionConfig): SupabaseClient {
    const cached = clientCache.get(config.tenantId);
    const now = Date.now();

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
        return cached.client;
    }

    const client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: {
                // Custom header to identify requests from ESDEN
                "x-esden-tenant": config.tenantId,
            },
        },
    });

    clientCache.set(config.tenantId, { client, cachedAt: now });
    console.log(`[TENANT-CLIENT] Created client for tenant ${config.tenantId} → ${config.supabaseUrl}`);

    return client;
}

/**
 * Clears the cached client for a tenant (call when credentials change).
 */
export function invalidateTenantClient(tenantId: string): void {
    clientCache.delete(tenantId);
    console.log(`[TENANT-CLIENT] Cache invalidated for tenant ${tenantId}`);
}

/**
 * Tests connectivity to a tenant's external Supabase.
 * Returns { ok: true } if the connection works, { ok: false, error } otherwise.
 */
export async function testTenantConnection(
    supabaseUrl: string,
    supabaseServiceKey: string
): Promise<{ ok: boolean; error?: string }> {
    try {
        const client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // Simple query — checks if the `lead` table exists and is accessible
        const { error } = await client.from("lead").select("id").limit(1);

        if (error) {
            // PGRST116 = no rows returned (table exists but empty) → OK
            if (error.code === "PGRST116") return { ok: true };
            return { ok: false, error: error.message };
        }

        return { ok: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { ok: false, error: msg };
    }
}
