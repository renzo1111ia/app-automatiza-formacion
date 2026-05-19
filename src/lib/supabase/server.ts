import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Fallback credentials for production safety
const FALLBACK_URL = "https://api-db.automatizaformacion.com";
const FALLBACK_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.dc0tXGNDPsriOwj6qR9dbJm-GffhvoNTBhl88YEB_hg";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZzJZGBn42ZpSlp3q42X4O48wWjciQQts4ftXVch4od8";

/**
 * Returns the currently active tenant_id from the cookie.
 */
export async function getActiveTenantId(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        return cookieStore.get("esden-tenant-id")?.value || process.env.ACTIVE_TENANT_ID || null;
    } catch {
        return process.env.ACTIVE_TENANT_ID || null;
    }
}

/**
 * Server-side Supabase client.
 */
export async function getSupabaseServerClient() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

/**
 * Admin Supabase client with Service Role.
 */
export async function getAdminSupabaseClient() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || FALLBACK_SERVICE_KEY;

    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
