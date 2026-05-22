-- ============================================================================
-- Sprint 0 tarea 1-19: RLS hardening tabla `public.knowledge_base`
-- ============================================================================
--
-- Finding F-04-004 / DA-2:
--   Una migration legacy (`supabase/migrations-historical/20260424000000_knowledge_and_billing.sql`)
--   define la policy:
--
--     CREATE POLICY ... USING (tenant_id::text = current_setting('app.current_tenant', true));
--
--   El backend NUNCA ejecuta `SET app.current_tenant`, por lo que la policy
--   evalúa siempre NULL → bloquea TODO para `authenticated` (silencioso) y
--   `service_role` la bypassa. Dead letter — protección RLS inefectiva.
--
--   Adicionalmente, la migration vigente (base_schema.sql) creó un loop que
--   añade `authenticated_read_knowledge_base USING (true)` → cross-tenant leak
--   total para authenticated.
--
-- AHORA:
--   - DROP de cualquier policy legacy sobre `knowledge_base`.
--   - SELECT: el caller debe ser dueño del tenant (vía `tenants.auth_user_id`)
--     o admin (`app_metadata.is_admin`).
--   - INSERT/UPDATE/DELETE: idéntico — solo dueño del tenant o admin.
--   - `service_role` mantiene el bypass para jobs internos y webhooks.
--
-- Idempotente. Aplica en local YA; VPS diferido a pre-deploy.
-- ============================================================================

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Limpia policies legacy (nombres conocidos del histórico + auto-generadas)
DROP POLICY IF EXISTS "knowledge_base_tenant_isolation" ON public.knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_select" ON public.knowledge_base;
DROP POLICY IF EXISTS "kb_tenant" ON public.knowledge_base;
DROP POLICY IF EXISTS "authenticated_read_knowledge_base" ON public.knowledge_base;
-- service_role_all_knowledge_base se MANTIENE (creado en base_schema.sql loop) —
-- es necesario para que el backend (BullMQ workers, webhooks) opere.

-- Drop policies de esta migration por si se re-corre
DROP POLICY IF EXISTS "kb_select_owner_or_admin" ON public.knowledge_base;
DROP POLICY IF EXISTS "kb_insert_owner_or_admin" ON public.knowledge_base;
DROP POLICY IF EXISTS "kb_update_owner_or_admin" ON public.knowledge_base;
DROP POLICY IF EXISTS "kb_delete_owner_or_admin" ON public.knowledge_base;

CREATE POLICY "kb_select_owner_or_admin"
  ON public.knowledge_base
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "kb_insert_owner_or_admin"
  ON public.knowledge_base
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "kb_update_owner_or_admin"
  ON public.knowledge_base
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

CREATE POLICY "kb_delete_owner_or_admin"
  ON public.knowledge_base
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );
