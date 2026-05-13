import axios from "axios";

/**
 * WHATSAPP CLOUD API BRIDGE
 * Native implementation for sending templates and messages via Meta.
 */

export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    wabaId?: string;
}

export interface WhatsAppTemplateComponent {
    type: string;
    text?: string;
    format?: string;
    buttons?: Record<string, unknown>[];
}

export interface WhatsAppTemplate {
    name: string;
    status: string;
    category: string;
    language: string;
    id: string;
    components?: WhatsAppTemplateComponent[];
}

export class WhatsAppBridge {
    private static API_URL = "https://graph.facebook.com/v20.0";

    /**
     * Sends a template message (required for initial contact outside windows).
     */
    public async sendTemplateMessage(
        to: string,
        templateName: string,
        languageCode: string = "es",
        components: Record<string, unknown>[] = [],
        config: WhatsAppConfig
    ) {
        try {
            const normalizedTo = to.replace(/\+/g, "").replace(/\s/g, "");
            const url = `${WhatsAppBridge.API_URL}/${config.phoneNumberId}/messages`;
            const response = await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: normalizedTo,
                    type: "template",
                    template: {
                        name: templateName,
                        language: { code: languageCode },
                        components: components,
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log(`[WHATSAPP BRIDGE] Template ${templateName} sent to ${to}. ID: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error: unknown) {
            const err = error as { response?: { data?: unknown }; message?: string };
            console.error("[WHATSAPP BRIDGE] Error sending template:", err.response?.data || err.message);
            throw error;
        }
    }

    /**
     * Sends a simple text message.
     */
    public async sendTextMessage(to: string, body: string, config: WhatsAppConfig) {
        try {
            // Safety check: Prevent sending if the lead is paused in DB
            try {
                const { createClient } = await import("@supabase/supabase-js");
                const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
                const { data: lead } = await supabase.from('lead').select('is_ai_paused').eq('telefono', to).maybeSingle();
                if (lead?.is_ai_paused) {
                    console.log(`[WHATSAPP BRIDGE] 🚫 BLOCKING outbound to ${to} because AI is PAUSED.`);
                    return { success: false, error: 'AI_PAUSED' };
                }
            } catch (e) {
                console.warn("[WHATSAPP BRIDGE] Failed to check pause status:", e);
            }

            const normalizedTo = to.replace(/\+/g, "").replace(/\s/g, "");
            const url = `${WhatsAppBridge.API_URL}/${config.phoneNumberId}/messages`;
            
            console.log(`[WHATSAPP BRIDGE] 📤 Sending text to ${to}: "${body.substring(0, 50)}..."`);
            
            const response = await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: normalizedTo,
                    type: "text",
                    text: { preview_url: false, body: body },
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            return response.data;
        } catch (error: unknown) {
            const err = error as { response?: { data?: unknown }; message?: string };
            console.error("[WHATSAPP BRIDGE] Error sending text:", err.response?.data || err.message);
            throw error;
        }
    }

    /**
     * Sends a typing indicator (Beta/New feature in Meta Cloud API)
     * Marks the message as 'read' and shows typing dots.
     */
    public async sendTypingIndicator(to: string, messageId: string, config: WhatsAppConfig) {
        try {
            const normalizedTo = to.replace(/\D/g, "");
            const url = `${WhatsAppBridge.API_URL}/${config.phoneNumberId}/messages`;
            
            // Note: In Cloud API, sending a 'read' status with typing_indicator
            await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    status: "read",
                    message_id: messageId,
                    to: normalizedTo,
                    typing_indicator: {
                        type: "text"
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );
            console.log(`[WHATSAPP BRIDGE] ✍️ Typing indicator sent for message ${messageId}`);
            return { success: true };
        } catch (error: unknown) {
            // We don't throw here to avoid blocking the main flow if typing fail
            const err = error as { response?: { data?: unknown }; message?: string };
            console.warn("[WHATSAPP BRIDGE] ⚠️ Failed to send typing indicator:", err.response?.data || err.message);
            return { success: false };
        }
    }

    /**
     * Sends a typing indicator ("typing...") to the user's WhatsApp.
     */
    public async sendLegacyTypingIndicator(to: string, config: WhatsAppConfig) {
        try {
            const url = `${WhatsAppBridge.API_URL}/${config.phoneNumberId}/messages`;
            await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: to.replace(/\D/g, ""),
                    type: "text",
                    text: { body: "..." } // Legacy simulation
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );
            return { success: true };
        } catch (error: unknown) {
            return { success: false };
        }
    }

    /**
     * Fetches available templates from the WhatsApp Business Account.
     */
    public async getAvailableTemplates(config: WhatsAppConfig): Promise<WhatsAppTemplate[]> {
        if (!config.wabaId || !config.accessToken) {
            throw new Error("WABA ID and Access Token are required to fetch templates.");
        }

        try {
            const url = `${WhatsAppBridge.API_URL}/${config.wabaId}/message_templates`;
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${config.accessToken}`,
                },
            });

            return response.data.data as WhatsAppTemplate[];
        } catch (error: unknown) {
            const err = error as { response?: { data?: unknown }; message?: string };
            console.error("[WHATSAPP BRIDGE] Error fetching templates:", err.response?.data || err.message);
            return [];
        }
    }
}

export const whatsappBridge = new WhatsAppBridge();
