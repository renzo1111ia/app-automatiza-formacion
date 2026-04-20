import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { whatsappBridge } from "../../integrations/whatsapp";
import OpenAI from "openai";
import { queryKnowledgeBase, invokeClaude } from "../../integrations/aws/bedrock";

/**
 * WHATSAPP AI PROCESSOR (CEREBRO)
 * Generates context-aware responses using OpenAI and tenant-specific configurations.
 */

export async function generateAIWhatsAppResponse(tenantId: string, leadId: string, incomingMessage: string) {
    console.log(`[AI PROCESSOR] Generating response for lead ${leadId} (tenant: ${tenantId})`);

    try {
        const supabase = getAdminSupabase();

        // 1. Get Lead & Tenant Context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (supabase.from("lead" as any) as any).select("*").eq("id", leadId).single();
        if (!lead) return;

        // 2. Get Course Info (Programas)
        // We look for the programs linked to this lead
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadPrograms } = await (supabase.from("lead_programas" as any) as any).select("id_programa").eq("id_lead", leadId);
        let courseContext = "";
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (leadPrograms && (leadPrograms as any[]).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const firstProgramId = (leadPrograms as any[])[0].id_programa;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: program } = await (supabase.from("programas" as any) as any).select("*").eq("id", firstProgramId).single();
            if (program) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = program as any;
                courseContext = `
INFORMACIÓN DEL CURSO:
- Nombre: ${p.nombre}
- Presentación: ${p.presentacion}
- Objetivos: ${p.objetivos}
- Precio: ${p.precio}
- Metodología: ${p.metodologia}
- Fechas inicio: ${p.fechas_inicio}
- Requisitos: ${p.requisitos_cualificacion}
`;
            }
        }

        // 3. Get Conversation History
        const { data: history } = await (supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("chat_messages" as any) as any)
            .select("direction, content")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(10);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conversationHistory = (history || []).reverse().map((m: any) => 
            `${m.direction === "INBOUND" ? "Usuario" : "Asistente"}: ${m.content}`
        ).join("\n") || "";

        // 4. Get AI Agent & Variant (API Key + Prompt)
        // We look for an active agent for this tenant
        const { data: variants } = await (supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("ai_agent_variants" as any) as any)
            .select("*")
            .eq("is_active", true)
            .limit(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!variants || (variants as any[]).length === 0) {
            console.warn(`[AI PROCESSOR] No active AI agent found for tenant ${tenantId}`);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeVariant = (variants as any[])[0];
        const apiKey = activeVariant.api_key;
        if (!apiKey) {
            console.error(`[AI PROCESSOR] API Key missing in agent variant for tenant ${tenantId}`);
            return;
        }

        // 5. Get Deep Knowledge from AWS Bedrock (RAG)
        // Consultamos la base de conocimientos de Automatiza Formación para obtener datos técnicos precisos
        const kbResults = await queryKnowledgeBase(incomingMessage, activeVariant.knowledge_base_id);
        const deepKnowledgeContext = kbResults.length > 0 
            ? `\nCONOCIMIENTO ADICIONAL (AWS):\n${kbResults.map(r => `- ${r.text}`).join("\n")}\n`
            : "";

        // 7. Build Prompt
        const systemPrompt = `
${activeVariant.prompt_text}

CONTEXTO DEL LEAD:
- Nombre: ${lead.nombre} ${lead.apellido || ""}
- Email: ${lead.email || "No proveído"}
- País: ${lead.pais || "No proveído"}
${courseContext}
${deepKnowledgeContext}

HISTORIAL DE CONVERSACIÓN RECIENTE:
${conversationHistory}
`;

        // 11. Call LLM (OpenAI or Bedrock)
        let aiResponse = "";
        const modelName = activeVariant.model_name || "gpt-4o";
        let usage = null;

        if (modelName.includes("claude") || modelName.includes("anthropic")) {
            console.log(`[AI PROCESSOR] Using AWS Bedrock (${modelName}) for response`);
            aiResponse = await invokeClaude(systemPrompt, incomingMessage, modelName) || "";
        } else {
            console.log(`[AI PROCESSOR] Using OpenAI (${modelName}) for response`);
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: incomingMessage }
                ],
                temperature: 0.7,
                max_tokens: 500
            });
            aiResponse = completion.choices[0]?.message?.content || "";
            usage = completion.usage;
        }

        if (aiResponse) {
            // 8. Send via WhatsApp
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: tenant } = await (supabase.from("tenants" as any) as any).select("config").eq("id", tenantId).single();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const waConfig = (tenant as any)?.config?.whatsapp;

            if (waConfig?.accessToken && waConfig?.phoneNumberId) {
                await whatsappBridge.sendTextMessage(lead.telefono!, aiResponse, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 9. Log Outbound Message (Supabase)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("chat_messages" as any) as any).insert({
                    tenant_id: tenantId,
                    lead_id: leadId,
                    direction: "OUTBOUND",
                    message_type: "TEXT",
                    content: aiResponse,
                    sent_by: "AI_AGENT",
                    status: "SENT",
                    metadata: { 
                        model: modelName,
                        variant_id: activeVariant.id,
                        token_usage: usage
                    }
                });
            } else {
                console.error(`[AI PROCESSOR] WhatsApp credentials missing for tenant ${tenantId} during response`);
            }
        }

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[AI PROCESSOR] Error generating response:", error.message);
    }
}

function getAdminSupabase() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    }

    return createClient<Database>(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}
