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

        // 1. Identify Tenant by WABA ID (phone_number_id)
        const { data: tenants, error: tenantError } = await supabase.from("tenants")
            .select("id")
            .filter("config->whatsapp->>phoneNumberId", "eq", wabaId);

        if (tenantError || !tenants || tenants.length === 0) {
            console.warn(`[WHATSAPP PROCESSOR] No tenant found for phone_number_id: ${wabaId}`);
            return;
        }

        const tenantId = (tenants as unknown as Array<{ id: string }>)[0].id;

        // 2. Normalize Phone Number
        let searchPhone = fromNumber;
        if (searchPhone.startsWith("+")) searchPhone = searchPhone.slice(1);

        // 3. Find or Create Lead
        const { data: leadFound, error: leadError } = await supabase.from("lead")
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newLead, error: createError } = await supabase.from("lead")
                .insert({
                    tenant_id: tenantId,
                    telefono: fromNumber,
                    nombre: firstName,
                    apellido: lastName,
                    origen: "WHATSAPP_INBOUND",
                    is_ai_enabled: true,
                    pais: location.countryName
                })
                .select()
                .single();
            
            if (createError) throw createError;
            lead = newLead;
        } else if (!lead.pais) {
            // Update country for existing lead if missing
            const location = getLeadLocationData(fromNumber);
            if (location.countryName) {
                await supabase.from("lead")
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
                    const { data: tenantData } = await supabase.from("tenants").select("config").eq("id", tenantId).single();
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

            // Log activity for debugging
            await supabase.from("system_logs").insert({
                tenant_id: tenantId,
                level: "INFO",
                message: `WhatsApp Inbound: ${fromNumber}`,
                metadata: { lead_id: lead.id, content: content.substring(0, 100) }
            });
        } catch (logEx) {
            console.error("[WHATSAPP PROCESSOR] Exception logging message:", logEx);
        }

        // 6. Trigger AI Response
        if ((lead as unknown as { is_ai_enabled: boolean }).is_ai_enabled) {
            const { generateAIWhatsAppResponse } = await import("./WhatsAppAIProcessor");
            await generateAIWhatsAppResponse(tenantId, (lead as unknown as { id: string }).id, content);
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
