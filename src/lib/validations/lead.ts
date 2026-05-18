import { z } from "zod";

/**
 * LEAD VALIDATION SCHEMA
 * Validates incoming leads from CRMs (Zoho, Salesforce, etc.)
 */
export const LeadWebhookSchema = z.object({
    id_lead_externo: z.string().optional(),
    nombre: z.string().min(1, "Nombre es requerido"),
    apellido: z.string().optional(),
    telefono: z.string().min(8, "Teléfono es demasiado corto"),
    email: z.string().email("Email inválido").optional(),
    pais: z.string().optional(),
    origen: z.string().optional(),
    campana: z.string().optional(),
});

export type LeadWebhook = z.infer<typeof LeadWebhookSchema>;
