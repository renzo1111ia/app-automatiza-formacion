// Sprint 5 - Zoho CRM writeback bidireccional.
//
// Cuando el trigger SQL (Fase 01) detecta un cambio en un lead originado de
// Zoho, escribe el campo de vuelta al CRM. Esta función es el análogo Zoho de
// writeBackLeadChange() de Sheets: resuelve zoho_lead_id, mapea campos AF →
// campos Zoho y llama provider.updateLead().
//
// Anti-bucle: el trigger SQL solo dispara si app.zoho_pull_in_progress = false,
// y el event-processor (Fase 02) compara Modified_Time antes de sobreescribir.
// Por tanto NO se necesita lógica anti-bucle adicional aquí.

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { applyWritePolicy } from "@/lib/integrations/crm/write-guard";
import { ZohoSyncConnectionSchema } from "./types";

const log = createLogger("zoho-pull.writeback");

// ─── Tipos de salida ──────────────────────────────────────────────────────────

export interface WrittenFieldAudit {
  integration_id: string;
  zoho_lead_id: string;
  field_name: string;
  new_value: string | null;
}

export interface ZohoWriteBackResult {
  leadsUpdated: number;
  fieldsWritten: number;
  errors: string[];
  /** Detalle por campo escrito exitosamente, para audit R-014. */
  writtenFields: WrittenFieldAudit[];
}

// ─── Mapeo AF → Zoho (inverso de STAGE_LOOKUP / normalizeZohoStage) ──────────
//
// current_stage → Lead_Status: usamos los valores Zoho más comunes. Cuando el
// tenant tiene un field_mapping propio ya incluye Lead_Status → lead.current_stage;
// aquí invertimos al valor canónico que Zoho entiende.

const STAGE_TO_ZOHO: Record<string, string> = {
  QUALIFICATION: "New",
  SCHEDULING: "Contacted",
  COMPLETED: "Converted",
  DROPPED: "Junk Lead",
  UNREACHABLE: "Attempted to Contact",
};

// Mapeo AF-field → Zoho-field (default, cuando field_mapping del tenant está vacío).
const AF_TO_ZOHO_DEFAULT: Record<string, string> = {
  "lead.current_stage": "Lead_Status",
  "lead.email": "Email",
  "lead.telefono": "Phone",
  "lead.status": "Lead_Status", // fallback
};

/**
 * Convierte un valor AF a su equivalente Zoho. Para current_stage aplica el
 * mapeo inverso de stage; para el resto hace toString.
 */
function toZohoValue(afField: string, value: unknown): unknown {
  if (afField === "lead.current_stage" || afField === "lead.status") {
    const stage = String(value ?? "").toUpperCase();
    return STAGE_TO_ZOHO[stage] ?? String(value);
  }
  return value;
}

/**
 * Dado el field_mapping del tenant (array {zoho_field, target}), construye el
 * mapa inverso target→zoho_field para usarlo en writeback.
 */
