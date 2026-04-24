/**
 * STANDALONE BULLMQ WORKER
 * Run with: node worker.js
 * This process stays alive and picks up queued lead sequence jobs from Redis.
 */

import { createLeadWorker } from "./src/lib/core/queue/lead-sequence-queue.js";
import { orchestrator } from "./src/lib/core/orchestrator.js";
import { getSupabaseServerClient } from "./src/lib/supabase/server.js";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

console.log("[WORKER] 🚀 Automatiza Formación Lead Sequence Worker starting...");
console.log(`[WORKER] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`);

const worker = createLeadWorker(async (job) => {
    const { leadId, tenantId, step, action, transcript, callId } = job.data;
    
    console.log(`[WORKER] Incoming job ${job.id}: Action: ${action} | Lead: ${leadId}`);

    // Fetch tenant and check spend limits (Circuit Breaker)
    const supabase = await getSupabaseServerClient();
    if (tenantId) {
        const { data: tenant } = await supabase.from("tenants").select("daily_spend_limit, current_daily_spend").eq("id", tenantId).single();
        if (tenant && tenant.current_daily_spend >= tenant.daily_spend_limit) {
            console.error(`[WORKER] 🔥 CIRCUIT BREAKER ACTIVE: Tenant ${tenantId} exceeded daily spend limit (${tenant.current_daily_spend}/${tenant.daily_spend_limit})`);
            return; // Stop processing for this tenant
        }
    }

    // 1. HANDLER: Recurring Watchdog Scan
    if (action === "WATCHDOG_SCAN") {
        const { appointmentWatchdog } = await import("./src/lib/core/processors/AppointmentWatchdog.js");
        await appointmentWatchdog.run();
        return;
    }

    // 2. HANDLER: Deep Qualification Analysis
    if (action === "QUALIFY_ANALYSIS") {
        const { qualificationProcessor } = await import("./src/lib/core/processors/QualificationProcessor.js");
        await qualificationProcessor.process({ leadId, tenantId, transcript, callId });
        return;
    }

    // 3. HANDLER: Recurring Zoho CRM Polling
    if (action === "ZOHO_POLLING") {
        const { crmPollingProcessor } = await import("./src/lib/core/processors/CRMPollingProcessor.js");
        await crmPollingProcessor.run();
        return;
    }

    // 4. HANDLER: Standard Lead Sequence Step (Calls, WhatsApp, Zoho Update)
    if (action === "call" || action === "whatsapp" || action === "ai_agent" || action === "zoho") {
        // Fetch the lead
        const { data: lead, error } = await supabase
            .from("lead")
            .select("*")
            .eq("id", leadId)
            .single();

        if (error || !lead) throw new Error(`Lead ${leadId} not found`);

        // Load tenant config
        const { getOrchestratorConfigForTenant } = await import("./src/lib/actions/orchestrator-config.js");
        const config = await getOrchestratorConfigForTenant(tenantId);
        const sequence = config.sequence;

        // Execute step
        if (step !== undefined) {
            await orchestrator.executeSequenceStep(lead, tenantId, sequence, step, config);
        }
    }
});

// Initialize Cron for Watchdog & Zoho (If running as a background process)
import { setupWatchdogCron, setupZohoCron } from "./src/lib/core/queue/lead-sequence-queue.js";
setupWatchdogCron().catch(err => console.error("[WORKER] Failed to setup watchdog cron:", err));
setupZohoCron().catch(err => console.error("[WORKER] Failed to setup zoho cron:", err));

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("[WORKER] SIGTERM received. Closing gracefully...");
    await worker.close();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("[WORKER] SIGINT received. Closing gracefully...");
    await worker.close();
    process.exit(0);
});
