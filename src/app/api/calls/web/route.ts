import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Retell from "retell-sdk";
import { z } from "zod";
import { Tenant } from "@/types/tenant";
import { requireApiUser, requireTenantAccess } from "@/lib/api-auth";

const webCallSchema = z.object({
  agentId: z.string(),
  tenantId: z.string().uuid(),
});

/**
 * API: WEB CALL TRIGGER
 * Generates an access_token for the Retell Web Client SDK (in-browser voice simulation).
 */

export async function POST(req: Request) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) return ctx;

    const body = await req.json();
    const { agentId, tenantId } = webCallSchema.parse(body);

    const tenantGuard = await requireTenantAccess(ctx, tenantId);
    if (tenantGuard) return tenantGuard;

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
    const retellConfig = (config.retell || {}) as Record<string, unknown>;

    const apiKey = typeof retellConfig.apiKey === "string" ? retellConfig.apiKey : "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Retell API Key missing in tenant configuration" },
        { status: 400 }
      );
    }

    // 2. Initialize Retell Backend Client
    const retell = new Retell({ apiKey });

    // 3. Create Web Call
    const webCallResponse = await retell.call.createWebCall({
      agent_id: agentId,
    });

    console.log(`[API_WEB_CALL] Generated access token for agent ${agentId}`);

    return NextResponse.json({
      success: true,
      accessToken: webCallResponse.access_token,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[API_WEB_CALL] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
