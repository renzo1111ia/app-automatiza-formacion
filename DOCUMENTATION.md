# 📘 Documentación Maestra: AI CRM & Workflow Orchestrator v3.0

Esta es la guía definitiva para operar, configurar y escalar el ecosistema de orquestación de leads impulsado por Inteligencia Artificial.

---

## 📑 Índice de Contenidos

1. [Introducción](#1-introducción)
2. [Sección de Usuario (Operaciones)](#2-sección-de-usuario-operaciones)
   - [Gestión de Leads](#gestión-de-leads)
   - [Constructor de Flujos (Canvas)](#constructor-de-flujos-canvas)
   - [Configuración de Agentes (Voz y Texto)](#configuración-de-agentes-voz-y-texto)
3. [Sección de Administrador (Setup)](#3-sección-de-administrador-setup)
   - [Creación de Clientes (Tenants)](#creación-de-clientes-tenants)
   - [Conexión de APIs (Meta, OpenAI, Retell)](#conexión-de-apis-meta-openai-retell)
   - [Ingesta de Datos (Webhooks)](#ingesta-de-datos-webhooks)
4. [Variables y Lógica Avanzada](#4-variables-y-lógica-avanzada)
5. [Infraestructura y Seguridad](#5-infraestructura-y-seguridad)

---

## 🚀 1. Introducción

El **AI CRM & Orchestrator** es un motor de automatización diseñado para eliminar el trabajo manual en el seguimiento de leads. A diferencia de un CRM tradicional, este sistema "piensa" y "ejecuta" acciones (llamadas, mensajes, análisis) de forma autónoma basándose en un grafo de decisión.

**Valor Clave:**

- **Respuesta inmediata:** Menor a 1 minuto desde que entra el lead.
- **Persistencia inteligente:** Bucle de reintentos dinámico.
- **Omnicanalidad real:** Coordinación perfecta entre Voz y WhatsApp.
- **Sin Dependencias Externas:** Ejecución nativa en Supabase (adiós a Airtable).

---

## 👥 2. Sección de Usuario (Operaciones)

Esta sección está dirigida a los operadores, cerradores y gestores de marketing.

### Gestión de Leads

En el dashboard principal, el sistema categoriza los leads según su madurez:

- **QUALIFICATION:** La IA está validando el interés y capturando variables (Presupuesto, Ciudad, Programa).
- **SCHEDULING:** El lead ha sido cualificado y la IA está negociando una fecha en el calendario.
- **BOOKED:** Éxito total. La cita ya está en el calendario del asesor.
- **DISCARDED:** Leads que no cumplen criterios o no tienen interés real.

### Constructor de Flujos (Canvas)

El canvas es la herramienta visual donde defines la estrategia de contacto.

**Nodos Disponibles:**

- **Lead Trigger:** El nodo naranja. Recibe el lead y dispara el flujo.
- **Time Condition:** El nodo amarillo. Define "ventanas de contacto". Si un lead entra a las 3 AM, este nodo lo retiene hasta las 9 AM para no incumplir normativas.
- **Llamada IA:** El nodo azul. Conecta con Retell o Ultravox para una conversación de voz fluida.
- **WhatsApp Template:** El nodo verde. Envía mensajes oficiales usando la API de Meta.
- **Bucle de Reintentos:** El nodo marrón. Gestiona la insistencia. Si un lead no contesta, este nodo espera X horas y vuelve a intentar por el canal alternativo.
- **Condición (If/Else):** El nodo índigo. Ramifica según variables como `{{call.status}}`.

### Configuración de Agentes (Voz y Texto)

- **Identidad:** Define el nombre, tono (formal/cercano) y objetivo del agente.
- **Knowledge Base:** Sube tus manuales de ventas en PDF. La IA los indexará y usará como única fuente de verdad durante las llamadas.

---

## 🔑 3. Sección de Administrador (Setup)

Guía para la configuración técnica inicial de cada cliente.

### Creación de Clientes (Tenants)

Un "Tenant" es una instancia aislada para un cliente.

1.  **Registro:** Crea el perfil en el Admin Panel.
2.  **API Key:** Genera la llave única. Esta llave debe ir en el Header `x-api-key` de todas las peticiones externas.
3.  **Límites:** Configura el presupuesto diario en USD. Si el cliente gasta más de lo permitido, el sistema detiene las llamadas automáticamente (Circuit Breaker).

### Conexión de APIs (Meta, OpenAI, Retell)

Para que el sistema tenga "vida", debes configurar las conexiones:

- **Meta (WhatsApp API):** Requiere `AccessToken`, `PhoneNumberID` y `WABA_ID`. Configura los Webhooks en el panel de Meta para que el sistema reciba las respuestas de los leads.
- **OpenAI:** El cerebro detrás del análisis. Se recomienda usar modelos `gpt-4o` para una precisión del 100% en la extracción de datos.
- **Retell AI / Ultravox:** Los motores de voz. Requieren API Keys que se pegan en la configuración del Tenant.

### Ingesta de Datos (Webhooks)

El sistema es agnóstico a la fuente. Puedes enviar leads desde Zoho, Facebook Ads o tu propia web.

**Endpoint Universal:** `https://tu-dominio.com/api/leads/ingest`

**Cuerpo del JSON Requerido:**

```json
{
  "nombre": "Nombre del Lead",
  "telefono": "+34600000000",
  "campana": "Nombre_Campana",
  "origen": "Facebook_Ads",
  "extra": {
    "campo_personalizado": "valor"
  }
}
```

---

## 🧠 4. Variables y Lógica Avanzada

El sistema mapea automáticamente los datos del lead para que los uses en mensajes:

- `{{lead.nombre}}`: Para saludos personalizados.
- `{{course.name}}`: El curso detectado por la IA.
- `{{call.summary}}`: Resumen automático de la conversación.
- `{{appointment.link}}`: Link dinámico de agendamiento.

---

## 🛡️ 5. Infraestructura y Seguridad

El sistema corre sobre **Supabase**, lo que garantiza:

1.  **Escalabilidad:** Soporta miles de leads concurrentes sin latencia.
2.  **Seguridad:** Los datos de cada cliente están aislados lógicamente.
3.  **Transparencia:** Cada segundo de llamada y cada céntimo gastado queda auditado en los logs de orquestación.

---

## 🎬 Guion para Video Explicativo

1.  **El Problema:** "Los leads se enfrían en minutos".
2.  **La Solución:** "IA que llama y chatea al instante".
3.  **Demostración:** Muestra el Canvas y una llamada real.
4.  **Cierre:** "Escala tu negocio sin contratar más personal".

---

*Documentación Oficial - Versión 3.0 (Mayo 2026)*
