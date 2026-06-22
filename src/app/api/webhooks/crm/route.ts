/* eslint-disable @typescript-eslint/no-explicit-any -- casts legacy Supabase, refactor pendiente en Sprint 1 tarea 2-22 */
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LeadWebhookSchema } from "@/lib/validations/lead";
import { orchestrator } from "@/lib/core/orchestrator";
import { verifyCrmWebhookSignature } from "@/lib/api-auth";
import { createLogger } from "@/lib/utils/logger";
import { resolveLeadCountry } from "@/lib/integrations/sheets/phone-country";

const log = createLogger("webhook.crm");

/**
 * CRM WEBHOOK INGESTION ENDPOINT
 * Receives leads from CRMs and triggers the native Orchestrator.
 *
 * Sprint 0 tarea 1-15: firma HMAC obligatoria con secret per-tenant
 * (`tenants.config.webhook_crm_secret`). El header `x-webhook-signature`
 * (HMAC-SHA256 hex sobre rawBody) se valida contra ese secret.
 *
 * Sprint 3 phase-02 (4-03): logger Pino + trace_id por request.
 */

export async function POST(req: Request) {
  const trace_id = crypto.randomUUID();
  try {
    const tenantId = req.headers.get("x-tenant-id");

    if (!tenantId) {
      log.warn("Missing x-tenant-id header", { trace_id });
      return NextResponse.json({ error: "Missing x-tenant-id header" }, { status: 400 });
    }

    const rawBody = await req.text();

    const sigGuard = await verifyCrmWebhookSignature(req, rawBody, tenantId);
    if (sigGuard) {
      log.warn("HMAC signature verification failed", { trace_id, tenant_id: tenantId });
      return sigGuard;
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      log.warn("Invalid JSON payload", { trace_id, tenant_id: tenantId });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    log.info("CRM webhook received", { trace_id, tenant_id: tenantId });

    const validatedData = LeadWebhookSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json({ error: validatedData.error.format() }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    // 1. Deduplication Guard: Check if a lead with the same phone or email already exists for this tenant
    const { data: existingLead } = await supabase
      .from("lead")
      .select("id")
      .eq("tenant_id", tenantId)
      .or(`telefono.eq.${validatedData.data.telefono},email.eq.${validatedData.data.email}`)
      .maybeSingle();

    let leadId: string;

    if (existingLead) {
      console.log(
        `[CRM WEBHOOK] Duplicate found for ${validatedData.data.telefono}. Merging data with lead ${existingLead.id}`
      );
      const { error: updateError } = await supabase
        .from("lead")
        .update({
          ...validatedData.data,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", existingLead.id);

      if (updateError) {
        console.error("[CRM WEBHOOK] Update error during merge:", updateError);
        return NextResponse.json({ error: "Database error during lead merge" }, { status: 500 });
      }
      leadId = existingLead.id;
    } else {
      // New Lead: Standard Upsert (Safe for concurrent requests with same id_lead_externo)
      const { data: newLead, error: leadError } = await supabase
        .from("lead")
        .upsert(
          {
            ...validatedData.data,
            tenant_id: tenantId,
            // País (regla AF): explícito → teléfono → España por defecto.
            pais: resolveLeadCountry(validatedData.data.pais, validatedData.data.telefono),
            fecha_actualizacion: new Date().toISOString(),
          },
          { onConflict: "tenant_id, id_lead_externo" }
        )
        .select()
        .single();

      if (leadError || !newLead) {
        console.error("[CRM WEBHOOK] Upsert error:", leadError);
        return NextResponse.json(
          { error: "Database error during lead ingestion" },
          { status: 500 }
        );
      }
      leadId = newLead.id;
    }

    // 2. Trigger Orchestrator (In background)
    // In Next.js, we should use a proper background worker / queue for this
    // For now, call it directly (should be handled by a queue in a real production environment)
    orchestrator.handleNewLead(leadId, tenantId).catch((err) => {
      console.error("[ORCHESTRATOR] Error processing background event:", err);
    });

    return NextResponse.json({
      success: true,
      message: existingLead
        ? "Lead merged and orchestration triggered"
        : "Lead ingested and orchestration triggered",
      lead_id: leadId,
    });
  } catch (e) {
    console.error("[CRM WEBHOOK] Internal error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
