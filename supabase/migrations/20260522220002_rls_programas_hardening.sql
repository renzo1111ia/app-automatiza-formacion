-- ============================================================================
-- Sprint 1 · Tarea 2-25 — RLS hardening programas (cursos del cliente)
-- ============================================================================
-- Finding F-04-008: getPrograms expone programas de todos los clientes a
-- authenticated. Origen: policy tautologica authenticated_read_programas.
--
-- Fix: tenant_id scope via tenants.auth_user_id, igual patron que knowledge_base.
-- service_role bypass mantiene operacion de webhooks.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_programas" ON public.programas;
DROP POLICY IF EXISTS "programas_tenant_isolation" ON public.programas;
DROP POLICY IF EXISTS "programas_select_owner_or_admin" ON public.programas;
DROP POLICY IF EXISTS "programas_insert_owner_or_admin" ON public.programas;
DROP POLICY IF EXISTS "programas_update_owner_or_admin" ON public.programas;
DROP POLICY IF EXISTS "programas_delete_owner_or_admin" ON public.programas;

CREATE POLICY "programas_select_owner_or_admin"
  ON public.programas
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "programas_insert_owner_or_admin"
  ON public.programas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "programas_update_owner_or_admin"
  ON public.programas
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

CREATE POLICY "programas_delete_owner_or_admin"
  ON public.programas
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );
