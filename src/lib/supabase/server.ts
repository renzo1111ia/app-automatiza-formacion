import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireEnv, requireEnvAny } from "@/lib/env";

/**
 * Returns the currently active tenant_id from the cookie.
 */
export async function getActiveTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("esden-tenant-id")?.value || null;
}

/**
 * Server-side Supabase client (anon key — RLS aplica).
 * Sprint 0 tarea 1-04: sin fallback hardcoded. Si las env vars no están
 * configuradas, falla explícitamente al primer uso.
 */
export async function getSupabaseServerClient() {
  const url = requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const key = requireEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Admin Supabase client (service_role — bypasses RLS).
 * Sprint 0 tarea 1-04: sin fallback hardcoded.
 */
export async function getAdminSupabaseClient() {
  const url = requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
