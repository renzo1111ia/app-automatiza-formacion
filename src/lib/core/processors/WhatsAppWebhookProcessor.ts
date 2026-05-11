import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { uploadToMinio } from "@/lib/integrations/minio";
import axios from "axios";
import { getLeadLocationData } from "@/lib/core/compliance";

/**
 * WHATSAPP WEBHOOK PROCESSOR
 * Handles the logic of identifying leads, logging messages, and triggering AI responses.
 */

interface WebhookMessage {
    id: string;
    type: string;
    from: string;
    text?: { body: string };
    button?: { text: string };
    interactive?: {
        button_reply?: { title: string };
        list_reply?: { title: string };
    };
    image?: { id: string };
    audio?: { id: string };
    document?: { id: string };
    [key: string]: unknown;
}

export async function processIncomingWhatsApp(fromNumber: string, message: WebhookMessage, wabaId: string, contactName?: string | null) {
    console.log(`[WHATSAPP PROCESSOR] Processing message from ${fromNumber} (WABA ID: ${wabaId}, Name: ${contactName})`);
    
    try {
        const supabase = getAdminSupabase();

        // 0. Deduplication check (Skip if we already processed this Meta ID)
        if (message.id) {
            const { data: existing } = await (supabase.from("chat_messages" as any) as any)
                .select("id")
                .eq("metadata->>meta_id", message.id)
                .maybeSingle();
            
            if (existing) {
                console.log(`[WHATSAPP PROCESSOR] ⏭️ Skipping duplicate Meta ID: ${message.id}`);
                return;
            }
        }

        // 1. Identify Tenant by WABA ID (phone_number_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tenants, error: tenantError } = await (supabase.from("tenants") as any)
            .select("id")
            .filter("config->whatsapp->>phoneNumberId", "eq", wabaId);

        if (tenantError || !tenants || tenants.length === 0) {
            console.warn(`[WHATSAPP PROCESSOR] No tenant found for phone_number_id: ${wabaId}`);
            
            // Emergency log for production visibility
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("system_logs" as any) as any).insert({
                tenant_id: "47e84fa2-73f3-4e23-9267-1e49d4442f70",
                level: "WARNING",
                message: `WHATSAPP_WEBHOOK: Tenant not found for WABA ID: ${wabaId}`,
                metadata: { wabaId, fromNumber, error: tenantError }
            });
            return;
        }

        const tenantId = (tenants as unknown as Array<{ id: string }>)[0].id;

        // 2. Normalize Phone Number
        let searchPhone = fromNumber;
        if (searchPhone.startsWith("+")) searchPhone = searchPhone.slice(1);

        // 3. Find or Create Lead
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadFound, error: leadError } = await (supabase.from("lead") as any)
            .select("*")
            .eq("tenant_id", tenantId)
            .ilike("telefono", `%${searchPhone}%`)
            .maybeSingle();

        let lead = leadFound;

        if (leadError || !lead) {
            console.log(`[WHATSAPP PROCESSOR] Lead not found for ${fromNumber}. Creating lead: ${contactName || 'Anonymous'}`);
            
            // Handle name logic: Use contactName if available, else placeholder
            const fullName = contactName || "Prospecto WhatsApp";
            const parts = fullName.split(' ');
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ') || (contactName ? "" : "WhatsApp"); // If it's a real name we don't force 'WhatsApp' as surname

            // Get location data from phone prefix
            const location = getLeadLocationData(fromNumber);

            // Find the default active agent for this tenant to auto-assign
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: defaultAgent } = await (supabase.from("ai_agents") as any)
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("status", "ACTIVE")
                .limit(1)
                .maybeSingle();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newLead, error: createError } = await (supabase.from("lead") as any)
                .insert({
                    tenant_id: tenantId,
                    telefono: fromNumber,
                    nombre: firstName,
                    apellido: lastName,
                    origen: "WHATSAPP_INBOUND",
                    is_ai_enabled: true,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ai_agent_id: (defaultAgent as any)?.id || null,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pais: (location as any).countryName
                })
                .select()
                .single();
            
            if (createError) throw createError;
            lead = newLead;
        } else if (!lead.pais) {
            // Update country for existing lead if missing
            const location = getLeadLocationData(fromNumber);
            if (location.countryName) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("lead") as any)
                    .update({ pais: location.countryName })
                    .eq("id", lead.id);
                lead.pais = location.countryName;
            }
        }

        if (!lead) return;

        // 4. Extract content
        let content = "";
        let mediaUrl: string | null = null;

        if (message.type === "text") {
            content = message.text?.body || "";
        } else if (message.type === "button") {
            content = message.button?.text || "";
        } else if (message.type === "interactive") {
            content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "Interacción Botón";
        } else if (message.type === "image" || message.type === "audio" || message.type === "document") {
            const mediaObj = message[message.type] as { id: string } | undefined;
            const mediaId = mediaObj?.id;
            content = `[Archivo ${message.type} recibido]`;
            
            if (mediaId) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: tenantData } = await (supabase.from("tenants") as any).select("config").eq("id", tenantId).single();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const config = (tenantData as any)?.config;
                    const token = config?.whatsapp?.accessToken;

                    if (token) {
                        console.log(`[WHATSAPP PROCESSOR] Downloading media ${mediaId} from Meta...`);
                        const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        const downloadUrl = metaRes.data.url;
                        const fileRes = await axios.get(downloadUrl, {
                            headers: { Authorization: `Bearer ${token}` },
                            responseType: 'arraybuffer'
                        });

                        const fileName = `whatsapp/${tenantId}/${message.id}.${message.type === 'audio' ? 'ogg' : 'jpg'}`;
                        mediaUrl = await uploadToMinio(fileName, Buffer.from(fileRes.data), fileRes.headers['content-type']);
                        content = `[${message.type.toUpperCase()}]: ${mediaUrl}`;
                        console.log(`[WHATSAPP PROCESSOR] Media uploaded to MinIO: ${mediaUrl}`);
                    }
                } catch (mediaErr) {
                    console.error("[WHATSAPP PROCESSOR] Failed to process media:", mediaErr);
                    content = `[Error al procesar ${message.type}]`;
                }
            }
        } else {
            content = `[Mensaje tipo: ${message.type}]`;
        }

        // 5. Log Message in consolidated chat_summaries
        const { ChatSummaryService } = await import("@/lib/services/knowledge-base");
        await ChatSummaryService.appendMessage(tenantId, lead.id, "Usuario", content);

        // 5b. Individual message logging (Re-enabled for Omnicanal Inbox)
        try {
            const { error: logError } = await (supabase.from("chat_messages" as unknown as string) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> })
                .insert({
                    tenant_id: tenantId,
                    lead_id: (lead as unknown as { id: string }).id,
                    direction: "INBOUND",
                    message_type: "TEXT",
                    content: content,
                    status: "READ",
                    metadata: { 
                        meta_id: message.id, 
                        raw: message as unknown,
                        media_url: mediaUrl
                    }
                });

            if (logError) {
                console.error("[WHATSAPP PROCESSOR] Failed to log message in Supabase:", logError);
            } else {
                console.log(`[WHATSAPP PROCESSOR] Message logged successfully for lead ${lead.id}`);
            }

            // activity log for debugging
            const { GlobalLogger } = await import("../logger");
            await GlobalLogger.info(tenantId, "WHATSAPP", `WhatsApp Inbound: ${fromNumber}`, { 
                lead_id: lead.id, 
                content: content.substring(0, 100),
                is_ai_enabled: (lead as unknown as { is_ai_enabled: boolean }).is_ai_enabled
            });
        } catch (logEx) {
            console.error("[WHATSAPP PROCESSOR] Exception logging message:", logEx);
        }

        // 6. Trigger AI Response
        if ((lead as unknown as { is_ai_enabled: boolean }).is_ai_enabled) {
            const { GlobalLogger } = await import("../logger");
            await GlobalLogger.info(tenantId, "WHATSAPP", `🤖 Calling AI Processor for lead ${lead.id}`);
            const { generateAIWhatsAppResponse } = await import("./WhatsAppAIProcessor");
            await generateAIWhatsAppResponse(tenantId, (lead as unknown as { id: string }).id, content, message.id);
        } else {
            const { GlobalLogger } = await import("../logger");
            await GlobalLogger.warn(tenantId, "WHATSAPP", `AI is DISABLED for lead ${lead.id}. Skipping.`);
        }

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[WHATSAPP PROCESSOR] Error:", error.message);
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
