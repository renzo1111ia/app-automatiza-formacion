-- ============================================================================
-- Sprint 1 · Tarea NEW-06 — Tabla lead_opportunities + dedup
-- ============================================================================
-- Modelo: un lead (persona) puede tener N solicitudes de informacion sobre
-- programas distintos a lo largo del tiempo. Bea V1: "se debera ver, con
-- fechas de solicitud, lo que paso en cada una".
--
-- Dedup: si un mismo lead+programa pide en <48h, la segunda se marca como
-- duplicada (is_duplicate_of) — politica explicita Bea V1.
--
-- RLS owner_or_admin (igual patron knowledge_base / integrations).
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lead_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
  programa_id UUID REFERENCES public.programas(id) ON DELETE SET NULL,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado_oportunidad TEXT NOT NULL DEFAULT 'NUEVA' CHECK (
    estado_oportunidad IN ('NUEVA', 'EN_PROCESO', 'CUALIFICADA', 'AGENDADA', 'CERRADA', 'DESCARTADA')
  ),
  is_duplicate_of UUID REFERENCES public.lead_opportunities(id) ON DELETE SET NULL,
  source TEXT, -- 'webhook_crm', 'ingest_form', 'manual', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_opportunities_lead
  ON public.lead_opportunities(lead_id, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_lead_opportunities_tenant
  ON public.lead_opportunities(tenant_id, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_lead_opportunities_dedup
  ON public.lead_opportunities(lead_id, programa_id, fecha_solicitud)
  WHERE is_duplicate_of IS NULL;

ALTER TABLE public.lead_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_opportunities_select_owner_or_admin" ON public.lead_opportunities;
DROP POLICY IF EXISTS "lead_opportunities_insert_owner_or_admin" ON public.lead_opportunities;
DROP POLICY IF EXISTS "lead_opportunities_update_owner_or_admin" ON public.lead_opportunities;
DROP POLICY IF EXISTS "lead_opportunities_delete_owner_or_admin" ON public.lead_opportunities;
DROP POLICY IF EXISTS "service_role_all_lead_opportunities" ON public.lead_opportunities;

CREATE POLICY "lead_opportunities_select_owner_or_admin"
  ON public.lead_opportunities
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "lead_opportunities_insert_owner_or_admin"
  ON public.lead_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "lead_opportunities_update_owner_or_admin"
  ON public.lead_opportunities
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

CREATE POLICY "service_role_all_lead_opportunities"
  ON public.lead_opportunities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_lead_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_opportunities_updated_at ON public.lead_opportunities;
CREATE TRIGGER trg_lead_opportunities_updated_at
  BEFORE UPDATE ON public.lead_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.touch_lead_opportunities_updated_at();

-- Migración datos legacy: 1 oportunidad por lead existente, sin dedup retroactivo.
-- Idempotente: NO inserta duplicados si ya existe la oportunidad legacy.
INSERT INTO public.lead_opportunities (tenant_id, lead_id, fecha_solicitud, estado_oportunidad, source, metadata)
SELECT
  l.tenant_id,
  l.id,
  COALESCE(l.fecha_ingreso_crm, l.fecha_creacion, NOW()),
  'NUEVA',
  'legacy_backfill',
  jsonb_build_object('backfilled_at', NOW(), 'lead_origen', COALESCE(l.origen, ''))
FROM public.lead l
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_opportunities lo
  WHERE lo.lead_id = l.id AND lo.source = 'legacy_backfill'
);
