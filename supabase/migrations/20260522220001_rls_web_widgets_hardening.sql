-- ============================================================================
-- Sprint 1 · Tarea 2-24 — RLS hardening web_widgets
-- ============================================================================
-- Finding F-04-006: web_widgets devuelve registros de todos los tenants
-- a usuarios authenticated.
--
-- Fix:
--   - DROP policy authenticated_read_web_widgets USING (true).
--   - CREATE policies owner_or_admin para SELECT/INSERT/UPDATE/DELETE.
--   - service_role mantiene bypass.
--
-- NOTA: la lectura PUBLICA del widget (chat embebido en sitio del cliente)
-- se hace vía endpoint `/widget/[id]` que usa el cliente Supabase server-side
-- (service_role), no via authenticated, por lo que NO se rompe esa via.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.web_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_web_widgets" ON public.web_widgets;
DROP POLICY IF EXISTS "web_widgets_tenant_isolation" ON public.web_widgets;
DROP POLICY IF EXISTS "web_widgets_select_owner_or_admin" ON public.web_widgets;
DROP POLICY IF EXISTS "web_widgets_insert_owner_or_admin" ON public.web_widgets;
DROP POLICY IF EXISTS "web_widgets_update_owner_or_admin" ON public.web_widgets;
DROP POLICY IF EXISTS "web_widgets_delete_owner_or_admin" ON public.web_widgets;

CREATE POLICY "web_widgets_select_owner_or_admin"
  ON public.web_widgets
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "web_widgets_insert_owner_or_admin"
  ON public.web_widgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "web_widgets_update_owner_or_admin"
  ON public.web_widgets
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

CREATE POLICY "web_widgets_delete_owner_or_admin"
  ON public.web_widgets
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );
