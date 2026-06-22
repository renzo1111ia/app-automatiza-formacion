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
import { mapRowToLead, letterToIndex, hashRow } from "./row-mapper";
import { resolveLeadCountry } from "./phone-country";
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
  const { data: connRow, error: connErr } = await supabase
    .from("sheet_connections")
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

  // 2b. Localizar la columna de current_stage para autorellenar el default en
  // la Sheet cuando un lead entra sin Estado (requisito 03-06-2026). Si el
  // mapping no mapea current_stage, no hay nada que autorellenar.
  const stageCol = mapping.columns.find((c) => c.target === "lead.current_stage");
  const stageColIdx = stageCol ? letterToIndex(stageCol.letter) : -1;

  // 2c. Columna semáforo "AF": nuestra app marca 🔴 al empezar a procesar la
  // fila y 🟢 al terminar. Es columna técnica (excluida del hash en row-mapper)
  // → escribirla no dispara re-pull. Opcional: si no está configurada, no se
  // gestiona semáforo.
  const statusCol = mapping.status_column ?? null;
  const ignoreIdxForHash = statusCol ? [letterToIndex(statusCol)] : [];
  const AF_PROCESSING = "🔴 Gestionando AF";
  const afDone = () => `🟢 Sincronizado ${new Date().toISOString().slice(11, 16)}`;

  /** Escribe el semáforo AF en la fila si la columna está configurada. */
  async function writeAfStatus(rowIdx: number, value: string): Promise<void> {
    if (!statusCol) return;
    try {
      await adapter.writeCells(conn.spreadsheet_id, conn.sheet_tab_name, [
        { letter: statusCol, rowIndex: rowIdx, value },
      ]);
    } catch (err) {
      // El semáforo es best-effort: si falla la escritura no abortamos el pull.
      log.warn("No se pudo escribir semáforo AF", {
        sheet_connection_id: conn.id,
        row_index: rowIdx,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Si la celda Estado de la fila `rowIdx` está vacía, escribe `stageValue` en
   * la Sheet y devuelve el row_hash RECALCULADO (con el valor ya puesto, e
   * ignorando la columna AF) para persistirlo y que el re-pull haga SKIP.
   * Si no hay nada que rellenar, devuelve null.
   */
  async function autofillStageCell(
    rowIdx: number,
    currentRowValues: unknown[],
    stageValue: string
  ): Promise<string | null> {
    if (!stageCol || stageColIdx < 0) return null;
    const cell = currentRowValues[stageColIdx];
    const isEmpty = cell === undefined || cell === null || String(cell).trim() === "";
    if (!isEmpty) return null;

    await adapter.writeCells(conn.spreadsheet_id, conn.sheet_tab_name, [
      { letter: stageCol.letter, rowIndex: rowIdx, value: stageValue },
    ]);

    const updatedRow = [...currentRowValues];
    updatedRow[stageColIdx] = stageValue;
    return hashRow(updatedRow, ignoreIdxForHash);
  }

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
    const { data: existing } = await supabase
      .from("sheet_row_processed")
      .select("id, row_hash, lead_id")
      .eq("sheet_connection_id", conn.id)
      .eq("row_index", i)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (existing && (existing as any).row_hash === mapped.rowHash) {
      result.rowsSkipped++;

      // Autorelleno en fila histórica: hash idéntico pero la celda Estado sigue
      // vacía y su lead ya tiene current_stage → escribir ese stage de vuelta.
      let touchedHash: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingLeadId = (existing as any).lead_id as string | undefined;
      if (existingLeadId && stageColIdx >= 0) {
        const cell = rowValues[stageColIdx];
        const cellEmpty = cell === undefined || cell === null || String(cell).trim() === "";
        if (cellEmpty) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leadRow } = await supabase
            .from("lead")
            .select("current_stage")
            .eq("id", existingLeadId)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stage = (leadRow as any)?.current_stage as string | undefined;
          if (stage) {
            touchedHash = await autofillStageCell(i, rowValues, stage);
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase
        .from("sheet_row_processed")
        .update({
          last_seen_at: new Date().toISOString(),
          ...(touchedHash ? { row_hash: touchedHash } : {}),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("id", (existing as any).id);
      continue;
    }

    // 5. Decidir INSERT vs UPDATE.
    // BUG-4-08: si la fila YA fue importada (existe sheet_row_processed con
    // lead_id) y el hash cambió, es una EDICIÓN manual en la Sheet. La spec
    // (plan Sprint 4 phase-01: "fila editada en Sheet → lead ACTUALIZADO en
    // Esden") exige ACTUALIZAR ese lead, no crear uno nuevo (antes se creaba un
    // lead huérfano por cada edición).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingLeadId = (existing as any)?.lead_id as string | undefined;
    let leadId: string | null = null;

    const sheetSource = {
      sheet_connection_id: conn.id,
      spreadsheet_id: conn.spreadsheet_id,
      sheet_tab_name: conn.sheet_tab_name,
      row_index: i,
    };

    // Semáforo 🔴: la app va a procesar esta fila (insert o update).
    await writeAfStatus(i, AF_PROCESSING);

    try {
      if (existingLeadId) {
        // ── UPDATE de lead ya vinculado a esta fila ──────────────────────────
        // Leer el estado actual para completar autogenerados FALTANTES sin pisar
        // los que ya tienen valor (leads históricos pre-código-nuevo: sin
        // origen/pais/fecha_ingreso_crm — BUG-4-10).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cur } = await supabase
          .from("lead")
          .select("pais, origen, tipo_lead, fecha_ingreso_crm")
          .eq("id", existingLeadId)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (cur ?? {}) as any;

        const updatePayload: Record<string, unknown> = {
          ...mapped.lead,
          metadata: {
            ...(mapped.metadata ?? {}),
            sheet_source: { ...sheetSource, updated_at: new Date().toISOString() },
          },
          fecha_actualizacion: new Date().toISOString(),
        };
        // No pisamos current_stage si la fila no aporta uno (lo gestiona el
        // orquestador / writeback). Solo lo seteamos si viene mapeado.
        if (mapped.lead.current_stage === undefined) delete updatePayload.current_stage;

        // Completar país si falta en BD: explícito → teléfono → España (regla AF).
        if (!c.pais) {
          updatePayload.pais = resolveLeadCountry(
            mapped.lead.pais as string | undefined,
            (updatePayload.telefono ?? mapped.lead.telefono) as string | undefined
          );
        }
        if (!c.origen) updatePayload.origen = "google_sheets";
        if (!c.tipo_lead) updatePayload.tipo_lead = "sheet_import";
        if (!c.fecha_ingreso_crm) updatePayload.fecha_ingreso_crm = new Date().toISOString();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await supabase
          .from("lead")
          .update(updatePayload)
          .eq("id", existingLeadId)
          .eq("tenant_id", job.tenant_id);

        if (updErr) {
          result.errors.push(`row ${i} (update): ${updErr.message}`);
          log.error("Lead update failed", {
            tenant_id: job.tenant_id,
            sheet_connection_id: conn.id,
            row_index: i,
            lead_id: existingLeadId,
            error: updErr.message,
          });
          continue;
        }

        leadId = existingLeadId;
        result.rowsNew++; // contabiliza como fila procesada (cambió)

        // Refrescar cualificación si la edición trae campos nuevos.
        const cualifPayload = mapped.lead_cualificacion;
        if (cualifPayload && Object.keys(cualifPayload).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabase
            .from("lead_cualificacion")
            .upsert(
              { tenant_id: job.tenant_id, id_lead: leadId, ...cualifPayload },
              { onConflict: "id_lead" }
            );
        }

        // Actualizar el hash de la fila (NO re-disparamos orchestrator: no es
        // un lead nuevo, ya está en el pipeline).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase
          .from("sheet_row_processed")
          .update({ row_hash: mapped.rowHash, last_seen_at: new Date().toISOString() })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq("id", (existing as any).id);

        log.info("Lead actualizado desde edición en Sheet", {
          tenant_id: job.tenant_id,
          sheet_connection_id: conn.id,
          row_index: i,
          lead_id: leadId,
        });
        // Semáforo 🟢: fila sincronizada.
        await writeAfStatus(i, afDone());
        continue; // siguiente fila
      }

      // ── INSERT de lead nuevo ───────────────────────────────────────────────
      // Campos AUTOGENERADOS por la app (no vienen de la Sheet, BUG-4-10):
      //  - origen: marca de procedencia para los entry_filters del orquestador.
      //  - fecha_ingreso_crm: momento real de entrada en NUESTRA app.
      //  - tipo_lead: clasificación por defecto de importación Sheet.
      //  - pais: si la fila no lo trae, derivar del prefijo del teléfono.
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
        origen: "google_sheets",
        tipo_lead: "sheet_import",
        ...mapped.lead, // un mapeo explícito de origen/tipo_lead tiene prioridad
        pais: resolvedPais, // SIEMPRE hay país (tras el spread, gana este valor resuelto)
        fecha_ingreso_crm: nowIso,
        metadata: {
          ...(mapped.metadata ?? {}),
          sheet_source: { ...sheetSource, imported_at: nowIso },
        },
        fecha_primer_contacto: nowIso,
      };

      if (!leadPayload.id_lead_externo) {
        leadPayload.id_lead_externo = `sheet_${conn.id.slice(0, 8)}_row_${i}`;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: leadRow, error: leadErr } = await supabase
        .from("lead")
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
        await supabase.from("lead_cualificacion").insert({
          tenant_id: job.tenant_id,
          id_lead: leadId,
          ...cualifPayload,
        });
      }

      // 6b. Autorelleno: si la fila entró SIN Estado, escribir el default que
      // acabamos de asignar al lead de vuelta en la Sheet. Devuelve el hash
      // recalculado (con el valor puesto) para que el re-pull haga SKIP.
      const insertedStage =
        (mapped.lead.current_stage as string | undefined) ?? LeadStageEnum.enum.QUALIFICATION;
      const refreshedHash = await autofillStageCell(i, rowValues, insertedStage);

      // 7. Registrar row processed (idempotencia)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("sheet_row_processed").upsert(
        {
          sheet_connection_id: conn.id,
          row_index: i,
          row_hash: refreshedHash ?? mapped.rowHash,
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

      // Semáforo 🟢: lead nuevo sincronizado.
      await writeAfStatus(i, afDone());
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
  await supabase
    .from("sheet_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
    })
    .eq("id", conn.id);

  return result;
}
