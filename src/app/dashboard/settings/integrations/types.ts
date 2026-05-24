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
