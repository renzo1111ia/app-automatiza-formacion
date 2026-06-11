// Sprint 5 (Fase 05b) - Endpoint cron manual para el pull Zoho event-driven.
//
// Dispara tres tareas de mantenimiento (backstop del flujo event-driven):
//   1. renewExpiringZohoSubscriptions(): renueva suscripciones Notifications
//      API con expiry <24h (las workflow_webhook manuales no caducan).
//   2. runZohoReconciliation(): 1×/día por conexión, recupera leads que el
//      webhook no entregó (idempotente vía event-processor).
//   3. runZohoWritebackOutbox(): procesa filas pending de zoho_writeback_outbox.
//
// Auth: header `x-cron-secret` debe coincidir con CRON_SECRET (env). En
// producción lo invoca un cron externo (Dokploy schedule, etc.). En dev se
// invoca manualmente. Patrón fail-closed idéntico a /api/internal/sheets/cron
// (SEC-S4-01 ya endurecido).

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  renewExpiringZohoSubscriptions,
  runZohoReconciliation,
} from "@/lib/integrations/zoho-pull/maintenance";
import { runZohoWritebackOutbox } from "@/lib/integrations/zoho-pull/outbox-processor";
import { ensureZohoLeadWorker } from "@/lib/integrations/zoho-pull/queue";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("cron.zoho");

/**
 * Autoriza el endpoint cron. FAIL-CLOSED (SEC-S4-01, OWASP A07/A05):
 * - Si CRON_SECRET no está configurado:
 *     · en producción → SE DENIEGA (evita endpoint abierto a internet que
 *       permitiría disparar reconciliación/writeback masivo a Zoho).
 *     · en desarrollo → se permite con warning (conveniencia local).
 * - Si está configurado → comparación en tiempo constante contra el header.
 */
function authorize(req: NextRequest): boolean {
  const headerSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      log.error("CRON_SECRET no configurado en producción - endpoint cron DENEGADO");
      return false;
    }
    log.warn("CRON_SECRET no configurado - endpoint sin auth (solo dev)");
    return true;
  }

  if (!headerSecret) return false;
  const a = Buffer.from(headerSecret);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    // La reconciliación encola jobs en la cola Zoho → garantizamos que el worker
    // los consume en este proceso (standalone no ejecuta instrumentation.ts).
    ensureZohoLeadWorker();

    // Renovación + reconciliación en paralelo (independientes); la reconciliación
    // internamente recorre conexiones de forma secuencial.
    const [subscriptions, reconciliation] = await Promise.all([
      renewExpiringZohoSubscriptions(),
      runZohoReconciliation(),
    ]);
    // Writeback al final: puede arrastrar cambios derivados de la reconciliación.
    const writeback = await runZohoWritebackOutbox();

    return NextResponse.json({ ok: true, subscriptions, reconciliation, writeback });
  } catch (err) {
    // S5-SEC-01 (A09): el detalle interno (mensajes Postgres, etc.) solo va al
    // log; al cliente se le devuelve un error genérico para no filtrar internals.
    log.error("cron zoho falló", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

// GET para health check del endpoint en sí.
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: "zoho-pull-cron",
    endpoints: ["subscriptions", "reconciliation", "writeback"],
  });
}
