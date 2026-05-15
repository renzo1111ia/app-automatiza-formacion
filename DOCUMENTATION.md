# 📘 Guía Maestra: AI CRM & Workflow Orchestrator v3.0

Bienvenido a la documentación oficial y completa del sistema. Esta guía está diseñada para que cualquier administrador o cliente pueda operar, configurar e integrar el orquestador de forma profesional.

---

## 📑 Índice de Contenidos

1. [Visión General del Sistema](#visión-general-del-sistema)
2. [Guía de Usuario (Métricas y Calendario)](#guía-de-usuario-métricas-y-calendario)
3. [Guía de Administrador (Setup y Construcción)](#guía-de-administrador-setup-y-construcción)
4. [Diccionario de Variables del Sistema](#diccionario-de-variables-del-sistema)
5. [Catálogo de Nodos y Tools](#catálogo-de-nodos-y-tools)
6. [Integraciones de Terceros (Meta, OpenAI, Retell)](#integraciones-de-terceros-meta-openai-retell)
7. [Guía de Supabase Externo (Self-Hosting)](#guía-de-supabase-externo-self-hosting)

---

## Visión General del Sistema

El **AI CRM & Orchestrator** es una plataforma de automatización de ventas que utiliza Inteligencia Artificial para contactar, cualificar y agendar leads en tiempo real.

### Componentes Clave

- **Orchestrator Engine:** El cerebro que decide qué acción tomar basándose en el comportamiento del lead.
- **Canales Omnicanal:** Voz (IA Telefónica) y Texto (WhatsApp Business API).
- **Aislamiento de Datos:** Soporte para multi-tenancy nativo y bases de datos externas por cliente.

---

## Guía de Usuario (Métricas y Calendario)

Los usuarios finales (clientes) tienen un acceso simplificado centrado en la visualización de resultados.

### Visualización de Métricas

- **Dashboard Principal:** Resumen de leads procesados, citas agendadas y tasa de conversión.
- **Informes de Llamadas:** Detalle de cada llamada, incluyendo el resumen de la IA y el link a la grabación.
- **Informes de WhatsApp:** Seguimiento de las conversaciones automatizadas.

### Calendario de Citas

- Acceso al calendario donde se reflejan las citas confirmadas por el agente de voz o el chatbot.
- Cada cita incluye los datos capturados durante la cualificación (ej: presupuesto, ciudad, programa de interés).

---

## Guía de Administrador (Setup y Construcción)

El administrador tiene el control total sobre la lógica de negocio.

### Paso 1: Creación de un Cliente (Tenant)

1. Ve al **Admin Panel**.
2. Define los parámetros del cliente (Nombre, Email de soporte).
3. Configura el **Presupuesto Máximo Diario** (Circuit Breaker) para evitar excesos de facturación en APIs.

### Paso 2: El Constructor de Flujos (Workflow Builder)

El sistema opera bajo una lógica de grafos. Debes arrastrar y conectar nodos para definir el camino del lead.

- **Estrategia Recomendada:** Intentar llamada inmediata -> Si no contesta -> Esperar 1 hora -> Enviar WhatsApp -> Reintentar llamada a las 24h.

---

## Diccionario de Variables del Sistema

Puedes usar estas variables en cualquier nodo de mensaje, prompt o condición usando la sintaxis `{{variable}}`.

| Variable | Descripción | Ejemplo de Uso |
| :--- | :--- | :--- |
| `{{lead.nombre}}` | Nombre de pila del lead | "Hola {{lead.nombre}}..." |
| `{{lead.telefono}}` | Número con prefijo internacional | Identificación en APIs |
| `{{lead.campana}}` | Nombre de la campaña de marketing | Segmentación de lógica |
| `{{course.name}}` | Programa por el que el lead preguntó | Contexto para el agente |
| `{{call.status}}` | Estado de la última llamada (`completed`, `busy`, `failed`) | Nodo Condición |
| `{{call.summary}}` | Resumen ejecutivo generado por la IA | Reportes de ventas |
| `{{call.outcome}}` | Resultado de la cualificación (`INTERESADO`, `NEGATIVO`) | Bifurcación de flujo |
| `{{appointment.date}}` | Fecha de la cita agendada | Confirmación por WhatsApp |
| `{{appointment.link}}` | URL para reprogramar o ver la cita | Mensajes de seguimiento |

---

## Catálogo de Nodos y Tools

| Nodo | Función | Configuración Requerida |
| :--- | :--- | :--- |
| **Lead Trigger** | Disparador inicial cuando entra un lead vía API. | Ninguna. |
| **Wait (Espera)** | Pausa el flujo por minutos, horas o días. | Tiempo de espera. |
| **Time Condition** | Valida si la hora actual está dentro del horario laboral. | Horario (ej: 9am - 8pm). |
| **Llamada IA** | Ejecuta una llamada saliente con voz natural. | Agente de Voz ID. |
| **WhatsApp Message** | Envía una plantilla de Meta. | Template Name & Language. |
| **Bucle de Reintentos** | Motor de insistencia inteligente con bifurcación. | Nº de intentos, Intervalo. |
| **Condition (If/Else)** | Evalúa una variable para decidir el siguiente paso. | Regla (ej: variable == valor). |
| **AI Agent (Chat)** | Activa un agente de texto para conversar por WhatsApp. | Prompt del Sistema. |

---

## Integraciones de Terceros (Meta, OpenAI, Retell)

### Meta (WhatsApp Business API)

Para que el sistema envíe mensajes, debes configurar en el Panel de Admin:

1. **Access Token:** Token permanente generado en el portal de Facebook Developers.
2. **Phone Number ID:** ID único del número de teléfono.
3. **WABA ID:** WhatsApp Business Account ID.

### Retell AI / Ultravox (Voz)

1. Obtén tu **API Key** del proveedor de voz.
2. Configura el **Voice Agent ID** en el nodo de llamada.

### OpenAI

- Se requiere para el análisis de transcripciones y la extracción de variables.
- Configura tu `OPENAI_API_KEY` en el entorno del servidor.

---

## Guía de Supabase Externo (Self-Hosting)

Si un cliente desea que sus datos se guarden en su propia instancia de Supabase por motivos de seguridad o cumplimiento, sigue este proceso:

### Paso 1: Configuración en el Dashboard de ESDEN

1. En la configuración del Cliente, activa la opción **"Base de Datos Externa"**.
2. Ingresa la **URL de Supabase** y la **Service Role Key** del cliente.

### Paso 2: Ejecución del Schema en el Supabase del Cliente

El cliente debe ejecutar el siguiente script SQL en su editor de SQL de Supabase para crear las tablas e índices necesarios:

```sql
-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLA: lead
CREATE TABLE IF NOT EXISTS public.lead (
    id                      uuid NOT NULL DEFAULT uuid_generate_v4(),
    id_lead_externo         text,
    nombre                  text,
    apellido                text,
    telefono                text,
    email                   text,
    pais                    text,
    origen                  text,
    campana                 text,
    current_stage           text DEFAULT 'QUALIFICATION',
    metadata                jsonb,
    last_interaction_at     timestamp with time zone DEFAULT now(),
    CONSTRAINT lead_pkey    PRIMARY KEY (id)
);

-- TABLA: llamadas
CREATE TABLE IF NOT EXISTS public.llamadas (
    id                  uuid NOT NULL DEFAULT uuid_generate_v4(),
    id_lead             uuid NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    id_llamada_retell   text,
    estado_llamada      text,
    duracion_segundos   integer,
    url_grabacion       text,
    transcripcion       text,
    resumen             text,
    fecha_creacion      timestamp with time zone DEFAULT now(),
    CONSTRAINT llamadas_pkey PRIMARY KEY (id)
);

-- TABLA: agendamientos
CREATE TABLE IF NOT EXISTS public.agendamientos (
    id                      uuid NOT NULL DEFAULT uuid_generate_v4(),
    id_lead                 uuid NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    fecha_agendada          timestamp with time zone,
    confirmado              boolean DEFAULT false,
    fecha_creacion          timestamp with time zone DEFAULT now(),
    CONSTRAINT agendamientos_pkey PRIMARY KEY (id)
);

-- Habilitar RLS (Seguridad)
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamientos ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para el servicio
CREATE POLICY "service_access_all" ON public.lead FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_access_calls" ON public.llamadas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_access_apps" ON public.agendamientos FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Paso 3: Verificación

Una vez ejecutado, el sistema realizará una prueba de conexión. A partir de ese momento, ningún dato del lead tocará la base de datos interna de ESDEN.

---

### Guion para Video Explicativo

1. **El Problema:** La pérdida de leads por falta de rapidez.
2. **La Solución:** IA omnicanal 24/7.
3. **Roles:** Diferencia entre lo que ve el Admin (Constructor) y el Cliente (Métricas).
4. **Cierre:** Automatización real y escalable.

---

*Documentación Oficial - Versión 3.3 (Mayo 2026)*
