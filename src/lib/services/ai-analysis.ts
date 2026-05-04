import OpenAI from "openai";

/**
 * AI ANALYSIS SERVICE
 * Uses LLMs to extract structured data from conversations.
 */

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

export interface ConversationAnalysis {
    qualified: "si" | "no" | "anulado";
    scheduled_call_confirmed: boolean;
    reasons: string;
    student_interest_level: number; // 1-10
    lead_score: number; // 1-100
    extracted_data: {
        pais?: string;
        programa?: string;
        presupuesto?: string;
        disponibilidad?: string;
        años_experiencia?: string;
        nivel_estudios?: string;
        titulacion_lead?: string;
        motivo_anulacion?: string;
        date_time_preferred?: string; // ISO String
    };
}

export async function analyzeConversation(transcript: string): Promise<ConversationAnalysis> {
    if (!transcript || transcript.length < 50) {
        return {
            qualified: "no",
            scheduled_call_confirmed: false,
            reasons: "Conversación demasiado corta para analizar.",
            student_interest_level: 0,
            lead_score: 0,
            extracted_data: {}
        };
    }

    try {
        const openai = getOpenAI();
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Analiza la siguiente conversación entre un agente de ventas (VirginIA) y un posible estudiante de Esden Business School.
Extrae la información clave en formato JSON.

Reglas de cualificación:
- qualified: "si" si el estudiante muestra interés genuino y cumple con el perfil mínimo. "no" si rechaza la oferta. "anulado" si hay algún motivo específico de exclusión.
- scheduled_call_confirmed: true si se ha agendado o confirmado una cita/llamada de seguimiento.
- extracted_data:
    * años_experiencia: "0-5 años", "5-10 años", "10-20 años", "+20 años" o "N/A".
    * nivel_estudios: "Estudios Universitarios", "Estudios Postgrado", "Estudios Técnicos", "Bachillerato" o "N/A".
    * titulacion_lead: Profesión o carrera estudiada.
    * motivo_anulacion: Si qualified es "anulado", indicar por qué (ej: "No le encaja horario", "Precio", "Ya estudia en competencia").
    * date_time_preferred: Si se acordó una cita, extraer en formato ISO.

Responde ÚNICAMENTE con el objeto JSON.`
                },
                {
                    role: "user",
                    content: `Transcripción:\n${transcript}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content || "{}") as ConversationAnalysis;
    } catch (err) {
        console.error("[AI_ANALYSIS] Error analyzing conversation:", err);
        throw err;
    }
}
