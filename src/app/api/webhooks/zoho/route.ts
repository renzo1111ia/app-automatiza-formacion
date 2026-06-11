// Sprint 5 - Webhook receiver Zoho (event-driven).
//
// Zoho notifica acciones (Leads.create / Leads.edit) via POST a esta URL,
// tanto por Notifications API v8 (suscripción programática) como por un
// Workflow Webhook manual del tenant. AMBAS vías terminan aquí.
//
// Autenticación: el token de suscripción viaja en ?token=<token> (lo pusimos en
// la notify_url al suscribir). Se valida en tiempo constante (timingSafeEqual)
// contra zoho_sync_connections.subscription_token. integration_id se resuelve
// del registro de suscripción (por el token), NUNCA del body.
//
// El body trae los ids de los registros afectados (no el lead completo). Por
// cada id encolamos un job; el worker hará getLead() + upsert. Respondemos 200
// rápido (<2s) siempre que el token valide — el procesamiento es async.
//
// Referencia patrón: src/app/api/webhooks/google-sheets/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { enqueueZohoLeadEvent, ensureZohoLeadWorker } from "@/lib/integrations/zoho-pull/queue";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("webhook.zoho");

/** Rechaza si la promesa no resuelve antes de `ms` (no bloquea el webhook). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("enqueue_timeout")), ms)),
  ]);
}

/** Comparación constant-time. Devuelve false si longitudes difieren. */
function tokensMatch(received: string, stored: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Extrae defensivamente los zoho_lead_ids del body (Notifications API o Workflow). */
function extractLeadIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;

  // Notifications API: { ids: [...], operation, module, channel_id, token }
  if (Array.isArray(b.ids)) return b.ids.map(String).filter(Boolean);
  // Algunas variantes: { data: [{ id }, ...] } o { data: [ "id", ... ] }
  if (Array.isArray(b.data)) {
    return b.data
      .map((d) =>
        d && typeof d === "object" ? String((d as Record<string, unknown>).id ?? "") : String(d)
      )
      .filter(Boolean);
  }
  // Workflow Webhook manual: un único id (varias claves posibles).
  const single = b.id ?? b.entity_id ?? b.record_id ?? b.lead_id;
  if (single) return [String(single)];
  return [];
}

/** Claves que NO son campos del lead (id / control de la Notifications API). */
const NON_FIELD_KEYS = new Set([
  "entity_id",
  "id",
  "record_id",
  "lead_id",
  "ids",
  "data",
  "operation",
  "module",
  "channel_id",
  "token",
]);

export interface ExtractedWebhook {
  ids: string[];
  /** Campos inline del lead por id (Vía A "gorda"). Vacío si solo vino el id. */
  fieldsById: Record<string, Record<string, unknown>>;
}

/**
 * Extrae id(s) + campos inline probando TODAS las vías que usa Zoho:
 *   1. Header `Entity_id` — Workflow Webhook (id en header). Los CAMPOS del lead
 *      (si el cliente mapeó "Parámetros del módulo") llegan en el body form-encoded.
 *   2. Query params (?ids=... / ?id=...).
 *   3. Body JSON (Notifications API) o form-encoded (Workflow con campos).
 *
 * Si vienen campos del lead además del id → se devuelven en fieldsById para que
 * el processor cree el lead SIN getLead (no requiere OAuth).
 */
