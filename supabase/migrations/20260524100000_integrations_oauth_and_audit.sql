-- ============================================================================
-- Sprint 2 · Phase 01 — Ampliación tabla integrations + crm_write_audit
-- ============================================================================
-- Añade columnas necesarias para Sprint 2 (Adapter HubSpot + Zoho):
--   - write_policy + override_fields → enforcement del WriteGuard (R-014).
--   - oauth_state → state ephemeral durante OAuth handshake (anti-CSRF, se borra
--     en el callback).
--   - last_healthcheck_at + healthcheck_status → UI muestra estado del provider.
--   - portal_id → HubSpot hub_id (multi-portal). Zoho usa metadata.api_domain
--     (no necesita columna nueva — JSONB ya existe en metadata desde Sprint 1).
--
-- IMPORTANTE: NO crea columnas access_token_encrypted / refresh_token_encrypted
-- porque Sprint 1 ya entregó `credentials_cipher TEXT` que persiste
-- JSON.stringify({accessToken, refreshToken}) cifrado con AES-256-GCM
-- (ver src/lib/crypto/token-crypto.ts + ADR-017).
--
-- Constraint UNIQUE(tenant_id): enforza decisión cliente "1 CRM activo por
-- tenant" (24-05-2026). Se aplica como índice único parcial sobre filas
-- con is_active = true, para permitir registros históricos desactivados
-- de integraciones anteriores (audit trail).
--
-- crm_write_audit: append-only a nivel DB (no UPDATE, no DELETE policies),
-- sólo service_role INSERT, authenticated SELECT del propio tenant.
--
-- Ref: plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §3
-- ============================================================================

-- ── 1. Nuevas columnas en integrations ──────────────────────────────────────

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS write_policy TEXT NOT NULL DEFAULT 'append_only'
    CHECK (write_policy IN ('append_only', 'overwrite_with_audit'));

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS override_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS oauth_state TEXT;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS last_healthcheck_at TIMESTAMPTZ;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS healthcheck_status TEXT
    CHECK (healthcheck_status IN ('ok', 'error') OR healthcheck_status IS NULL);

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS portal_id TEXT;

COMMENT ON COLUMN public.integrations.write_policy IS
  'append_only = nunca sobrescribir campos con valor no-null en el CRM. overwrite_with_audit = permite sobrescribir SOLO campos listados en override_fields, escribiendo audit row en crm_write_audit.';

COMMENT ON COLUMN public.integrations.override_fields IS
  'Whitelist de campos permitidos para overwrite cuando write_policy = overwrite_with_audit. Array vacío = bloquea cualquier overwrite.';

COMMENT ON COLUMN public.integrations.oauth_state IS
  'State HMAC efímero usado durante el OAuth handshake. Se limpia (UPDATE oauth_state = NULL) tras callback exitoso.';

COMMENT ON COLUMN public.integrations.healthcheck_status IS
  'Resultado del último healthcheck del provider. ok = autenticado y alcanzable. error = falló (revisar logs). NULL = nunca ejecutado.';

COMMENT ON COLUMN public.integrations.portal_id IS
  'HubSpot hub_id / portal_id obtenido de /oauth/v1/access-tokens/{token}. Para Zoho NO se usa (la región vive en metadata.api_domain).';

-- ── 2. UNIQUE(tenant_id) WHERE is_active = true ─────────────────────────────
-- Decisión cliente 24-05-2026: 1 CRM activo por tenant. Permite mantener filas
-- históricas con is_active = false (audit). El índice parcial cubre el caso
-- común sin romper bajas/altas.

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_one_active_per_tenant
  ON public.integrations(tenant_id)
  WHERE is_active = true;

COMMENT ON INDEX public.idx_integrations_one_active_per_tenant IS
  'Enforza máximo 1 integración activa por tenant (decisión 24-05-2026).';

-- ── 3. crm_write_audit (append-only) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crm_write_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  lead_id        TEXT NOT NULL,
  field_name     TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT NOT NULL,
  write_policy   TEXT NOT NULL,
  actor_id       UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.crm_write_audit IS
  'Append-only log de overwrites a CRMs externos. Solo service_role INSERT. Sin policies UPDATE/DELETE → inmutable a nivel DB.';

CREATE INDEX IF NOT EXISTS idx_crm_write_audit_tenant_lead
  ON public.crm_write_audit(tenant_id, lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_write_audit_integration
  ON public.crm_write_audit(integration_id, created_at DESC);

ALTER TABLE public.crm_write_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_owner_or_admin" ON public.crm_write_audit;
DROP POLICY IF EXISTS "audit_insert_service_role" ON public.crm_write_audit;

CREATE POLICY "audit_select_owner_or_admin"
  ON public.crm_write_audit
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "audit_insert_service_role"
  ON public.crm_write_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No UPDATE policy. No DELETE policy. service_role bypassa RLS de todas formas
-- (igual que en el resto de tablas), pero a nivel de capa app NO permitimos.

-- ── 4. PostgREST cache reload ───────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
