import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/api-auth";
import { createLogger } from "@/lib/utils/logger";
import { createClient } from "@supabase/supabase-js";
import { AUTH_SUPABASE_URL, getAuthServiceRoleKey } from "@/lib/auth-config";
import { metaWhatsAppClient } from "@/lib/integrations/whatsapp/client";
import type { WABAConfig } from "@/lib/integrations/whatsapp/client";

export const dynamic = "force-dynamic";

const log = createLogger("cron.whatsapp-outbox");

/**
 * CRON ROUTE — WhatsApp Outbox Processor
 * GET /api/cron/whatsapp-outbox
 *
 * Processes pending rows in `whatsapp_message_outbox` for all active tenants.
 * Respects Meta rate limits via exponential backoff.
 *
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/whatsapp-outbox", "schedule": "* * * * *" }] }
 *
 * Sprint 5.7 — outbox processor with per-tenant rate limiting.
 */
export async function GET(req: Request) {
  // Validate Vercel Cron secret
  const cronError = requireCronSecret(req);
  if (cronError) return cronError;

  const supabase = createClient(AUTH_SUPABASE_URL, getAuthServiceRoleKey());

  // Fetch all active WABA configurations across all tenants
  const { data: configs, error: configError } = await supabase
    .from("waba_configurations")
    .select("tenant_id, waba_id, phone_number_id, access_token")
    .eq("is_active", true);

  if (configError) {
    log.error("Failed to fetch WABA configurations", { error: configError.message });
    return NextResponse.json({ success: false, error: configError.message }, { status: 500 });
  }

  if (!configs?.length) {
    return NextResponse.json({ success: true, message: "No active WABA configurations" });
  }

  const results: { tenantId: string; processed: number; failed: number }[] = [];

  for (const cfg of configs) {
    const wabaConfig: WABAConfig = {
      accessToken: cfg.access_token,
      phoneNumberId: cfg.phone_number_id,
      wabaId: cfg.waba_id,
    };

    try {
      const result = await metaWhatsAppClient.processOutbox(cfg.tenant_id, wabaConfig, 5);
      results.push({ tenantId: cfg.tenant_id, processed: result.processed, failed: result.failed });
      log.info("Outbox processed", {
        tenantId: cfg.tenant_id,
        processed: result.processed,
        failed: result.failed,
      });
    } catch (e) {
      log.error("Outbox processing failed for tenant", {
        tenantId: cfg.tenant_id,
        error: String(e),
      });
      results.push({ tenantId: cfg.tenant_id, processed: 0, failed: 0 });
    }
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  return NextResponse.json({
    success: true,
    tenants: results.length,
    totalProcessed,
    totalFailed,
  });
}
