-- Evolution to Orchestrator v2.0
-- Adds memory to leads and advanced routing configuration

-- 1. Update lead table with memory fields
ALTER TABLE public.lead 
ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'QUALIFICATION',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_ai_paused BOOLEAN DEFAULT false;

-- 2. Create client_configs table for advanced routing & rules
CREATE TABLE IF NOT EXISTS public.client_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    routing_rules JSONB DEFAULT '{
        "allowed_campaigns": [],
        "allowed_origins": [],
        "drop_invalid_leads": true,
        "contact_sequence": ["whatsapp", "call"]
    }',
    rescue_config JSONB DEFAULT '{
        "enabled": true,
        "wait_minutes": 30,
        "template_id": "rescue_01"
    }',
    timezone_config JSONB DEFAULT '{
        "default_timezone": "UTC",
        "compliance_start": "09:00",
        "compliance_end": "21:00"
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_config UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.client_configs ENABLE ROW LEVEL SECURITY;

-- Policy for service_role
CREATE POLICY "service_role_all_client_configs"
    ON public.client_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_client_configs_tenant ON public.client_configs(tenant_id);
