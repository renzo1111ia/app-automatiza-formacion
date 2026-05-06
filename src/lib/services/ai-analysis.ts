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
        USER_NAME?: string;
        USER_AGE?: string;
        USER_PROFESION?: string;
        USER_ESTUDIES?: string;
        "YEARS_ EXPERIENCIE"?: string;
        USER_MOTIVATIONS?: string;
        USER_COUNTRY?: string;
        CURSE_NAME?: string;
        MOTIVO_DESCARTE?: string;
        "FECHA_ AGENDA"?: string;
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
- qualified: "si" si el estudiante muestra interés genuino y cumple con el perfil mínimo. "no" si rechaza la oferta o no cumple. "anulado" si hay algún motivo específico de exclusión.
- scheduled_call_confirmed: true si se ha agendado o confirmado una cita/llamada de seguimiento.
- extracted_data:
    * USER_NAME: Nombre del lead.
    * USER_AGE: Edad.
    * USER_PROFESION: Trabajo o cargo actual.
    * USER_ESTUDIES: Estudios universitarios o técnicos realizados.
    * "YEARS_ EXPERIENCIE": Años de experiencia profesional (incluye el espacio).
    * USER_MOTIVATIONS: Por qué quiere hacer el curso.
    * USER_COUNTRY: País.
    * CURSE_NAME: Nombre del master por el que pregunta.
    * MOTIVO_DESCARTE: Si qualified es "no" o "anulado", indicar por qué.
    * "FECHA_ AGENDA": Si se acordó una cita, extraer en formato ISO.
    * date_time_preferred: Alias para FECHA_ AGENDA.

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
