import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { uploadToS3 } from "@/lib/integrations/aws/s3";
import axios from "axios";

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

export async function processIncomingWhatsApp(fromNumber: string, message: WebhookMessage, wabaId: string) {
    console.log(`[WHATSAPP PROCESSOR] Processing message from ${fromNumber} (WABA ID: ${wabaId})`);
    
    try {
        const supabase = getAdminSupabase();

        // 1. Identify Tenant by WABA ID (phone_number_id)
        // We use a safe cast or properly typed search
        const { data: tenants, error: tenantError } = await supabase
            .from("tenants")
            .select("id")
            .filter("config->whatsapp->>phoneNumberId", "eq", wabaId);

        if (tenantError || !tenants || tenants.length === 0) {
            console.warn(`[WHATSAPP PROCESSOR] No tenant found for phone_number_id: ${wabaId}`);
            return;
        }

        const tenantId = tenants[0].id;

        // 2. Normalize Phone Number
        let searchPhone = fromNumber;
        if (searchPhone.startsWith("+")) searchPhone = searchPhone.slice(1);

        // 3. Find or Create Lead
        const { data: leadFound, error: leadError } = await supabase
            .from("lead")
            .select("*")
            .eq("tenant_id", tenantId)
            .ilike("telefono", `%${searchPhone}%`)
            .maybeSingle();

        let lead = leadFound;

        if (leadError || !lead) {
            console.log(`[WHATSAPP PROCESSOR] Lead not found for ${fromNumber}. Creating anonymous lead.`);
            const { data: newLead, error: createError } = await supabase
                .from("lead")
                .insert({
                    tenant_id: tenantId,
                    telefono: fromNumber,
                    nombre: "Prospecto",
                    apellido: "WhatsApp",
                    origen: "WHATSAPP_INBOUND",
                    is_ai_enabled: true
                })
                .select()
                .single();
            
            if (createError) throw createError;
            lead = newLead;
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
                    const config = tenantData?.config as any;
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
                        mediaUrl = await uploadToS3(fileName, Buffer.from(fileRes.data), fileRes.headers['content-type']);
                        content = `[${message.type.toUpperCase()}]: ${mediaUrl}`;
                        console.log(`[WHATSAPP PROCESSOR] Media uploaded to S3: ${mediaUrl}`);
                    }
                } catch (mediaErr) {
                    console.error("[WHATSAPP PROCESSOR] Failed to process media:", mediaErr);
                    content = `[Error al procesar ${message.type}]`;
                }
            }
        } else {
            content = `[Mensaje tipo: ${message.type}]`;
        }

        // 5. Log Message in chat_messages
        // Use READ status as RECEIVED is not allowed by DB constraint
        const { error: logError } = await supabase
            .from("chat_messages")
            .insert({
                tenant_id: tenantId,
                lead_id: lead.id,
                direction: "INBOUND",
                message_type: "TEXT",
                content: content,
                status: "READ", // Must match DB constraint
                metadata: { 
                    meta_id: message.id, 
                    raw: message as any,
                    media_url: mediaUrl
                }
            });

        if (logError) console.error("[WHATSAPP PROCESSOR] Failed to log message in Supabase:", logError);

        // 6. Trigger AI Response
        if (lead.is_ai_enabled) {
            const { generateAIWhatsAppResponse } = await import("./WhatsAppAIProcessor");
            await generateAIWhatsAppResponse(tenantId, lead.id, content);
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
