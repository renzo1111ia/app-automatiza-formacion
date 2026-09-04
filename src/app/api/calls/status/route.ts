import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ultravoxBridge, UltravoxConfig } from "@/lib/integrations/ultravox";
import { z } from "zod";
import { requireApiUser, requireTenantAccess } from "@/lib/api-auth";

const statusSchema = z.object({
  callId: z.string(),
  tenantId: z.string().uuid(),
});

/**
 * API: CALL STATUS (Polling)
 * Fetches current status and transcript of an active voice call via Ultravox or Supabase log.
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

    // 1. Fetch Call Log from DB first
    const { data: callLog } = await supabase
      .from("llamadas_log")
      .select("*")
      .eq("id_llamada", validCallId)
      .single();

    if (callLog) {
      return NextResponse.json({
        success: true,
        status: callLog.estado || "completed",
        transcript: callLog.transcripcion || "",
        recordingUrl: callLog.grabacion_url || "",
      });
    }

    // 2. Fetch Tenant Config for Ultravox API Key if not in DB
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", validTenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const config = (tenant.config || {}) as Record<string, unknown>;
    const ultravox = (config.ultravox || {}) as Record<string, unknown>;

    const apiKey = typeof ultravox.apiKey === "string" ? ultravox.apiKey : process.env.ULTRAVOX_API_KEY || "";
    const ultravoxConfig: UltravoxConfig = { apiKey };

    if (!ultravoxConfig.apiKey) {
      return NextResponse.json({
        success: true,
        status: "queued",
        transcript: "",
        recordingUrl: "",
      });
    }

    try {
      const transcriptData = await ultravoxBridge.getCallTranscript(validCallId, ultravoxConfig);
      return NextResponse.json({
        success: true,
        status: "completed",
        transcript: Array.isArray(transcriptData) ? transcriptData.map((m: { text?: string }) => m.text).join("\n") : "",
        recordingUrl: "",
      });
    } catch {
      return NextResponse.json({
        success: true,
        status: "in-progress",
        transcript: "",
        recordingUrl: "",
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[API_CALL_STATUS] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
