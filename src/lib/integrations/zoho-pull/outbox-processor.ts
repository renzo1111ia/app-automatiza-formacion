// Sprint 5 - Outbox processor para writeback automático Zoho.
//
// Lee filas pending de zoho_writeback_outbox, ejecuta writeBackLeadChangeToZoho
// y marca done/failed. Diseñado para correr periódicamente desde el cron
// /api/internal/zoho-pull/cron (Fase 05b) junto con renovación de suscripción
// y reconciliación diaria.
//
// Patrón idéntico a src/lib/integrations/sheets/outbox-processor.ts (Sprint 4).
// Diferencias clave:
//   - Tabla: zoho_writeback_outbox (vs sheets_writeback_outbox).
//   - Función: writeBackLeadChangeToZoho (vs writeBackLeadChange).
//   - Audit: crm_type='zoho', provider='zoho' (vs 'google_sheets').

import { createHash } from "crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { writeBackLeadChangeToZoho, type WrittenFieldAudit } from "./writeback";
import {
  CrmWriteAuditRepository,
  IntegrationsRepository,
} from "@/lib/repositories/integrations-repository";

const log = createLogger("zoho-pull.outbox");
const auditRepo = new CrmWriteAuditRepository();
const integrationsRepo = new IntegrationsRepository();

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface OutboxRunResult {
  picked: number;
  processed: number;
  failed: number;
  errors: string[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_BATCH = 25;
const MAX_ATTEMPTS = 5;

// ─── Audit R-014 ──────────────────────────────────────────────────────────────

/**
 * Inserta una fila de audit (R-014) por cada campo escrito en Zoho.
 * Best-effort: si el audit falla, lo loguea pero NO revierte el writeback
 * (la escritura en Zoho ya ocurrió, perder el audit es preferible a revertir).
 */
async function recordWritebackAudit(
  tenantId: string,
  leadId: string,
  writtenFields: WrittenFieldAudit[]
): Promise<void> {
  if (writtenFields.length === 0) return;

  const { data: integration } = await integrationsRepo.findByCrmType(tenantId, "zoho");
  if (!integration) {
    log.warn("audit skipped: tenant sin integration zoho activa", {
      tenant_id: tenantId,
      lead_id: leadId,
    });
    return;
  }

  for (const field of writtenFields) {
    const payloadHash = createHash("sha256")
      .update(
        `${field.integration_id}|${field.zoho_lead_id}|${field.field_name}|${field.new_value ?? ""}`
      )
      .digest("hex");

    const { error } = await auditRepo.create(tenantId, {
      tenant_id: tenantId,
      integration_id: integration.id,
      crm_type: "zoho",
      operation: "update",
      local_entity: "lead",
      local_entity_id: leadId,
      crm_entity_id: field.zoho_lead_id,
      payload_hash: payloadHash,
      result: "success",
      write_policy: "overwrite_with_audit",
      provider: "zoho",
      lead_id: leadId,
      field_name: field.field_name,
      new_value: field.new_value,
    });

    if (error) {
      log.warn("audit insert falló (no bloqueante)", {
        tenant_id: tenantId,
        lead_id: leadId,
        zoho_lead_id: field.zoho_lead_id,
        field_name: field.field_name,
        error,
      });
    }
  }
}

// ─── Procesador principal ─────────────────────────────────────────────────────

/**
 * Procesa hasta MAX_BATCH filas pending de zoho_writeback_outbox.
 * Idempotente: si una fila ya está en processing, no la re-toca.
 *
 * Diseño claim en 2 pasos (igual que Sheets): PostgREST NO soporta
 * order()+limit() sobre UPDATE, así que se hace SELECT ids primero y
 * luego UPDATE ... IN (...).
 *
 * Exportado para ser invocado desde el cron route de Fase 05b.
 */
export async function runZohoWritebackOutbox(): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { picked: 0, processed: 0, failed: 0, errors: [] };
  const supabase = await getAdminSupabaseClient();

  // Paso 1a — Seleccionar IDs pending ordenados por antigüedad.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: pendingIds, error: selErr } = await (
    supabase.from("zoho_writeback_outbox" as any) as any
  )
    .select("id")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (selErr) {
    log.error("outbox select pendientes falló", { error: selErr.message });
    result.errors.push(`claim: ${selErr.message}`);
    return result;
  }

  const idsToClaim = ((pendingIds ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (idsToClaim.length === 0) return result;

  // Paso 1b — Marcar como processing (solo los que siguen pending para evitar race).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: claimed, error: claimErr } = await (
    supabase.from("zoho_writeback_outbox" as any) as any
  )
    .update({ status: "processing" })
    .in("id", idsToClaim)
    .eq("status", "pending")
    .select("id, lead_id, tenant_id, changes, attempts");
  /* eslint-enable @typescript-eslint/no-explicit-any */

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

  // Paso 2 — Procesar uno a uno.
  for (const row of rows) {
    try {
      const wb = await writeBackLeadChangeToZoho(row.tenant_id, row.lead_id, {
        changes: row.changes,
      });

      if (wb.errors.length > 0 && wb.fieldsWritten === 0) {
        // Todo falló → reintentar más tarde (o marcar failed si alcanzó MAX_ATTEMPTS).
        const newAttempts = row.attempts + 1;
        const finalFailed = newAttempts >= MAX_ATTEMPTS;
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await (supabase.from("zoho_writeback_outbox" as any) as any)
          .update({
            status: finalFailed ? "failed" : "pending",
            attempts: newAttempts,
            last_error: wb.errors.slice(0, 3).join("; "),
          })
          .eq("id", row.id);
        /* eslint-enable @typescript-eslint/no-explicit-any */
        result.failed++;
        continue;
      }

      // Al menos un campo escrito → marcar done.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      await (supabase.from("zoho_writeback_outbox" as any) as any)
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          last_error: wb.errors.length > 0 ? wb.errors.join("; ") : null,
        })
        .eq("id", row.id);
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // R-014: audit append-only por cada campo escrito exitosamente.
      // Best-effort: no rollback del writeback si el audit falla.
      try {
        await recordWritebackAudit(row.tenant_id, row.lead_id, wb.writtenFields);
      } catch (auditErr) {
        log.warn("audit batch falló (no bloqueante)", {
          tenant_id: row.tenant_id,
          lead_id: row.lead_id,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }

      result.processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const newAttempts = row.attempts + 1;
      const finalFailed = newAttempts >= MAX_ATTEMPTS;

      /* eslint-disable @typescript-eslint/no-explicit-any */
      await (supabase.from("zoho_writeback_outbox" as any) as any)
        .update({
          status: finalFailed ? "failed" : "pending",
          attempts: newAttempts,
          last_error: msg,
        })
        .eq("id", row.id);
      /* eslint-enable @typescript-eslint/no-explicit-any */

      result.failed++;
      result.errors.push(`lead ${row.lead_id}: ${msg}`);
      log.warn("outbox row failed", {
        outbox_id: row.id,
        lead_id: row.lead_id,
        attempts: newAttempts,
        failed: finalFailed,
        error: msg,
      });
    }
  }

  log.info("outbox batch processed", { ...result });
  return result;
}
