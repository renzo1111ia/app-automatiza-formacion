// Sprint 4 - Write-back helper.
//
// Cuando el orchestrator (o cualquier otro punto del sistema) cambia el
// estado de un lead, escribe los nuevos valores en las celdas de TODAS las
// Sheets conectadas con writeback_enabled=true que mapeen ese lead.
//
// Diseñado como funcion explicita writeBackLeadChange() en lugar de auto-hook
// pasivo, para que el caller controle CUANDO se ejecuta (typicamente despues
// de UPDATE en lead.current_stage / lead_cualificacion.*).
//
// Lookup row index: usa sheet_row_processed (lead_id -> row_index) para
// localizar la fila en la Sheet sin re-leer toda la hoja.

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { GoogleSheetsAdapter } from "./adapter";
import { ColumnMappingSchema, SheetsAdapterError } from "./types";
import { buildWritebackCells } from "./row-mapper";

const log = createLogger("sheets.writeback");

export interface LeadChange {
  /** Cambios en formato target -> value. target = "lead.current_stage" etc. */
  changes: Record<string, unknown>;
}

export interface WrittenCellAudit {
  sheet_connection_id: string;
  spreadsheet_id: string;
  row_index: number;
  field_name: string;
  new_value: string | null;
}

export interface WriteBackResult {
  sheetsUpdated: number;
  cellsWritten: number;
  errors: string[];
  /** Detalle por celda escrita exitosamente, para audit R-014. */
  writtenCells: WrittenCellAudit[];
}

/**
 * Escribe los cambios en TODAS las Sheets conectadas que tengan al lead
 * registrado en sheet_row_processed y writeback_enabled=true.
 *
 * Idempotente: si la celda ya tiene el mismo valor, Google la sobreescribe
 * con el mismo dato sin error. NO disparamos un push notification artificial
 * (Drive lo detectara como cambio aunque el valor sea igual).
 */
export async function writeBackLeadChange(
  tenantId: string,
  leadId: string,
  change: LeadChange
): Promise<WriteBackResult> {
  const out: WriteBackResult = {
    sheetsUpdated: 0,
    cellsWritten: 0,
    errors: [],
    writtenCells: [],
  };
  const supabase = await getAdminSupabaseClient();

  // 1. Localizar todas las filas de sheets que apuntan a este lead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase.from("sheet_row_processed" as any) as any)
    .select(
      "id, sheet_connection_id, row_index, sheet_connections!inner(id, tenant_id, spreadsheet_id, sheet_tab_name, column_mapping, writeback_enabled, is_active)"
    )
    .eq("lead_id", leadId);

  if (error) {
    log.error("Error consultando sheet_row_processed", {
      tenant_id: tenantId,
      lead_id: leadId,
      error: error.message,
    });
    out.errors.push(error.message);
    return out;
  }
  if (!rows || rows.length === 0) {
    return out; // lead no origina de ninguna Sheet conectada
  }

  let adapter: GoogleSheetsAdapter | null = null;

  for (const r of rows as unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = r as any;
    const conn = rec.sheet_connections;
    if (!conn || conn.tenant_id !== tenantId) continue;
    if (!conn.is_active || !conn.writeback_enabled) continue;

    try {
      const mapping = ColumnMappingSchema.parse(conn.column_mapping);
      const cells = buildWritebackCells(mapping, rec.row_index, change.changes);
      if (cells.length === 0) continue;

      if (!adapter) {
        adapter = await GoogleSheetsAdapter.forTenant(tenantId);
      }
      await adapter.writeCells(conn.spreadsheet_id, conn.sheet_tab_name, cells);

      out.sheetsUpdated++;
      out.cellsWritten += cells.length;

      // Mapping cell -> target field para audit. Replica el matching de
      // buildWritebackCells: column.target con writeback=true y target ∈ changes.
      for (const col of mapping.columns) {
        if (!col.writeback) continue;
        if (!(col.target in change.changes)) continue;
        const raw = change.changes[col.target];
        out.writtenCells.push({
          sheet_connection_id: String(conn.id),
          spreadsheet_id: String(conn.spreadsheet_id),
          row_index: rec.row_index,
          field_name: col.target,
          new_value: raw === null || raw === undefined ? null : String(raw),
        });
      }

      log.info("writeback completado para sheet", {
        tenant_id: tenantId,
        lead_id: leadId,
        sheet_connection_id: conn.id,
        row_index: rec.row_index,
        cells: cells.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      out.errors.push(`sheet ${conn.id}: ${msg}`);
      log.warn("writeback fallo en sheet (no bloqueante)", {
        tenant_id: tenantId,
        lead_id: leadId,
        sheet_connection_id: conn.id,
        error: msg,
      });
      // Si el adapter falla con OAUTH_MISSING no tiene sentido seguir con
      // otras sheets del mismo tenant.
      if (err instanceof SheetsAdapterError && err.code === "OAUTH_MISSING") break;
    }
  }

  return out;
}
