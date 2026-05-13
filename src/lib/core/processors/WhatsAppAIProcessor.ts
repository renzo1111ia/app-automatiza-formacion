/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { whatsappBridge } from "../../integrations/whatsapp";
import OpenAI from "openai";
import { ChatMemoryService } from "@/lib/services/chat-memory";
import { KnowledgeBaseService, ChatSummaryService } from "@/lib/services/knowledge-base";
import { FactExtractionService } from "@/lib/services/fact-extractor";
import { GlobalLogger } from "../logger";
import { getTimezoneByCountry } from "@/lib/utils/timezones";
import { resolveCountryFromPhone } from "@/lib/utils/location-client";

/**
 * WHATSAPP AI PROCESSOR (CEREBRO v3.0)
 * Consolidates Redis Memory, PGVector Knowledge, and Dynamic Variables.
 * No AWS dependencies.
 */

export async function generateAIWhatsAppResponse(tenantId: string, leadId: string, incomingMessage: string) {
    if (!incomingMessage) return;
    
    try {
        const supabase = getAdminSupabase();
        await GlobalLogger.info(tenantId, "WHATSAPP", `Thinking started for lead ${leadId}`, { message: incomingMessage });

        // 0. Deduplication check - Handled by Webhook Processor to avoid self-blocking

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

        let { data: variants } = await variantQuery;
        
        if (!variants || (variants as any[]).length === 0) {
            console.warn(`[AI PROCESSOR] ⚠️ No active AI variant with prompt found for lead ${leadId}. Checking for ANY variant...`);
            
            // Second attempt: just ANY variant with a prompt
            const { data: anyVariants } = await (supabase.from("ai_agent_variants" as unknown as string) as any)
                .select("*")
                .eq("agent_id", agentId || "")
                .neq("prompt_text", "")
                .limit(1);
            
            if (!anyVariants || anyVariants.length === 0) {
                console.error(`[AI PROCESSOR] ❌ CRITICAL: No variants with prompt_text found for agent ${agentId}`);
                return;
            }
            variants = anyVariants as any;
        }

        // Si hay varias, intentamos elegir la que tenga prompt_text más largo o simplemente la primera (que por el orden será Variant A si existe)
        const activeVariant = (variants as any[])[0];
        const apiKey = (activeVariant.api_key && activeVariant.api_key !== "your_api_key_here") 
            ? activeVariant.api_key 
            : process.env.OPENAI_API_KEY;
        
        if (!apiKey || apiKey === "your_api_key_here") {
            await GlobalLogger.error(tenantId, "WHATSAPP", `Missing OpenAI API Key for lead ${leadId}`);
            console.error(`[AI PROCESSOR] ❌ OpenAI API Key missing both in Variant and System Env for lead ${leadId}`);
            return;
        }

        await GlobalLogger.info(tenantId, "WHATSAPP", `API Key verified, using variant ${activeVariant.id}`);

        const { AppointmentService } = await import("@/lib/services/appointment-service");

        // 3-5. Fetch all context data in parallel to reduce latency
        console.log(`[AI PROCESSOR] ⚡ Fetching context data and credentials in parallel...`);
        const [recentHistory, chatSummary, localKnowledge, tenantData, leadAppointments] = await Promise.all([
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
            (supabase.from("tenants" as unknown as string) as any).select("config").eq("id", tenantId).single(),
            // 7. Get Lead Appointments
            AppointmentService.getLeadAppointments(leadId).catch(err => {
                console.warn("[AI PROCESSOR] Appointments fetch skipped:", err);
                return [];
            })
        ]);

        const waConfig = (tenantData?.data as any)?.config?.whatsapp;

        // 🟢 EARLY TYPING INDICATOR: Trigger as soon as credentials are ready to show while AI is thinking
        if (waConfig?.accessToken && waConfig?.phoneNumberId) {
            whatsappBridge.sendTypingIndicator((lead as any).telefono!, {
                accessToken: waConfig.accessToken,
                phoneNumberId: waConfig.phoneNumberId
            }).catch(() => {});
        }

        const conversationContext = recentHistory.map(m =>
            `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
        ).join("\n");

        const TZ = "Europe/Madrid";
        const now = new Date();
        const variableMap = {
            nombre: (lead as any).nombre || 'estudiante',
            email: (lead as any).email || '',
            telefono: (lead as any).telefono || '',
            fecha: now.toLocaleDateString('es-ES', { timeZone: TZ }),
            hora: now.toLocaleTimeString('es-ES', { timeZone: TZ }),
            now: now.toLocaleString('es-ES', { timeZone: TZ }),
            pais: ((lead as any).pais && (lead as any).pais !== 'Desconocido' && (lead as any).pais !== 'Identificando...') 
                  ? (lead as any).pais 
                  : (resolveCountryFromPhone((lead as any).telefono) || 'Desconocido'),
            "$now": now.toLocaleString('es-ES', { timeZone: TZ }),
            "$date": now.toLocaleDateString('es-ES', { timeZone: TZ }),
            "$time": now.toLocaleTimeString('es-ES', { timeZone: TZ }),
            "$timezone": "Europe/Madrid (CET/CEST)",
            ...((lead as any).metadata || {}), // CAPTURED MEMORY
            ...((activeVariant.dynamic_variables as Record<string, string>) || {}) // STATIC CONTEXT
        };

        // Add implicit context about timezones
        const timezoneContext = `
[REGLAS DE AGENDAMIENTO]
1. Horario de atención: Solo puedes agendar citas entre las 09:00 y las 20:00 (Hora de España - Europe/Madrid).
2. NUNCA ofrezcas ni confirmes una hora fuera de este rango. Si el lead pide una hora que cae en la madrugada de España (como las 01:00), dile amablemente que esa hora no está disponible y ofrece una alternativa dentro del horario (09:00 - 20:00 Madrid).
3. Disponibilidad: Antes de confirmar cualquier hora, DEBES llamar a 'check_availability' para ver si el hueco está libre.
4. Doble Confirmación: Al confirmar, di siempre: "Perfecto, agendado para las [HORA LOCAL] de tu país, que son las [HORA ESPAÑA] aquí en España".
`;
        let finalPrompt = timezoneContext + "\n" + activeVariant.prompt_text;

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
                    description: "Agendar una nueva cita con un asesor. IMPORTANTE: El argumento 'date' DEBE ser una fecha en formato ISO (YYYY-MM-DD).",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Fecha de la cita (formato YYYY-MM-DD)" },
                            time: { type: "string", description: "Hora de la cita (formato HH:MM)" },
                            notes: { type: "string", description: "Notas adicionales sobre el interés del lead" }
                        },
                        required: ["date", "time"]
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
                            appointmentId: { type: "string", description: "ID único (UUID) de la cita a cancelar, obtenido de la lista de CITAS PROGRAMADAS." }
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
                            appointmentId: { type: "string", description: "ID único (UUID) de la cita, obtenido de la lista de CITAS PROGRAMADAS." },
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

CITAS PROGRAMADAS PARA ESTE LEAD:
${(leadAppointments as any[]).length > 0 
    ? (leadAppointments as any[]).map(a => `- ID: ${a.id} | Fecha/Hora: ${new Date(a.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} (Madrid) | Estado: ${a.status} | Asesor: ${a.advisors?.name || 'Por asignar'}`).join("\n")
    : "No hay citas programadas activas para este lead."}
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

        await GlobalLogger.info(tenantId, "WHATSAPP", `Calling OpenAI model ${modelName}`, { promptLength: systemPrompt.length });

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 500
        });

        let aiMessage = completion.choices[0]?.message;
        
        // 10. Handle Tool Calls with recursion (max 2 rounds)
        let toolRounds = 0;
        const maxToolRounds = 2;

        while (aiMessage?.tool_calls && toolRounds < maxToolRounds) {
            toolRounds++;
            console.log(`[AI PROCESSOR] 🛠️ Tool calls detected (Round ${toolRounds}): ${aiMessage.tool_calls.length}`);
            messages.push(aiMessage);

            const { AppointmentService } = await import("@/lib/services/appointment-service");
            const executedToolsInRound = new Set<string>();
            for (const toolCall of aiMessage.tool_calls) {
                if (toolCall.type !== 'function') continue;

                const name = toolCall.function.name;
                const argsString = toolCall.function.arguments;
                const toolKey = `${name}:${argsString}`;

                if (executedToolsInRound.has(toolKey)) {
                    console.log(`[AI PROCESSOR] ⏭️ Skipping duplicate tool call in same round: ${toolKey}`);
                    continue;
                }
                executedToolsInRound.add(toolKey);

                const args = JSON.parse(argsString);
                console.log(`[AI PROCESSOR] 🛠️ Executing tool: ${name}`, args);
                let result = "";

                try {
                    if (name === "book_appointment") {
                        const appt = await AppointmentService.bookAppointment(tenantId, leadId, args.date, args.time, args.notes);
                        
                        // AUTO-QUALIFY: If appointment is booked, automatically qualify the lead
                        try {
                            // Fetch dynamic segments to find the one for "appointments"
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const { data: tenant } = await (supabase.from("tenants") as any).select("config").eq("id", tenantId).single();
                            let targetSegment = "AGENDADO"; // fallback
                            if (tenant?.config?.segmentations) {
                                const segs = (tenant.config as { segmentations: string[] }).segmentations || [];
                                // Look for anything containing "AGENDA", "CITA", or "BOOK"
                                const matched = segs.find(s => s.toUpperCase().includes("AGENDA") || s.toUpperCase().includes("CITA"));
                                if (matched) targetSegment = matched;
                            }

                            await (supabase.from("lead") as any).update({
                                tipo_lead: 'CUALIFICADO',
                                segmentacion: targetSegment
                            }).eq("id", leadId);
                            console.log(`[AI PROCESSOR] 🎯 Goal met! Auto-qualifying lead ${leadId} as CUALIFICADO / ${targetSegment}.`);
                        } catch (err) {
                            console.error("[AI PROCESSOR] Failed to auto-qualify lead:", err);
                        }

                        result = JSON.stringify({ success: true, appointment: appt });
                    } else if (name === "cancel_appointment") {
                        const res = await AppointmentService.cancelAppointment(args.appointmentId);
                        result = JSON.stringify(res);
                    } else if (name === "reschedule_appointment") {
                        const res = await AppointmentService.rescheduleAppointment(args.appointmentId, args.newDate, args.newTime);
                        result = JSON.stringify(res);
                    } else if (name === "check_availability") {
                        const leadTimezone = getTimezoneByCountry((lead as any).pais);
                        const res = await AppointmentService.checkAvailability(tenantId, args.date, leadTimezone);
                        result = JSON.stringify(res);
                    }
                } catch (e) {
                    console.error(`[AI PROCESSOR] ❌ Error executing tool ${name}:`, e);
                    result = JSON.stringify({ 
                        error: (e as Error).message,
                        details: "Si el error persiste, contacta a soporte técnico." 
                    });
                }

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result
                });
                console.log(`[AI PROCESSOR] ✅ Tool ${name} result:`, result);
            }

            // Get next completion (could be another tool call or final response)
            const nextCompletion = await openai.chat.completions.create({
                model: modelName,
                messages,
                temperature: 0.7
            });
            aiMessage = nextCompletion.choices[0]?.message;
        }

        const aiResponse = aiMessage?.content || "";
        await GlobalLogger.info(tenantId, "WHATSAPP", `AI Response generated`, { response: aiResponse.substring(0, 100) });

        if (aiResponse) {
            // 11. Update Redis Memory (Short-term)
            await ChatMemoryService.addMessage(leadId, 'user', incomingMessage);
            await ChatMemoryService.addMessage(leadId, 'assistant', aiResponse);

            if (waConfig?.accessToken && waConfig?.phoneNumberId) {
                // 11.5 Simulate human typing delay (30ms per character, min 3s, max 6s)
                const typingDelay = Math.min(Math.max(aiResponse.length * 30, 3000), 6000);
                
                console.log(`[AI PROCESSOR] ⏳ Simulating typing delay of ${typingDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, typingDelay));

                await whatsappBridge.sendTextMessage((lead as any).telefono!, aiResponse, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 12. Log Outbound Message (Consolidated)
                await ChatSummaryService.appendMessage(tenantId, leadId, "Asistente", aiResponse);

                // 12. Individual message logging (REQUIRED FOR DASHBOARD INBOX)
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

                // 12. Autonomous Learning (Fact Extraction & Discovery)
                const trackedVars = (activeVariant.tracked_variables as string[]) || [];

                // 12b. Inject System Variables into metadata automatically
                const systemFacts: Record<string, string> = {
                    "AGENT_MESSAGE": aiResponse.substring(0, 500),
                    "USER_PHONE": (lead as any).telefono || "",
                    "RESUMEN_CONVERSACION": chatSummary || "En progreso..."
                };
                
                // We run it even if trackedVars is empty to allow for "Discovery" of other relevant data
                const dialogueForExtraction = conversationContext 
                    ? `${conversationContext}\nUsuario: ${incomingMessage}\nAsistente: ${aiResponse}`
                    : `Usuario: ${incomingMessage}\nAsistente: ${aiResponse}`;

                FactExtractionService.extractFromDialogue(
                    leadId, 
                    dialogueForExtraction, 
                    trackedVars, 
                    apiKey,
                    tenantId,
                    systemFacts // Passing pre-filled system facts
                ).catch((e: any) => console.error("[AI PROCESSOR] Fact extraction error:", e));

            } else {
                console.error(`[AI PROCESSOR] ❌ WhatsApp credentials missing for tenant ${tenantId}`);
            }
        }

    } catch (err: unknown) {
        const error = err as Error;
        await GlobalLogger.error(tenantId, "WHATSAPP", `Critical Error in generateAIWhatsAppResponse: ${error.message}`, { stack: error.stack });
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
