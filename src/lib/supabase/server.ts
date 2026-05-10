import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const PLACEHOLDER_URL = "https://api-db.automatizaformacion.com";
const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZzJZGBn42ZpSlp3q42X4O48wWjciQQts4ftXVch4od8";
const REAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.dc0tXGNDPsriOwj6qR9dbJm-GffhvoNTBhl88YEB_hg";

/**
 * Returns the currently active tenant_id from the cookie.
 */
export async function getActiveTenantId(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get("esden-tenant-id")?.value || null;
}

/**
 * V2 Server-side Supabase client with ULTIMATE Diagnostic Logs.
 */
export async function getSupabaseServerClient() {
    try {
        // We try both prefixed and non-prefixed for maximum compatibility in Dokploy
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        const key = serviceKey || anonKey;

        // EMERGENCY LOG: List all keys starting with SUPABASE or NEXT_PUBLIC
        const allKeys = Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("NEXT_PUBLIC"));
        console.log(`[SUPABASE_DIAGNOSTIC] Available Env Vars: ${allKeys.join(", ")}`);
        console.log(`[SUPABASE_INFO] URL: ${url ? 'FOUND' : 'MISSING'}`);

        if (!url || !key || url.includes("placeholder")) {
            console.error("[SUPABASE_CLIENT] ERROR: Missing credentials. Using Hardcoded Fallback.");
            return createClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
        }

        return createClient<Database>(url, key, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    } catch (error) {
        console.error("[SUPABASE_CLIENT] CRITICAL EXCEPTION:", error);
        return createClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
    }
}

/**
 * Admin Supabase client with redundant variable checking.
 */
export async function getAdminSupabaseClient() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) console.error("[ADMIN_CLIENT] ERROR: Missing URL (Checked SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL)");
    if (!key) console.error("[ADMIN_CLIENT] ERROR: Missing SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !key || url.includes("placeholder")) {
        console.error("[ADMIN_CLIENT] ERROR: Missing URL or KEY. Using Hardcoded Fallback.");
        return createClient<Database>(PLACEHOLDER_URL, REAL_SERVICE_KEY);
    }

    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
