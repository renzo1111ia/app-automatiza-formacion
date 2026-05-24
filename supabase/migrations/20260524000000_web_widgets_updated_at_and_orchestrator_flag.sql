-- ============================================================
-- 20260524000000 — web_widgets.updated_at + orchestrator flag
-- ============================================================
-- Phase B fixes from plan plans/260524-1020-doc-agent-empty-states-full/:
--   B.4: add web_widgets.updated_at column + trigger (schema cache error fix).
--   B.3: enable test_orchestrator_enabled flag for ALL existing tenants
--        (silences "Orchestration disabled for tenant" 403 in dashboard).

-- ----------------------------------------------------------------
-- Shared trigger function for updated_at maintenance.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- B.4 — web_widgets.updated_at
-- ----------------------------------------------------------------
ALTER TABLE public.web_widgets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS trg_web_widgets_updated_at ON public.web_widgets;
CREATE TRIGGER trg_web_widgets_updated_at
  BEFORE UPDATE ON public.web_widgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill existing rows so updated_at is never NULL.
UPDATE public.web_widgets SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- ----------------------------------------------------------------
-- B.3 — enable test_orchestrator_enabled for existing tenants
-- ----------------------------------------------------------------
-- The flag is the guard from src/lib/api-auth.ts::requireOrchestrationEnabled.
-- The dashboard fails with 403 if it's not explicitly true. Seeded tenants
-- pre-this-migration didn't have it set, so we patch the JSONB column.
UPDATE public.tenants
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('test_orchestrator_enabled', true)
WHERE COALESCE((config ->> 'test_orchestrator_enabled')::boolean, false) IS DISTINCT FROM true;

-- ----------------------------------------------------------------
-- Reload PostgREST schema cache so the new column is visible immediately.
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
