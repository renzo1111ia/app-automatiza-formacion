// Sprint 5 (Fase 05b) - Mantenimiento del pull Zoho event-driven.
//
// Backstop del flujo event-driven (NO es el camino feliz). Dos tareas:
//   1. renewExpiringZohoSubscriptions(): renueva las suscripciones
//      Notifications API próximas a caducar (las de method 'workflow_webhook'
//      NO caducan → se excluyen).
//   2. runZohoReconciliation(): 1×/día por conexión, busca leads modificados
//      desde el último sync y los re-encola por el MISMO event-processor
//      (idempotente por zoho_lead_id → NO duplica). Recupera lo que el webhook
//      no entregó.
//
// Patrón de renovación alineado con sheets/outbox-processor.ts
// (renewExpiringWatchChannels). service_role (bypass RLS, worker interno).

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import type { CRMLead } from "@/lib/integrations/crm/interface";
import { createLogger } from "@/lib/utils/logger";
import { renewZohoNotifications } from "./subscription";
import { enqueueZohoLeadEvent } from "./queue";

// El proveedor Zoho soporta searchLeads paginado (page, perPage); la interfaz
// genérica ICRMProvider solo declara searchLeads(criteria). Narrowing local.
type PaginatedSearchProvider = {
  searchLeads(criteria: string, page?: number, perPage?: number): Promise<CRMLead[]>;
};

const log = createLogger("zoho-pull.maintenance");

// Margen de renovación: renovar suscripciones que caducan en <24h.
const RENEW_MARGIN_MS = 24 * 60 * 60 * 1000;
// Reconciliación: solo 1×/día por conexión (last_synced_at de ayer o antes).
const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Cap de leads por run para no saturar (≈5 páginas de 100).
const MAX_RECONCILE_LEADS = 500;
const RECONCILE_PER_PAGE = 100;
const MAX_RECONCILE_PAGES = Math.ceil(MAX_RECONCILE_LEADS / RECONCILE_PER_PAGE);
// Si una conexión nunca sincronizó (last_synced_at null), reconcilia los
// últimos 7 días como cursor inicial razonable.
const INITIAL_CURSOR_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Renovación de suscripciones Notifications API ──────────────────────────

/**
 * Renueva las suscripciones Notifications API que caducan en <24h. Las
 * conexiones con method 'workflow_webhook' (webhook manual en Zoho) NO caducan
 * y quedan excluidas. Llamar desde el cron (cada 30-60 min).
 */
