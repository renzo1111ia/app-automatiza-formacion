-- ============================================================================
-- Sprint 5.5 — Persistencia de Flow Builder y Estados de Espera
-- ============================================================================

-- 1. Tabla Principal de Flujos
CREATE TABLE IF NOT EXISTS public.agent_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL UNIQUE REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Nodos del Grafo (React Flow)
CREATE TABLE IF NOT EXISTS public.flow_nodes (
    flow_id UUID NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    position JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (flow_id, node_id)
);

-- 3. Tabla de Conexiones/Aristas del Grafo (React Flow)
CREATE TABLE IF NOT EXISTS public.flow_edges (
    flow_id UUID NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    PRIMARY KEY (flow_id, edge_id)
);

-- 4. Tabla de Estados de Espera (Red Team)
CREATE TABLE IF NOT EXISTS public.flow_wait_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
    current_node_id TEXT NOT NULL,
    scheduled_resume_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (lead_id, flow_id)
);

-- Habilitar RLS en todas las nuevas tablas
ALTER TABLE public.agent_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_wait_states ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS (Aislamiento por Tenant para Rol Authenticated y Admin)
-- ============================================================================

-- Políticas para agent_flows
CREATE POLICY "agent_flows_select_owner_or_admin" ON public.agent_flows
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

CREATE POLICY "agent_flows_insert_owner_or_admin" ON public.agent_flows
    FOR INSERT TO authenticated
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND agent_id IN (SELECT id FROM public.ai_agents WHERE tenant_id = agent_flows.tenant_id)
    );

CREATE POLICY "agent_flows_update_owner_or_admin" ON public.agent_flows
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND agent_id IN (SELECT id FROM public.ai_agents WHERE tenant_id = agent_flows.tenant_id)
    );

CREATE POLICY "agent_flows_delete_owner_or_admin" ON public.agent_flows
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

-- Políticas para flow_nodes
CREATE POLICY "flow_nodes_select_owner_or_admin" ON public.flow_nodes
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

CREATE POLICY "flow_nodes_insert_owner_or_admin" ON public.flow_nodes
    FOR INSERT TO authenticated
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_nodes.tenant_id)
    );

CREATE POLICY "flow_nodes_update_owner_or_admin" ON public.flow_nodes
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_nodes.tenant_id)
    );

CREATE POLICY "flow_nodes_delete_owner_or_admin" ON public.flow_nodes
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

-- Políticas para flow_edges
CREATE POLICY "flow_edges_select_owner_or_admin" ON public.flow_edges
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

CREATE POLICY "flow_edges_insert_owner_or_admin" ON public.flow_edges
    FOR INSERT TO authenticated
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_edges.tenant_id)
    );

CREATE POLICY "flow_edges_update_owner_or_admin" ON public.flow_edges
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_edges.tenant_id)
    );

CREATE POLICY "flow_edges_delete_owner_or_admin" ON public.flow_edges
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

-- Políticas para flow_wait_states
CREATE POLICY "flow_wait_states_select_owner_or_admin" ON public.flow_wait_states
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

CREATE POLICY "flow_wait_states_insert_owner_or_admin" ON public.flow_wait_states
    FOR INSERT TO authenticated
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND lead_id IN (SELECT id FROM public.lead WHERE tenant_id = flow_wait_states.tenant_id)
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_wait_states.tenant_id)
    );

CREATE POLICY "flow_wait_states_update_owner_or_admin" ON public.flow_wait_states
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
    WITH CHECK (
        (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
         OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true')
        AND lead_id IN (SELECT id FROM public.lead WHERE tenant_id = flow_wait_states.tenant_id)
        AND flow_id IN (SELECT id FROM public.agent_flows WHERE tenant_id = flow_wait_states.tenant_id)
    );

CREATE POLICY "flow_wait_states_delete_owner_or_admin" ON public.flow_wait_states
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
           OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true');

-- ============================================================================
-- ACCESO TOTAL PARA EL ROL SERVICE_ROLE (Bypass para Webhooks/Trabajos de Fondo)
-- ============================================================================
CREATE POLICY "service_role_all_agent_flows" ON public.agent_flows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_flow_nodes" ON public.flow_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_flow_edges" ON public.flow_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_flow_wait_states" ON public.flow_wait_states FOR ALL TO service_role USING (true) WITH CHECK (true);
