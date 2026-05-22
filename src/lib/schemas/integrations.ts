import { z } from "zod";
import {
  uuidSchema,
  tenantIdSchema,
  timestampSchema,
  nullableTimestampSchema,
  jsonbSchema,
} from "./_base";

// ─── Integrations (CRM externos: HubSpot, Zoho, Sheets, Salesforce, GHL, AC) ───
// Diseñado pensando en Fase 2 (adapter HubSpot/Zoho) — el shape ya soporta los demás.

export const CrmTypeEnum = z.enum([
  "hubspot",
  "zoho",
  "google_sheets",
  "salesforce",
  "gohighlevel",
  "activecampaign",
]);
export type CrmType = z.infer<typeof CrmTypeEnum>;

export const CrmDataCenterEnum = z.enum(["us", "eu", "in", "au", "cn", "jp"]);

// Las credenciales (tokens OAuth, refresh_token, api_key) se cifran AES-256 antes de persistir.
// El campo `credentials_cipher` contiene el ciphertext, NO los tokens en claro (ver tarea 2-26).
export const IntegrationSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  crm_type: CrmTypeEnum,
  data_center: CrmDataCenterEnum.nullable().optional(),
  display_name: z.string().min(1),
  is_active: z.boolean().default(true),
  credentials_cipher: z.string().nullable(),
  credentials_iv: z.string().nullable(),
  scopes: z.array(z.string()).optional(),
  expires_at: nullableTimestampSchema,
  last_sync_at: nullableTimestampSchema,
  metadata: jsonbSchema.optional(),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type Integration = z.infer<typeof IntegrationSchema>;

export const CreateIntegrationSchema = IntegrationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateIntegration = z.infer<typeof CreateIntegrationSchema>;

// ─── Webhooks entrantes (CRM → AF) ───────────────────────────────────────

export const WebhookDirectionEnum = z.enum(["inbound", "outbound"]);

export const WebhookSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  integration_id: uuidSchema.nullable().optional(),
  direction: WebhookDirectionEnum,
  endpoint_url: z.string().url(),
  secret: z.string().nullable(),
  event_types: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
  last_received_at: nullableTimestampSchema,
  created_at: nullableTimestampSchema,
});
export type Webhook = z.infer<typeof WebhookSchema>;

// ─── Field mapping CRM ↔ dominio AF ──────────────────────────────────────
// Diseñado para que el adapter sepa: "campo X en HubSpot = campo Y en mi dominio".
// `transform` opcional para conversiones (uppercase, fecha ISO, etc.).

export const CrmFieldMappingSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  integration_id: uuidSchema,
  crm_type: CrmTypeEnum,
  crm_field: z.string().min(1),
  local_field: z.string().min(1),
  local_entity: z.enum(["lead", "appointment", "qualification", "program"]),
  transform: z.string().nullable().optional(),
  is_required: z.boolean().default(false),
  created_at: nullableTimestampSchema,
});
export type CrmFieldMapping = z.infer<typeof CrmFieldMappingSchema>;

// ─── Audit append-only de escrituras al CRM (R-014) ───────────────────────

export const CrmWriteOperationEnum = z.enum(["create", "update", "delete", "upsert"]);
export const CrmWriteResultEnum = z.enum(["success", "error", "skipped", "deferred"]);
export const CrmWritePolicyEnum = z.enum(["append_only", "overwrite_with_audit"]);

export const CrmWriteAuditSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  integration_id: uuidSchema,
  crm_type: CrmTypeEnum,
  operation: CrmWriteOperationEnum,
  local_entity: z.string(),
  local_entity_id: uuidSchema,
  crm_entity_id: z.string().nullable(),
  payload_hash: z.string(),
  result: CrmWriteResultEnum,
  error_message: z.string().nullable().optional(),
  write_policy: CrmWritePolicyEnum.default("append_only"),
  created_at: timestampSchema,
});
export type CrmWriteAudit = z.infer<typeof CrmWriteAuditSchema>;

export const CreateCrmWriteAuditSchema = CrmWriteAuditSchema.omit({ id: true, created_at: true });
export type CreateCrmWriteAudit = z.infer<typeof CreateCrmWriteAuditSchema>;
