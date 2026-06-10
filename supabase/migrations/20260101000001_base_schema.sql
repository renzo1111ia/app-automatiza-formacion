-- ============================================================
-- Base schema consolidado para dev local
--
-- Combina MASTER_RESTORE.sql (16 tablas) + tablas faltantes
-- (llamadas, lead_cualificacion, conversaciones_whatsapp,
-- chat_messages, intentos*, notificaciones, lead_programas,
-- campanas) extraidas de migrations-historical/.
--
-- Sustituye al pg_dump --schema-only del cliente hasta que
-- tengamos acceso a Easypanel.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ADVISORS
-- ============================================================
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
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AI AGENTS + VARIANTS
-- ============================================================
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
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_agent_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    version_label TEXT,
    prompt_text TEXT,
    is_active BOOLEAN DEFAULT false,
    is_variant_b BOOLEAN DEFAULT false,
    weight DECIMAL(3,2) DEFAULT 0.5,
    metrics JSONB DEFAULT '{}'::jsonb,
    api_key TEXT,
    model_provider TEXT,
    model_name TEXT,
    knowledge_base_id UUID,
    knowledge_base_ids UUID[] DEFAULT '{}',
    dynamic_variables JSONB DEFAULT '{}'::jsonb,
    tracked_variables JSONB DEFAULT '[]'::jsonb,
    automation_rules JSONB DEFAULT '{}'::jsonb,
    crm_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_agent_variants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VOICE AGENTS
-- ============================================================
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
    retell_llm_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- LEAD (combina MASTER_RESTORE + columnas de migraciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead_externo TEXT,
    nombre TEXT,
    apellido TEXT,
    telefono TEXT,
    email TEXT,
    pais TEXT,
    tipo_lead TEXT,
    origen TEXT,
    campana TEXT,
    status TEXT DEFAULT 'PENDING',
    is_ai_enabled BOOLEAN DEFAULT true,
    photo_url TEXT,
    segmentation TEXT,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    fecha_ingreso_crm TIMESTAMPTZ,
    fecha_primer_contacto TIMESTAMPTZ DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT now(),
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lead_tenant ON public.lead(tenant_id);

-- ============================================================
-- LLAMADAS
-- ============================================================
-- llamadas (columnas segun src/lib/constants/schema.ts)
CREATE TABLE IF NOT EXISTS public.llamadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada_retell TEXT,
    tipo_agente TEXT,
    nombre_agente TEXT,
    estado_llamada TEXT,
    razon_termino TEXT,
    fecha_inicio TIMESTAMPTZ DEFAULT now(),
    duracion_segundos INTEGER,
    url_grabacion TEXT,
    transcripcion TEXT,
    resumen TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_llamadas_tenant ON public.llamadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llamadas_lead ON public.llamadas(id_lead);

-- ============================================================
-- LEAD CUALIFICACION
-- ============================================================
-- lead_cualificacion (columnas segun src/lib/constants/schema.ts)
CREATE TABLE IF NOT EXISTS public.lead_cualificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada UUID,
    cualificacion TEXT,
    motivo_anulacion TEXT,
    anios_experiencia INTEGER,
    nivel_estudios TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lead_cualificacion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lead_cual_tenant ON public.lead_cualificacion(tenant_id);

-- ============================================================
-- CONVERSACIONES WHATSAPP
-- ============================================================
-- conversaciones_whatsapp (columnas segun schema.ts)
CREATE TABLE IF NOT EXISTS public.conversaciones_whatsapp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_conversacion_chatwoot TEXT,
    opt_in_whatsapp BOOLEAN DEFAULT false,
    estado TEXT DEFAULT 'ACTIVA',
    fecha_ultimo_mensaje TIMESTAMPTZ DEFAULT now(),
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conversaciones_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conv_whatsapp_tenant ON public.conversaciones_whatsapp(tenant_id);

-- ============================================================
-- CHAT MESSAGES (whatsapp inbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    lead_id UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'TEMPLATE', 'SYSTEM_LOG', 'IMAGE', 'DOCUMENT')),
    content TEXT NOT NULL,
    sent_by TEXT,
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'READ', 'FAILED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chat_messages_lead ON public.chat_messages(lead_id);

-- ============================================================
-- INTENTOS DE LLAMADAS / INTENTOS
-- ============================================================
-- intentos_llamadas (columnas segun schema.ts)
CREATE TABLE IF NOT EXISTS public.intentos_llamadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada UUID,
    tipo_intento TEXT,
    numero_intento INTEGER DEFAULT 1,
    fecha_reintento TIMESTAMPTZ,
    estado TEXT,
    fecha_ejecucion TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.intentos_llamadas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.intentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    tipo TEXT,
    canal TEXT,
    resultado TEXT,
    fecha TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.intentos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    tipo TEXT,
    titulo TEXT,
    mensaje TEXT,
    leida BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROGRAMAS + LEAD_PROGRAMAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    precio DECIMAL(10,2),
    duracion_meses INTEGER,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_programas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_programa UUID NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
    estado TEXT DEFAULT 'INTERESADO',
    fecha_inscripcion TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE (id_lead, id_programa)
);
ALTER TABLE public.lead_programas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAMPANAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    fecha_inicio TIMESTAMPTZ DEFAULT now(),
    fecha_fin TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- APPOINTMENTS + AVAILABILITY SLOTS
