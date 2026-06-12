import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/core/orchestrator";
import { Tenant, ClientConfig } from "@/types/database";
import { LeadStageEnum } from "@/lib/schemas/_base";
import { leadOpportunitiesRepository } from "@/lib/repositories/lead-opportunities-repository";
import { resolveLeadCountry } from "@/lib/integrations/sheets/phone-country";

/**
 * UNIVERSAL INGEST ENDPOINT
 * Receives leads from Zoho, Meta, Web Forms, etc.
 * Applies Routing Rules (Gatekeeper) before starting orchestration.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const supabase = await getSupabaseServerClient();

    // 1. Identify Tenant (by API Key or Header)
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing API Key" }, { status: 401 });
    }

    // Use typed supabase client
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json(
        { success: false, error: "Invalid API Key or Tenant not found" },
        { status: 403 }
      );
    }

    const tenantId = (tenant as unknown as Tenant).id;

    // 2. Fetch Client Config for Routing Rules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientConfigData } = await (supabase as any)
      .from("client_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientConfig = clientConfigData as any as ClientConfig | null;

    // 3. GATEKEEPER: Business Rules Validation
    const rules = clientConfig?.routing_rules || {
      allowed_campaigns: [],
      allowed_origins: [],
      drop_invalid_leads: false,
      contact_sequence: [],
    };

    // Rule: Allowed Campaigns
    if (
      rules.allowed_campaigns &&
      Array.isArray(rules.allowed_campaigns) &&
      rules.allowed_campaigns.length > 0 &&
      payload.campana
    ) {
      if (!rules.allowed_campaigns.includes(payload.campana)) {
        return NextResponse.json({
          success: true,
          status: LeadStageEnum.enum.DROPPED,
          reason: "Campaign not white-listed",
        });
      }
    }

    // Rule: Allowed Origins
    if (
      rules.allowed_origins &&
      Array.isArray(rules.allowed_origins) &&
      rules.allowed_origins.length > 0 &&
      payload.origen
    ) {
      if (!rules.allowed_origins.includes(payload.origen)) {
        return NextResponse.json({
          success: true,
          status: LeadStageEnum.enum.DROPPED,
          reason: "Origin not white-listed",
        });
      }
    }

    // 4. CREATE LEAD IN SUPABASE
    const leadData = {
      tenant_id: tenantId,
      id_lead_externo: payload.id_externo || payload.id || "manual_" + Date.now(),
      nombre: payload.nombre || "Lead",
      apellido: payload.apellido || "Externo",
      telefono: payload.telefono,
      email: payload.email,
      // País (regla AF): explícito → derivado del teléfono → España por defecto.
      pais: resolveLeadCountry(payload.pais, payload.telefono),
      origen: payload.origen,
      campana: payload.campana,
      current_stage: LeadStageEnum.enum.QUALIFICATION,
      metadata: { ...payload.extra, raw_payload: payload },
      last_interaction_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: leadErr } = await (supabase as any)
      .from("lead")
      .insert(leadData)
      .select()
      .single();

    if (leadErr) {
      throw new Error("Failed to create lead: " + leadErr.message);
    }

    // 5. NEW-06: registrar oportunidad con dedup automatico.
    // Bea V1: un lead puede tener N solicitudes; dedup en ventana 48h por lead+programa.
    let opportunityResult: Awaited<
      ReturnType<typeof leadOpportunitiesRepository.createWithDedup>
    > | null = null;
    if (lead && lead.id) {
      opportunityResult = await leadOpportunitiesRepository.createWithDedup(tenantId, {
        lead_id: lead.id,
        programa_id: payload.programa_id || null,
        source: "ingest_form",
        metadata: { origen: payload.origen, campana: payload.campana },
      });
      if (opportunityResult.error) {
        console.warn(
          "[INGEST] lead_opportunities createWithDedup error (no bloqueante):",
          opportunityResult.error
        );
      }
    }

    // 6. TRIGGER ORCHESTRATION
    if (lead && lead.id) {
      await orchestrator.handleNewLead(lead.id, tenantId);
    }

    return NextResponse.json({
      success: true,
      leadId: lead?.id,
      opportunityId: opportunityResult?.data?.id,
      isDuplicate: opportunityResult?.isDuplicate ?? false,
      duplicateOfId: opportunityResult?.originalId,
      status: "INGESTED",
      message: opportunityResult?.isDuplicate
        ? "Lead procesado; oportunidad marcada como duplicada (politica dedup 48h)"
        : "Lead processed and orchestration started",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[INGEST] Error:", errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
