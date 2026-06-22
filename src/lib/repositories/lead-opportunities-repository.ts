// Sprint 1 — NEW-06 Repository de oportunidades de leads con dedup automatico.
// Ventana de dedup: 48h (politica Bea V1 - "mismo dia o dias sucesivos").

import type { LeadOpportunity, CreateLeadOpportunity } from "@/lib/schemas/opportunities";
import { OpportunityStatusEnum } from "@/lib/schemas/opportunities";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";

const TABLE = "lead_opportunities";
const DEDUP_WINDOW_HOURS = 48;

export interface CreateWithDedupResult {
  data: LeadOpportunity | null;
  error: string | null;
  isDuplicate: boolean;
  originalId: string | null;
}

export class LeadOpportunitiesRepository {
  async findByLead(leadId: string, tenantId: string): Promise<RepoListResult<LeadOpportunity>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId)
        .order("fecha_solicitud", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as LeadOpportunity[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<LeadOpportunity>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as LeadOpportunity) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  // Crea una oportunidad. Si existe otra del mismo lead+programa dentro de la
  // ventana de dedup, NO crea una nueva — marca esta como duplicada de la original.
  async createWithDedup(
    tenantId: string,
    data: CreateLeadOpportunity
  ): Promise<CreateWithDedupResult> {
    try {
      const supabase = await getAdminSupabaseClient();
      const now = new Date();
      const windowStart = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

      // 1) Buscar oportunidades del mismo lead+programa en la ventana de dedup,
      //    no-duplicadas (is_duplicate_of IS NULL).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dupQuery: any = supabase
        .from(TABLE)
        .select("id, fecha_solicitud")
        .eq("tenant_id", tenantId)
        .eq("lead_id", data.lead_id)
        .is("is_duplicate_of", null)
        .gte("fecha_solicitud", windowStart.toISOString())
        .order("fecha_solicitud", { ascending: false })
        .limit(1);
      // Solo dedup si hay programa especificado (ambos deben coincidir).
      if (data.programa_id) {
        dupQuery = dupQuery.eq("programa_id", data.programa_id);
      } else {
        dupQuery = dupQuery.is("programa_id", null);
      }
      const { data: existing, error: dupErr } = await dupQuery.maybeSingle();
      if (dupErr) {
        return {
          data: null,
          error: handleSupabaseError(dupErr),
          isDuplicate: false,
          originalId: null,
        };
      }

      // 2) Si existe original → insertar como duplicada referenciando la original.
      const originalId = existing ? (existing as { id: string }).id : null;
      const payload = {
        ...data,
        tenant_id: tenantId,
        estado_oportunidad: data.estado_oportunidad ?? OpportunityStatusEnum.enum.NUEVA,
        is_duplicate_of: originalId,
      };

       
      const { data: inserted, error: insErr } = await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single();
      if (insErr) {
        return {
          data: null,
          error: handleSupabaseError(insErr),
          isDuplicate: false,
          originalId: null,
        };
      }
      return {
        data: inserted as LeadOpportunity,
        error: null,
        isDuplicate: !!originalId,
        originalId,
      };
    } catch (e) {
      return {
        data: null,
        error: handleSupabaseError(e),
        isDuplicate: false,
        originalId: null,
      };
    }
  }

  async markAsDuplicate(
    id: string,
    tenantId: string,
    originalId: string
  ): Promise<RepoResult<LeadOpportunity>> {
    try {
      const supabase = await getAdminSupabaseClient();
       
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ is_duplicate_of: originalId })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as LeadOpportunity, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string
  ): Promise<RepoResult<LeadOpportunity>> {
    try {
      const supabase = await getAdminSupabaseClient();
       
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ estado_oportunidad: status })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as LeadOpportunity, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export const leadOpportunitiesRepository = new LeadOpportunitiesRepository();