-- ============================================================
-- agendamientos (columnas segun schema.ts)
CREATE TABLE IF NOT EXISTS public.agendamientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,
    fecha_agendada_cliente TIMESTAMPTZ,
    fecha_agendada_lead TIMESTAMPTZ,
    confirmado BOOLEAN DEFAULT false,
    meeting_link TEXT,
    notas TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.agendamientos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agendamientos_tenant ON public.agendamientos(tenant_id);

-- appointments mantenido como alias para compatibilidad
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'SCHEDULED',
    meeting_link TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id);

CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN DEFAULT false
);
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WORKFLOWS + ORCHESTRATION
-- ============================================================
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
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orchestration_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    graph_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orchestration_graphs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT,
    file_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WEB WIDGETS
-- ============================================================
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
ALTER TABLE public.web_widgets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- LOG TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    level TEXT,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    agent_id UUID,
    lead_id UUID,
    message TEXT,
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID,
    event_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLITICAS RLS
-- service_role: acceso total (backend de confianza).
-- authenticated: SELECT con AISLAMIENTO POR TENANT (BUG-SEC RLS-001, 10-06-2026).
--
-- ANTES (bug): `authenticated_read_* USING (true)` permitia a cualquier usuario
-- authenticated leer filas de CUALQUIER tenant via anon key (IDOR multi-tenant).
-- AHORA: cada tabla filtra por su relacion al tenant del usuario logueado.
-- Patron: tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()).
-- ============================================================

-- service_role_all_* para TODAS las tablas (sin cambio).
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN (
            'tenants', 'advisors', 'ai_agents', 'ai_agent_variants',
            'voice_agents', 'lead', 'llamadas', 'lead_cualificacion',
            'conversaciones_whatsapp', 'chat_messages', 'intentos_llamadas',
            'intentos', 'notificaciones', 'programas', 'lead_programas',
            'campanas', 'agendamientos', 'appointments', 'availability_slots', 'workflows',
            'orchestration_graphs', 'knowledge_base', 'web_widgets',
            'system_logs', 'ai_agent_logs', 'lead_events'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "service_role_all_%I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
        -- Limpiar cualquier authenticated_read previa (incluida la version OPEN bugueada).
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON public.%I', tbl, tbl);
    END LOOP;
END $$;

-- authenticated_read_* FILTRADO POR TENANT, por grupo segun como se relaciona cada tabla:

-- (a) Tablas con tenant_id UUID directo.
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'advisors','ai_agent_logs','agendamientos','appointments','campanas',
        'conversaciones_whatsapp','intentos','intentos_llamadas','lead','lead_cualificacion',
        'lead_programas','llamadas','notificaciones','orchestration_graphs','system_logs',
        'voice_agents','workflows'
    ]) LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
            EXECUTE format(
              'CREATE POLICY "authenticated_read_%I" ON public.%I FOR SELECT TO authenticated '
              'USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()))', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- (b) chat_messages: tenant_id es TEXT → cast id::text.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='chat_messages') THEN
        CREATE POLICY "authenticated_read_chat_messages" ON public.chat_messages FOR SELECT TO authenticated
          USING (tenant_id IN (SELECT id::text FROM public.tenants WHERE auth_user_id = auth.uid()));
    END IF;
END $$;

-- (c) availability_slots: sin tenant_id → via advisor_id.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='availability_slots') THEN
        CREATE POLICY "authenticated_read_availability_slots" ON public.availability_slots FOR SELECT TO authenticated
          USING (advisor_id IN (SELECT a.id FROM public.advisors a
                 WHERE a.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())));
    END IF;
END $$;

-- (d) lead_events: sin tenant_id → via lead_id.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='lead_events') THEN
        CREATE POLICY "authenticated_read_lead_events" ON public.lead_events FOR SELECT TO authenticated
          USING (lead_id IN (SELECT l.id FROM public.lead l
                 WHERE l.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())));
    END IF;
END $$;

-- (e) tenants: el usuario solo ve SU propia fila (auth_user_id = auth.uid()) o admin.
--     NO se crea authenticated_read_tenants OPEN (era el leak de anon_key/email cross-tenant).
--     El acceso legitimo a la fila propia lo da tenants_select_owner_or_admin (definida en migracion de tenants).
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tenants') THEN
        CREATE POLICY "authenticated_read_tenants" ON public.tenants FOR SELECT TO authenticated
          USING (auth_user_id = auth.uid()
                 OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'is_admin'), 'false') = 'true');
    END IF;
END $$;

-- NOTA: programas, ai_agents, ai_agent_variants, knowledge_base, web_widgets ya definen
-- sus propias politicas *_owner_or_admin (filtradas) en sus migraciones — no se tocan aqui.
