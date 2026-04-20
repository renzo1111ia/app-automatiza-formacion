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
            const normalizedTo = to.replace(/\+/g, "").replace(/\s/g, "");
            const url = `${WhatsAppBridge.API_URL}/${config.phoneNumberId}/messages`;
            const response = await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: normalizedTo,
                    type: "text",
                    text: { body: body },
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log(`[WHATSAPP BRIDGE] Text message sent to ${to}.`);
            return response.data;
        } catch (error: unknown) {
            const err = error as { response?: { data?: unknown }; message?: string };
            console.error("[WHATSAPP BRIDGE] Error sending text:", err.response?.data || err.message);
            throw error;
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
