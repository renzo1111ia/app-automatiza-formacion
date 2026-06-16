import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { retellBridge, RetellConfig } from "@/lib/integrations/retell";
import { z } from "zod";
import { Tenant } from "@/types/tenant";
import { requireApiUser, requireTenantAccess } from "@/lib/api-auth";

const statusSchema = z.object({
  callId: z.string(),
  tenantId: z.string().uuid(),
});

/**
 * API: CALL STATUS (Polling)
 * Fetches current status and transcript of an active Retell AI call.
 */

export async function GET(req: Request) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) return ctx;

    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");
    const tenantId = url.searchParams.get("tenantId");

    if (!callId || !tenantId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const { callId: validCallId, tenantId: validTenantId } = statusSchema.parse({
      callId,
      tenantId,
    });

    const tenantGuard = await requireTenantAccess(ctx, validTenantId);
    if (tenantGuard) return tenantGuard;

    const supabase = await getSupabaseServerClient();

    // 1. Fetch Tenant Config (API Keys)
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", validTenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantData = tenant as unknown as Tenant;
    const config = (tenantData.config || {}) as Record<string, unknown>;
    const retell = (config.retell || {}) as Record<string, unknown>;

    const apiKey = typeof retell.apiKey === "string" ? retell.apiKey : "";
    const retellConfig: RetellConfig = { apiKey };

    if (!retellConfig.apiKey) {
      return NextResponse.json(
        { error: "Retell configuration incomplete for this tenant" },
        { status: 400 }
      );
    }

    // 2. Fetch Call via Bridge
    const callData = await retellBridge.getCall(validCallId, retellConfig);

    return NextResponse.json({
      success: true,
      status: callData.call_status,
      transcript: callData.transcript,
      recordingUrl: callData.recording_url,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[API_CALL_STATUS] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
