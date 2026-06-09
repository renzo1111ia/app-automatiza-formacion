// Sprint 5 - Zoho CRM entrada de leads (event-driven)
//
// Types + Zod schemas para el pull Zoho. Patrón de referencia:
// src/lib/integrations/sheets/types.ts.
// Targets validados según docs/Docs-entrega-clienta/Estructura/
// VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx.

import { z } from "zod";

// ─── Método de suscripción event-driven ────────────────────────────────────

export const ZohoSubscriptionMethodEnum = z.enum([
  "notifications_api", // auto, caduca 7d, requiere renovación
  "workflow_webhook", // manual en Zoho, NO caduca
]);
export type ZohoSubscriptionMethod = z.infer<typeof ZohoSubscriptionMethodEnum>;

// ─── Field mapping (campo Zoho -> target AF) ───────────────────────────────
// target permite lead.<campo>, lead_cualificacion.<campo> o metadata.<campo>.

const targetRegex = /^(lead|lead_cualificacion|metadata)\.[a-z_][a-z0-9_]*$/;

export const ZohoFieldMappingEntrySchema = z.object({
  zoho_field: z.string().min(1, "zoho_field no puede estar vacío"),
  target: z
    .string()
    .regex(
      targetRegex,
      "target debe ser lead.<campo>, lead_cualificacion.<campo> o metadata.<campo>"
    ),
  type: z.string().optional(),
});
export type ZohoFieldMappingEntry = z.infer<typeof ZohoFieldMappingEntrySchema>;

// Array de entries. Vacío => se usa el mapeo default del pull processor.
export const ZohoFieldMappingSchema = z.array(ZohoFieldMappingEntrySchema);
export type ZohoFieldMapping = z.infer<typeof ZohoFieldMappingSchema>;

// ─── Criterio de búsqueda Zoho ─────────────────────────────────────────────

export const ZohoSearchCriteriaSchema = z.object({
  module: z.literal("Leads").default("Leads"),
  criteria: z.string().optional(),
});
export type ZohoSearchCriteria = z.infer<typeof ZohoSearchCriteriaSchema>;

// ─── ZohoSyncConnection row schema ─────────────────────────────────────────

export const ZohoSyncConnectionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  integration_id: z.string().uuid(),
  search_criteria: ZohoSearchCriteriaSchema,
  field_mapping: ZohoFieldMappingSchema,
  subscription_channel_id: z.string().nullable().optional(),
  subscription_token: z.string().nullable().optional(),
  subscription_expiry: z.string().nullable().optional(),
  subscription_method: ZohoSubscriptionMethodEnum.default("notifications_api"),
  writeback_enabled: z.boolean().default(true),
  is_active: z.boolean().default(true),
  last_synced_at: z.string().nullable().optional(),
  last_sync_error: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
});
export type ZohoSyncConnection = z.infer<typeof ZohoSyncConnectionSchema>;

// ─── Job payloads (BullMQ) ─────────────────────────────────────────────────

export const ZohoPullJobSchema = z.object({
  integration_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  // IDs concretos a procesar (webhook). Vacío/omitido => reconciliación amplia.
  zoho_lead_ids: z.array(z.string()).optional(),
  // Datos inline del lead (campos crudos de Zoho) cuando el Workflow Webhook los
  // manda en el body. Mapa zoho_lead_id -> { campo_zoho: valor }. Si vienen, el
  // processor los usa directamente y NO llama a getLead() (no requiere OAuth).
  // Si falta el id o sus campos, se hace fallback a getLead() (Notifications API).
  inline_leads: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  trigger: z.enum(["webhook", "manual", "reconcile", "cron-renew"]),
  triggered_at: z.string(),
});
export type ZohoPullJob = z.infer<typeof ZohoPullJobSchema>;

export const ZohoWritebackJobSchema = z.object({
  integration_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  changes: z.record(z.string(), z.unknown()),
  triggered_at: z.string(),
});
export type ZohoWritebackJob = z.infer<typeof ZohoWritebackJobSchema>;

// ─── Errores tipados ───────────────────────────────────────────────────────

export class ZohoPullError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_MISSING"
      | "SUBSCRIPTION_FAILED"
      | "LEAD_FETCH_FAILED"
      | "MAPPING_INVALID"
      | "WRITE_FAILED"
      | "TOKEN_INVALID",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ZohoPullError";
  }
}
