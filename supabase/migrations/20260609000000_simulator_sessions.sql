-- Migration: simulator_sessions
-- Created at: 2026-06-09
-- Fix: RLS policies corrected — use public.tenants.auth_user_id instead of
--      non-existent public.users table (project-standard pattern, Sprint 1 ADR-017).

CREATE TABLE IF NOT EXISTS public.simulator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    session_name TEXT DEFAULT 'Sesión sin título',
    messages JSONB DEFAULT '[]'::jsonb,
    variables_captured JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas por tenant
CREATE INDEX IF NOT EXISTS idx_simulator_sessions_tenant
  ON public.simulator_sessions(tenant_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.simulator_sessions ENABLE ROW LEVEL SECURITY;

-- Drop policies idempotente
DROP POLICY IF EXISTS "simulator_sessions_select_policy" ON public.simulator_sessions;
DROP POLICY IF EXISTS "simulator_sessions_insert_policy" ON public.simulator_sessions;
DROP POLICY IF EXISTS "simulator_sessions_update_policy" ON public.simulator_sessions;
DROP POLICY IF EXISTS "simulator_sessions_delete_policy" ON public.simulator_sessions;
DROP POLICY IF EXISTS "service_role_all_simulator_sessions" ON public.simulator_sessions;

-- Políticas RLS estándar del proyecto (patrón owner_or_admin via tenants.auth_user_id)
CREATE POLICY "simulator_sessions_select_policy"
  ON public.simulator_sessions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "simulator_sessions_insert_policy"
  ON public.simulator_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "simulator_sessions_update_policy"
  ON public.simulator_sessions
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

CREATE POLICY "simulator_sessions_delete_policy"
  ON public.simulator_sessions
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

-- Service role bypass (para jobs/workers BullMQ que no tienen auth context)
CREATE POLICY "service_role_all_simulator_sessions"
  ON public.simulator_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.touch_simulator_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_simulator_sessions_updated_at ON public.simulator_sessions;
CREATE TRIGGER trg_simulator_sessions_updated_at
  BEFORE UPDATE ON public.simulator_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_simulator_sessions_updated_at();