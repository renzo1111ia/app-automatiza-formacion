/**
 * Sprint 1 NEW-13 — Política unificada de handoff humano.
 *
 * ADR: docs/adr/ADR-014-politica-handoff-humano.md
 * Migración: supabase/migrations/20260522200000_lead_unreachable_handoff_policy.sql
 * Origen: Bea correcciones V1 §"Escalado a Humanos (Handoff)"
 *
 * Único punto donde se marca un lead como ilocalizable. Reemplaza el blueprint
 * Zoho "Anulado automáticamente por IA - Número Inválido" y la actualización
 * directa `current_stage = LOST` que estaban duplicadas en orchestrator.ts.
 *
 * NO crea tareas ni blueprints en el CRM cliente — los asesores no deben perder
 * tiempo con leads ilocalizables (decisión Bea V1).
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { logOrchestrationStep } from "@/lib/core/scheduler";
import { LeadStageEnum, HandoffReasonEnum, type HandoffReason } from "@/lib/schemas/_base";

export type UnreachableReason = HandoffReason;
export { HandoffReasonEnum };

export interface HandleUnreachableResult {
  success: boolean;
  error?: string;
}

/**
 * Marca un lead como ilocalizable.
 *
 * Efectos:
 *   - `lead.current_stage = "UNREACHABLE"`
 *   - `lead.tipo_lead = "ilocalizable"`
 *   - `lead.unreachable_reason = <reason>`
 *   - Log estructurado vía `logOrchestrationStep`.
 *
 * NO hace:
 *   - NO crea tarea/blueprint en CRM cliente.
 *   - NO envía notificación al asesor humano.
 *
 * @param leadId    UUID del lead.
 * @param reason    Motivo del descarte.
 * @param opts.tenantId  Opcional. Si se proporciona, se loguea junto al evento.
 */
export async function handleUnreachable(
  leadId: string,
  reason: UnreachableReason,
  opts?: { tenantId?: string }
): Promise<HandleUnreachableResult> {
  try {
    const supabase = await getSupabaseServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("lead")
      .update({
        current_stage: LeadStageEnum.enum.UNREACHABLE,
        tipo_lead: "ilocalizable",
        unreachable_reason: reason,
      })
      .eq("id", leadId);

    if (error) {
      console.error(`[HANDOFF] handleUnreachable failed for lead ${leadId}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`[HANDOFF] Lead ${leadId} marked UNREACHABLE (reason: ${reason})`);

    if (opts?.tenantId) {
      try {
        await logOrchestrationStep({
          tenantId: opts.tenantId,
          leadId,
          step: 0,
          actionType: "UNREACHABLE",
          result: "SUCCESS",
          errorMessage: `reason:${reason}`,
        });
      } catch (logErr) {
        // No bloqueamos el handoff si el log falla.
        console.warn(`[HANDOFF] Log failed (non-blocking):`, logErr);
      }
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[HANDOFF] handleUnreachable threw for lead ${leadId}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Comprueba si el contador de intentos ha alcanzado el máximo configurado.
 * Helper para el orquestador antes de cada step de contacto.
 *
 * @param currentAttempts  Valor actual de `lead.contact_attempts`.
 * @param maxAttempts      Valor de `tenant.config.max_contact_attempts` (default 5).
 */
export function hasReachedMaxAttempts(currentAttempts: number, maxAttempts?: number): boolean {
  const limit = typeof maxAttempts === "number" && maxAttempts > 0 ? maxAttempts : 5;
  return currentAttempts >= limit;
}
