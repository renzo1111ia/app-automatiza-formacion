"use server";

import { PostAnalysisService } from "@/lib/services/post-analysis";
import { FactExtractionService } from "@/lib/services/fact-extractor";
import { getChatHistory } from "./inbox";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Trigger manual analysis for a lead based on recent chat history.
 * Runs TWO passes:
 * 1. PostAnalysisService — structured qualification (qualified/score/CRM sync)
 * 2. FactExtractionService — extracts ALL agent tracked variables from the transcript
 */
export async function runManualAnalysis(leadId: string, tenantId: string) {
    try {
        console.log(`[ACTION] Manual analysis requested for lead ${leadId}`);

        // 1. Get History
        const chatRes = await getChatHistory(leadId);
        if (!chatRes.success || !chatRes.data) {
            throw new Error("Could not fetch chat history");
        }

        // 2. Format transcript
        const transcript = chatRes.data
            .filter(m => m.message_type !== 'SYSTEM_LOG')
            .map(m => `${m.direction === 'INBOUND' ? 'Usuario' : 'Asistente'}: ${m.content}`)
            .join("\n");

        if (transcript.length < 50) {
            return { success: false, error: "La conversación es demasiado corta para analizar." };
        }

        // 3. Get active agent's API key and tracked variables
        const supabase = await getAdminSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: agentVariant } = await (supabase as any)
            .from("ai_agent_variants")
            .select("api_key, tracked_variables")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .not("api_key", "is", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { api_key: string; tracked_variables: string[] } | null };

        const apiKey = agentVariant?.api_key;
        const trackedVars = agentVariant?.tracked_variables || [];

        // 4. PASS 1 — PostAnalysis (qualification + CRM sync)
        const analysis = await PostAnalysisService.processInteraction({
            leadId,
            tenantId,
            transcript,
            channel: 'WHATSAPP'
        });

        // 5. PASS 2 — Fact extraction for ALL tracked variables (if API key available)
        let factData: Record<string, string> = {};
        if (apiKey && trackedVars.length > 0) {
            console.log(`[ACTION] Running fact extraction for ${trackedVars.length} tracked vars`);
            const facts = await FactExtractionService.extractFromDialogue(
                leadId,
                transcript,
                trackedVars,
                apiKey,
                tenantId
            );
            if (facts) factData = facts;
        }

        // 6. Return merged data for immediate UI update
        const mergedData = {
            ...analysis.extracted_data,
            ...factData,
            QUALIFIED: analysis.qualified === "si" ? "SI" : "NO",
            last_fact_update: new Date().toISOString()
        };

        return { success: true, data: { ...analysis, extracted_data: mergedData } };

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[ACTION] Analysis error:", error);
        return { success: false, error: error.message };
    }
}