function buildInverseMapping(
  fieldMapping: Array<{ zoho_field: string; target: string }>
): Map<string, string> {
  const inv = new Map<string, string>();
  for (const entry of fieldMapping) {
    inv.set(entry.target, entry.zoho_field);
  }
  return inv;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Escribe los cambios de un lead interno de vuelta a Zoho.
 *
 * - Si el lead no está en zoho_lead_synced → skip (no originó de Zoho).
 * - Si la conexión tiene writeback_enabled=false o is_active=false → skip.
 * - Mapea changes (claves "lead.current_stage", "lead.email", etc.) → campos Zoho.
 * - Llama provider.updateLead(zoho_lead_id, mappedFields).
 * - Devuelve detalle para audit R-014.
 *
 * Best-effort: acumula errores sin tirar excepción.
 */
export async function writeBackLeadChangeToZoho(
  tenantId: string,
  leadId: string,
  change: { changes: Record<string, unknown> }
): Promise<ZohoWriteBackResult> {
  const out: ZohoWriteBackResult = {
    leadsUpdated: 0,
    fieldsWritten: 0,
    errors: [],
    writtenFields: [],
  };

  const supabase = await getAdminSupabaseClient();

  // 1. Resolver zoho_lead_id + conexión desde zoho_lead_synced.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: syncRow, error: syncErr } = await supabase
    .from("zoho_lead_synced")
    .select(
      "zoho_lead_id, integration_id, zoho_sync_connections!inner(id, tenant_id, writeback_enabled, is_active, field_mapping, integration_id)"
    )
    .eq("lead_id", leadId)
    .maybeSingle();
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (syncErr) {
    log.error("Error consultando zoho_lead_synced", {
      tenant_id: tenantId,
      lead_id: leadId,
      error: syncErr.message,
    });
    out.errors.push(syncErr.message);
    return out;
  }

  if (!syncRow) {
    // Lead no originó de Zoho — writeback no aplica.
    return out;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (syncRow as any).zoho_sync_connections;
  if (!conn || conn.tenant_id !== tenantId) {
    log.warn("zoho_lead_synced encontrado pero conexión no pertenece al tenant", {
      tenant_id: tenantId,
      lead_id: leadId,
    });
    return out;
  }

  // Validar con Zod para garantizar tipado (leniente: si falla, seguimos con raw).
  let parsedConn: {
    writeback_enabled: boolean;
    is_active: boolean;
    field_mapping: Array<{ zoho_field: string; target: string }>;
  };
  try {
    const partial = ZohoSyncConnectionSchema.partial().parse(conn);
    parsedConn = {
      writeback_enabled: partial.writeback_enabled ?? true,
      is_active: partial.is_active ?? true,
      field_mapping: partial.field_mapping ?? [],
    };
  } catch {
    parsedConn = {
      writeback_enabled: conn.writeback_enabled ?? true,
      is_active: conn.is_active ?? true,
      field_mapping: conn.field_mapping ?? [],
    };
  }

  // 2. Respetar flags de la conexión.
  if (!parsedConn.is_active || !parsedConn.writeback_enabled) {
    log.info("writeback Zoho omitido (conexión inactiva o writeback_enabled=false)", {
      tenant_id: tenantId,
      lead_id: leadId,
      is_active: parsedConn.is_active,
      writeback_enabled: parsedConn.writeback_enabled,
    });
    return out;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zohoLeadId = String((syncRow as any).zoho_lead_id ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integrationId = String((syncRow as any).integration_id ?? conn.integration_id ?? "");

  if (!zohoLeadId || !integrationId) {
    out.errors.push("zoho_lead_id o integration_id vacíos en zoho_lead_synced");
    return out;
  }

  // 3. Mapear changes AF → campos Zoho.
  const inverseMap: Map<string, string> =
    parsedConn.field_mapping.length > 0
      ? buildInverseMapping(parsedConn.field_mapping)
      : new Map(Object.entries(AF_TO_ZOHO_DEFAULT));

  const mappedFields: Record<string, unknown> = {};
  for (const [afKey, value] of Object.entries(change.changes)) {
    const zohoField = inverseMap.get(afKey);
    if (!zohoField) continue;
    mappedFields[zohoField] = toZohoValue(afKey, value);
  }

  if (Object.keys(mappedFields).length === 0) {
    log.info("writeback Zoho: ningún campo mapeado en changes", {
      tenant_id: tenantId,
      lead_id: leadId,
      changes_keys: Object.keys(change.changes),
    });
    return out;
  }

  // 4. Aplicar write policy overwrite_with_audit.
  // applyWritePolicy con allowEmptyCurrent=true porque no hacemos un getLead()
  // extra (el trigger ya filtró los campos relevantes y el costo de red extra
  // no merece la pena en el hot path de writeback).
  let safeFields: Record<string, unknown>;
  try {
    safeFields = await applyWritePolicy({
      tenantId,
      integrationId,
      provider: "zoho",
      leadId,
      fields: mappedFields,
      currentCRMFields: undefined,
      actorId: "system",
      policy: "overwrite_with_audit",
      allowedOverrideFields: Object.keys(mappedFields),
      allowEmptyCurrent: true,
    });
  } catch (guardErr) {
    const msg = guardErr instanceof Error ? guardErr.message : String(guardErr);
    out.errors.push(`write-guard: ${msg}`);
    log.warn("write-guard rechazó writeback Zoho", {
      tenant_id: tenantId,
      lead_id: leadId,
      error: msg,
    });
    return out;
  }

  if (Object.keys(safeFields).length === 0) {
    log.info("write-guard filtró todos los campos — skip writeback Zoho", {
      tenant_id: tenantId,
      lead_id: leadId,
    });
    return out;
  }

  // 5. Llamar al provider Zoho.
  try {
    const provider = await CRMFactory.getProviderForIntegration(integrationId);
    await provider.updateLead(zohoLeadId, safeFields);

    out.leadsUpdated = 1;
    out.fieldsWritten = Object.keys(safeFields).length;

    for (const [fieldName, newVal] of Object.entries(safeFields)) {
      out.writtenFields.push({
        integration_id: integrationId,
        zoho_lead_id: zohoLeadId,
        field_name: fieldName,
        new_value: newVal === null || newVal === undefined ? null : String(newVal),
      });
    }

    log.info("writeback Zoho completado", {
      tenant_id: tenantId,
      lead_id: leadId,
      zoho_lead_id: zohoLeadId,
      fields: Object.keys(safeFields),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    out.errors.push(`updateLead ${zohoLeadId}: ${msg}`);
    log.warn("writeback Zoho falló en updateLead (no bloqueante)", {
      tenant_id: tenantId,
      lead_id: leadId,
      zoho_lead_id: zohoLeadId,
      error: msg,
    });
  }

  return out;
}
