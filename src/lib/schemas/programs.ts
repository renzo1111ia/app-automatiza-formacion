import { z } from "zod";
import { uuidSchema, tenantIdSchema, nullableTimestampSchema, CampaignStatusEnum } from "./_base";

// Tabla: public.programas (mantiene nombre en español según VARIABLES DEFINIDAS).

export const ProgramaSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  nombre: z.string().min(1),
  id_producto: z.string().nullable().optional(),
  presentacion: z.string().nullable().optional(),
  objetivos: z.string().nullable().optional(),
  precio: z.string().nullable().optional(),
  becas_financiacion: z.string().nullable().optional(),
  metodologia: z.string().nullable().optional(),
  beneficios: z.string().nullable().optional(),
  practicas: z.string().nullable().optional(),
  fechas_inicio: z.string().nullable().optional(),
  requisitos_cualificacion: z.string().nullable().optional(),
  fecha_creacion: nullableTimestampSchema,
});
export type Programa = z.infer<typeof ProgramaSchema>;

export const CreateProgramaSchema = ProgramaSchema.omit({ id: true, fecha_creacion: true });
export type CreatePrograma = z.infer<typeof CreateProgramaSchema>;

export const UpdateProgramaSchema = ProgramaSchema.partial().omit({ id: true, tenant_id: true });
export type UpdatePrograma = z.infer<typeof UpdateProgramaSchema>;

// Asociación lead ↔ programa.
export const LeadProgramaSchema = z.object({
  id: uuidSchema,
  id_lead: uuidSchema,
  id_programa: uuidSchema,
  fecha_creacion: nullableTimestampSchema,
});
export type LeadPrograma = z.infer<typeof LeadProgramaSchema>;

// Asociación advisor ↔ programa.
export const AdvisorProgramaSchema = z.object({
  id: uuidSchema,
  advisor_id: uuidSchema,
  programa_id: uuidSchema,
  created_at: nullableTimestampSchema,
});
export type AdvisorPrograma = z.infer<typeof AdvisorProgramaSchema>;

// Campañas (tabla `campanas`).
export const CampanaSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  estado: CampaignStatusEnum.nullable().optional(),
  fecha_inicio: nullableTimestampSchema,
  fecha_fin: nullableTimestampSchema,
  agente_texto_id: uuidSchema.nullable().optional(),
  agente_llamada_id: uuidSchema.nullable().optional(),
  fecha_creacion: nullableTimestampSchema,
});
export type Campana = z.infer<typeof CampanaSchema>;

export const CreateCampanaSchema = CampanaSchema.omit({ id: true, fecha_creacion: true });
export type CreateCampana = z.infer<typeof CreateCampanaSchema>;

export const UpdateCampanaSchema = CampanaSchema.partial().omit({ id: true, tenant_id: true });
export type UpdateCampana = z.infer<typeof UpdateCampanaSchema>;
