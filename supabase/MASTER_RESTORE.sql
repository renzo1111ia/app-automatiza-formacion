-- SCRIPT MAESTRO DE RESTAURACIÓN TOTAL
-- 1. CREACIÓN DE ESQUEMA (TABLAS)
-- 2. INYECCIÓN DE DATOS RECUPERADOS

BEGIN;

-- ==========================================
-- 1. CREACIÓN DE TABLAS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    supabase_url TEXT,
    supabase_anon_key TEXT,
    client_email TEXT,
    auth_user_id UUID,
    config JSONB DEFAULT '{}'::jsonb,
    daily_spend_limit DECIMAL(10,2) DEFAULT 100.00,
    current_daily_spend DECIMAL(10,2) DEFAULT 0.00,
    last_spend_reset_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    origins TEXT[] DEFAULT '{}',
    campaigns TEXT[] DEFAULT '{}',
    countries TEXT[] DEFAULT '{}',
    courses TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'PAUSED',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    flow_config JSONB DEFAULT '{}'::jsonb,
    automation_rules JSONB DEFAULT '{}'::jsonb,
    crm_config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ai_agent_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    version_label TEXT,
    prompt_text TEXT,
    is_active BOOLEAN DEFAULT false,
    is_variant_b BOOLEAN DEFAULT false,
    weight DECIMAL(3,2) DEFAULT 0.5,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    knowledge_base_id UUID,
    api_key TEXT,
    model_provider TEXT,
    model_name TEXT,
    dynamic_variables JSONB DEFAULT '{}'::jsonb,
    tracked_variables JSONB DEFAULT '[]'::jsonb,
    knowledge_base_ids UUID[] DEFAULT '{}',
    automation_rules JSONB DEFAULT '{}'::jsonb,
    crm_config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.voice_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    provider TEXT,
    provider_agent_id TEXT,
    voice_id TEXT,
    from_number TEXT,
    retell_llm_id TEXT,
    prompt_text_retell TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    retell_llm_config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lead (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    nombre TEXT,
    apellido TEXT,
    telefono TEXT,
    pais TEXT,
    origen TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    is_ai_enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orchestration_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    graph_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.programas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT,
    file_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.web_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    welcome_message TEXT,
    required_variables JSONB,
    bubble_color TEXT,
    bubble_icon TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tablas de Logs
CREATE TABLE IF NOT EXISTS public.system_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID, level TEXT, message TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ai_agent_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID, agent_id UUID, lead_id UUID, message TEXT, type TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lead_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID, event_type TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now());

-- ==========================================
-- 2. INSERCIÓN DE DATOS (RESCATADOS)
-- ==========================================

-- Tenants
INSERT INTO public.tenants (id, name, client_email, config) VALUES
('f9782efc-1938-4f79-8df6-7d849d701c52', 'demo admin', 'admin1@gmail.com', '{"is_admin": true}'),
('47e84fa2-73f3-4e23-9267-1e49d4442f70', 'CLIENTE 1', 'usuario2@gmail.com', '{"username": "esden", "whatsapp": {"wabaId": "1269604455298809"}}')
ON CONFLICT (id) DO NOTHING;

-- AI Agents
INSERT INTO public.ai_agents (id, tenant_id, name, type) VALUES
('2fdee4d8-4024-44e5-9c12-69ad8cc3fdc8', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'agente principal', 'QUALIFY')
ON CONFLICT (id) DO NOTHING;

-- Virginia Prompt (Variant)
INSERT INTO public.ai_agent_variants (id, agent_id, tenant_id, prompt_text, is_active, model_name, metrics, dynamic_variables, tracked_variables, automation_rules, crm_config) VALUES
('d046ccac-d1ea-4d13-a8a6-170c910b1fdf', '2fdee4d8-4024-44e5-9c12-69ad8cc3fdc8', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'PROMPT VIRGINIA - EDITAR MANUALMENTE', true, 'gpt-4.1-mini', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Voice Agents
INSERT INTO public.voice_agents (id, tenant_id, name, status, provider, provider_agent_id, voice_id, retell_llm_id, prompt_text_retell, retell_llm_config) VALUES
('93713c59-208b-45f2-a977-b73fe43dffca', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'Clinica Revitalis', 'ACTIVE', 'RETELL', 'agent_0404137219f8d18be5c97d585b', 'custom_voice_70a92192d492aff6546689b2ce', 'llm_7697236d06ac713b36e5e9259dc4', 'PROMPT MARIA - EDITAR MANUALMENTE', '{"model": "gpt-4.1-mini", "version": 26}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Leads
INSERT INTO public.lead (id, tenant_id, nombre, telefono, pais, metadata) VALUES
('6a02c14c-c5db-47fb-8857-99a28d3ee6ec', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'Bea', '34717771303', 'Spain', '{"USER_NAME": "Beatriz"}'::jsonb),
('adcf5c82-43af-4906-8d9a-94b8487fe937', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'renzo', '59177349252', 'Bolivia', '{"USER_NAME": "Renzo"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;
