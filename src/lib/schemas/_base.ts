import { z } from "zod";

// Helpers reutilizables para todos los schemas del dominio.
// Nomenclatura: campos en español coincidentes con docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS.

export const uuidSchema = z.string().uuid();
export const tenantIdSchema = uuidSchema;
export const timestampSchema = z.string().datetime({ offset: true });
export const nullableTimestampSchema = timestampSchema.nullable().optional();
export const jsonbSchema = z.record(z.string(), z.unknown());

export const emailSchema = z.string().email();
export const phoneSchema = z
  .string()
  .min(8, "Teléfono demasiado corto")
  .max(20, "Teléfono demasiado largo");

// ─── Enums comunes ─────────────────────────────────────────────────────────

export const LeadStageEnum = z.enum(["QUALIFICATION", "SCHEDULING", "COMPLETED", "DROPPED"]);
export type LeadStage = z.infer<typeof LeadStageEnum>;

// Razones de handoff humano (ADR-014, NEW-13).
export const HandoffReasonEnum = z.enum([
  "invalid_phone",
  "max_attempts_exceeded",
  "user_requested_stop",
]);
export type HandoffReason = z.infer<typeof HandoffReasonEnum>;

// Estado de cualificación tras llamada (ver lead_cualificacion.cualificacion).
export const QualificationEnum = z.enum([
  "CUALIFICADO",
  "NO_CUALIFICADO",
  "PENDIENTE",
  "ANULADO",
  "UNREACHABLE",
]);
export type Qualification = z.infer<typeof QualificationEnum>;

// Estado llamada Retell/Ultravox.
export const CallStatusEnum = z.enum([
  "completed",
  "no_answer",
  "voicemail",
  "failed",
  "in_progress",
  "scheduled",
]);
export type CallStatus = z.infer<typeof CallStatusEnum>;

// Estado appointment (calendar).
export const AppointmentStatusEnum = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>;

// Estado campañas marketing.
export const CampaignStatusEnum = z.enum(["ACTIVA", "PAUSADA", "FINALIZADA"]);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

// AI agent tipo y status.
export const AiAgentTypeEnum = z.enum(["QUALIFY", "REMINDER", "CLOSER", "SUPPORT"]);
export const AiAgentStatusEnum = z.enum(["ACTIVE", "PAUSED"]);

// LLM providers soportados.
export const LlmProviderEnum = z.enum(["OPENAI", "ANTHROPIC", "GEMINI"]);
export type LlmProvider = z.infer<typeof LlmProviderEnum>;

// Tipo intento (whatsapp vs llamada).
export const AttemptTypeEnum = z.enum(["LLAMADA", "WHATSAPP"]);

// Helper para schemas Create: omite id + timestamps.
export const omitAuditCreate = {
  id: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
  created_at: true,
  updated_at: true,
} as const;
