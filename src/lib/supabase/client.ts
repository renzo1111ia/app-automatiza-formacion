"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * V2 Multi-Tenant Architecture: Single central Supabase instance.
 * All tenants share the same database. Row Level Security (RLS) enforces data isolation
 * using the tenant_id JWT claim passed through the session.
 *
 * This client always connects to the central Supabase project.
 * Tenant isolation is handled server-side via RLS — NOT via separate DB credentials.
 *
 * 24-05-2026: refactor para usar acceso DIRECTO a process.env.NEXT_PUBLIC_*.
 * Next.js sólo bakea estos valores cuando se accede de forma literal
 * (`process.env.NEXT_PUBLIC_X`), NO via lookup dinámico `process.env[name]`.
 * En browser bundles, `requireEnv("NEXT_PUBLIC_X")` resolvía a undefined porque
 * `process.env` está vacío en runtime — sólo los valores bakeados existen.
 * Ver bug paralelo arreglado en src/lib/auth-config.ts (commit 702d4a3).
 */
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseClient() {
  if (!PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL.trim() === "") {
    throw new Error(
      "Missing required env: NEXT_PUBLIC_SUPABASE_URL. " +
        "Debe ser un Build Arg en Dokploy (no solo Environment) para que Next.js lo bakee en el bundle browser."
    );
  }
  if (!PUBLIC_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY.trim() === "") {
    throw new Error(
      "Missing required env: NEXT_PUBLIC_SUPABASE_ANON_KEY. " + "Debe ser un Build Arg en Dokploy."
    );
  }
  return createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}
