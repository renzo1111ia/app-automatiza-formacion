/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * META TEMPLATE SERVICE
 * Centralizes the logic for mapping Lead data/Metadata into Meta WhatsApp Template parameters.
 */
export class MetaTemplateService {
    
    /**
     * Resolves a list of variables for a WhatsApp template based on lead information.
     * @param templateConfig - JSON configuration of parameters (e.g. ["{{nombre}}", "{{sede}}"])
     * @param leadData - The lead object containing standard fields and metadata.
     * @returns Array of formatted WhatsApp parameter objects.
     */
    static resolveParameters(templateConfig: string[], leadData: any): any[] {
        if (!templateConfig || templateConfig.length === 0) return [];

        return templateConfig.map((templateVar) => {
            // Remove {{ and }} if present
            const cleanVar = templateVar.replace(/{{|}}/g, '').trim();

            // 1. Try standard fields
            let value = leadData[cleanVar];

            // 2. Try metadata (Captured facts)
            if (value === undefined && leadData.metadata) {
                value = leadData.metadata[cleanVar];
            }

            // 3. Fallbacks
            if (value === undefined || value === null) {
                switch(cleanVar) {
                    case 'nombre': value = 'Estudiante'; break;
                    case 'sede': value = 'Esden'; break;
                    default: value = ''; break;
                }
            }

            return {
                type: "text",
                text: String(value)
            };
        });
    }

    /**
     * Helper to prepare the full Meta API payload for a template.
     */
    static preparePayload(to: string, templateName: string, languageCode: string, params: any[]) {
        return {
            messaging_product: "whatsapp",
            to: to,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
                components: [
                    {
                        type: "body",
                        parameters: params
                    }
                ]
            }
        };
    }
}
