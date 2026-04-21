import { getSupabaseServerClient } from "@/lib/supabase/server";
import { invokeClaude } from "@/lib/integrations/aws/bedrock";
import { Lead } from "@/types/database";

/**
 * LEAD MEMORY PROCESSOR
 * Analyzes conversation history to extract structured data and determine the current stage.
 */
export const leadMemoryProcessor = {
    /**
     * Extracts facts from a conversation and updates the lead's metadata and stage.
     */
    async extractFactsAndUpdateStage(leadId: string, lastMessages: string[]) {
        const supabase = await getSupabaseServerClient();

        // 1. Prompt Claude to extract structured data
        const systemPrompt = `Eres un experto en extracción de datos para un CRM médico/educativo.
Tu objetivo es leer los últimos mensajes de un lead y extraer:
- nombre
- edad
- profesion
- curso_interes (Normalizado a mayúsculas, ej: "MESOTERAPIA", "MBA")
- nivel_cualificacion (0-10)
- etapa_sugerida (QUALIFICATION, SCHEDULING, COMPLETED)

Responde ÚNICAMENTE en formato JSON plano. Ejemplo:
{"nombre": "Juan", "curso_interes": "MESOTERAPIA", "etapa_sugerida": "SCHEDULING"}`;

        const userMessage = `Conversación:\n${lastMessages.join("\n")}\n\nExtrae los datos:`;
        
        try {
            const rawJson = await invokeClaude(systemPrompt, userMessage);
            const facts = JSON.parse(rawJson || "{}");

            // 2. Load current lead metadata
            const { data: lead } = await supabase.from("lead" as string).select("metadata, current_stage").eq("id", leadId).single();
            const currentMetadata = (lead as unknown as Lead)?.metadata || {};

            // 3. Merge and update
            const newMetadata = { ...currentMetadata, ...facts };
            const newStage = facts.etapa_sugerida || (lead as unknown as Lead)?.current_stage || 'QUALIFICATION';

            await supabase.from("lead" as string).update({
                metadata: newMetadata,
                current_stage: newStage,
                last_interaction_at: new Date().toISOString()
            } as unknown).eq("id", leadId);

            console.log(`[MEMORY] Lead ${leadId} updated. Stage: ${newStage}`);
            return { success: true, stage: newStage, facts };

        } catch (error) {
            console.error("[MEMORY] Error processing facts:", error);
            return { success: false };
        }
    }
};
