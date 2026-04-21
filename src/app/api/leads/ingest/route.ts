import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/core/orchestrator";
import { Tenant, ClientConfig } from "@/types/database";

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
            return NextResponse.json({ success: false, error: "Invalid API Key or Tenant not found" }, { status: 403 });
        }

        const tenantId = (tenant as unknown as Tenant).id;

        // 2. Fetch Client Config for Routing Rules
        const { data: clientConfigData } = await supabase
            .from("client_configs")
            .select("*")
            .eq("tenant_id", tenantId)
            .single();

        const clientConfig = clientConfigData as ClientConfig | null;

        // 3. GATEKEEPER: Business Rules Validation
        const rules = clientConfig?.routing_rules || {
            allowed_campaigns: [],
            allowed_origins: [],
            drop_invalid_leads: false,
            contact_sequence: []
        };
        
        // Rule: Allowed Campaigns
        if (rules.allowed_campaigns && Array.isArray(rules.allowed_campaigns) && rules.allowed_campaigns.length > 0 && payload.campana) {
            if (!rules.allowed_campaigns.includes(payload.campana)) {
                return NextResponse.json({ success: true, status: "DROPPED", reason: "Campaign not white-listed" });
            }
        }

        // Rule: Allowed Origins
        if (rules.allowed_origins && Array.isArray(rules.allowed_origins) && rules.allowed_origins.length > 0 && payload.origen) {
            if (!rules.allowed_origins.includes(payload.origen)) {
                return NextResponse.json({ success: true, status: "DROPPED", reason: "Origin not white-listed" });
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
            pais: payload.pais,
            origen: payload.origen,
            campana: payload.campana,
            current_stage: 'QUALIFICATION',
            metadata: { ...payload.extra, raw_payload: payload },
            last_interaction_at: new Date().toISOString()
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

        // 5. TRIGGER ORCHESTRATION
        if (lead && lead.id) {
            await orchestrator.handleNewLead(lead.id, tenantId);
        }

        return NextResponse.json({ 
            success: true, 
            leadId: lead?.id, 
            status: "INGESTED",
            message: "Lead processed and orchestration started" 
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Internal Server Error";
        console.error("[INGEST] Error:", errMsg);
        return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }
}
