/**
 * Helper para SELECT de `crm_write_audit` desde la UI (Phase 05).
 *
 * Usa el client autenticado (no service_role) para que RLS filtre por tenant.
 * Soporta filtro por lead_id + paginación simple (limit + offset).
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditQueryOptions {
  tenantId: string;
  leadId?: string;
  integrationId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  integration_id: string | null;
  provider: string;
  lead_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  write_policy: string;
  actor_id: string | null;
  created_at: string;
}

export async function getAuditLog(opts: AuditQueryOptions): Promise<AuditLogRow[]> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase
    .from("crm_write_audit")
    .select(
      "id, tenant_id, integration_id, provider, lead_id, field_name, old_value, new_value, write_policy, actor_id, created_at"
    )
    .eq("tenant_id", opts.tenantId)
    .order("created_at", { ascending: false });

  if (opts.leadId) query = query.eq("lead_id", opts.leadId);
  if (opts.integrationId) query = query.eq("integration_id", opts.integrationId);

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    console.error(`[audit-query] error: ${error.message}`);
    return [];
  }
  return (data ?? []) as AuditLogRow[];
}
