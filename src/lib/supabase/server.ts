import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireEnv, requireEnvAny } from "@/lib/env";

/**
 * Returns the currently active tenant_id from the cookie.
 */
export async function getActiveTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("esden-tenant-id")?.value;
  if (cookieVal) return cookieVal;

  try {
    const supabase = await getAdminSupabaseClient();
    const { data } = (await supabase
      .from("tenants")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };

    if (data?.id) return data.id;
  } catch (err) {
    console.error("[getActiveTenantId] Error falling back to default tenant:", err);
  }
  return null;
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
  const key = requireEnvAny([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
