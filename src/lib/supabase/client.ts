"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireEnv } from "@/lib/env";

/**
 * V2 Multi-Tenant Architecture: Single central Supabase instance.
 * All tenants share the same database. Row Level Security (RLS) enforces data isolation
 * using the tenant_id JWT claim passed through the session.
 *
 * This client always connects to the central Supabase project.
 * Tenant isolation is handled server-side via RLS — NOT via separate DB credentials.
 *
 * Sprint 0 tarea 1-04: sin fallback hardcoded. Las env vars NEXT_PUBLIC_* las
 * inlinea Next.js en build time — si faltan, el build falla con mensaje claro.
 */
export function getSupabaseClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient<Database>(url, key);
}
