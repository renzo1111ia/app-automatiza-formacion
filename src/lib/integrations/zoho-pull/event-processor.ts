// Sprint 5 - Procesador de evento Zoho (event-driven).
//
// Consume un ZohoPullJob (encolado por el webhook): por cada zoho_lead_id trae
// el lead completo con provider.getLead(), lo mapea y hace upsert idempotente
// contra la tabla `lead` + `zoho_lead_synced`:
//   - lead nuevo  -> INSERT + autorelleno + orchestrator.handleNewLead()
//   - lead existente y cambió -> UPDATE guardado (anti-bucle) + actualizar
//     zoho_modified_time. Si NO cambió (mismo Modified_Time) -> skip.
//
// Patrón de inserts alineado con sheets/pull-processor.ts (casts `as any` por
// tablas no tipadas en el client). service_role (bypass RLS).
//
// Referencias:
//   - src/lib/integrations/sheets/pull-processor.ts (autorelleno + orchestrator)
//   - src/lib/integrations/crm/factory.ts (getProviderForIntegration)
//   - supabase/migrations/20260608153200_zoho_pull_guarded_update.sql (RPC guard)

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { resolveLeadCountry } from "@/lib/integrations/sheets/phone-country";
import { LeadStageEnum } from "@/lib/schemas/_base";
import { createLogger } from "@/lib/utils/logger";
import { mapZohoLeadToInternal } from "./lead-mapper";
import { ZohoPullJob, ZohoFieldMappingSchema, ZohoPullError } from "./types";

const log = createLogger("zoho-pull.event-processor");

export interface ZohoEventResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Columnas del mapping que pueden ir a un UPDATE guardado (whitelist alineada
// con la RPC zoho_pull_update_lead).
const WRITEBACK_COLS = [
  "current_stage",
  "status",
  "email",
  "telefono",
  "pais",
  "nombre",
  "apellido",
] as const;

/**
 * Construye un CRMLead a partir de los campos crudos que el Workflow Webhook de
 * Zoho mandó inline (en "Parámetros del módulo"). Replica la forma de
 * ZohoCRMProvider.mapToLead para que mapZohoLeadToInternal funcione igual que
 * con un lead traído por getLead(). Tolera nombres de campo estándar de Zoho.
 */
function buildCrmLeadFromInline(
  zohoLeadId: string,
  fields: Record<string, unknown>
): { id: string; fields: Record<string, unknown>; raw: Record<string, unknown> } {
  // Las claves pueden venir tal cual de Zoho (First_Name, Email, Phone, Country,
  // Lead_Source, Lead_Status, Modified_Time...) o en minúscula desde el form.
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (fields[k] !== undefined && fields[k] !== "") return fields[k];
      const lower = Object.keys(fields).find((fk) => fk.toLowerCase() === k.toLowerCase());
      if (lower && fields[lower] !== undefined && fields[lower] !== "") return fields[lower];
    }
    return undefined;
  };

  return {
    id: zohoLeadId,
    fields: {
      nombre: pick("First_Name", "nombre", "first_name") ?? "",
      apellido: pick("Last_Name", "apellido", "last_name") ?? "",
      email: pick("Email", "email") ?? "",
      telefono: pick("Phone", "telefono", "phone", "Mobile") ?? "",
      pais: pick("Country", "pais", "country") ?? "",
      source: pick("Lead_Source", "source", "lead_source") ?? "",
    },
    // raw = todos los campos recibidos + el id, para que el mapping custom y la
    // detección de Modified_Time funcionen igual que con getLead.
    raw: { ...fields, id: zohoLeadId },
  };
}

