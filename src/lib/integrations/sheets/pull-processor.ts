// Sprint 4 - pull-processor: leer Sheet -> detectar filas nuevas/modificadas
// (idempotencia via row_hash) -> crear leads en Esden -> disparar orchestrator.
//
// Invocado por el worker BullMQ tras recibir un job sheets-pull. Tambien por
// el endpoint manual de testing.

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { GoogleSheetsAdapter } from "./adapter";
import {
  ColumnMappingSchema,
  SheetPullJob,
  SheetsAdapterError,
  SheetConnectionSchema,
} from "./types";
import { mapRowToLead } from "./row-mapper";
import { LeadStageEnum } from "@/lib/schemas/_base";

const log = createLogger("sheets.pull-processor");

export interface PullResult {
  rowsTotal: number;
  rowsNew: number;
  rowsSkipped: number;
  leadsCreated: number;
  warnings: number;
  errors: string[];
}

/**
 * Procesa un pull job para UNA sheet_connection: lee filas, calcula hashes,
 * inserta leads nuevos, dispara orchestrator.handleNewLead para cada uno.
 */
export async function processSheetPullJob(job: SheetPullJob): Promise<PullResult> {
  const result: PullResult = {
    rowsTotal: 0,
    rowsNew: 0,
    rowsSkipped: 0,
    leadsCreated: 0,
    warnings: 0,
    errors: [],
  };

  const supabase = await getAdminSupabaseClient();

  // 1. Cargar sheet_connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connRow, error: connErr } = await (supabase.from("sheet_connections" as any) as any)
    .select("*")
    .eq("id", job.sheet_connection_id)
    .eq("tenant_id", job.tenant_id)
    .eq("is_active", true)
    .single();

  if (connErr || !connRow) {
    throw new SheetsAdapterError(
      "READ_FAILED",
      `sheet_connection ${job.sheet_connection_id} no encontrada o inactiva`
    );
  }

  const conn = SheetConnectionSchema.parse(connRow);
  const mapping = ColumnMappingSchema.parse(conn.column_mapping);

  // Solo procesar inbound/custom (export/reporting no crean leads).
  if (conn.purpose !== "leads_inbound" && conn.purpose !== "custom") {
    log.info("Sheet purpose no inbound, skip", {
      purpose: conn.purpose,
      sheet_connection_id: conn.id,
    });
    return result;
  }

  // 2. Leer filas de la Sheet
  const adapter = await GoogleSheetsAdapter.forTenant(job.tenant_id);
  const rows = await adapter.readRows(conn.spreadsheet_id, conn.sheet_tab_name);
  result.rowsTotal = rows.length;

  // 3. Procesar a partir de data_start_row (1-based -> 0-based)
  const startIdx = Math.max(0, mapping.data_start_row - 1);

  for (let i = startIdx; i < rows.length; i++) {
    const rowValues = rows[i] ?? [];
    const allEmpty = rowValues.every(
      (v) => v === undefined || v === null || String(v).trim() === ""
    );
    if (allEmpty) continue;

    const mapped = mapRowToLead(rowValues, i, mapping);
    result.warnings += mapped.warnings.length;

    // 4. Idempotencia: hash == ultimo procesado?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from("sheet_row_processed" as any) as any)
      .select("id, row_hash, lead_id")
      .eq("sheet_connection_id", conn.id)
      .eq("row_index", i)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (existing && (existing as any).row_hash === mapped.rowHash) {
      result.rowsSkipped++;
      // Touch last_seen_at
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sheet_row_processed" as any) as any)
        .update({ last_seen_at: new Date().toISOString() })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("id", (existing as any).id);
      continue;
    }

    // 5. Crear lead (o reutilizar si ya existe via id_lead_externo)
    let leadId: string | null = null;

    const leadPayload: Record<string, unknown> = {
      tenant_id: job.tenant_id,
      current_stage: mapped.lead.current_stage ?? LeadStageEnum.enum.QUALIFICATION,
      status: "PENDING",
      ...mapped.lead,
      metadata: {
        ...(mapped.metadata ?? {}),
        sheet_source: {
          sheet_connection_id: conn.id,
          spreadsheet_id: conn.spreadsheet_id,
          sheet_tab_name: conn.sheet_tab_name,
          row_index: i,
          imported_at: new Date().toISOString(),
        },
      },
      fecha_primer_contacto: new Date().toISOString(),
    };

    if (!leadPayload.id_lead_externo) {
      leadPayload.id_lead_externo = `sheet_${conn.id.slice(0, 8)}_row_${i}`;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: leadRow, error: leadErr } = await (supabase.from("lead" as any) as any)
        .insert(leadPayload)
        .select("id")
        .single();

      if (leadErr) {
        result.errors.push(`row ${i}: ${leadErr.message}`);
        log.error("Lead insert failed", {
          tenant_id: job.tenant_id,
          sheet_connection_id: conn.id,
          row_index: i,
          error: leadErr.message,
        });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leadId = (leadRow as any).id as string;
      result.leadsCreated++;

      // 6. Insertar lead_cualificacion si hay campos para ello
      const cualifPayload = mapped.lead_cualificacion;
      if (cualifPayload && Object.keys(cualifPayload).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("lead_cualificacion" as any) as any).insert({
          tenant_id: job.tenant_id,
          id_lead: leadId,
          ...cualifPayload,
        });
      }

      // 7. Registrar row processed (idempotencia)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sheet_row_processed" as any) as any).upsert(
        {
          sheet_connection_id: conn.id,
          row_index: i,
          row_hash: mapped.rowHash,
          lead_id: leadId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "sheet_connection_id,row_index" }
      );

      result.rowsNew++;

      // 8. Disparar orchestrator agentico
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`row ${i}: ${msg}`);
      log.error("Row processing failed", {
        tenant_id: job.tenant_id,
        sheet_connection_id: conn.id,
        row_index: i,
        error: msg,
      });
    }
  }

  // 9. Actualizar last_synced_at en la connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("sheet_connections" as any) as any)
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
    })
    .eq("id", conn.id);

  return result;
}
