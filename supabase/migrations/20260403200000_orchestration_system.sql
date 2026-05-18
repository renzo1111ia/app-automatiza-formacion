-- SQL: Initial Orchestration Schema (v2.0)
-- Creates the necessary tables for the Builder-ready dashboard.

-- 1. Table for Workflows (Central Registry)
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table for Visual Graphs (ReactFlow State)
CREATE TABLE IF NOT EXISTS public.orchestration_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    graph_data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table for Execution Rules (Flattened Sequences)
CREATE TABLE IF NOT EXISTS public.orchestration_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON public.workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_graphs_workflow ON public.orchestration_graphs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_rules_workflow ON public.orchestration_rules(workflow_id);

-- Enforce RLS (Simplified for Dashboard UI usage)
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestration_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestration_rules ENABLE ROW LEVEL SECURITY;

-- Note: Admin client (Service Role) bypasses these, but we add basic isolation for safety.
CREATE POLICY "Tenant isolation for workflows" ON public.workflows FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);
CREATE POLICY "Tenant isolation for graphs" ON public.orchestration_graphs FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);
CREATE POLICY "Tenant isolation for rules" ON public.orchestration_rules FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);