export async function processZohoLeadEvent(job: ZohoPullJob): Promise<ZohoEventResult> {
  const result: ZohoEventResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const ids = job.zoho_lead_ids ?? [];
  if (ids.length === 0) {
    log.info("zoho-lead job sin ids, nada que procesar", {
      integration_id: job.integration_id,
      trigger: job.trigger,
    });
    return result;
  }

  const supabase = await getAdminSupabaseClient();

  // Cargar la connection (field_mapping). Una por integración.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connRow } = await supabase
    .from("zoho_sync_connections")
    .select("id, field_mapping")
    .eq("integration_id", job.integration_id)
    .maybeSingle();
  const fieldMappingParsed = ZohoFieldMappingSchema.safeParse(
    Array.isArray(connRow?.field_mapping) ? connRow.field_mapping : []
  );
  const fieldMapping = fieldMappingParsed.success ? fieldMappingParsed.data : [];

  const inlineLeads = job.inline_leads ?? {};
  // Solo instanciamos el provider (OAuth) si HACE FALTA getLead — es decir, si
  // algún id del job NO trae campos inline. Así la vía "webhook con campos"
  // funciona sin OAuth configurado.
  const needsProvider = ids.some(
    (id) => !inlineLeads[id] || Object.keys(inlineLeads[id]).length === 0
  );
  let provider: Awaited<ReturnType<typeof CRMFactory.getProviderForIntegration>> | null = null;
  if (needsProvider) {
    provider = await CRMFactory.getProviderForIntegration(job.integration_id);
  }

  for (const zohoLeadId of ids) {
    try {
      const inlineFields = inlineLeads[zohoLeadId];
      let crmLead;
      if (inlineFields && Object.keys(inlineFields).length > 0) {
        // Vía A "gorda": el webhook ya trajo los campos → sin getLead/OAuth.
        crmLead = buildCrmLeadFromInline(zohoLeadId, inlineFields);
      } else {
        // Vía A "id" / Vía B: traer el lead completo de Zoho (requiere OAuth).
        crmLead = provider ? await provider.getLead(zohoLeadId) : null;
      }
      if (!crmLead) {
        // 404 / borrado en Zoho → nada que sincronizar.
        log.info("Lead Zoho no encontrado (borrado?), skip", {
          integration_id: job.integration_id,
          zoho_lead_id: zohoLeadId,
        });
        result.skipped++;
        continue;
      }

      const mapped = mapZohoLeadToInternal(crmLead, fieldMapping);
      const raw = (crmLead.raw ?? {}) as Record<string, unknown>;
      const zohoModified = (raw.Modified_Time as string | undefined) ?? null;

      // ¿Ya sincronizado?
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: synced } = await supabase
        .from("zoho_lead_synced")
        .select("id, lead_id, zoho_modified_time")
        .eq("integration_id", job.integration_id)
        .eq("zoho_lead_id", zohoLeadId)
        .maybeSingle();

      if (synced && synced.lead_id) {
        await handleExisting(supabase, job, synced, mapped, zohoModified, result);
      } else {
        await handleNew(supabase, job, zohoLeadId, mapped, zohoModified, result);
      }
      result.processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`lead ${zohoLeadId}: ${msg}`);
      log.error("Procesamiento de lead Zoho falló", {
        integration_id: job.integration_id,
        zoho_lead_id: zohoLeadId,
        error: msg,
      });
    }
  }

  // Actualizar last_synced_at / last_sync_error de la connection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase
    .from("zoho_sync_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
    })
    .eq("integration_id", job.integration_id);

  return result;
}

// ─── UPDATE de lead existente (con guard anti-bucle) ────────────────────────

async function handleExisting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  job: ZohoPullJob,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  synced: any,
  mapped: ReturnType<typeof mapZohoLeadToInternal>,
  zohoModified: string | null,
  result: ZohoEventResult
): Promise<void> {
  // Guard de aplicación: si Modified_Time no cambió respecto a lo guardado, NO
  // re-procesar (evita re-disparar trigger writeback). Es el guard primario.
  const prev = synced.zoho_modified_time as string | null;
  if (zohoModified && prev && new Date(zohoModified).getTime() === new Date(prev).getTime()) {
    result.skipped++;
    return;
  }

  // Construir el set de cambios whitelisteados desde el mapping.
  const changes: Record<string, unknown> = {};
  for (const col of WRITEBACK_COLS) {
    if (mapped.lead[col] !== undefined && mapped.lead[col] !== null) {
      changes[col] = mapped.lead[col];
    }
  }

  // País (regla AF): si el lead en BD no tiene país, resolverlo (teléfono →
  // España). Solo se rellena cuando falta en BD para no pisar uno editado a mano.
  if (changes.pais == null) {
    const { data: leadRow } = await supabase
      .from("lead")
      .select("pais, telefono")
      .eq("id", synced.lead_id)
      .maybeSingle();
    if (leadRow && (leadRow.pais == null || String(leadRow.pais).trim() === "")) {
      changes.pais = resolveLeadCountry(
        mapped.lead.pais as string | undefined,
        (changes.telefono ?? mapped.lead.telefono ?? leadRow.telefono) as string | undefined
      );
    }
  }

  if (Object.keys(changes).length > 0) {
    // UPDATE vía RPC con SET LOCAL app.zoho_pull_in_progress=true en la misma
    // transacción → el trigger writeback NO re-encola (guard SQL real).
    const { error: rpcErr } = await supabase.rpc("zoho_pull_update_lead", {
      p_lead_id: synced.lead_id,
      p_tenant_id: job.tenant_id,
      p_changes: changes,
    });
    if (rpcErr) {
      throw new ZohoPullError("WRITE_FAILED", `zoho_pull_update_lead RPC: ${rpcErr.message}`);
    }

    // Refrescar cualificación si la edición trae campos.
    const cualif = mapped.lead_cualificacion;
    if (cualif && Object.keys(cualif).length > 0) {
      await supabase
        .from("lead_cualificacion")
        .upsert(
          { tenant_id: job.tenant_id, id_lead: synced.lead_id, ...cualif },
          { onConflict: "id_lead" }
        );
    }
  }

  // Actualizar el Modified_Time guardado (aunque no haya changes trackables,
  // sella el evento como visto para que un re-pull haga skip).
  await supabase
    .from("zoho_lead_synced")
    .update({ zoho_modified_time: zohoModified, last_synced_at: new Date().toISOString() })
    .eq("id", synced.id);

  result.updated++;
}

