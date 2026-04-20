import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { uploadToS3 } from "@/lib/integrations/aws/s3";
import axios from "axios";

/**
 * WHATSAPP WEBHOOK PROCESSOR
 * Handles the logic of identifying leads, logging messages, and triggering AI responses.
 */

export async function processIncomingWhatsApp(fromNumber: string, message: any, wabaId: string) {
    console.log(`[WHATSAPP PROCESSOR] Processing message from ${fromNumber} (WABA ID: ${wabaId})`);
    
    try {
        // We get the config early to have the access token for media
        const supabase = getAdminSupabase();

        // 1. Identify Tenant by WABA ID (phone_number_id)
        // We search in the JSONB config of the tenants table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tenants, error: tenantError } = await (supabase.from("tenants" as any) as any)
            .select("id")
            .filter("config->whatsapp->>phoneNumberId", "eq", wabaId);

        if (tenantError || !tenants || (tenants as any[]).length === 0) {
            console.warn(`[WHATSAPP PROCESSOR] No tenant found for phone_number_id: ${wabaId}`);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (tenants as any[])[0].id;

        // 2. Normalize Phone Number (remove + or prefix if necessary)
        // Meta sends standard E.164, we search in the `lead` table
        let searchPhone = fromNumber;
        if (searchPhone.startsWith("+")) searchPhone = searchPhone.slice(1);

        // 3. Find or Create Lead
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadFound, error: leadError } = await (supabase.from("lead" as any) as any)
            .select("*")
            .eq("tenant_id", tenantId)
            .ilike("telefono", `%${searchPhone}%`)
            .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lead = leadFound as any;

        if (leadError || !lead) {
            console.log(`[WHATSAPP PROCESSOR] Lead not found for ${fromNumber}. Creating anonymous lead.`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newLead, error: createError } = await (supabase.from("lead" as any) as any)
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lead = newLead as any;
        }

        if (!lead) return; // Lead safety

        // 4. Extract content (Text or Media)
        let content = "";
        let mediaUrl = null;

        if (message.type === "text") {
            content = message.text?.body || "";
        } else if (message.type === "button") {
            content = message.button?.text || "";
        } else if (message.type === "interactive") {
            content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "Interacción Botón";
        } else if (message.type === "image" || message.type === "audio" || message.type === "document") {
            const mediaId = message[message.type].id;
            content = `[Archivo ${message.type} recibido]`;
            
            // Try to download and upload to S3
            try {
                // We need the access token from the tenant config
                const { data: tenantData } = await (supabase.from("tenants" as any) as any).select("config").eq("id", tenantId).single();
                const token = (tenantData as any)?.config?.whatsapp?.accessToken;

                if (token) {
                    console.log(`[WHATSAPP PROCESSOR] Downloading media ${mediaId} from Meta...`);
                    // 1. Get download URL
                    const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    const downloadUrl = metaRes.data.url;
                    
                    // 2. Download Buffer
                    const fileRes = await axios.get(downloadUrl, {
                        headers: { Authorization: `Bearer ${token}` },
                        responseType: 'arraybuffer'
                    });

                    // 3. Upload to S3
                    const fileName = `whatsapp/${tenantId}/${message.id}.${message.type === 'audio' ? 'ogg' : 'jpg'}`;
                    mediaUrl = await uploadToS3(fileName, Buffer.from(fileRes.data), fileRes.headers['content-type']);
                    content = `[${message.type.toUpperCase()}]: ${mediaUrl}`;
                    console.log(`[WHATSAPP PROCESSOR] Media uploaded to S3: ${mediaUrl}`);
                }
            } catch (mediaErr) {
                console.error("[WHATSAPP PROCESSOR] Failed to process media:", mediaErr);
                content = `[Error al procesar ${message.type}]`;
            }
        } else {
            content = `[Mensaje tipo: ${message.type}]`;
        }

        // 1. Get Lead & Tenant Context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadData } = await (supabase.from("lead" as any) as any).select("*").eq("id", lead.id).single();
        if (!leadData) return;

        // 2. Get Course Info (Programas)
        // We look for the programs linked to this lead
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadPrograms } = await (supabase.from("lead_programas" as any) as any).select("id_programa").eq("id_lead", lead.id);

        // 5. Log Message in `chat_messages` (Supabase)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: logError } = await (supabase.from("chat_messages" as any) as any)
            .insert({
                tenant_id: tenantId,
                lead_id: lead.id,
                direction: "INBOUND",
                message_type: "TEXT",
                content: content,
                status: "RECEIVED",
                metadata: { 
                    meta_id: message.id, 
                    raw: message, 
                    programs: leadPrograms,
                    media_url: mediaUrl
                }
            });

        if (logError) console.error("[WHATSAPP PROCESSOR] Failed to log message in Supabase:", logError);

        // 6. Trigger AI Response if AI is enabled for this lead
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
