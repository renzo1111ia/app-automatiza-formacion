/**
 * Helpers compartidos por las server actions / API routes de integraciones CRM.
 *
 * Centralizan:
 *   - Resolución del `tenant_id` desde la cookie.
 *   - Carga de rows de `integrations` con scoping multi-tenant.
 *   - Zod schemas para los inputs de los endpoints (write-policy, audit query).
 */
import { z } from "zod";
import { getActiveTenantId, getAdminSupabaseClient } from "@/lib/supabase/server";

export const SUPPORTED_PROVIDERS = ["hubspot", "zoho"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export const writePolicySchema = z.object({
  write_policy: z.enum(["append_only", "overwrite_with_audit"]),
  override_fields: z.array(z.string().min(1)).default([]),
});

export const providerParamSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
});

export interface IntegrationRow {
  id: string;
  tenant_id: string;
  crm_type: string;
  is_active: boolean;
  portal_id: string | null;
  data_center: string | null;
  metadata: Record<string, unknown> | null;
  write_policy: string | null;
  override_fields: string[] | null;
  oauth_state: string | null;
  last_healthcheck_at: string | null;
  healthcheck_status: string | null;
  scopes: string[] | null;
  expires_at: string | null;
}

const SELECT_COLUMNS =
  "id, tenant_id, crm_type, is_active, portal_id, data_center, metadata, write_policy, override_fields, oauth_state, last_healthcheck_at, healthcheck_status, scopes, expires_at";

export async function requireTenantId(): Promise<string> {
  const tenantId = await getActiveTenantId();
  if (!tenantId) throw new Error("No active tenant — cookie esden-tenant-id ausente");
  return tenantId;
}

export async function getIntegrationByProvider(
  tenantId: string,
  provider: SupportedProvider
): Promise<IntegrationRow | null> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("integrations")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("crm_type", provider)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`getIntegrationByProvider: ${error.message}`);
  return (data as IntegrationRow | null) ?? null;
}

export async function getIntegrationById(
  id: string,
  tenantId: string
): Promise<IntegrationRow | null> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("integrations")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`getIntegrationById: ${error.message}`);
  return (data as IntegrationRow | null) ?? null;
}

export async function listIntegrations(tenantId: string): Promise<IntegrationRow[]> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("integrations")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`listIntegrations: ${error.message}`);
  return (data as IntegrationRow[]) ?? [];
}

export function buildRedirectUri(provider: SupportedProvider): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8500";
  return `${base.replace(/\/$/, "")}/api/integrations/${provider}/auth/callback`;
}

export function getProviderEnv(provider: SupportedProvider): {
  clientId: string;
  clientSecret: string;
} {
  const upper = provider.toUpperCase();
  const clientId = process.env[`${upper}_CLIENT_ID`];
  const clientSecret = process.env[`${upper}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${upper}_CLIENT_ID / ${upper}_CLIENT_SECRET missing en .env`);
  }
  return { clientId, clientSecret };
}