async function extractWebhook(req: NextRequest): Promise<ExtractedWebhook> {
  const out: ExtractedWebhook = { ids: [], fieldsById: {} };

  // Parsear el body (puede traer campos del lead aunque el id venga en header).
  const ct = req.headers.get("content-type") ?? "";
  let bodyObj: Record<string, unknown> | null = null;
  try {
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => null);
      if (j && typeof j === "object") bodyObj = j as Record<string, unknown>;
    } else if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const form = await req.formData().catch(() => null);
      if (form) {
        bodyObj = {};
        for (const [k, v] of form.entries()) bodyObj[k] = v;
      }
    } else {
      const j = await req.json().catch(() => null);
      if (j && typeof j === "object") bodyObj = j as Record<string, unknown>;
    }
  } catch {
    bodyObj = null;
  }

  // 1. id: header → query → body.
  const headerId =
    req.headers.get("entity_id") ?? req.headers.get("entityid") ?? req.headers.get("x-entity-id");
  const qIds = req.nextUrl.searchParams.getAll("ids");
  const qId =
    req.nextUrl.searchParams.get("id") ??
    req.nextUrl.searchParams.get("entity_id") ??
    req.nextUrl.searchParams.get("record_id");

  if (headerId) {
    out.ids = [String(headerId)];
  } else if (qIds.length > 0) {
    out.ids = qIds
      .flatMap((v) => v.split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (qId) {
    out.ids = [String(qId)];
  } else if (bodyObj) {
    out.ids = extractLeadIdsFromBody(bodyObj);
  }

  // 2. Campos inline del lead (todo el body menos las claves de control). Solo
  // tiene sentido para 1 id (Workflow Webhook envía 1 registro por llamada).
  if (out.ids.length === 1 && bodyObj) {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bodyObj)) {
      if (NON_FIELD_KEYS.has(k.toLowerCase())) continue;
      if (v === undefined || v === null || v === "") continue;
      fields[k] = v;
    }
    if (Object.keys(fields).length > 0) {
      out.fieldsById[out.ids[0]] = fields;
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    log.warn("Webhook Zoho sin token, rechazado");
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 403 });
  }

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn, error } = await (supabase.from("zoho_sync_connections" as any) as any)
    .select("id, tenant_id, integration_id, subscription_token, is_active")
    .eq("subscription_token", token)
    .maybeSingle();

  if (error) {
    log.error("Error consultando zoho_sync_connections", { error: error.message });
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  if (!conn || !conn.subscription_token) {
    log.warn("Webhook Zoho con token desconocido, rechazado");
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }

  // Validación constant-time (defensa anti-spoof / timing).
  if (!tokensMatch(token, conn.subscription_token)) {
    log.error("Webhook Zoho token MISMATCH - posible spoof");
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }
  if (!conn.is_active) {
    log.info("Webhook Zoho para connection inactiva, ignorado", { connection_id: conn.id });
    return NextResponse.json({ ok: true, ignored: "inactive" });
  }

  // Garantiza que el worker consume la cola en este proceso (standalone no
  // ejecuta instrumentation.ts → sin esto los jobs quedarían en `wait`).
  ensureZohoLeadWorker();

  const { ids: leadIds, fieldsById } = await extractWebhook(req);
  if (leadIds.length === 0) {
    // Zoho a veces envía un ping de verificación sin ids → 200 sin encolar.
    log.info("Webhook Zoho sin ids (ping/verificación)", { connection_id: conn.id });
    return NextResponse.json({ ok: true, ignored: "no_ids" });
  }

  // Encolar UN job por id (dedup por jobId en la cola). Delay corto para agrupar
  // ráfagas de la misma ventana.
  //
  // CLAVE: el webhook DEBE responder rápido (<2s). El enqueue va contra Redis y,
  // si Redis está caído/lento, BullMQ reintenta la conexión indefinidamente y el
  // await se colgaría → Zoho recibiría timeout y reintentaría el webhook en bucle.
  // Por eso encolamos con un timeout duro y respondemos 200 igualmente: si algún
  // job no llega a encolarse, la reconciliación diaria (red de seguridad) lo
  // recupera. Nunca bloqueamos la respuesta del webhook por la cola.
  const triggeredAt = new Date().toISOString();
  const ENQUEUE_TIMEOUT_MS = 2_000;
  const results = await Promise.allSettled(
    leadIds.map((zohoLeadId) =>
      withTimeout(
        enqueueZohoLeadEvent(
          {
            integration_id: conn.integration_id,
            tenant_id: conn.tenant_id,
            zoho_lead_ids: [zohoLeadId],
            // Si el webhook trajo los campos del lead, los pasamos inline →
            // el processor crea el lead sin getLead/OAuth. Si no, será getLead.
            ...(fieldsById[zohoLeadId]
              ? { inline_leads: { [zohoLeadId]: fieldsById[zohoLeadId] } }
              : {}),
            trigger: "webhook",
            triggered_at: triggeredAt,
          },
          3_000
        ),
        ENQUEUE_TIMEOUT_MS
      )
    )
  );

  const enqueued = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - enqueued;
  if (failed > 0) {
    log.warn("Algunos jobs Zoho no se encolaron (se recuperan en reconciliación)", {
      connection_id: conn.id,
      enqueued,
      failed,
    });
  } else {
    log.info("zoho-lead jobs encolados desde webhook", {
      connection_id: conn.id,
      integration_id: conn.integration_id,
      tenant_id: conn.tenant_id,
      lead_count: leadIds.length,
    });
  }

  return NextResponse.json({ ok: true, enqueued, failed });
}

// GET para health check.
export async function GET() {
  return NextResponse.json({ ok: true, service: "zoho-webhook" });
}
