import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { retellBridge, RetellConfig } from "@/lib/integrations/retell";
import { z } from "zod";
import { Tenant } from "@/types/tenant";

const callSchema = z.object({
    phoneNumber: z.string().min(8),
    agentId: z.string().optional(),
    tenantId: z.string().uuid()
});

/**
 * API: MANUAL CALL TRIGGER
 * Initiates an outbound Retell AI call.
 */

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { phoneNumber, agentId, tenantId } = callSchema.parse(body);

        const supabase = await getSupabaseServerClient();

        // 1. Fetch Tenant Config (API Keys)
        const { data: tenant, error: tenantError } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        const tenantData = tenant as unknown as Tenant;
        const config = (tenantData.config || {}) as Record<string, unknown>;
        const retell = (config.retell || {}) as Record<string, unknown>;
        
        const apiKey = typeof retell.apiKey === "string" ? retell.apiKey : "";
        const targetAgentId = agentId || (typeof retell.qualifyAgentId === "string" ? retell.qualifyAgentId : "");
        const fromNumber = typeof retell.fromNumber === "string" ? retell.fromNumber : "";

        const retellConfig: RetellConfig = { apiKey };

        if (!retellConfig.apiKey || !targetAgentId || !fromNumber) {
            return NextResponse.json({ error: "Retell configuration incomplete for this tenant" }, { status: 400 });
        }

        // 2. Trigger Call via Bridge
        const callData = await retellBridge.createCall(
            phoneNumber,
            targetAgentId,
            fromNumber,
            { source: "manual_dialer", tenant_id: tenantId },
            {}, // No dynamic variables for manual call
            retellConfig
        );

        return NextResponse.json({ success: true, callId: callData.call_id });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "An unknown error occurred";
        console.error("[API_MANUAL_CALL] Error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
