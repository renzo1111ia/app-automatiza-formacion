import { NextResponse } from "next/server";
import { processIncomingWhatsApp } from "@/lib/core/processors/WhatsAppWebhookProcessor";
import { verifyHmacSignature } from "@/lib/api-auth";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("webhook.whatsapp");

/**
 * WHATSAPP WEBHOOK (META CLOUD API)
 * GET: Verification for Meta Dashboard
 * POST: Incoming messages and status updates
 *
 * Sprint 0 tarea 1-14: validación HMAC OBLIGATORIA — antes se saltaba si
 * la env var faltaba o el header no venía. Ahora ambas son requeridas y se
 * compara timing-safe vía `verifyHmacSignature`.
 *
 * Sprint 3 phase-02 (4-03): logger Pino estructurado.
 */

// Verification Endpoint (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!verifyToken) {
    log.error("WHATSAPP_VERIFY_TOKEN no configurado");
    return new Response("Service Unavailable", { status: 503 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    log.info("Webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }

  log.warn("Verification failed: invalid token", { mode });
  return new Response("Forbidden", { status: 403 });
}

// Message Receiver (POST)
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

    // Sprint 0 1-14: WHATSAPP_APP_SECRET es requerido. Antes el código
    // hacía `if (appSecret && signature)` permitiendo cualquier payload
    // anónimo si la env var faltaba — finding DA-2-006.
    if (!appSecret) {
      console.error("[WHATSAPP WEBHOOK] WHATSAPP_APP_SECRET no configurado.");
      return NextResponse.json({ error: "Service misconfigured" }, { status: 503 });
    }
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyHmacSignature(rawBody, signature, appSecret)) {
      console.warn("[WHATSAPP WEBHOOK] Invalid signature mismatch.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 2. Estructura básica de WhatsApp
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Invalid object type" }, { status: 400 });
    }

    // 3. Procesar mensajes a través del procesador central
    // Nota: Meta envía una estructura compleja, processIncomingWhatsApp maneja la extracción interna.
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value || !value.messages) continue;

        for (const message of value.messages) {
          const from = message.from;
          const wabaId = value.metadata?.phone_number_id;
          const contactName = value.contacts?.[0]?.profile?.name || null;

          // Procesamiento asíncrono para no bloquear a Meta
          processIncomingWhatsApp(from, message, wabaId, contactName).catch((err) => {
            console.error("[WHATSAPP WEBHOOK] Error en procesamiento:", err);
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("❌ [WHATSAPP WEBHOOK] Error crítico:", (error as Error).message);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
