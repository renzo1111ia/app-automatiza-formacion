import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./server";
import { getTenantExternalClient } from "./tenant-client";

/**
 * TENANT DATA ROUTER
 *
 * The single entry point for all data access in the multi-tenant system.
 * Automatically decides whether to query:
 *
 *   A) SUPABASE CENTRAL — tenant_id filtered (client stores data with ESDEN)
 *   B) SUPABASE EXTERNO — client's own Supabase project (full isolation)
 *
 * Usage:
 *   const { client, mode, tenantId } = await getTenantDataClient(tenantId);
 *   const { data } = await client.from("lead").select("*");
 *   // In CENTRAL mode: always add .eq("tenant_id", tenantId)
 *   // In EXTERNAL mode: no tenant_id filter needed (already isolated)
 */

export type TenantMode = "central" | "external";

export interface TenantDataClient {
    /** Ready-to-use Supabase client */
    client: SupabaseClient;
    /** "central" = shared DB with tenant_id filter | "external" = client's own DB */
    mode: TenantMode;
    /** The tenant UUID */
    tenantId: string;
    /**
     * Helper: applies tenant_id filter only when mode === "central".
     * Always use this instead of manually calling .eq("tenant_id", ...)
     *
     * Example:
     *   const query = client.from("lead").select("*")
     *   const filtered = applyTenantFilter(query)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyTenantFilter: (query: any) => any;
}

// In-memory cache: tenantId → { mode, supabaseUrl?, supabaseServiceKey? }
type TenantMeta = {
    mode: TenantMode;
    supabaseUrl?: string;
    supabaseServiceKey?: string;
    cachedAt: number;
};
const metaCache = new Map<string, TenantMeta>();
const META_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolves how to connect to a tenant's data layer.
 * Fetches tenant metadata from the Central Supabase (tenants table),
 * then caches it to avoid repeated DB lookups.
 */
interface TenantRow {
    id: string;
    supabase_url: string | null;
    config: Record<string, unknown> | null;
}

async function resolveTenantMeta(tenantId: string): Promise<TenantMeta> {
    const cached = metaCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < META_TTL_MS) {
        return cached;
    }

    const centralClient = await getSupabaseServerClient();
    const { data: tenant, error } = await centralClient
        .from("tenants")
        .select("id, supabase_url, config")
        .eq("id", tenantId)
        .returns<TenantRow[]>()
        .single();

    if (error || !tenant) {
        console.error(`[TENANT-ROUTER] Could not resolve tenant ${tenantId}:`, error?.message);
        // Fallback to central mode — safe default
        const meta: TenantMeta = { mode: "central", cachedAt: Date.now() };
        metaCache.set(tenantId, meta);
        return meta;
    }

    const config = (tenant as TenantRow).config;
    const supabaseUrl = (tenant as TenantRow).supabase_url;
    // service key stored inside config.supabase_service_key (not exposed in anon)
    const supabaseServiceKey = (config?.supabase_service_key as string) || null;

    const isExternal = !!(supabaseUrl && supabaseServiceKey);

    const meta: TenantMeta = {
        mode: isExternal ? "external" : "central",
        supabaseUrl: supabaseUrl ?? undefined,
        supabaseServiceKey: supabaseServiceKey ?? undefined,
        cachedAt: Date.now(),
    };

    metaCache.set(tenantId, meta);
    console.log(`[TENANT-ROUTER] Tenant ${tenantId} → mode: ${meta.mode}`);
    return meta;
}

/**
 * Main function — use this everywhere instead of getSupabaseServerClient().
 *
 * @param tenantId — The active tenant UUID (from cookie or parameter)
 * @returns TenantDataClient with routing metadata and filter helper
 */
export async function getTenantDataClient(tenantId: string): Promise<TenantDataClient> {
    const meta = await resolveTenantMeta(tenantId);

    let client: SupabaseClient;

    if (meta.mode === "external" && meta.supabaseUrl && meta.supabaseServiceKey) {
        client = getTenantExternalClient({
            tenantId,
            supabaseUrl: meta.supabaseUrl,
            supabaseServiceKey: meta.supabaseServiceKey,
        });
    } else {
        client = await getSupabaseServerClient();
    }

    /**
     * Applies `tenant_id` filter only in central mode.
     * In external mode the DB is already isolated — no filter needed.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyTenantFilter = (query: any): any => {
        if (meta.mode === "central") {
            return query.eq("tenant_id", tenantId);
        }
        return query;
    };

    return { client, mode: meta.mode, tenantId, applyTenantFilter };
}

/**
 * Invalidates the cached metadata for a tenant.
 * Call this after updating a tenant's Supabase credentials.
 */
export function invalidateTenantMeta(tenantId: string): void {
    metaCache.delete(tenantId);
    console.log(`[TENANT-ROUTER] Meta cache invalidated for tenant ${tenantId}`);
}
