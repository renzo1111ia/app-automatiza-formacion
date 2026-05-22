-- ============================================================================
-- Sprint 1 · Tarea 2-26 — Tabla integrations + columnas cifradas
-- ============================================================================
-- Crea la tabla `integrations` que persiste credenciales OAuth cifradas
-- (AES-256-GCM, ver src/lib/crypto/token-crypto.ts).
--
-- Columnas:
--   credentials_cipher TEXT — payload cifrado (formato iv:ct:authTag).
--   credentials_iv     TEXT — NO se usa (el iv ya va dentro del payload). Lo
--     mantenemos por compat con el schema Zod IntegrationSchema; valor NULL.
--
-- El backend (Server Actions + repo) es el unico punto que cifra/descifra,
-- nunca persiste tokens en claro.
--
-- RLS: solo owner_or_admin. service_role bypass para webhooks/jobs.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN (
    'hubspot', 'zoho', 'google_sheets', 'salesforce', 'gohighlevel', 'activecampaign'
  )),
  data_center TEXT CHECK (data_center IN ('us', 'eu', 'in', 'au', 'cn', 'jp') OR data_center IS NULL),
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  credentials_cipher TEXT,
  credentials_iv TEXT,
  scopes TEXT[],
  expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant_crm
  ON public.integrations(tenant_id, crm_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_integrations_tenant_active
  ON public.integrations(tenant_id)
  WHERE is_active = true;

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations_select_owner_or_admin" ON public.integrations;
DROP POLICY IF EXISTS "integrations_insert_owner_or_admin" ON public.integrations;
DROP POLICY IF EXISTS "integrations_update_owner_or_admin" ON public.integrations;
DROP POLICY IF EXISTS "integrations_delete_owner_or_admin" ON public.integrations;
DROP POLICY IF EXISTS "service_role_all_integrations" ON public.integrations;

CREATE POLICY "integrations_select_owner_or_admin"
  ON public.integrations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "integrations_insert_owner_or_admin"
  ON public.integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "integrations_update_owner_or_admin"
  ON public.integrations
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "integrations_delete_owner_or_admin"
  ON public.integrations
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "service_role_all_integrations"
  ON public.integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at auto.
CREATE OR REPLACE FUNCTION public.touch_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON public.integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_integrations_updated_at();
