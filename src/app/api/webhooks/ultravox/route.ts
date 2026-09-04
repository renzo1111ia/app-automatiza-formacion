import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { createLogger } from "@/lib/utils/logger";
import { getAuthServiceRoleKey } from "@/lib/auth-config";

const log = createLogger("webhook.ultravox");

export async function POST(req: Request) {
  const trace_id = crypto.randomUUID();

  try {
    const rawBody = await req.text();
    // TODO: Verify Ultravox signature (e.g. X-Ultravox-Signature) 
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      log.warn("Invalid JSON payload", { trace_id });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    log.info("Webhook received", { trace_id, event: body.event, call_id: body.call?.callId });

    if (body.event !== "call.ended" && body.event !== "call.analyzed") {
      return NextResponse.json({ received: true });
    }

    const callData = body.call;
    if (!callData) {
      return NextResponse.json({ error: "No call object in payload" }, { status: 400 });
    }

    const metadata = callData.systemMetadata || callData.templateContext || {};
    const tenantId = metadata.tenant_id;
    const leadId = metadata.lead_id;

    if (!tenantId || !leadId) {
      console.warn(
        `[ULTRAVOX WEBHOOK] Missing tenant_id or lead_id in metadata for call ${callData.callId}`
      );
      return NextResponse.json({ received: true, warning: "Missing metadata" });
    }

    const durationStr = callData.duration;
    const duration = durationStr ? parseInt(durationStr.replace("s", ""), 10) : 0;
    const callStatus = callData.status || "ended";
    const recordingUrl = callData.recordingUrl;
    const transcript = "(Transcripción de Ultravox - pendiente de sync API)";
    
    let summaryText = `📞 **Llamada de Voz (${callStatus})** - Duración: ${duration}s\n\n`;
    summaryText += `*Transcripción disponible en el panel.*`;

    const supabaseAdmin = getAdminSupabase();

    const { error: llamadaError, data: llamadaInsertRaw } = await supabaseAdmin
      .from("llamadas")
      .insert({
        tenant_id: tenantId,
        id_lead: leadId,
        id_llamada_retell: callData.callId,
        tipo_agente: "ULTRAVOX_AI",
        nombre_agente: callData.agentId,
        estado_llamada: callStatus,
        razon_termino: callData.endReason || null,
        duracion_segundos: duration,
        url_grabacion: recordingUrl || null,
        transcripcion: transcript,
      } as any)
      .select("id")
      .single();

    const llamadaInsert = llamadaInsertRaw as any;

    if (llamadaError) {
      console.error("[ULTRAVOX WEBHOOK] Error saving llamada:", llamadaError);
    }

    const { PostAnalysisService } = await import("@/lib/services/post-analysis");
    PostAnalysisService.processInteraction({
      leadId,
      tenantId,
      transcript,
      channel: "CALL",
      externalId: callData.callId,
      durationMs: duration * 1000,
      disconnectionReason: callData.endReason || null,
    }).catch((err) => console.error("[ULTRAVOX WEBHOOK] Post-Analysis Error:", err));

    const { error: insertError } = await supabaseAdmin.from("chat_messages").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      direction: "OUTBOUND",
      message_type: "SYSTEM_LOG",
      content: summaryText,
      sent_by: "Ultravox AI",
      status: "DELIVERED",
      metadata: {
        call_id: callData.callId,
        recording_url: recordingUrl,
        llamada_db_id: llamadaInsert?.id,
      },
    } as any);

    if (insertError) {
      console.error("[ULTRAVOX WEBHOOK] Failed to insert chat_message:", insertError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Logged to Inbox" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ULTRAVOX WEBHOOK POST] Error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing Supabase configuration (SUPABASE_URL)");
  }
  const key = getAuthServiceRoleKey();

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
