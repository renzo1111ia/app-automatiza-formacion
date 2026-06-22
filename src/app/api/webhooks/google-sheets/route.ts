// Sprint 4 - Webhook receiver Drive push notifications.
//
// Google Drive notifica cambios en archivos vigilados (watch channels) via
// POST a esta URL. Headers utiles:
//   X-Goog-Channel-Id      -> channelId que generamos al setupWatch
//   X-Goog-Channel-Token   -> token HMAC nuestro para autenticar
//   X-Goog-Resource-Id     -> ID opaco del recurso
//   X-Goog-Resource-State  -> "sync" (al crear el canal) | "change" | "remove"
//   X-Goog-Message-Number  -> nº de mensaje (idempotencia secundaria)
//
// Validacion:
//   1. channel_id existe en sheet_connections con is_active=true.
//   2. channel_token coincide con el persistido.
//   3. resource-state == "change" (ignoramos "sync" inicial).
// Luego encola un sheets-pull job (dedup automatico por jobId).

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { enqueueSheetPull, ensureSheetsPullWorker } from "@/lib/integrations/sheets/queue";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("webhook.google-sheets");

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const channelToken = req.headers.get("x-goog-channel-token");
  const resourceState = req.headers.get("x-goog-resource-state");
  const messageNumber = req.headers.get("x-goog-message-number");

  if (!channelId || !channelToken) {
    log.warn("Webhook sin channel headers, ignorado", {
      hasChannelId: Boolean(channelId),
      hasChannelToken: Boolean(channelToken),
    });
    return NextResponse.json({ ok: false, error: "missing_channel_headers" }, { status: 400 });
  }

  // Drive envia un primer mensaje "sync" tras crear el canal. No es un cambio
  // real, lo respondemos 200 sin hacer nada.
  if (resourceState === "sync") {
    log.info("Drive sync ping received", { channelId, messageNumber });
    return NextResponse.json({ ok: true, ignored: "sync" });
  }

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await supabase
    .from("sheet_connections")
    .select("id, tenant_id, drive_channel_token, is_active")
    .eq("drive_channel_id", channelId)
    .maybeSingle();

  if (error) {
    log.error("Error consultando sheet_connection", { channelId, error: error.message });
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  if (!row) {
    log.warn("Webhook con channelId desconocido", { channelId });
    return NextResponse.json({ ok: false, error: "unknown_channel" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  if (r.drive_channel_token !== channelToken) {
    log.error("channel_token MISMATCH - posible spoof", { channelId });
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }
  if (!r.is_active) {
    log.info("Webhook para connection inactiva, ignorado", { channelId });
    return NextResponse.json({ ok: true, ignored: "inactive" });
  }

  // Garantiza que el worker consume la cola en este proceso (standalone no
  // ejecuta instrumentation.ts → sin esto los jobs quedarían en `wait`).
  ensureSheetsPullWorker();

  // Encolar pull con delay corto - Drive notifica varias veces seguidas para
  // batches; dedup por jobId hace que solo se procese una vez por ventana.
  try {
    await enqueueSheetPull(
      {
        sheet_connection_id: r.id,
        tenant_id: r.tenant_id,
        trigger: "webhook",
        triggered_at: new Date().toISOString(),
      },
      5_000
    );
    log.info("sheets-pull enqueued desde webhook Drive", {
      channelId,
      sheet_connection_id: r.id,
      tenant_id: r.tenant_id,
      resourceState,
      messageNumber,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Enqueue falló desde webhook", {
      channelId,
      sheet_connection_id: r.id,
      error: msg,
    });
    return NextResponse.json({ ok: false, error: "enqueue_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// GET para health check (Drive a veces hace GET tras setup).
export async function GET() {
  return NextResponse.json({ ok: true, service: "google-sheets-webhook" });
}
