import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ultravoxBridge, UltravoxConfig } from "@/lib/integrations/ultravox";
import { TelephonyFactory } from "@/lib/integrations/telephony/factory";
import { z } from "zod";
import { Tenant } from "@/types/tenant";
import { requireApiUser, requireTenantAccess, requireOrchestrationEnabled } from "@/lib/api-auth";

const callSchema = z.object({
  phoneNumber: z.string().min(8),
  agentId: z.string().optional(),
  tenantId: z.string().uuid(),
});

/**
 * API: MANUAL CALL TRIGGER
 * Initiates an outbound Retell AI call.
 */

export async function POST(req: Request) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) return ctx;

    const body = await req.json();
    const { phoneNumber, agentId, tenantId } = callSchema.parse(body);

    const tenantGuard = await requireTenantAccess(ctx, tenantId);
    if (tenantGuard) return tenantGuard;

    const orchGuard = await requireOrchestrationEnabled(tenantId);
    if (orchGuard) return orchGuard;

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
    const ultravox = (config.ultravox || {}) as Record<string, unknown>;

    const apiKey = typeof ultravox.api_key === "string" ? ultravox.api_key : "";
    const targetAgentId =
      agentId || (typeof ultravox.agentId === "string" ? ultravox.agentId : "");
    const fromNumber = typeof (config.telephony as any)?.credentials?.fromNumber === "string" ? (config.telephony as any).credentials.fromNumber : "";

    const ultravoxConfig: UltravoxConfig = { apiKey };

    if (!ultravoxConfig.apiKey || !targetAgentId || !fromNumber) {
      return NextResponse.json(
        { error: "Ultravox or Telephony configuration incomplete for this tenant" },
        { status: 400 }
      );
    }

    // 2. Trigger Call via Bridge
    const callData = await ultravoxBridge.createAgentCall(
      targetAgentId,
      {
        templateContext: { source: "manual_dialer", tenant_id: tenantId },
        medium: { twilio: {} },
        recordingEnabled: true,
      },
      ultravoxConfig
    );
    
    if (callData.join_url) {
      const telephonyProvider = TelephonyFactory.getProvider(tenantData.config as any);
      await telephonyProvider.triggerCall({
        to: phoneNumber,
        from: fromNumber,
        joinUrl: callData.join_url,
        recordingEnabled: true,
      });
    }

    return NextResponse.json({ success: true, callId: callData.call_id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[API_MANUAL_CALL] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
