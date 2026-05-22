// Sprint 1 — Bloque 2.3 (tarea 2-13) Repository de leads.
// Tabla: public.lead (campos en español, ver VARIABLES DEFINIDAS).
// Todos los métodos son tenant-scoped vía withTenantFilter.

import type { Lead, CreateLead, UpdateLead } from "@/lib/schemas/leads";
import { LeadStageEnum } from "@/lib/schemas/_base";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import {
  type IRepository,
  type RepoResult,
  type RepoListResult,
  type PaginationParams,
  handleSupabaseError,
  paginate,
} from "./_base-repository";

const TABLE = "lead";

export interface LeadFilters extends PaginationParams {
  stage?: string;
  origen?: string;
  campana?: string;
  isAiPaused?: boolean;
  search?: string; // texto en nombre/apellido/telefono/email
}

export class LeadsRepository implements IRepository<Lead, CreateLead, UpdateLead> {
  async findByTenant(tenantId: string, filters?: LeadFilters): Promise<RepoListResult<Lead>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { from, to } = paginate(filters);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(TABLE).select("*", { count: "exact" }).eq("tenant_id", tenantId);
      if (filters?.stage) q = q.eq("current_stage", filters.stage);
      if (filters?.origen) q = q.eq("origen", filters.origen);
      if (filters?.campana) q = q.eq("campana", filters.campana);
      if (filters?.isAiPaused !== undefined) q = q.eq("is_ai_paused", filters.isAiPaused);
      if (filters?.search) {
        const s = `%${filters.search}%`;
        q = q.or(`nombre.ilike.${s},apellido.ilike.${s},telefono.ilike.${s},email.ilike.${s}`);
      }
      q = q.order("fecha_creacion", { ascending: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Lead[], error: null, count: count ?? undefined };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<Lead>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Lead) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async findByExternalId(externalId: string, tenantId: string): Promise<RepoResult<Lead>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id_lead_externo", externalId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Lead) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateLead): Promise<RepoResult<Lead>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from(TABLE) as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as Lead, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(id: string, tenantId: string, data: UpdateLead): Promise<RepoResult<Lead>> {
    try {
      const supabase = await getAdminSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated, error } = await (supabase.from(TABLE) as any)
        .update(data)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as Lead, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  // Soft-delete: pasa el lead a DROPPED (no borrado fisico — preservar histórico).
  async softDelete(id: string, tenantId: string): Promise<RepoResult<Lead>> {
    return this.update(id, tenantId, {
      current_stage: LeadStageEnum.enum.DROPPED,
    } as UpdateLead);
  }
}

export const leadsRepository = new LeadsRepository();
