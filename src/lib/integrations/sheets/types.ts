// Sprint 4 - Google Sheets bidireccional
//
// Types + Zod schemas para la integracion Sheets.
// Catalogo de targets validado segun docs/Docs-entrega-clienta/Estructura/
// VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx.

import { z } from "zod";

// ─── Targets permitidos ────────────────────────────────────────────────────
// Catalogo cerrado para campos top-level (lead + lead_cualificacion).
// metadata.* es libre (cualquier subcampo JSONB).

export const LEAD_TOP_LEVEL_FIELDS = [
  "lead.id_lead_externo",
  "lead.nombre",
  "lead.apellido",
  "lead.telefono",
  "lead.email",
  "lead.pais",
  "lead.tipo_lead",
  "lead.origen",
  "lead.campana",
  "lead.foto_url",
  "lead.current_stage",
  "lead.is_ai_enabled",
] as const;

export const LEAD_CUALIFICACION_FIELDS = [
  "lead_cualificacion.cualificacion",
  "lead_cualificacion.motivo_anulacion",
  "lead_cualificacion.anios_experiencia",
  "lead_cualificacion.nivel_estudios",
] as const;

// Catalogo recomendado de metadata.* (no restrictivo - cualquier metadata.<custom> es valido).
export const METADATA_RECOMMENDED_FIELDS = [
  "metadata.empresa",
  "metadata.cargo",
  "metadata.user_age",
  "metadata.user_profession",
  "metadata.year_experience",
  "metadata.user_studies",
  "metadata.nivel_estudios",
  "metadata.user_motivations",
  "metadata.curse_name",
  "metadata.curse_origin",
  "metadata.fecha_agenda",
  "metadata.ok_whatsapp",
  "metadata.notas",
  "metadata.qualified",
  "metadata.estado",
  "metadata.motivo_descarte",
  "metadata.conversation_status",
  "metadata.scheduled_call_confirmed",
  "metadata.qa_handled",
  "metadata.qa_topic",
] as const;

const targetRegex = /^(lead|lead_cualificacion|metadata)\.[a-z_][a-z0-9_]*$/;

// ─── Tipos de columna ──────────────────────────────────────────────────────

export const ColumnTypeEnum = z.enum([
  "string",
  "text",
  "email",
  "phone",
  "url",
  "number",
  "boolean",
  "datetime",
  "date",
  "json",
  "enum:lead_stage",
  "enum:qualified",
  "enum:estado",
  "enum:motivo_descarte",
  "enum:nivel_estudios",
]);
export type ColumnType = z.infer<typeof ColumnTypeEnum>;

// Enums alineados con VARIABLES DEFINIDAS de la clienta.
export const QualifiedEnum = z.enum(["apto", "no apto", ""]);
export const EstadoEnum = z.enum([
  "cualificado",
  "agendado",
  "informado",
  "matriculado",
  "descartado",
  "ilocalizable",
  "",
]);
export const MotivoDescarteEnum = z.enum([
  "ilocalizable",
  "No cumple requisitos",
  "No ha pedido información",
  "Pide no ser contactado",
  "No interesado por precio",
  "No interesado, no indica motivo",
  "Se matricula en la competencia",
  "Solo quiere Oficial",
  "No le interesa temario",
  "No le interesa modalidad ofertada",
  "No le interesa la titulación ofertada",
  "Solo busca información",
  "N/A",
]);
export const NivelEstudiosEnum = z.enum([
  "Postgrado/master",
  "universitario",
  "técnico",
  "preuniversitario",
  "básico",
  "sin estudios",
]);

// ─── ColumnMapping schema ──────────────────────────────────────────────────

export const ColumnMappingEntrySchema = z.object({
  letter: z
    .string()
    .regex(/^[A-Z]{1,3}$/, "letter debe ser columna Sheet en mayúscula (A, B, ..., AA, AB, ...)"),
  header: z.string().optional(),
  target: z
    .string()
    .regex(
      targetRegex,
      "target debe ser lead.<campo>, lead_cualificacion.<campo> o metadata.<campo>"
    ),
  type: ColumnTypeEnum,
  writeback: z.boolean().optional().default(false),
});
export type ColumnMappingEntry = z.infer<typeof ColumnMappingEntrySchema>;

export const ColumnMappingSchema = z.object({
  header_row: z.number().int().min(1).default(1),
  data_start_row: z.number().int().min(1).default(2),
  columns: z.array(ColumnMappingEntrySchema).min(1, "Debe haber al menos 1 columna mapeada"),
});
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

// ─── SheetConnection row schema ────────────────────────────────────────────

export const PurposeEnum = z.enum(["leads_inbound", "leads_export", "reporting", "custom"]);
export type SheetPurpose = z.infer<typeof PurposeEnum>;

export const SheetConnectionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  integration_id: z.string().uuid(),
  spreadsheet_id: z.string().min(1),
  spreadsheet_name: z.string().nullable().optional(),
  sheet_tab_name: z.string().default("Hoja 1"),
  purpose: PurposeEnum.default("leads_inbound"),
  column_mapping: ColumnMappingSchema,
  drive_channel_id: z.string().uuid().nullable().optional(),
  drive_channel_token: z.string().nullable().optional(),
  drive_resource_id: z.string().nullable().optional(),
  drive_channel_expiry: z.string().nullable().optional(),
  writeback_enabled: z.boolean().default(false),
  is_active: z.boolean().default(true),
  last_synced_at: z.string().nullable().optional(),
  last_sync_error: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
});
export type SheetConnection = z.infer<typeof SheetConnectionSchema>;

// ─── Job payloads (BullMQ) ─────────────────────────────────────────────────

export const SheetPullJobSchema = z.object({
  sheet_connection_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  trigger: z.enum(["webhook", "manual", "cron-renew"]),
  triggered_at: z.string(),
});
export type SheetPullJob = z.infer<typeof SheetPullJobSchema>;

export const SheetWritebackJobSchema = z.object({
  sheet_connection_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  changes: z.record(z.string(), z.unknown()),
  triggered_at: z.string(),
});
export type SheetWritebackJob = z.infer<typeof SheetWritebackJobSchema>;

// ─── Errores tipados ───────────────────────────────────────────────────────

export class SheetsAdapterError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_MISSING"
      | "CREDENTIALS_INVALID"
      | "WATCH_FAILED"
      | "READ_FAILED"
      | "WRITE_FAILED"
      | "MAPPING_INVALID"
      | "QUOTA_EXCEEDED",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SheetsAdapterError";
  }
}
