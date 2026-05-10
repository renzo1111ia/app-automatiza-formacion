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
 */
export function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-db.automatizaformacion.com";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZzJZGBn42ZpSlp3q42X4O48wWjciQQts4ftXVch4od8";

    if (!url || !key || url.includes("placeholder")) {
        console.error("SUPABASE CLIENT ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
        return createClient<Database>("https://api-db.automatizaformacion.com", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZzJZGBn42ZpSlp3q42X4O48wWjciQQts4ftXVch4od8");
    }

    return createClient<Database>(url, key);
}
