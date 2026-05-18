-- ============================================================
-- ESDEN Analytics — Client Supabase Schema
-- 
-- Este SQL se ejecuta en el Supabase PROPIO del cliente.
-- El cliente ya tiene aislamiento total por ser una BD separada,
-- por lo que NO se usa tenant_id en las tablas.
--
-- Seguridad implementada:
--   1. RLS habilitado en todas las tablas
--   2. Solo service_role (la key de ESDEN) puede leer/escribir
--   3. anon key del cliente NO tiene acceso a los datos
--   4. El acceso directo desde el dashboard del cliente está bloqueado
--
-- Instrucciones:
--   1. Abre el SQL Editor de tu proyecto Supabase
--   2. Pega este script completo y ejecuta
--   3. Copia tu Service Role Key y compártela con ESDEN de forma segura
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: lead
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead (
    id                      uuid        NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: llamadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.llamadas (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: agendamientos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agendamientos (
    id                      uuid    NOT NULL DEFAULT uuid_generate_v4(),
    id_lead                 uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    fecha_agendada_cliente  timestamp without time zone,
    fecha_agendada_lead     timestamp without time zone,
    confirmado              boolean DEFAULT false,
    fecha_creacion          timestamp without time zone DEFAULT now(),
    CONSTRAINT agendamientos_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: lead_cualificacion
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_cualificacion (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: conversaciones_whatsapp
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversaciones_whatsapp (
    id                          uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: intentos_llamadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intentos_llamadas (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: intentos (legacy)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intentos (
    id                  uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- TABLA: notificaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    id_lead         uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    tipo            text    NOT NULL,
    fecha_envio     timestamp without time zone,
    metadatos       jsonb,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT notificaciones_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: programas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    nombre          text    NOT NULL,
    id_producto     text,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT programas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: lead_programas (relación N:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_programas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
    id_lead         uuid    NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_programa     uuid    NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
    fecha_creacion  timestamp without time zone DEFAULT now(),
    CONSTRAINT lead_programas_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: campanas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campanas (
    id              uuid    NOT NULL DEFAULT uuid_generate_v4(),
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
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_llamadas_lead         ON public.llamadas(id_lead);
CREATE INDEX IF NOT EXISTS idx_llamadas_estado       ON public.llamadas(estado_llamada);
CREATE INDEX IF NOT EXISTS idx_llamadas_fecha        ON public.llamadas(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamientos_lead    ON public.agendamientos(id_lead);
CREATE INDEX IF NOT EXISTS idx_lead_cual_lead        ON public.lead_cualificacion(id_lead);
CREATE INDEX IF NOT EXISTS idx_conv_whatsapp_lead    ON public.conversaciones_whatsapp(id_lead);
CREATE INDEX IF NOT EXISTS idx_intentos_ll_lead      ON public.intentos_llamadas(id_lead);
CREATE INDEX IF NOT EXISTS idx_intentos_lead         ON public.intentos(id_lead);
CREATE INDEX IF NOT EXISTS idx_notificaciones_lead   ON public.notificaciones(id_lead);
CREATE INDEX IF NOT EXISTS idx_lead_programas_lead   ON public.lead_programas(id_lead);
CREATE INDEX IF NOT EXISTS idx_lead_campana          ON public.lead(campana);
CREATE INDEX IF NOT EXISTS idx_lead_origen           ON public.lead(origen);
CREATE INDEX IF NOT EXISTS idx_lead_fecha_ingreso    ON public.lead(fecha_ingreso_crm);

-- ============================================================
-- SEGURIDAD: HABILITAR ROW LEVEL SECURITY EN TODAS LAS TABLAS
-- Solo service_role puede acceder — anon key bloqueada por defecto
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
-- POLÍTICAS RLS — EXCLUSIVO service_role (ESDEN backend)
-- anon y authenticated NO tienen acceso directo a los datos
-- ============================================================
CREATE POLICY "esden_service_role_lead"
    ON public.lead FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_llamadas"
    ON public.llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_agendamientos"
    ON public.agendamientos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_lead_cualificacion"
    ON public.lead_cualificacion FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_conversaciones_whatsapp"
    ON public.conversaciones_whatsapp FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_intentos_llamadas"
    ON public.intentos_llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_intentos"
    ON public.intentos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_notificaciones"
    ON public.notificaciones FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_programas"
    ON public.programas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_lead_programas"
    ON public.lead_programas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "esden_service_role_campanas"
    ON public.campanas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT
    t.table_name,
    CASE WHEN r.rowsecurity THEN '🔒 RLS ACTIVO' ELSE '⚠️ RLS INACTIVO' END AS rls_status
FROM information_schema.tables t
JOIN pg_class r ON r.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
