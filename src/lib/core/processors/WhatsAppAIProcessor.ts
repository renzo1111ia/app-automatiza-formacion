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
        const apiKey = activeVariant.api_key || process.env.OPENAI_API_KEY;
        
        if (!apiKey || apiKey === "your_api_key_here") {
            console.error(`[AI PROCESSOR] ❌ OpenAI API Key missing or invalid for lead ${leadId}`);
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
                    const kbIds = (activeVariant as any).knowledge_base_ids || [];
                    const kbResults = await KnowledgeBaseService.search(tenantId, embedding, 0.4, 3, kbIds);
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
            now: new Date().toLocaleString(),
            "$now": new Date().toLocaleString(),
            "$date": new Date().toLocaleDateString(),
            "$time": new Date().toLocaleTimeString(),
            ...((lead as any).metadata || {}), // CAPTURED MEMORY
            ...((activeVariant.dynamic_variables as Record<string, string>) || {}) // STATIC CONTEXT
        };

        let finalPrompt = activeVariant.prompt_text;

        // Replace patterns like {{nombre}}
        Object.keys(variableMap).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            finalPrompt = finalPrompt.replace(regex, variableMap[key]);
        });

        // 7. Define Tools
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "book_appointment",
                    description: "Agendar una nueva cita o reunión.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
                            time: { type: "string", description: "Hora en formato HH:MM" },
                            notes: { type: "string", description: "Notas adicionales o motivo" }
                        },
                        required: ["date"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "cancel_appointment",
                    description: "Cancelar una cita existente.",
                    parameters: {
                        type: "object",
                        properties: {
                            appointmentId: { type: "string", description: "ID de la cita a cancelar" }
                        },
                        required: ["appointmentId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "reschedule_appointment",
                    description: "Cambiar la fecha u hora de una cita existente.",
                    parameters: {
                        type: "object",
                        properties: {
                            appointmentId: { type: "string", description: "ID de la cita" },
                            newDate: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
                            newTime: { type: "string", description: "Nueva hora HH:MM" }
                        },
                        required: ["appointmentId", "newDate"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "check_availability",
                    description: "Consultar huecos libres para citas.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Fecha a consultar" }
                        }
                    }
                }
            }
        ];

        // 8. Build System Prompt
        const systemPrompt = `
${finalPrompt}

INFORMACIÓN ADICIONAL (CEREBRO):
${localKnowledge || "No hay información específica en la base de conocimiento para este mensaje."}

RESUMEN DE CONVERSACIÓN PREVIA:
${chatSummary || "Primera interacción con este lead."}

CONTEXTO RECIENTE (Últimas 10 líneas):
${conversationContext}
`;

        // 9. Call OpenAI with Tools
        let modelName = activeVariant.model_name || "gpt-4o";
        if (modelName === "gpt-4.1") modelName = "gpt-4o";
        if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";
        
        const openai = new OpenAI({ apiKey });
        
        console.log(`[AI PROCESSOR] 🧠 Calling ${modelName} with Tools...`);
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...recentHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "user", content: incomingMessage }
        ];

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 500
        });

        let aiMessage = completion.choices[0]?.message;
        
        // 10. Handle Tool Calls
        if (aiMessage?.tool_calls) {
            console.log(`[AI PROCESSOR] 🛠️ Tool calls detected: ${aiMessage.tool_calls.length}`);
            messages.push(aiMessage);

            const { AppointmentService } = await import("@/lib/services/appointment-service");

            for (const toolCall of aiMessage.tool_calls) {
                if (toolCall.type !== 'function') continue;

                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let result = "";

                try {
                    if (name === "book_appointment") {
                        const appt = await AppointmentService.bookAppointment(tenantId, leadId, args.date, args.time, args.notes);
                        result = JSON.stringify({ success: true, appointment: appt });
                    } else if (name === "cancel_appointment") {
                        const res = await AppointmentService.cancelAppointment(args.appointmentId);
                        result = JSON.stringify(res);
                    } else if (name === "reschedule_appointment") {
                        const res = await AppointmentService.rescheduleAppointment(args.appointmentId, args.newDate, args.newTime);
                        result = JSON.stringify(res);
                    } else if (name === "check_availability") {
                        const res = await AppointmentService.checkAvailability(tenantId, args.date);
                        result = JSON.stringify(res);
                    }
                } catch (e) {
                    result = JSON.stringify({ error: (e as Error).message });
                }

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result
                });
            }

            // Get final response after tool execution
            const secondCompletion = await openai.chat.completions.create({
                model: modelName,
                messages,
                temperature: 0.7
            });
            aiMessage = secondCompletion.choices[0]?.message;
        }

        const aiResponse = aiMessage?.content || "";

        if (aiResponse) {
            // 11. Update Redis Memory (Short-term)
            await ChatMemoryService.addMessage(leadId, 'user', incomingMessage);
            await ChatMemoryService.addMessage(leadId, 'assistant', aiResponse);

            if (waConfig?.accessToken && waConfig?.phoneNumberId) {
                await whatsappBridge.sendTextMessage((lead as any).telefono!, aiResponse, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 12. Log Outbound Message (Consolidated)
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
                        apiKey,
                        tenantId
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
