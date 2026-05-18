import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runFactExtraction(leadId: string, tenantId: string) {
    // 1. Fetch chat messages
    const { data: messages } = await supabase
        .from("chat_messages")
        .select("direction, content")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
        console.log(`No messages found for lead ${leadId}`);
        return;
    }

    const transcript = messages
        .map((m: { direction: string; content: string }) =>
            `${m.direction === "INBOUND" ? "Usuario" : "Asistente"}: ${m.content}`
        )
        .join("\n");

    // 2. Fetch agent API key + tracked vars
    const { data: variant } = await supabase
        .from("ai_agent_variants")
        .select("api_key, tracked_variables")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

    if (!variant?.api_key || !variant?.tracked_variables) {
        console.log("No active agent or API key found");
        return;
    }

    const openai = new OpenAI({ apiKey: variant.api_key });
    const normalizedKeys = variant.tracked_variables.map((v: string) => v.replace(/^\{\{|\}\}$/g, "").trim());

    const systemPrompt = `Eres un extractor de datos ultra-preciso especializado en leads para educación.
Analiza el diálogo y extrae la información relevante del perfil del lead.

CLAVES PRIORITARIAS OBLIGATORIAS: ${normalizedKeys.join(', ')}.

REGLAS CRÍTICAS:
1. Devuelve ÚNICAMENTE un JSON plano.
2. "RESUMEN_EJECUTIVO": Genera un resumen BREVE de la situación actual del lead.
3. NO INVENTES NADA: Si el usuario no ha mencionado algo, devuelve null.
4. "qualified": Evalúa si el lead está "SI", "NO" o "PENDIENTE".
5. "ESTADO": Estado general del lead (ej. "Interesado", "Cita agendada").
6. "REGLA_APLICADA": La regla de cualificación que se aplicó (ej. "Experiencia laboral mínima", "Sin requisitos").
7. "QA_HANDLED": "SI" si el usuario hizo preguntas y fueron respondidas, de lo contrario "NO".
8. "QA_TOPIC": El tema principal de las preguntas (ej. "Precios", "Horarios", "Becas"). Si no hubo preguntas, null.
9. "MOTIVO_DESCARTE": Si qualified es "NO", explicar por qué.
10. "CONVERSATION_STATUS": "FINALIZADA" si la conversación terminó, "EN_CURSO" si sigue.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CONVERSACIÓN:\n${transcript}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 600
    });

    const rawResult = completion.choices[0]?.message?.content;
    if (!rawResult) { console.log("No result from OpenAI"); return; }

    const extracted = JSON.parse(rawResult);
    console.log(`\nExtracted for lead ${leadId}:`, JSON.stringify(extracted, null, 2));

    // 3. Normalize keys to UPPERCASE and filter out nulls before merging
    const normalizedExtracted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extracted)) {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
            // Keep the key as-is if it's already uppercase, otherwise uppercase it
            normalizedExtracted[k.toUpperCase()] = v;
        }
    }

    // 4. Merge into metadata (new values override old "Pendiente..." ones)
    const { data: lead } = await supabase.from("lead").select("metadata").eq("id", leadId).single();
    const currentMeta = (lead as { metadata?: Record<string, unknown> })?.metadata || {};
    const updatedMeta = { ...currentMeta, ...normalizedExtracted, last_fact_update: new Date().toISOString() };

    await supabase.from("lead").update({ metadata: updatedMeta }).eq("id", leadId);
    console.log(`✅ Metadata updated for lead ${leadId}`);
}

async function main() {
    // All leads
    const { data: leads } = await supabase.from("lead").select("id, nombre, tenant_id");
    if (!leads) { console.log("No leads found"); return; }

    for (const lead of leads as { id: string; nombre: string; tenant_id: string }[]) {
        console.log(`\n=== Processing lead: ${lead.nombre} [${lead.id}]`);
        await runFactExtraction(lead.id, lead.tenant_id);
    }
}

main();
