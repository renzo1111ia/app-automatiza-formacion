-- ============================================================
-- 20260524000001 — help_sections table for Doc Admin + Docs Clientes
-- ============================================================
-- Phase C of plans/260524-1020-doc-agent-empty-states-full/.
-- Stores documentation content shown in two distinct dashboard pages:
--   /dashboard/docs-admin   (scope='admin')   — visible to admins only
--   /dashboard/docs-clientes (scope='clientes') — visible to any authenticated user
-- Maintained by the help-docs-keeper agent (writes via service_role).

CREATE TABLE IF NOT EXISTS public.help_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('admin', 'clientes')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  route_in_app TEXT,
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'completada')),
  brief TEXT,
  content_markdown TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  fields_table JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  common_cases JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (scope, slug)
);

CREATE INDEX IF NOT EXISTS idx_help_sections_scope ON public.help_sections (scope, display_order);
CREATE INDEX IF NOT EXISTS idx_help_sections_status ON public.help_sections (status);
CREATE INDEX IF NOT EXISTS idx_help_sections_route ON public.help_sections (route_in_app);

DROP TRIGGER IF EXISTS trg_help_sections_updated_at ON public.help_sections;
CREATE TRIGGER trg_help_sections_updated_at
  BEFORE UPDATE ON public.help_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- RLS — multi-tenant not applicable (help is global), but we gate reads
-- by audience: anyone authenticated can read 'clientes'; only admins can
-- read 'admin' (admins identified by app_metadata.is_admin = true).
-- ----------------------------------------------------------------
ALTER TABLE public.help_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS help_sections_select_clientes ON public.help_sections;
CREATE POLICY help_sections_select_clientes ON public.help_sections
  FOR SELECT TO authenticated
  USING (scope = 'clientes');

DROP POLICY IF EXISTS help_sections_select_admin ON public.help_sections;
CREATE POLICY help_sections_select_admin ON public.help_sections
  FOR SELECT TO authenticated
  USING (
    scope = 'admin'
    AND COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
      (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean,
      false
    ) = true
  );

-- Writes left to service_role only (bypass RLS).
COMMENT ON TABLE public.help_sections IS
  'Content for /dashboard/docs-admin and /dashboard/docs-clientes. Maintained by help-docs-keeper agent.';

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
