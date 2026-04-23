/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { whatsappBridge } from "../../integrations/whatsapp";
import OpenAI from "openai";
import { ChatMemoryService } from "@/lib/services/chat-memory";
import { KnowledgeBaseService, ChatSummaryService } from "@/lib/services/knowledge-base";

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
            .eq("is_active", true);
        
        if (agentId) {
            variantQuery = variantQuery.eq("agent_id", agentId);
        } else {
            // Fallback to first active variant of the tenant
            const { data: tenantAgents } = await (supabase.from("ai_agents" as unknown as string) as any).select("id").eq("tenant_id", tenantId);
            const agentIds = (tenantAgents || []).map((a: any) => a.id);
            variantQuery = variantQuery.in("agent_id", agentIds);
        }

        const { data: variants } = await variantQuery.limit(1);

        if (!variants || (variants as any[]).length === 0) {
            console.warn(`[AI PROCESSOR] ⚠️ No active AI variant found for lead ${leadId}`);
            return;
        }

        const activeVariant = (variants as any[])[0];
        const apiKey = activeVariant.api_key || process.env.OPENAI_API_KEY; // Global fallback
        
        if (!apiKey) {
            console.error(`[AI PROCESSOR] ❌ API Key missing for response`);
            return;
        }

        // 3. Get Recent Context (REDIS - Last 10 lines)
        const recentHistory = await ChatMemoryService.getRecentContext(leadId);
        const conversationContext = recentHistory.map(m => 
            `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
        ).join("\n");

        // 4. Get Long-Term Memory (SQL Summary)
        const chatSummary = await ChatSummaryService.getSummary(leadId);

        // 5. Get Local Knowledge (PGVector)
        // Note: For search, we need embeddings. For now, we assume search might be triggered
        // if the model name supports external tools or we do it here.
        // We'll simulate a query if knowledge is enabled.
        let localKnowledge = "";
        try {
            // We'd need an embedding for incomingMessage. Using OpenAI for that.
            const openai = new OpenAI({ apiKey });
            const embedRes = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: incomingMessage,
            });
            const embedding = embedRes.data[0].embedding;
            const kbResults = await KnowledgeBaseService.search(tenantId, embedding, 0.4, 3);
            localKnowledge = kbResults.map(r => `- ${r.content}`).join("\n");
        } catch (kbErr) {
            console.warn("[AI PROCESSOR] KB search skipped/failed:", kbErr);
        }

        // 6. Process Dynamic Variables
        let finalPrompt = activeVariant.prompt_text;
        
        // Substitution Map
        const variableMap: Record<string, string> = {
            "nombre": (lead as any).nombre || "Prospecto",
            "apellido": (lead as any).apellido || "",
            "email": (lead as any).email || "desconocido",
            "telefono": (lead as any).telefono || "",
            "pais": (lead as any).pais || "no especificado",
            "fecha": new Date().toLocaleDateString(),
            "hora": new Date().toLocaleTimeString(),
            ...((activeVariant.dynamic_variables || {}) as Record<string, string>) // Custom variables from variant
        };

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
        const modelName = activeVariant.model_name || "gpt-4o";
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

            // 10. Send via WhatsApp
            const { data: tenant } = await (supabase.from("tenants" as unknown as string) as any).select("config").eq("id", tenantId).single();
            const waConfig = (tenant as any)?.config?.whatsapp;

            if (waConfig?.accessToken && waConfig?.phoneNumberId) {
                await whatsappBridge.sendTextMessage((lead as any).telefono!, aiResponse, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 11. Log Outbound Message (Supabase)
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
