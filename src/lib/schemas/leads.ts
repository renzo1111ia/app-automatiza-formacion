import { z } from "zod";
import {
  uuidSchema,
  tenantIdSchema,
  nullableTimestampSchema,
  jsonbSchema,
  LeadStageEnum,
} from "./_base";

// Nomenclatura validada contra VARIABLES DEFINIDAS (campos en español).
// Tabla: public.lead

export const LeadSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  id_lead_externo: z.string().nullable().optional(),
  nombre: z.string().nullable().optional(),
  apellido: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  pais: z.string().nullable().optional(),
  tipo_lead: z.string().nullable().optional(),
  origen: z.string().nullable().optional(),
  campana: z.string().nullable().optional(),
  foto_url: z.string().url().nullable().optional(),
  is_ai_enabled: z.boolean().optional(),
  fecha_ingreso_crm: nullableTimestampSchema,
  fecha_creacion: nullableTimestampSchema,
  fecha_actualizacion: nullableTimestampSchema,

  // v2.0 memory + orchestrator
  current_stage: LeadStageEnum.or(z.string()).nullable().optional(),
  metadata: jsonbSchema.nullable().optional(),
  last_interaction_at: nullableTimestampSchema,
  is_ai_paused: z.boolean().optional(),
  ai_agent_id: uuidSchema.nullable().optional(),
  inactivity_sent_count: z.number().int().nonnegative().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const CreateLeadSchema = LeadSchema.omit({
  id: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
}).extend({
  // En creación, nombre+telefono son los mínimos útiles para el orquestador.
  nombre: z.string().min(1, "Nombre requerido"),
  telefono: z.string().min(8, "Teléfono demasiado corto"),
});
export type CreateLead = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = LeadSchema.partial().omit({ id: true, tenant_id: true });
export type UpdateLead = z.infer<typeof UpdateLeadSchema>;

// Webhook entrante CRM externo (subset). Mantiene compat con src/lib/validations/lead.ts.
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

// Lead cualificacion (tabla `lead_cualificacion`).
export const LeadCualificacionSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  id_lead: uuidSchema,
  id_llamada: uuidSchema.nullable().optional(),
  motivo_anulacion: z.string().nullable().optional(),
  cualificacion: z.string().nullable().optional(),
  calificacion_score: z.number().nullable().optional(),
  objeciones: z.string().nullable().optional(),
  analisis_profundo: jsonbSchema.nullable().optional(),
  anios_experiencia: z.number().int().nullable().optional(),
  nivel_estudios: z.string().nullable().optional(),
  fecha_creacion: nullableTimestampSchema,
});
export type LeadCualificacion = z.infer<typeof LeadCualificacionSchema>;

export const CreateLeadCualificacionSchema = LeadCualificacionSchema.omit({
  id: true,
  fecha_creacion: true,
});
export type CreateLeadCualificacion = z.infer<typeof CreateLeadCualificacionSchema>;
