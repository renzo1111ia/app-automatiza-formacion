-- ============================================================
-- MIGRACIÓN: Multi-Tenant V2 — Añadir tenant_id a todas las tablas
-- Ejecutar en: SQL Editor del Supabase CENTRAL (el mismo donde están los tenants)
-- ============================================================

-- 1. LIMPIAR tenants: hacer supabase_url y supabase_anon_key opcionales
--    (ya no son necesarios en el modelo centralizado)
ALTER TABLE public.tenants
    ALTER COLUMN supabase_url DROP NOT NULL,
    ALTER COLUMN supabase_anon_key DROP NOT NULL;

-- 2. AÑADIR tenant_id A TODAS LAS TABLAS DE DATOS

ALTER TABLE public.lead
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.llamadas
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.agendamientos
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.lead_cualificacion
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.conversaciones_whatsapp
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.intentos_llamadas
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.intentos
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.notificaciones
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.programas
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.lead_programas
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.campanas
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 3. ÍNDICES DE RENDIMIENTO (crítico para 100+ clientes)
CREATE INDEX IF NOT EXISTS idx_lead_tenant            ON public.lead(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llamadas_tenant        ON public.llamadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agendamientos_tenant   ON public.agendamientos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_cual_tenant       ON public.lead_cualificacion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_whatsapp_tenant   ON public.conversaciones_whatsapp(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intentos_ll_tenant     ON public.intentos_llamadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intentos_tenant        ON public.intentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tenant  ON public.notificaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_programas_tenant       ON public.programas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_programas_tenant  ON public.lead_programas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campanas_tenant        ON public.campanas(tenant_id);

-- 4. HABILITAR RLS (Row Level Security) en todas las tablas
ALTER TABLE public.lead                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llamadas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamientos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_cualificacion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones_whatsapp  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_llamadas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_programas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanas                 ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICA RLS: el service_role siempre puede hacer todo
--    (Nuestro backend usa service_role key, así que tiene acceso completo)
--    Las políticas de usuario final las manejamos con filtros explícitos en el código.

CREATE POLICY "service_role_all_lead"
    ON public.lead FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_llamadas"
    ON public.llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_agendamientos"
    ON public.agendamientos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_lead_cualificacion"
    ON public.lead_cualificacion FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_conversaciones_whatsapp"
    ON public.conversaciones_whatsapp FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_intentos_llamadas"
    ON public.intentos_llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_intentos"
    ON public.intentos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_notificaciones"
    ON public.notificaciones FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_programas"
    ON public.programas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_lead_programas"
    ON public.lead_programas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_campanas"
    ON public.campanas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. VERIFICACIÓN FINAL: Comprueba que todo se aplicó correctamente
SELECT 
    table_name,
    CASE WHEN column_name = 'tenant_id' THEN '✅ tenant_id OK' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
ORDER BY table_name;
