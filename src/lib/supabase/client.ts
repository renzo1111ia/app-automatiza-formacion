"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * V2 Multi-Tenant Architecture: Single central Supabase instance.
 * All tenants share the same database. Row Level Security (RLS) enforces data isolation
 * using the tenant_id JWT claim passed through the session.
 *
 * This client always connects to the central Supabase project.
 * Tenant isolation is handled server-side via RLS — NOT via separate DB credentials.
 *
 * 13-06-2026 (Sprint 8): migrado de `createClient` (@supabase/supabase-js) a
 * `createBrowserClient` (@supabase/ssr). El cliente plano NO leía la sesión de
 * las cookies SSR que escribe el login (auth.ts usa createServerClient), así que
 * las queries client-side iban con solo la anon key (sin JWT) y la RLS las
 * bloqueaba — devolvían []. Síntoma visible: /dashboard/costs sin datos en local.
 * createBrowserClient lee esas cookies y propaga el JWT de sesión → la RLS deja
 * ver las filas del tenant autenticado. Afecta a TODA lectura client-side con RLS.
 *
 * 24-05-2026: acceso DIRECTO a process.env.NEXT_PUBLIC_* (Next.js sólo bakea
 * estos valores con acceso literal, no via lookup dinámico). En browser bundles
 * `requireEnv("NEXT_PUBLIC_X")` resolvía a undefined. Ver auth-config.ts (702d4a3).
 */
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseClient() {
  const url = PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient<Database>(url, key);
}