// ─── INSERT de lead nuevo (autorelleno + orchestrator) ──────────────────────

async function handleNew(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  job: ZohoPullJob,
  zohoLeadId: string,
  mapped: ReturnType<typeof mapZohoLeadToInternal>,
  zohoModified: string | null,
  result: ZohoEventResult
): Promise<void> {
  const nowIso = new Date().toISOString();
  // País: explícito → derivado del teléfono → España por defecto (regla AF única).
  const resolvedPais = resolveLeadCountry(
    mapped.lead.pais as string | undefined,
    mapped.lead.telefono as string | undefined
  );

  const leadPayload: Record<string, unknown> = {
    tenant_id: job.tenant_id,
    current_stage: mapped.lead.current_stage ?? LeadStageEnum.enum.QUALIFICATION,
    status: "PENDING",
    origen: "zoho_crm",
    tipo_lead: "zoho_import",
    ...mapped.lead, // un mapeo explícito tiene prioridad sobre los defaults
    pais: resolvedPais, // SIEMPRE hay país (tras el spread, gana este valor resuelto)
    fecha_ingreso_crm: nowIso,
    fecha_primer_contacto: nowIso,
    metadata: {
      ...(mapped.metadata ?? {}),
      zoho_source: { zoho_lead_id: zohoLeadId, imported_at: nowIso },
    },
  };
  if (!leadPayload.id_lead_externo) leadPayload.id_lead_externo = zohoLeadId;

  const { data: leadRow, error: leadErr } = await supabase
    .from("lead")
    .insert(leadPayload)
    .select("id")
    .single();
  if (leadErr) {
    throw new ZohoPullError("WRITE_FAILED", `lead insert: ${leadErr.message}`);
  }
  const leadId = leadRow.id as string;
  result.created++;

  const cualif = mapped.lead_cualificacion;
  if (cualif && Object.keys(cualif).length > 0) {
    await supabase
      .from("lead_cualificacion")
      .insert({ tenant_id: job.tenant_id, id_lead: leadId, ...cualif });
  }

  // Registrar idempotencia.
  await supabase.from("zoho_lead_synced").upsert(
    {
      tenant_id: job.tenant_id,
      integration_id: job.integration_id,
      zoho_lead_id: zohoLeadId,
      lead_id: leadId,
      zoho_modified_time: zohoModified,
      last_synced_at: nowIso,
    },
    { onConflict: "integration_id,zoho_lead_id" }
  );

  // Disparar el orquestador agéntico (lead nuevo entra al pipeline).
  try {
    const { orchestrator } = await import("@/lib/core/orchestrator");
    await orchestrator.handleNewLead(leadId, job.tenant_id);
  } catch (orchErr) {
    const msg = orchErr instanceof Error ? orchErr.message : String(orchErr);
    log.warn("orchestrator.handleNewLead falló (lead creado igualmente)", {
      tenant_id: job.tenant_id,
      lead_id: leadId,
      error: msg,
    });
    result.errors.push(`orchestrator(${leadId}): ${msg}`);
  }
}
