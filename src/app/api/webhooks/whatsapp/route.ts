import { NextResponse } from "next/server";
import { WhatsAppWebhookProcessor } from "@/lib/core/processors/WhatsAppWebhookProcessor";
import crypto from "crypto";

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
    try {
        const rawBody = await req.text();
        const body = JSON.parse(rawBody);
        const signature = req.headers.get("x-hub-signature-256");
        const appSecret = process.env.WHATSAPP_APP_SECRET;

        // 1. Validar firma si existe el App Secret
        if (appSecret && signature) {
            const hash = "sha256=" + crypto
                .createHmac("sha256", appSecret)
                .update(rawBody)
                .digest("hex");

            if (hash !== signature) {
                console.warn("[WHATSAPP WEBHOOK] ❌ Invalid signature mismatch.");
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        // 2. Estructura básica de WhatsApp
        if (body.object !== "whatsapp_business_account") {
            return NextResponse.json({ error: "Invalid object type" }, { status: 400 });
        }

        // 3. Procesar mensajes a través del procesador central
        const result = await WhatsAppWebhookProcessor.processIncomingWhatsApp(body);

        return NextResponse.json({ success: result });
    } catch (error: any) {
        console.error("❌ [WHATSAPP WEBHOOK] Error crítico:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
