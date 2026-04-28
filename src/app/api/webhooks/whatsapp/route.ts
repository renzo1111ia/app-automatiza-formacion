import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * WHATSAPP WEBHOOK (META CLOUD API)
 * GET: Verification for Meta Dashboard
 * POST: Incoming messages and status updates
 */

const VERIFY_TOKEN = "automatiza_for_2025";

// Verification Endpoint (GET)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("[WHATSAPP WEBHOOK] ✅ Webhook verified successfully.");
        return new Response(challenge, { status: 200 });
    }

    console.warn("[WHATSAPP WEBHOOK] ❌ Verification failed. Invalid token.");
    return new Response("Forbidden", { status: 403 });
}

// Message Receiver (POST)
export async function POST(req: Request) {
    console.log("🚀 [WHATSAPP WEBHOOK] Solicitud recibida...");
    try {
        const rawBody = await req.text();
        console.log("📦 [WHATSAPP WEBHOOK] Body:", JSON.stringify(JSON.parse(rawBody), null, 2));
        const signature = req.headers.get("x-hub-signature-256");
        const appSecret = process.env.WHATSAPP_APP_SECRET;

        // 1. Validar firma si existe el App Secret
        if (appSecret && signature) {
            const crypto = await import("crypto");
            const hash = "sha256=" + crypto
                .createHmac("sha256", appSecret)
                .update(rawBody)
                .digest("hex");

            if (hash !== signature) {
                console.warn("[WHATSAPP WEBHOOK] ❌ Invalid signature.");
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const body = JSON.parse(rawBody);

        // --- DEBUG LOG: Capturar cuerpo completo ---
        try {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
            await supabase.from("system_logs").insert({
                tenant_id: "47e84fa2-73f3-4e23-9267-1e49d4442f70", // Usamos el ID del tenant principal para debug
                event_type: "WHATSAPP_WEBHOOK_RAW",
                message: "Cuerpo recibido de Meta",
                metadata: body
            });
        } catch (e) {
            console.error("Error logging raw webhook:", e);
        }

        // 1. Basic Structure check
        if (body.object !== "whatsapp_business_account") {
            return NextResponse.json({ error: "Invalid object type" }, { status: 400 });
        }

        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                const value = change.value;
                if (!value) continue;

                // ── A. Handle Status Updates (Sent, Delivered, Read) ──
                if (value.statuses) {
                    for (const status of value.statuses) {
                        console.log(`[WHATSAPP WEBHOOK] Status Update: ${status.status} for message ${status.id}`);
                        // Logic to update `chat_messages` status can be added here
                    }
                }

                // ── B. Handle Incoming Messages ──
                if (value.messages) {
                    // Extract contact name if available
                    const contactName = value.contacts?.[0]?.profile?.name || null;

                    for (const message of value.messages) {
                        const from = message.from; // Phone number (sender)
                        const wabaId = value.metadata?.phone_number_id;

                        // Delegate processing to a core processor (Non-blocking to avoid Meta timeout)
                        const { processIncomingWhatsApp } = await import("@/lib/core/processors/WhatsAppWebhookProcessor");
                        
                        processIncomingWhatsApp(from, message, wabaId, contactName).catch(err => {
                            console.error("[WHATSAPP WEBHOOK] Background processing error:", err);
                        });
                    }
                }
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[WHATSAPP WEBHOOK POST] Error:", err.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
