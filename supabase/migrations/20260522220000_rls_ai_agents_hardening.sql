-- ============================================================================
-- Sprint 1 · Tarea 2-23 — RLS hardening ai_agents + ai_agent_variants
-- ============================================================================
-- Finding F-04-005 / DA-2: la policy actual `authenticated_read_ai_agents`
-- USING (true) permite leer agents de cualquier tenant. ai_agent_variants
-- hereda la vulnerabilidad porque NO tiene tenant_id directo (se vincula
-- al tenant via ai_agents.tenant_id por agent_id).
--
-- Fix:
--   - ai_agents: SELECT/INSERT/UPDATE/DELETE solo si tenant_id pertenece al
--     auth.uid() actual (resuelto via tenants.auth_user_id) o admin.
--   - ai_agent_variants: misma logica via subquery (variant.agent_id IN
--     agents del tenant del caller).
-- service_role mantiene bypass para webhooks/jobs.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_ai_agents" ON public.ai_agents;
DROP POLICY IF EXISTS "authenticated_read_ai_agent_variants" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agents_tenant_isolation" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agent_variants_tenant_isolation" ON public.ai_agent_variants;

DROP POLICY IF EXISTS "ai_agents_select_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_insert_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_update_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_delete_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agent_variants_select_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_insert_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_update_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_delete_owner_or_admin" ON public.ai_agent_variants;

-- ai_agents
CREATE POLICY "ai_agents_select_owner_or_admin"
  ON public.ai_agents
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agents_insert_owner_or_admin"
  ON public.ai_agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agents_update_owner_or_admin"
  ON public.ai_agents
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

CREATE POLICY "ai_agents_delete_owner_or_admin"
  ON public.ai_agents
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

-- ai_agent_variants: tenant scope via agent_id -> ai_agents.tenant_id
CREATE POLICY "ai_agent_variants_select_owner_or_admin"
  ON public.ai_agent_variants
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agent_variants_insert_owner_or_admin"
  ON public.ai_agent_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agent_variants_update_owner_or_admin"
  ON public.ai_agent_variants
  FOR UPDATE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agent_variants_delete_owner_or_admin"
  ON public.ai_agent_variants
  FOR DELETE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );
