-- Create Planned Actions Table for Advanced Scheduling
CREATE TABLE IF NOT EXISTS public.planned_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- FK to tenants (metadata/integrations)
    lead_id UUID NOT NULL,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'WHATSAPP', 'CALL', 'API_CALL'
    config JSONB DEFAULT '{}', -- { template: '...', variables: {...} }
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'EXECUTED', 'FAILED'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for the SWEEP function performance
CREATE INDEX IF NOT EXISTS idx_planned_actions_scheduled_for ON public.planned_actions (scheduled_for) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_planned_actions_tenant_id ON public.planned_actions (tenant_id);
