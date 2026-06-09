-- ============================================================================
-- Sprint 5 · Zoho CRM entrada de leads (event-driven) — capa de datos
-- ============================================================================
-- Modelo: 1 tenant -> 1 integration (crm_type = 'zoho', Sprint 2) -> 1 config
-- de pull. La conexión OAuth (Client ID/Secret + tokens cifrados AES-256) ya
-- vive en `integrations`. Estas tablas la REFERENCIAN vía integration_id, no
-- duplican credenciales.
--
-- Dos tablas:
--   - zoho_sync_connections: config del pull por tenant (criterio de búsqueda,
--     field mapping, suscripción Notifications API / Workflow Webhook, cursor
--     de reconciliación, writeback on/off, activo/pausado).
--   - zoho_lead_synced: idempotencia por zoho_lead_id. Zoho da IDs únicos por
--     lead → no hace falta hash de fila (más simple que Sheets). Guarda
--     zoho_modified_time para comparar y NO re-procesar (clave anti-bucle).
--
-- RLS: dueño del tenant + admin. service_role bypass (webhooks/workers).
-- Idempotente.
--
-- Ref: plans/260608-1518-sprint-05-zoho-entrada-leads/phase-01-capa-datos-migraciones.md
-- ============================================================================

-- ── zoho_sync_connections ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zoho_sync_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  -- Criterio de búsqueda Zoho (módulo + filtro). Default: Leads modificados.
  search_criteria       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Mapeo campo Zoho -> target AF (lead.<campo> / lead_cualificacion.<campo> / metadata.<campo>).
  field_mapping         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Suscripción event-driven
  subscription_channel_id  TEXT,
  subscription_token       TEXT,
  subscription_expiry      TIMESTAMPTZ,
  subscription_method      TEXT NOT NULL DEFAULT 'notifications_api'
    CHECK (subscription_method IN ('notifications_api', 'workflow_webhook')),

  -- Write-back hacia Zoho (estado del lead, etc.)
  writeback_enabled     BOOLEAN NOT NULL DEFAULT true,

  -- Estado
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_synced_at        TIMESTAMPTZ,
  last_sync_error       TEXT,

  -- Auditoría
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),

  -- Una sola config de pull por (tenant, integración).
  UNIQUE (tenant_id, integration_id)
);

COMMENT ON TABLE public.zoho_sync_connections IS
  'Config de pull Zoho event-driven por tenant. Referencia la integración OAuth (Sprint 2) vía integration_id. Guarda suscripción Notifications API / Workflow Webhook + cursor de reconciliación.';

COMMENT ON COLUMN public.zoho_sync_connections.search_criteria IS
  'JSONB validado por ZohoSearchCriteriaSchema. Estructura: { module: "Leads", criteria?: "<Zoho COQL/criteria>" }. Default: Leads modificados.';

COMMENT ON COLUMN public.zoho_sync_connections.field_mapping IS
  'JSONB validado por ZohoFieldMappingSchema. Array de { zoho_field, target, type? }. target permite lead.<campo>, lead_cualificacion.<campo>, metadata.<campo>. Vacío => mapeo default.';

COMMENT ON COLUMN public.zoho_sync_connections.subscription_channel_id IS
  'ID del canal de la Notifications API de Zoho (channel_id). NULL si subscription_method = workflow_webhook.';

COMMENT ON COLUMN public.zoho_sync_connections.subscription_token IS
  'Token HMAC validado en /api/webhooks/zoho para autenticar la notificación entrante.';

COMMENT ON COLUMN public.zoho_sync_connections.subscription_expiry IS
  'TTL de la suscripción Notifications API (Zoho limita a 7 días). Worker renueva antes de caducar. NULL para workflow_webhook (no caduca).';

COMMENT ON COLUMN public.zoho_sync_connections.subscription_method IS
  'notifications_api = auto, caduca 7d, requiere renovación. workflow_webhook = manual en Zoho, NO caduca.';

COMMENT ON COLUMN public.zoho_sync_connections.last_synced_at IS
  'Cursor de la reconciliación diaria (red de seguridad). Marca hasta qué Modified_Time se procesó.';

