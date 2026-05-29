-- ============================================================================
-- Sprint 4 · Google Sheets bidireccional — tabla sheet_connections
-- ============================================================================
-- Modelo: 1 tenant -> 1 integration (crm_type = 'google_sheets') -> N sheets.
--
-- Una sola integración `integrations` por tenant guarda Client ID/Secret +
-- OAuth tokens del tenant (cifrados AES-256 vía credentials_cipher).
--
-- Esta tabla registra N hojas independientes conectadas por ese tenant
-- mediante Google Picker (scope drive.file). Cada hoja tiene:
--   - Su propio Drive watch channel (TTL 7 días, renovación BullMQ).
--   - Su propio column_mapping (estructura de columnas distinta por hoja).
--   - Su propio purpose (leads_inbound / leads_export / reporting / custom).
--   - Estado activo independiente (pausar 1 hoja sin afectar al resto).
--
-- RLS: dueño del tenant + admin. service_role bypass (webhooks/workers).
-- Idempotente.
--
-- Ref: plans/260521-0000-sprint-4-google-sheets/plan.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sheet_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  -- Identificación Google Drive
  spreadsheet_id        TEXT NOT NULL,
  spreadsheet_name      TEXT,
  sheet_tab_name        TEXT NOT NULL DEFAULT 'Hoja 1',

  -- Configuración funcional
  purpose               TEXT NOT NULL DEFAULT 'leads_inbound'
    CHECK (purpose IN ('leads_inbound', 'leads_export', 'reporting', 'custom')),
  column_mapping        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Push notifications Drive (watch channel)
  drive_channel_id      UUID,
  drive_channel_token   TEXT,
  drive_resource_id     TEXT,
  drive_channel_expiry  TIMESTAMPTZ,

  -- Write-back hacia la Sheet (estado del lead, etc.)
  writeback_enabled     BOOLEAN NOT NULL DEFAULT false,

  -- Estado
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_synced_at        TIMESTAMPTZ,
  last_sync_error       TEXT,

  -- Auditoría
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),

  -- Una hoja sólo puede estar conectada una vez por tenant.
  UNIQUE (tenant_id, spreadsheet_id, sheet_tab_name)
);

COMMENT ON TABLE public.sheet_connections IS
  'N Sheets conectadas por tenant vía Google Picker (scope drive.file). Cada hoja tiene watch channel propio + column mapping configurable.';

COMMENT ON COLUMN public.sheet_connections.purpose IS
  'leads_inbound = leer filas nuevas y crear leads. leads_export = escribir leads procesados. reporting = solo lectura. custom = lógica ad-hoc.';

COMMENT ON COLUMN public.sheet_connections.column_mapping IS
  'JSONB tipado validado por ColumnMappingSchema (src/lib/integrations/sheets/types.ts). Estructura: { header_row, data_start_row, columns: [{ letter, header, target, type, writeback }] }. target permite lead.<campo>, lead_cualificacion.<campo>, metadata.<campo>. writeback=true habilita escritura desde Esden hacia esa celda.';

COMMENT ON COLUMN public.sheet_connections.drive_channel_token IS
  'Token HMAC validado en /api/webhooks/google-sheets. Auto-generado al crear watch channel. Por hoja, no compartido.';

COMMENT ON COLUMN public.sheet_connections.drive_channel_expiry IS
  'TTL del watch channel (Drive limita a 7 días). Worker BullMQ renueva 24h antes.';

COMMENT ON COLUMN public.sheet_connections.writeback_enabled IS
  'Si true, los cambios de stage del lead se reflejan en la celda correspondiente de la Sheet.';

-- ── Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sheet_connections_tenant
  ON public.sheet_connections(tenant_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sheet_connections_integration
  ON public.sheet_connections(integration_id);

CREATE INDEX IF NOT EXISTS idx_sheet_connections_channel
  ON public.sheet_connections(drive_channel_id)
  WHERE drive_channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sheet_connections_expiry
  ON public.sheet_connections(drive_channel_expiry)
  WHERE is_active = true AND drive_channel_expiry IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.sheet_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sheet_connections_select_owner_or_admin" ON public.sheet_connections;
DROP POLICY IF EXISTS "sheet_connections_insert_owner_or_admin" ON public.sheet_connections;
DROP POLICY IF EXISTS "sheet_connections_update_owner_or_admin" ON public.sheet_connections;
DROP POLICY IF EXISTS "sheet_connections_delete_owner_or_admin" ON public.sheet_connections;
DROP POLICY IF EXISTS "service_role_all_sheet_connections" ON public.sheet_connections;

CREATE POLICY "sheet_connections_select_owner_or_admin"
  ON public.sheet_connections
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "sheet_connections_insert_owner_or_admin"
  ON public.sheet_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "sheet_connections_update_owner_or_admin"
  ON public.sheet_connections
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

CREATE POLICY "sheet_connections_delete_owner_or_admin"
  ON public.sheet_connections
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_sheet_connections"
  ON public.sheet_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Trigger updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_sheet_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sheet_connections_updated_at ON public.sheet_connections;
CREATE TRIGGER trg_sheet_connections_updated_at
  BEFORE UPDATE ON public.sheet_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_sheet_connections_updated_at();

-- ============================================================================
-- sheet_row_processed — idempotencia: evitar reprocesar misma fila
-- ============================================================================
-- Drive notifica "algo cambió en este archivo" sin decir qué. El worker debe
-- leer toda la Sheet, hashear cada fila y registrar las nuevas/modificadas.
-- Esta tabla guarda el hash de cada fila YA procesada para skipear duplicados
-- y detectar updates.
--
-- TTL implícito: rotar/purgar filas con last_seen_at > 90 días + Sheet inactiva.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sheet_row_processed (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_connection_id   UUID NOT NULL REFERENCES public.sheet_connections(id) ON DELETE CASCADE,
  row_index             INTEGER NOT NULL,
  row_hash              TEXT NOT NULL,
  lead_id               UUID REFERENCES public.lead(id) ON DELETE SET NULL,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (sheet_connection_id, row_index)
);

COMMENT ON TABLE public.sheet_row_processed IS
  'Idempotencia pull: hash de cada fila procesada por sheet_connection. Permite detectar nuevas vs modificadas vs ya vistas.';

CREATE INDEX IF NOT EXISTS idx_sheet_row_processed_lead
  ON public.sheet_row_processed(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sheet_row_processed_connection
  ON public.sheet_row_processed(sheet_connection_id, last_seen_at DESC);

ALTER TABLE public.sheet_row_processed ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe. Authenticated lee filas de sus propias sheets
-- (vía join implícito por sheet_connection_id que ya tiene RLS).

DROP POLICY IF EXISTS "sheet_row_processed_select_owner" ON public.sheet_row_processed;
DROP POLICY IF EXISTS "service_role_all_sheet_row_processed" ON public.sheet_row_processed;

CREATE POLICY "sheet_row_processed_select_owner"
  ON public.sheet_row_processed
  FOR SELECT
  TO authenticated
  USING (
    sheet_connection_id IN (
      SELECT id FROM public.sheet_connections
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_sheet_row_processed"
  ON public.sheet_row_processed
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── PostgREST cache reload ─────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
