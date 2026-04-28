/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { whatsappBridge } from "../../integrations/whatsapp";
import OpenAI from "openai";
import { ChatMemoryService } from "@/lib/services/chat-memory";
import { KnowledgeBaseService, ChatSummaryService } from "@/lib/services/knowledge-base";
import { FactExtractionService } from "@/lib/services/fact-extractor";

/**
 * WHATSAPP AI PROCESSOR (CEREBRO v3.0)
 * Consolidates Redis Memory, PGVector Knowledge, and Dynamic Variables.
 * No AWS dependencies.
 */

export async function generateAIWhatsAppResponse(tenantId: string, leadId: string, incomingMessage: string) {
    console.log(`[AI PROCESSOR] 🤖 Thinking for lead ${leadId} (tenant: ${tenantId})`);

    try {
        const supabase = getAdminSupabase();

        // 1. Get Lead Context
        const { data: lead } = await (supabase.from("lead" as unknown as string) as any).select("*").eq("id", leadId).single();
        if (!lead) return;

        // 2. Identify Active Agent & Variant
        const agentId = (lead as any).ai_agent_id;
        
        let variantQuery = (supabase.from("ai_agent_variants" as unknown as string) as any)
            .select("*")
            .eq("is_active", true)
            .neq("prompt_text", "")
            .not("api_key", "is", null)
            .order("is_variant_b", { ascending: true }) // Prioriza Variant A (false) sobre B (true)
            .order("updated_at", { ascending: false });
        
        if (agentId) {
            variantQuery = variantQuery.eq("agent_id", agentId);
        } else {
            // Fallback to first active variant of the tenant
            const { data: tenantAgents } = await (supabase.from("ai_agents" as unknown as string) as any).select("id").eq("tenant_id", tenantId);
            const agentIds = (tenantAgents || []).map((a: any) => a.id);
            variantQuery = variantQuery.in("agent_id", agentIds);
        }

        const { data: variants } = await variantQuery;
        
        if (!variants || (variants as any[]).length === 0) {
            console.warn(`[AI PROCESSOR] ⚠️ No active AI variant found for lead ${leadId}`);
            return;
        }

        // Si hay varias, intentamos elegir la que tenga prompt_text más largo o simplemente la primera (que por el orden será Variant A si existe)
        const activeVariant = (variants as any[])[0];
        const apiKey = activeVariant.api_key || process.env.OPENAI_API_KEY; // Global fallback
        
        if (!apiKey) {
            console.error(`[AI PROCESSOR] ❌ API Key missing for response`);
            return;
        }

        // 3-5. Fetch all context data in parallel to reduce latency
        console.log(`[AI PROCESSOR] ⚡ Fetching context data and credentials in parallel...`);
        const [recentHistory, chatSummary, localKnowledge, tenantData] = await Promise.all([
            // 3. Get Recent Context from DB (last 10 messages)
            ChatMemoryService.getRecentContext(leadId).catch(err => {
                console.warn("[AI PROCESSOR] Memory fetch skipped:", err);
                return [];
            }),
            // 4. Get Long-Term Memory (SQL Summary)
            ChatSummaryService.getSummary(leadId).catch(err => {
                console.warn("[AI PROCESSOR] Summary fetch skipped:", err);
                return null;
            }),
            // 5. Get Local Knowledge (PGVector)
            (async () => {
                try {
                    const openai = new OpenAI({ apiKey });
                    const embedRes = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: incomingMessage,
                    });
                    const embedding = embedRes.data[0].embedding;
                    const kbResults = await KnowledgeBaseService.search(tenantId, embedding, 0.4, 3);
                    return kbResults.map(r => `- ${r.content}`).join("\n");
                } catch (kbErr) {
                    console.warn("[AI PROCESSOR] KB search skipped/failed:", kbErr);
                    return "";
                }
            })(),
            // 6. Get Tenant WhatsApp Config
            (supabase.from("tenants" as unknown as string) as any).select("config").eq("id", tenantId).single()
        ]);

        const waConfig = (tenantData?.data as any)?.config?.whatsapp;

        const conversationContext = recentHistory.map(m =>
            `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
        ).join("\n");

        // 6. Process Dynamic Variables
        const variableMap = {
            nombre: (lead as any).nombre || 'estudiante',
            email: (lead as any).email || '',
            telefono: (lead as any).telefono || '',
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString(),
            ...((lead as any).metadata || {}), // CAPTURED MEMORY
            ...((activeVariant.dynamic_variables as Record<string, string>) || {}) // STATIC CONTEXT
        };

        let finalPrompt = activeVariant.prompt_text;

        // Replace patterns like {{nombre}}
        Object.keys(variableMap).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            finalPrompt = finalPrompt.replace(regex, variableMap[key]);
        });

        // 7. Build System Prompt
        const systemPrompt = `
${finalPrompt}

INFORMACIÓN ADICIONAL (CEREBRO):
${localKnowledge || "No hay información específica en la base de conocimiento para este mensaje."}

RESUMEN DE CONVERSACIÓN PREVIA:
${chatSummary || "Primera interacción con este lead."}

CONTEXTO RECIENTE (Últimas 10 líneas):
${conversationContext}
`;

        // 8. Call OpenAI
        let modelName = activeVariant.model_name || "gpt-4o";
        if (modelName === "gpt-4.1") modelName = "gpt-4o";
        if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";
        
        const openai = new OpenAI({ apiKey });
        
        console.log(`[AI PROCESSOR] 🧠 Calling ${modelName}...`);
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                ...recentHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
                { role: "user", content: incomingMessage }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const aiResponse = completion.choices[0]?.message?.content || "";

        if (aiResponse) {
            // 9. Update Redis Memory (Short-term)
            await ChatMemoryService.addMessage(leadId, 'user', incomingMessage);
            await ChatMemoryService.addMessage(leadId, 'assistant', aiResponse);

            if (waConfig?.accessToken && waConfig?.phoneNumberId) {
                await whatsappBridge.sendTextMessage((lead as any).telefono!, aiResponse, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 11. Log Outbound Message (Consolidated)
                await ChatSummaryService.appendMessage(tenantId, leadId, "Asistente", aiResponse);

                /*
                // LEGACY: Individual message logging
                await (supabase.from("chat_messages" as unknown as string) as any).insert({
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
                        token_usage: completion.usage
                    }
                });
                */

                // 12. Autonomous Learning (Fact Extraction)
                const trackedVars = (activeVariant.tracked_variables as string[]) || [];
                if (trackedVars.length > 0) {
                    // Use full recent context so variables mentioned earlier are also captured
                    const dialogueForExtraction = conversationContext 
                        ? `${conversationContext}\nUsuario: ${incomingMessage}\nAsistente: ${aiResponse}`
                        : `Usuario: ${incomingMessage}\nAsistente: ${aiResponse}`;

                    FactExtractionService.extractFromDialogue(
                        leadId, 
                        dialogueForExtraction, 
                        trackedVars, 
                        apiKey
                    ).catch((e: any) => console.error("[AI PROCESSOR] Fact extraction error:", e));
                }

            } else {
                console.error(`[AI PROCESSOR] ❌ WhatsApp credentials missing for tenant ${tenantId}`);
            }
        }

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[AI PROCESSOR] ❌ Critical Error:", error.message);
    }
}

function getAdminSupabase() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase configuration");
    }

    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
