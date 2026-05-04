import OpenAI from "openai";
import { getSupabaseServerClient } from "../supabase/server";

let _openai: OpenAI | null = null;

function getOpenAI() {
    if (!_openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === "your_api_key_here") {
            throw new Error("OPENAI_API_KEY no configurada. Por favor, añádela a tu archivo .env.local");
        }
        _openai = new OpenAI({ apiKey });
    }
    return _openai;
}

/**
 * AI RESCUE SERVICE
 * Generates personalized re-engagement messages for inactive leads.
 */
export class AIRescueService {
    /**
     * Generates a personalized message based on chat history and instructions.
     */
    static async generateSmartNudge(params: {
        leadId: string;
        instructions: string;
        agentPrompt: string;
    }): Promise<string> {
        const { leadId, instructions, agentPrompt } = params;
        const supabase = await getSupabaseServerClient();

        try {
            // 1. Fetch Chat History (Summary)
            const { data: summaryDataRaw } = await supabase
                .from("chat_summaries")
                .select("summary")
                .eq("lead_id", leadId)
                .single();

            const summaryData = summaryDataRaw as { summary: string } | null;
            const history = summaryData?.summary || "No hay historial previo.";

            // 2. Generate Message with GPT-4o
            const openai = getOpenAI();
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Eres VirginIA, un agente experto en ventas. Tu objetivo es reactivar a un lead que ha dejado de responder.
                        
                        CONTEXTO DEL AGENTE:
                        ${agentPrompt}

                        INSTRUCCIONES DE RESCATE:
                        ${instructions || "Dile que sigues aquí y pregunta si tiene alguna duda de forma amable."}

                        HISTORIAL DE LA CONVERSACIÓN:
                        ${history}

                        REGLAS:
                        - Sé breve y natural.
                        - No parezcas un robot.
                        - Usa el nombre del lead si lo conoces.
                        - El mensaje debe ser enviado por WhatsApp.
                        - NO uses placeholders como [NOMBRE], sustitúyelos por la información real si la tienes.
                        - Responde ÚNICAMENTE con el texto del mensaje a enviar.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 150
            });

            const message = response.choices[0].message.content?.trim();
            return message || "Hola! Sigues ahí? Me gustaría seguir hablando contigo.";

        } catch (err: unknown) {
            const error = err as Error;
            console.error("[AI_RESCUE] Error generating smart nudge:", error.message);
            return instructions.split('\n')[0] || "Hola! Sigues ahí?"; // Fallback to instruction or default
        }
    }
}
