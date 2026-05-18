-- SCRIPT DE REPARACIÓN DE VINCULACIÓN (ESDEN DASHBOARD)
-- Ejecutado exitosamente el 2026-05-11
BEGIN;

CREATE TABLE IF NOT EXISTS public.llamadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID REFERENCES public.lead(id) ON DELETE CASCADE,
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
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agendamientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    fecha_agendada_cliente TIMESTAMPTZ,
    fecha_agendada_lead TIMESTAMPTZ,
    confirmado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_cualificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada UUID REFERENCES public.llamadas(id) ON DELETE SET NULL,
    motivo_anulacion TEXT,
    cualificacion TEXT,
    calificacion_score INTEGER,
    objeciones TEXT,
    analisis_profundo JSONB DEFAULT '{}'::jsonb,
    anios_experiencia INTEGER,
    nivel_estudios TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.lead(id) ON DELETE CASCADE UNIQUE,
    summary TEXT,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='lead' AND COLUMN_NAME='id_lead_externo') THEN
        ALTER TABLE public.lead ADD COLUMN id_lead_externo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='lead' AND COLUMN_NAME='tipo_lead') THEN
        ALTER TABLE public.lead ADD COLUMN tipo_lead TEXT;
    END IF;
END $$;

ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_cualificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_llamadas" ON public.llamadas;
DROP POLICY IF EXISTS "service_role_all_agendamientos" ON public.agendamientos;
DROP POLICY IF EXISTS "service_role_all_cualificacion" ON public.lead_cualificacion;
DROP POLICY IF EXISTS "service_role_all_summaries" ON public.chat_summaries;

CREATE POLICY "service_role_all_llamadas" ON public.llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_agendamientos" ON public.agendamientos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_cualificacion" ON public.lead_cualificacion FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_summaries" ON public.chat_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
