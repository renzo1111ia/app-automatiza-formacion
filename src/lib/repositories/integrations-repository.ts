// Sprint 1 — Bloque 2.3 (tarea 2-18) Repository integrations + webhooks + CRM audit.
// Diseñado pensando en Fase 2 (adapter HubSpot/Zoho) — findByCrmType es el método clave.

import type {
  Integration,
  CreateIntegration,
  Webhook,
  CrmFieldMapping,
  CrmWriteAudit,
  CreateCrmWriteAudit,
  CrmType,
} from "@/lib/schemas/integrations";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";

export class IntegrationsRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<Integration>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Integration[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findByCrmType(tenantId: string, crmType: CrmType): Promise<RepoResult<Integration>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("crm_type", crmType)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Integration) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateIntegration): Promise<RepoResult<Integration>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
       
      const { data: inserted, error } = await supabase
        .from("integrations")
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as Integration, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async deactivate(id: string, tenantId: string): Promise<RepoResult<Integration>> {
    try {
      const supabase = await getAdminSupabaseClient();
       
      const { data: updated, error } = await supabase
        .from("integrations")
        .update({ is_active: false })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as Integration, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class CrmFieldMappingRepository {
  async findByIntegration(
    integrationId: string,
    tenantId: string
  ): Promise<RepoListResult<CrmFieldMapping>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("crm_field_mappings")
        .select("*")
        .eq("integration_id", integrationId)
        .eq("tenant_id", tenantId);
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as CrmFieldMapping[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }
}

export class CrmWriteAuditRepository {
  // Append-only (R-014): nunca update / delete sobre crm_write_audit.
  async create(tenantId: string, data: CreateCrmWriteAudit): Promise<RepoResult<CrmWriteAudit>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
       
      const { data: inserted, error } = await supabase
        .from("crm_write_audit")
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as CrmWriteAudit, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class WebhooksRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<Webhook>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Webhook[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }
}

export const integrationsRepository = new IntegrationsRepository();
export const crmFieldMappingRepository = new CrmFieldMappingRepository();
export const crmWriteAuditRepository = new CrmWriteAuditRepository();
export const webhooksRepository = new WebhooksRepository();
