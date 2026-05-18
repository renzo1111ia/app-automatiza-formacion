-- ============================================================
-- ESDEN Analytics Dashboard — SCHEMA RESTORE SCRIPT
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Lead Table
CREATE TABLE IF NOT EXISTS public.lead (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead_externo TEXT, -- Removed UNIQUE for multi-tenant support (unique per tenant instead)
    nombre TEXT,
    apellido TEXT,
    telefono TEXT,
    email TEXT,
    pais TEXT,
    tipo_lead TEXT, -- "nuevo", "ilocalizable", "localizable"
    origen TEXT,
    campana TEXT,
    fecha_ingreso_crm TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, id_lead_externo)
);
CREATE INDEX IF NOT EXISTS idx_lead_tenant_id ON public.lead(tenant_id);

-- 3. Llamadas Table
CREATE TABLE IF NOT EXISTS public.llamadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada_retell TEXT,
    tipo_agente TEXT,
    nombre_agente TEXT,
    estado_llamada TEXT,
    razon_termino TEXT,
    fecha_inicio TIMESTAMPTZ,
    duracion_segundos INTEGER,
    url_grabacion TEXT,
    transcripcion TEXT,
    resumen TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llamadas_tenant_id ON public.llamadas(tenant_id);

-- 4. Intentos Llamadas Table
CREATE TABLE IF NOT EXISTS public.intentos_llamadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada UUID REFERENCES public.llamadas(id) ON DELETE SET NULL,
    tipo_intento TEXT, -- "LLAMADA", "WHATSAPP"
    numero_intento INTEGER,
    fecha_reintento TIMESTAMPTZ,
    estado TEXT,
    fecha_ejecucion TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intentos_llamadas_tenant_id ON public.intentos_llamadas(tenant_id);

-- 5. Conversaciones Whatsapp Table
CREATE TABLE IF NOT EXISTS public.conversaciones_whatsapp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_conversacion_chatwoot TEXT,
    opt_in_whatsapp BOOLEAN DEFAULT false,
    estado TEXT,
    fecha_ultimo_mensaje TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_wa_tenant_id ON public.conversaciones_whatsapp(tenant_id);

-- 6. Agendamientos Table
CREATE TABLE IF NOT EXISTS public.agendamientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    fecha_agendada_cliente TIMESTAMPTZ,
    fecha_agendada_lead TIMESTAMPTZ,
    confirmado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agendamientos_tenant_id ON public.agendamientos(tenant_id);

-- 7. Lead Cualificacion Table
CREATE TABLE IF NOT EXISTS public.lead_cualificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada UUID REFERENCES public.llamadas(id) ON DELETE SET NULL,
    motivo_anulacion TEXT,
    cualificacion TEXT, -- "CUALIFICADO", "NO_CUALIFICADO", "NO"
    anios_experiencia INTEGER,
    nivel_estudios TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_cualif_tenant_id ON public.lead_cualificacion(tenant_id);

-- 8. Programas Table
CREATE TABLE IF NOT EXISTS public.programas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    nombre TEXT NOT NULL,
    id_producto TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programas_tenant_id ON public.programas(tenant_id);

-- 9. Lead Programas Table
CREATE TABLE IF NOT EXISTS public.lead_programas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_programa UUID NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_progs_tenant_id ON public.lead_programas(tenant_id);

-- 10. Notificaciones Table
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    tipo TEXT,
    fecha_envio TIMESTAMPTZ,
    metadatos JSONB,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_tenant_id ON public.notificaciones(tenant_id);

-- 11. Workflows Table (Orchestrator Parent)
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- The default entry point workflow
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON public.workflows(tenant_id);

-- 12. Orchestration Rules Table (Execution Engine)
CREATE TABLE IF NOT EXISTS public.orchestration_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- "CALL", "WHATSAPP", "WAIT", "SUB_WORKFLOW"
    sequence_order INTEGER NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orch_rules_workflow_id ON public.orchestration_rules(workflow_id);

-- 13. Orchestration Graphs Table (UI Persistence)
CREATE TABLE IF NOT EXISTS public.orchestration_graphs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    graph_data JSONB NOT NULL, -- Full XYFlow State (Nodes, Edges, Viewport)
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workflow_id)
);
CREATE INDEX IF NOT EXISTS idx_orch_graphs_workflow_id ON public.orchestration_graphs(workflow_id);

-- 14. Feature Flags Table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL means global
    flag_key TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, flag_key)
);

-- RLS POLICY ENFORCEMENT
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('lead', 'llamadas', 'intentos_llamadas', 'conversaciones_whatsapp', 'agendamientos', 'lead_cualificacion', 'programas', 'lead_programas', 'notificaciones', 'orchestration_rules')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL TO authenticated USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid) WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)', t);
    END LOOP;

    -- Loop removed

    -- Add new tables to RLS loop (explicitly)
    FOR t IN SELECT UNNEST(ARRAY['workflows', 'orchestration_graphs']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL TO authenticated USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid) WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)', t);
    END LOOP;
END $$;
