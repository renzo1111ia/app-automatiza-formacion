-- Migration: Add web_widgets table
CREATE TABLE IF NOT EXISTS public.web_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    welcome_message TEXT,
    required_variables TEXT[] DEFAULT '{}',
    bubble_color TEXT DEFAULT '#25D366', -- WhatsApp Green
    bubble_icon TEXT DEFAULT 'message-circle',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.web_widgets ENABLE ROW LEVEL SECURITY;

-- Add policies (assuming tenant-based isolation)
CREATE POLICY "Users can view their own tenant's widgets" ON public.web_widgets
    FOR SELECT USING (tenant_id IN (SELECT id FROM tenants));

CREATE POLICY "Users can insert their own tenant's widgets" ON public.web_widgets
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants));

CREATE POLICY "Users can update their own tenant's widgets" ON public.web_widgets
    FOR UPDATE USING (tenant_id IN (SELECT id FROM tenants));

CREATE POLICY "Users can delete their own tenant's widgets" ON public.web_widgets
    FOR DELETE USING (tenant_id IN (SELECT id FROM tenants));