export async function renewExpiringZohoSubscriptions(): Promise<{
  checked: number;
  renewed: number;
  failed: number;
}> {
  const result = { checked: 0, renewed: 0, failed: 0 };
  const supabase = await getAdminSupabaseClient();
  const threshold = new Date(Date.now() + RENEW_MARGIN_MS).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("zoho_sync_connections" as any) as any)
    .select("id, integration_id, tenant_id, subscription_expiry")
    .eq("is_active", true)
    .eq("subscription_method", "notifications_api")
    .lt("subscription_expiry", threshold)
    .not("subscription_expiry", "is", null);

  if (error) {
    log.error("renewExpiring select falló", { error: error.message });
    return result;
  }

  const rows = (data ?? []) as Array<{ id: string; integration_id: string }>;
  result.checked = rows.length;

  for (const row of rows) {
    try {
      const renewed = await renewZohoNotifications(row.integration_id);
      result.renewed++;
      log.info("Zoho suscripción renovada", {
        integration_id: row.integration_id,
        new_expiry: renewed.expiry,
      });
    } catch (err) {
      result.failed++;
      log.warn("Zoho suscripción renovación falló", {
        integration_id: row.integration_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info("renewExpiringZohoSubscriptions done", { ...result });
  return result;
}

// ─── Reconciliación diaria (red de seguridad) ───────────────────────────────

/** Formato criteria Zoho v8: ISO 8601 con offset (ej. 2026-06-01T00:00:00+00:00). */
function toZohoCriteriaTime(date: Date): string {
  // toISOString() produce "...Z"; Zoho admite el offset explícito +00:00.
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "+00:00")
    .replace(/Z$/, "+00:00");
}

/**
 * Reconciliación incremental: por cada conexión activa cuyo último sync sea de
 * ayer o antes (o null), busca en Zoho los leads modificados desde el cursor y
 * los re-encola por el event-processor (idempotente). Recupera leads que el
 * webhook no entregó. NO reimplementa ingesta — solo enqueue.
 */
export async function runZohoReconciliation(): Promise<{
  checked: number;
  leadsEnqueued: number;
  errors: string[];
}> {
  const result = { checked: 0, leadsEnqueued: 0, errors: [] as string[] };
  const supabase = await getAdminSupabaseClient();
  const dueThreshold = new Date(Date.now() - RECONCILE_INTERVAL_MS).toISOString();

  // Conexiones activas cuyo last_synced_at sea de ayer o antes, o null
  // (nunca reconciliadas). PostgREST: or() combina "<= ayer" con "is null".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("zoho_sync_connections" as any) as any)
    .select("id, integration_id, tenant_id, last_synced_at")
    .eq("is_active", true)
    .or(`last_synced_at.lt.${dueThreshold},last_synced_at.is.null`);

  if (error) {
    log.error("reconciliation select falló", { error: error.message });
    result.errors.push(`select: ${error.message}`);
    return result;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    integration_id: string;
    tenant_id: string;
    last_synced_at: string | null;
  }>;
  result.checked = rows.length;

  for (const conn of rows) {
    try {
      await reconcileConnection(conn, result);
      // Sella el cursor para que no se reconcilie de nuevo hasta mañana.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("zoho_sync_connections" as any) as any)
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
    } catch (err) {
      // Degradar sin abortar el resto (ej. OAuth no configurado en cuenta real).
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`connection ${conn.integration_id}: ${msg}`);
      log.warn("reconciliación de conexión falló (continúa con el resto)", {
        integration_id: conn.integration_id,
        error: msg,
      });
    }
  }

  log.info("runZohoReconciliation done", {
    checked: result.checked,
    leadsEnqueued: result.leadsEnqueued,
    errors: result.errors.length,
  });
  return result;
}

async function reconcileConnection(
  conn: { integration_id: string; tenant_id: string; last_synced_at: string | null },
  result: { leadsEnqueued: number }
): Promise<void> {
  const provider = (await CRMFactory.getProviderForIntegration(
    conn.integration_id
  )) as unknown as PaginatedSearchProvider;

  const cursorDate = conn.last_synced_at
    ? new Date(conn.last_synced_at)
    : new Date(Date.now() - INITIAL_CURSOR_MS);
  // VERIFICAR formato criteria contra cuenta real (operador greater_than v8).
  const criteria = `(Modified_Time:greater_than:${toZohoCriteriaTime(cursorDate)})`;
  const triggeredAt = new Date().toISOString();

  let enqueuedForConn = 0;
  for (let page = 1; page <= MAX_RECONCILE_PAGES; page++) {
    const leads = await provider.searchLeads(criteria, page, RECONCILE_PER_PAGE);
    if (leads.length === 0) break;

    for (const lead of leads) {
      if (enqueuedForConn >= MAX_RECONCILE_LEADS) break;
      // Idempotente: el event-processor deduplica por zoho_lead_id.
      await enqueueZohoLeadEvent({
        integration_id: conn.integration_id,
        tenant_id: conn.tenant_id,
        zoho_lead_ids: [lead.id],
        trigger: "reconcile",
        triggered_at: triggeredAt,
      });
      enqueuedForConn++;
      result.leadsEnqueued++;
    }

    if (enqueuedForConn >= MAX_RECONCILE_LEADS) break;
    if (leads.length < RECONCILE_PER_PAGE) break; // última página
  }

  log.info("conexión reconciliada", {
    integration_id: conn.integration_id,
    leads_enqueued: enqueuedForConn,
  });
}
