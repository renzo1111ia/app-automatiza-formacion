// Sprint 4 - Outbox processor para writeback automatico.
//
// Lee filas pending de sheets_writeback_outbox, ejecuta writeBackLeadChange
// y marca done/failed. Diseñado para correr periodicamente (cada 30s) o
// disparado por LISTEN sheets_writeback_pending.
//
// El trigger SQL escribe en outbox cuando un lead originado de Sheet cambia
// campos relevantes. Este processor desacopla el orchestrator del adapter
// de Sheets: el orchestrator solo hace UPDATEs como siempre, esta capa se
// encarga de propagar a Google.

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { writeBackLeadChange } from "./writeback";

const log = createLogger("sheets.outbox");

export interface OutboxRunResult {
  picked: number;
  processed: number;
  failed: number;
  errors: string[];
}

const MAX_BATCH = 25;
const MAX_ATTEMPTS = 5;

/**
 * Procesa hasta MAX_BATCH filas pending. Devuelve resumen.
 * Idempotente: si una fila ya esta processing, no la re-toca.
 */
export async function runWritebackOutbox(): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { picked: 0, processed: 0, failed: 0, errors: [] };
  const supabase = await getAdminSupabaseClient();

  // 1. Reclamar lote: marcar como processing en una sola transaccion logica.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: claimed, error: claimErr } = await (
    supabase.from("sheets_writeback_outbox" as any) as any
  )
    .update({ status: "processing" })
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH)
    .select("id, lead_id, tenant_id, changes, attempts");

  if (claimErr) {
    log.error("outbox claim falló", { error: claimErr.message });
    result.errors.push(`claim: ${claimErr.message}`);
    return result;
  }

  const rows = (claimed ?? []) as Array<{
    id: string;
    lead_id: string;
    tenant_id: string;
    changes: Record<string, unknown>;
    attempts: number;
  }>;
  result.picked = rows.length;
  if (rows.length === 0) return result;

  // 2. Procesar uno a uno (writeBackLeadChange puede involucrar varias Sheets).
  for (const row of rows) {
    try {
      const wb = await writeBackLeadChange(row.tenant_id, row.lead_id, {
        changes: row.changes,
      });

      if (wb.errors.length > 0 && wb.cellsWritten === 0) {
        // Todo falló -> reintentar mas tarde.

        await (supabase.from("sheets_writeback_outbox" as any) as any)
          .update({
            status: "pending",
            attempts: row.attempts + 1,
            last_error: wb.errors.slice(0, 3).join("; "),
          })
          .eq("id", row.id);
        result.failed++;
        continue;
      }

      await (supabase.from("sheets_writeback_outbox" as any) as any)
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          last_error: wb.errors.length > 0 ? wb.errors.join("; ") : null,
        })
        .eq("id", row.id);
      result.processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const newAttempts = row.attempts + 1;
      const failed = newAttempts >= MAX_ATTEMPTS;

      await (supabase.from("sheets_writeback_outbox" as any) as any)
        .update({
          status: failed ? "failed" : "pending",
          attempts: newAttempts,
          last_error: msg,
        })
        .eq("id", row.id);
      result.failed++;
      result.errors.push(`lead ${row.lead_id}: ${msg}`);
      log.warn("outbox row failed", {
        outbox_id: row.id,
        lead_id: row.lead_id,
        attempts: newAttempts,
        failed,
        error: msg,
      });
    }
  }

  log.info("outbox batch processed", { ...result });
  return result;
}

/**
 * Renueva watch channels Drive que expiran en <24h. Llamar desde un cron
 * (cada hora). Recrea el canal con stopWatch + setupWatch + persiste IDs.
 */
export async function renewExpiringWatchChannels(): Promise<{
  checked: number;
  renewed: number;
  failed: number;
}> {
  const result = { checked: 0, renewed: 0, failed: 0 };
  const supabase = await getAdminSupabaseClient();
  const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await (supabase.from("sheet_connections" as any) as any)
    .select("id, tenant_id, spreadsheet_id, drive_channel_id, drive_resource_id")
    .eq("is_active", true)
    .lt("drive_channel_expiry", threshold)
    .not("drive_channel_id", "is", null);

  if (error) {
    log.error("renewExpiring select falló", { error: error.message });
    return result;
  }

  const rows = (data ?? []) as Array<any>;
  result.checked = rows.length;

  const { GoogleSheetsAdapter } = await import("./adapter");

  for (const row of rows) {
    try {
      const adapter = await GoogleSheetsAdapter.forTenant(row.tenant_id);
      if (row.drive_channel_id && row.drive_resource_id) {
        await adapter.stopWatch(row.drive_channel_id, row.drive_resource_id);
      }
      const watch = await adapter.setupWatch(row.spreadsheet_id);

      await (supabase.from("sheet_connections" as any) as any)
        .update({
          drive_channel_id: watch.channelId,
          drive_channel_token: watch.channelToken,
          drive_resource_id: watch.resourceId,
          drive_channel_expiry: watch.expiry.toISOString(),
        })
        .eq("id", row.id);
      result.renewed++;
      log.info("watch channel renewed", {
        sheet_connection_id: row.id,
        new_expiry: watch.expiry.toISOString(),
      });
    } catch (err) {
      result.failed++;
      log.warn("watch channel renew failed", {
        sheet_connection_id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
