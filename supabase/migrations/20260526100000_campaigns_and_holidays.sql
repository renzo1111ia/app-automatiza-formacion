-- Sprint 3 phase-08 Bloque 3.B (NEW-09 + NEW-10).
-- Crea 2 tablas:
--   campaigns       : entidad propia para campañas (antes solo TEXT column en leads).
--   tenant_holidays : festivos manuales por país per-tenant (bloquea scheduler).
--
-- Ambas con RLS multi-tenant + índices + dedup.

-- =============================================================================
-- campaigns — NEW-09
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  -- Source CSV/Excel/API. NULL si creada en UI manual.
  source TEXT,
  -- Config flexible: cadencia (leads/min), ventana horaria, días activos.
  -- Ejemplo: { "rate_per_min": 5, "window_start": "09:00", "window_end": "20:00", "active_days": [1,2,3,4,5] }
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_tenant_select ON campaigns
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY campaigns_tenant_insert ON campaigns
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY campaigns_tenant_update ON campaigns
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY campaigns_tenant_delete ON campaigns
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Trigger updated_at automático.
CREATE OR REPLACE FUNCTION campaigns_updated_at_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION campaigns_updated_at_trigger();

-- =============================================================================
-- tenant_holidays — NEW-10
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (tenant_id, country_code, date)
);

CREATE INDEX IF NOT EXISTS idx_tenant_holidays_lookup
  ON tenant_holidays(tenant_id, country_code, date);

ALTER TABLE tenant_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_holidays_tenant_select ON tenant_holidays
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_holidays_tenant_insert ON tenant_holidays
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_holidays_tenant_delete ON tenant_holidays
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Comentarios para audit trail
COMMENT ON TABLE campaigns IS 'Sprint 3 NEW-09: campañas como entidad propia (antes solo TEXT column en leads). Config JSONB para cadencia configurable.';
COMMENT ON TABLE tenant_holidays IS 'Sprint 3 NEW-10: festivos manuales por país per-tenant. Usado por BullMQ scheduler para evitar envíos en festivos.';
