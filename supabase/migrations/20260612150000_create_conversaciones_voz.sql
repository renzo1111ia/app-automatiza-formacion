-- ============================================================
-- Migración: Crear conversaciones_voz + hardening
-- ============================================================

-- 1. Crear tabla conversaciones_voz (clon de conversaciones_whatsapp)
CREATE TABLE IF NOT EXISTS public.conversaciones_voz (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada_externa TEXT,
    estado TEXT DEFAULT 'ACTIVA',
    fecha_ultimo_mensaje TIMESTAMPTZ DEFAULT now(),
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_conversaciones_voz_lead UNIQUE (id_lead)
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.conversaciones_voz ENABLE ROW LEVEL SECURITY;

-- 3. Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_conv_voz_tenant ON public.conversaciones_voz(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_voz_lead ON public.conversaciones_voz(id_lead);

-- 4. Crear políticas RLS seguras
-- Acceso completo para service_role (backend)
DROP POLICY IF EXISTS "service_role_all_conversaciones_voz" ON public.conversaciones_voz;
CREATE POLICY "service_role_all_conversaciones_voz" ON public.conversaciones_voz 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Acceso de lectura para usuarios autenticados con aislamiento de tenant (RLS-001)
DROP POLICY IF EXISTS "authenticated_read_conversaciones_voz" ON public.conversaciones_voz;
CREATE POLICY "authenticated_read_conversaciones_voz" ON public.conversaciones_voz 
    FOR SELECT TO authenticated 
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));

-- 5. Agregar UNIQUE constraint a la tabla llamadas para evitar duplicados por reintentos (WEBHOOK-001)
ALTER TABLE public.llamadas ADD CONSTRAINT unique_id_llamada_retell_tenant UNIQUE (id_llamada_retell, tenant_id);

-- 6. Backfill inicial a partir de las llamadas existentes (tomando la última llamada por cada lead)
INSERT INTO public.conversaciones_voz (tenant_id, id_lead, id_llamada_externa, fecha_ultimo_mensaje, fecha_creacion)
SELECT DISTINCT ON (id_lead) 
    tenant_id, 
    id_lead, 
    id_llamada_retell, 
    fecha_inicio, 
    fecha_creacion
FROM public.llamadas
ORDER BY id_lead, fecha_inicio DESC
ON CONFLICT (id_lead) DO NOTHING;
