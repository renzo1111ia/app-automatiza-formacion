"use server";

import { PostAnalysisService } from "@/lib/services/post-analysis";
import { getChatHistory } from "./inbox";

/**
 * Trigger manual analysis for a lead based on recent chat history.
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
        const transcript = chatRes.data.map(m => 
            `${m.direction === 'INBOUND' ? 'Usuario' : 'Asistente'}: ${m.content}`
        ).join("\n");

        if (transcript.length < 50) {
            return { success: false, error: "La conversación es demasiado corta para analizar." };
        }

        // 3. Process
        const analysis = await PostAnalysisService.processInteraction({
            leadId,
            tenantId,
            transcript,
            channel: 'WHATSAPP' // Default for manual trigger from inbox
        });

        return { success: true, data: analysis };

    } catch (err: any) {
        console.error("[ACTION] Analysis error:", err);
        return { success: false, error: err.message };
    }
}