-- ── Índices zoho_sync_connections ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_zoho_sync_conn_tenant
  ON public.zoho_sync_connections(tenant_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_zoho_sync_conn_integration
  ON public.zoho_sync_connections(integration_id);

CREATE INDEX IF NOT EXISTS idx_zoho_sync_conn_expiry
  ON public.zoho_sync_connections(subscription_expiry)
  WHERE is_active = true AND subscription_expiry IS NOT NULL;

-- ── RLS zoho_sync_connections ───────────────────────────────────────────────

ALTER TABLE public.zoho_sync_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zoho_sync_conn_select_owner_or_admin" ON public.zoho_sync_connections;
DROP POLICY IF EXISTS "zoho_sync_conn_insert_owner_or_admin" ON public.zoho_sync_connections;
DROP POLICY IF EXISTS "zoho_sync_conn_update_owner_or_admin" ON public.zoho_sync_connections;
DROP POLICY IF EXISTS "zoho_sync_conn_delete_owner_or_admin" ON public.zoho_sync_connections;
DROP POLICY IF EXISTS "service_role_all_zoho_sync_conn" ON public.zoho_sync_connections;

CREATE POLICY "zoho_sync_conn_select_owner_or_admin"
  ON public.zoho_sync_connections
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_sync_conn_insert_owner_or_admin"
  ON public.zoho_sync_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_sync_conn_update_owner_or_admin"
  ON public.zoho_sync_connections
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_sync_conn_delete_owner_or_admin"
  ON public.zoho_sync_connections
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_zoho_sync_conn"
  ON public.zoho_sync_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Trigger updated_at zoho_sync_connections ────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_zoho_sync_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zoho_sync_connections_updated_at ON public.zoho_sync_connections;
CREATE TRIGGER trg_zoho_sync_connections_updated_at
  BEFORE UPDATE ON public.zoho_sync_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_zoho_sync_connections_updated_at();

-- ============================================================================
-- zoho_lead_synced — idempotencia por zoho_lead_id
-- ============================================================================
-- Zoho da IDs únicos por lead. Esta tabla mapea zoho_lead_id -> lead_id interno
-- y guarda Modified_Time del lead en Zoho para comparar y NO re-procesar leads
-- que no han cambiado (clave anti-bucle pull <-> writeback).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.zoho_lead_synced (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  zoho_lead_id          TEXT NOT NULL,
  lead_id               UUID REFERENCES public.lead(id) ON DELETE SET NULL,
  zoho_modified_time    TIMESTAMPTZ,
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un lead Zoho sólo se registra una vez por integración.
  UNIQUE (integration_id, zoho_lead_id)
);

COMMENT ON TABLE public.zoho_lead_synced IS
  'Idempotencia del pull Zoho: mapea zoho_lead_id externo -> lead_id interno. zoho_modified_time evita re-procesar leads no modificados (anti-bucle).';

COMMENT ON COLUMN public.zoho_lead_synced.zoho_modified_time IS
  'Modified_Time del lead en Zoho. El pull lo compara antes de re-procesar: si Zoho no reporta cambio respecto a este valor, se omite (clave anti-bucle pull/writeback).';

CREATE INDEX IF NOT EXISTS idx_zoho_lead_synced_lead
  ON public.zoho_lead_synced(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoho_lead_synced_integration
  ON public.zoho_lead_synced(integration_id);

ALTER TABLE public.zoho_lead_synced ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zoho_lead_synced_select_owner_or_admin" ON public.zoho_lead_synced;
DROP POLICY IF EXISTS "zoho_lead_synced_insert_owner_or_admin" ON public.zoho_lead_synced;
DROP POLICY IF EXISTS "zoho_lead_synced_update_owner_or_admin" ON public.zoho_lead_synced;
DROP POLICY IF EXISTS "zoho_lead_synced_delete_owner_or_admin" ON public.zoho_lead_synced;
DROP POLICY IF EXISTS "service_role_all_zoho_lead_synced" ON public.zoho_lead_synced;

CREATE POLICY "zoho_lead_synced_select_owner_or_admin"
  ON public.zoho_lead_synced
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_lead_synced_insert_owner_or_admin"
  ON public.zoho_lead_synced
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_lead_synced_update_owner_or_admin"
  ON public.zoho_lead_synced
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "zoho_lead_synced_delete_owner_or_admin"
  ON public.zoho_lead_synced
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_zoho_lead_synced"
  ON public.zoho_lead_synced
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── PostgREST cache reload ─────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
