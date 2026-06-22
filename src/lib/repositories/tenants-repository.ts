// Sprint 1 — Bloque 2.3 (tarea 2-14) Repository de tenants.

import type { Tenant, CreateTenant, UpdateTenant } from "@/lib/schemas/tenants";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";

const TABLE = "tenants";

export class TenantsRepository {
  async findAll(): Promise<RepoListResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("name", { ascending: true });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Tenant[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string): Promise<RepoResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Tenant) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async findByApiKey(apiKey: string): Promise<RepoResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("api_key", apiKey)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Tenant) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async findByAuthUserId(authUserId: string): Promise<RepoResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Tenant) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(data: CreateTenant): Promise<RepoResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
       
      const { data: inserted, error } = await supabase.from(TABLE).insert(data).select().single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as Tenant, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(id: string, data: UpdateTenant): Promise<RepoResult<Tenant>> {
    try {
      const supabase = await getAdminSupabaseClient();
       
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as Tenant, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export const tenantsRepository = new TenantsRepository();
