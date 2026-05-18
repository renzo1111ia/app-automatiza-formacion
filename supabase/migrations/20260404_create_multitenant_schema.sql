-- ============================================================
-- SCRIPT COMPLETO: Crear todas las tablas de datos en el Supabase Central
-- Con tenant_id, índices y RLS listos desde el principio.
-- Ejecutar en: SQL Editor del Supabase Central (donde está la tabla tenants)
-- ============================================================

-- 0. ACTUALIZAR tenants: hacer supabase_url y supabase_anon_key opcionales
--    (en el modelo centralizado ya no se necesitan por cliente)
ALTER TABLE public.tenants
    ALTER COLUMN supabase_url DROP NOT NULL,
    ALTER COLUMN supabase_anon_key DROP NOT NULL;

-- Habilitar uuid_generate_v4 si no está activo
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLA CENTRAL: lead
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead (
    id                      uuid        NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id               uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead_externo         text,
    nombre                  text,
    apellido                text,
    telefono                text,
    email                   text,
    pais                    text,
    tipo_lead               text,
    origen                  text,
    campana                 text,
    fecha_ingreso_crm       timestamp without time zone,
    fecha_primer_contacto   timestamp without time zone DEFAULT now(),
    fecha_actualizacion     timestamp without time zone DEFAULT now(),
    CONSTRAINT lead_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 2. TABLA: llamadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.llamadas (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead             uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada_retell   text,
    tipo_agente         text,
    nombre_agente       text,
    estado_llamada      text,
    razon_termino       text,
    fecha_inicio        timestamp without time zone,
    duracion_segundos   integer,
    url_grabacion       text,
    transcripcion       text,
    resumen             text,
    fecha_creacion      timestamp without time zone DEFAULT now(),
    CONSTRAINT llamadas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 3. TABLA: agendamientos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agendamientos (
    id                      uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id               uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead                 uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    fecha_agendada_cliente  timestamp without time zone,
    fecha_agendada_lead     timestamp without time zone,
    confirmado              boolean DEFAULT false,
    fecha_creacion          timestamp without time zone DEFAULT now(),
    CONSTRAINT agendamientos_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 4. TABLA: lead_cualificacion
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_cualificacion (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead             uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada          uuid    REFERENCES public.llamadas(id),
    motivo_anulacion    text,
    cualificacion       text,
    anios_experiencia   integer,
    nivel_estudios      text,
    fecha_creacion      timestamp without time zone DEFAULT now(),
    CONSTRAINT lead_cualificacion_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 5. TABLA: conversaciones_whatsapp
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversaciones_whatsapp (
    id                          uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id                   uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead                     uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_conversacion_chatwoot    text,
    acepta_whatsapp             boolean,
    opt_in_whatsapp             boolean DEFAULT true,
    estado                      character varying,
    fecha_ultimo_mensaje        timestamp without time zone,
    fecha_creacion              timestamp without time zone DEFAULT now(),
    CONSTRAINT conversaciones_whatsapp_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 6. TABLA: intentos_llamadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intentos_llamadas (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead             uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada          uuid    REFERENCES public.llamadas(id),
    tipo_intento        text,
    numero_intento      integer,
    fecha_reintento     timestamp with time zone,
    estado              text,
    fecha_ejecucion     timestamp with time zone,
    fecha_creacion      timestamp with time zone DEFAULT now(),
    CONSTRAINT intentos_llamadas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 7. TABLA: intentos (tabla legacy para compatibilidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intentos (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead             uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada          uuid    REFERENCES public.llamadas(id),
    tipo_intento        text,
    numero_intento      integer,
    fecha_reintento     timestamp without time zone,
    estado              text,
    fecha_ejecucion     timestamp without time zone,
    fecha_creacion      timestamp without time zone DEFAULT now(),
    CONSTRAINT intentos_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 8. TABLA: notificaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead         uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    tipo            text    NOT NULL,
    fecha_envio     timestamp without time zone,
    metadatos       jsonb,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT notificaciones_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 9. TABLA: programas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nombre          text    NOT NULL,
    id_producto     text,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT programas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 10. TABLA: lead_programas (relación N:N entre lead y programa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_programas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    id_lead         uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_programa     uuid    NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT lead_programas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 11. TABLA: campanas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campanas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nombre          text    NOT NULL,
    descripcion     text,
    estado          text    DEFAULT 'ACTIVA'::text
                            CHECK (estado = ANY (ARRAY['ACTIVA'::text, 'PAUSADA'::text, 'FINALIZADA'::text])),
    fecha_inicio    timestamp with time zone DEFAULT timezone('utc'::text, now()),
    fecha_fin       timestamp with time zone,
    fecha_creacion  timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT campanas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- 12. ÍNDICES DE RENDIMIENTO (crítico para 100+ clientes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lead_tenant              ON public.lead(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llamadas_tenant          ON public.llamadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agendamientos_tenant     ON public.agendamientos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_cual_tenant         ON public.lead_cualificacion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_whatsapp_tenant     ON public.conversaciones_whatsapp(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intentos_ll_tenant       ON public.intentos_llamadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intentos_tenant          ON public.intentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tenant    ON public.notificaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_programas_tenant         ON public.programas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_programas_tenant    ON public.lead_programas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campanas_tenant          ON public.campanas(tenant_id);

-- Índices secundarios útiles para filtros frecuentes
CREATE INDEX IF NOT EXISTS idx_lead_campana         ON public.lead(tenant_id, campana);
CREATE INDEX IF NOT EXISTS idx_lead_origen          ON public.lead(tenant_id, origen);
CREATE INDEX IF NOT EXISTS idx_llamadas_estado      ON public.llamadas(tenant_id, estado_llamada);
CREATE INDEX IF NOT EXISTS idx_llamadas_fecha       ON public.llamadas(tenant_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_lead_fecha_ingreso   ON public.lead(tenant_id, fecha_ingreso_crm);

-- ============================================================
-- 13. HABILITAR ROW LEVEL SECURITY
-- ============================================================
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

-- ============================================================
-- 14. POLÍTICAS RLS — service_role tiene acceso total
--     (nuestro backend usa service_role key)
-- ============================================================
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

-- ============================================================
-- 15. VERIFICACIÓN FINAL
-- ============================================================
SELECT
    t.table_name,
    CASE WHEN c.column_name IS NOT NULL THEN '✅ tenant_id OK' ELSE '❌ FALTA tenant_id' END AS estado
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON c.table_name = t.table_name 
    AND c.column_name = 'tenant_id' 
    AND c.table_schema = 'public'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('tenants', 'schema_migrations')
ORDER BY t.table_name;

