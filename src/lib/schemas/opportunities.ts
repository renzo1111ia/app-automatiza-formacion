import { z } from "zod";
import {
  uuidSchema,
  tenantIdSchema,
  timestampSchema,
  nullableTimestampSchema,
  jsonbSchema,
} from "./_base";

// NEW-06: oportunidades de un lead. Un lead = persona, puede tener N oportunidades.

export const OpportunityStatusEnum = z.enum([
  "NUEVA",
  "EN_PROCESO",
  "CUALIFICADA",
  "AGENDADA",
  "CERRADA",
  "DESCARTADA",
]);
export type OpportunityStatus = z.infer<typeof OpportunityStatusEnum>;

export const LeadOpportunitySchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  lead_id: uuidSchema,
  programa_id: uuidSchema.nullable().optional(),
  fecha_solicitud: timestampSchema,
  estado_oportunidad: OpportunityStatusEnum,
  is_duplicate_of: uuidSchema.nullable().optional(),
  source: z.string().nullable().optional(),
  metadata: jsonbSchema.optional(),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type LeadOpportunity = z.infer<typeof LeadOpportunitySchema>;

export const CreateLeadOpportunitySchema = LeadOpportunitySchema.omit({
  id: true,
  tenant_id: true, // lo inyecta el repository como primer argumento
  is_duplicate_of: true, // lo calcula createWithDedup
  created_at: true,
  updated_at: true,
}).extend({
  fecha_solicitud: timestampSchema.optional(), // default NOW() server-side
  estado_oportunidad: OpportunityStatusEnum.optional(), // default NUEVA
});
export type CreateLeadOpportunity = z.infer<typeof CreateLeadOpportunitySchema>;
