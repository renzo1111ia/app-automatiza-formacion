import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handle Retell Webhook Callback
 * When a call finishes or is analyzed, Retell sends a payload here.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Very basic simple logging to verify the webhook arrival payload structure in console.
        console.log(`[RETELL WEBHOOK] Received event: ${body.event}`);

        // We specifically listen for call_analyzed or call_ended
        if (body.event !== "call_analyzed" && body.event !== "call_ended") {
            return NextResponse.json({ received: true });
        }

        const callData = body.call;
        if (!callData) {
            return NextResponse.json({ error: "No call object in payload" }, { status: 400 });
        }

        // We passed tenant_id and lead_id in the createCall metadata
        const metadata = callData.metadata || {};
        const tenantId = metadata.tenant_id;
        const leadId = metadata.lead_id;

        if (!tenantId || !leadId) {
            // Cannot associate to any specific inbox.
            console.warn(`[RETELL WEBHOOK] Missing tenant_id or lead_id in metadata for call ${callData.call_id}`);
            return NextResponse.json({ received: true, warning: "Missing metadata" });
        }

        // Format a message for the Inbox chat
        const duration = callData.call_duration || "0";
        const callStatus = callData.call_status;
        const recordingUrl = callData.recording_url;
        const transcript = callData.transcript || "(Sin transcripción)";
        const callAnalysis = callData.call_analysis?.custom_analysis_data || {};

        let summaryText = `📞 **Llamada de Voz (${callStatus})** - Duración: ${duration}s\n\n`;
        if (callData.call_analysis?.call_summary) {
            summaryText += `*Resumen AI:* ${callData.call_analysis.call_summary}\n\n`;
        }
        summaryText += `*Transcripción:*\n${transcript}`;

        const supabaseAdmin = getAdminSupabase();

        // 1. Insert formal call record in `llamadas` table for Analytics and History
        const { error: llamadaError, data: llamadaInsertRaw } = await (supabaseAdmin
            .from("llamadas" as any) as any)
            .insert({
                tenant_id: tenantId,
                id_lead: leadId,
                id_llamada_retell: callData.call_id,
                tipo_agente: "RETELL_AI",
                nombre_agente: callData.agent_id,
                estado_llamada: callStatus,
                razon_termino: callData.disconnection_reason || null,
                duracion_segundos: duration ? parseInt(duration, 10) : 0,
                url_grabacion: recordingUrl || null,
                transcripcion: transcript,
                resumen: callData.call_analysis?.call_summary || null
            } as any)
            .select("id")
            .single();

        const llamadaInsert = llamadaInsertRaw as any;

        if (llamadaError) {
             console.error("[RETELL WEBHOOK] Error saving llamada:", llamadaError);
        }

        // 2. Delegate Deep Qualification Analysis to Background Service
        const { PostAnalysisService } = await import("@/lib/services/post-analysis");
        
        // We trigger it without awaiting if we want it to be fully background, 
        // but for now, we'll let it run so we can see logs in the dashboard.
        PostAnalysisService.processInteraction({
            leadId,
            tenantId,
            transcript,
            channel: 'CALL',
            externalId: callData.call_id,
            durationMs: duration ? parseInt(duration, 10) * 1000 : 0,
            disconnectionReason: callData.disconnection_reason || null
        }).catch(err => console.error("[RETELL WEBHOOK] Post-Analysis Error:", err));

        // 3. Insert as a system log type message in the Inbox
        const { error: insertError } = await (supabaseAdmin
            .from("chat_messages" as any) as any)
            .insert({
                tenant_id: tenantId,
                lead_id: leadId,
                direction: "OUTBOUND", 
                message_type: "SYSTEM_LOG",
                content: summaryText,
                sent_by: "Retell AI",
                status: "DELIVERED",
                metadata: {
                    call_id: callData.call_id,
                    recording_url: recordingUrl,
                    analysis: callAnalysis,
                    llamada_db_id: llamadaInsert?.id
                }
            } as any);

        if (insertError) {
            console.error("[RETELL WEBHOOK] Failed to insert chat_message:", insertError);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Logged to Inbox" });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[RETELL WEBHOOK POST] Error:", msg);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Ensure we have an admin client instance for the webhook
function getAdminSupabase() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Admin key

    if (!url || !key) {
        throw new Error("Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    }

    return createClient<Database>(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
}
