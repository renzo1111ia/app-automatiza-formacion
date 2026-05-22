import { z } from "zod";
import { uuidSchema, tenantIdSchema, nullableTimestampSchema, jsonbSchema } from "./_base";

// Tabla: public.tenants

export const TenantSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  username: z.string().optional(),
  supabase_url: z.string().url(),
  supabase_anon_key: z.string().min(20),
  client_email: z.string().email().optional(),
  is_admin: z.boolean().optional(),
  auth_user_id: uuidSchema.optional(),
  api_type: z.enum(["internal", "client"]).optional(),
  config: jsonbSchema,
  api_key: z.string().nullable().optional(),
  daily_spend_limit: z.number().nonnegative().optional(),
  monthly_spend_limit: z.number().nonnegative().optional(),
  current_daily_spend: z.number().nonnegative().optional(),
  current_monthly_spend: z.number().nonnegative().optional(),
  last_spend_reset: nullableTimestampSchema,
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type Tenant = z.infer<typeof TenantSchema>;

export const CreateTenantSchema = TenantSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

export const UpdateTenantSchema = TenantSchema.partial().omit({ id: true });
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

// Roles dentro de un tenant (multi-membership futuro). De momento se gestiona vía auth_user_id directo.
export const TenantMemberRoleEnum = z.enum(["admin", "member", "viewer"]);
export type TenantMemberRole = z.infer<typeof TenantMemberRoleEnum>;

// tenant_orchestrator_config (legacy Motor 1 — ver ADR-015).
export const TenantOrchestratorConfigSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  config: jsonbSchema,
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type TenantOrchestratorConfig = z.infer<typeof TenantOrchestratorConfigSchema>;

// client_configs (Motor 2 — workflows + reglas separadas).
export const ClientConfigSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  routing_rules: z.object({
    allowed_campaigns: z.array(z.string()),
    allowed_origins: z.array(z.string()),
    drop_invalid_leads: z.boolean(),
    contact_sequence: z.array(z.enum(["whatsapp", "call"])),
  }),
  rescue_config: z.object({
    enabled: z.boolean(),
    wait_minutes: z.number().int().nonnegative(),
    template_id: z.string(),
  }),
  timezone_config: z.object({
    default_timezone: z.string(),
    compliance_start: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
    compliance_end: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  }),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;
