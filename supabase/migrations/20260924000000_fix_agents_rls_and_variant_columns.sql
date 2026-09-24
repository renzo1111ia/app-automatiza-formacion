-- ============================================================================
-- fix: ensure service_role bypass policies exist for ai_agents and ai_agent_variants
-- and add tenant_id to ai_agent_variants for direct tenant isolation
-- ============================================================================

-- 1. Add tenant_id column to ai_agent_variants if missing
ALTER TABLE public.ai_agent_variants
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Backfill tenant_id from parent ai_agents table (for existing rows)
UPDATE public.ai_agent_variants av
SET tenant_id = ag.tenant_id
FROM public.ai_agents ag
WHERE av.agent_id = ag.id
  AND av.tenant_id IS NULL;

-- 3. Add knowledge_base_ids JSONB column (for multi-kb support)
ALTER TABLE public.ai_agent_variants
ADD COLUMN IF NOT EXISTS knowledge_base_ids JSONB DEFAULT '[]'::jsonb;

-- 4. Add tracked_variables and crm_config columns if missing
ALTER TABLE public.ai_agent_variants
ADD COLUMN IF NOT EXISTS tracked_variables JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.ai_agent_variants
ADD COLUMN IF NOT EXISTS crm_config JSONB DEFAULT '{}'::jsonb;
-- Note: scheduling_config is stored INSIDE automation_rules JSONB, not as its own column.


DROP POLICY IF EXISTS "service_role_all_ai_agents" ON public.ai_agents;
DROP POLICY IF EXISTS "service_role_all_ai_agent_variants" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "Tenants can only see their own agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Tenants can only see their own agent variants" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agents_select_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_insert_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_update_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_delete_owner_or_admin" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agent_variants_select_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_insert_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_update_owner_or_admin" ON public.ai_agent_variants;
DROP POLICY IF EXISTS "ai_agent_variants_delete_owner_or_admin" ON public.ai_agent_variants;

-- 6. Service role bypass (for server-side admin operations)
CREATE POLICY "service_role_all_ai_agents"
  ON public.ai_agents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_ai_agent_variants"
  ON public.ai_agent_variants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Authenticated tenant isolation policies for ai_agents
CREATE POLICY "ai_agents_select_owner_or_admin"
  ON public.ai_agents FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agents_insert_owner_or_admin"
  ON public.ai_agents FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agents_update_owner_or_admin"
  ON public.ai_agents FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agents_delete_owner_or_admin"
  ON public.ai_agents FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

-- 8. Authenticated tenant isolation for ai_agent_variants (now with direct tenant_id)
CREATE POLICY "ai_agent_variants_select_owner_or_admin"
  ON public.ai_agent_variants FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agent_variants_insert_owner_or_admin"
  ON public.ai_agent_variants FOR INSERT TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "ai_agent_variants_update_owner_or_admin"
  ON public.ai_agent_variants FOR UPDATE TO authenticated
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
  ON public.ai_agent_variants FOR DELETE TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

-- 9. Reload schema cache
NOTIFY pgrst, 'reload schema';
