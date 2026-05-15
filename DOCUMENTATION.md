# 📘 Documentación Maestra: AI CRM & Workflow Orchestrator v3.0

Esta es la guía definitiva para operar, configurar y escalar el ecosistema de orquestación de leads impulsado por Inteligencia Artificial.

---

## 📑 Índice de Contenidos

1. [Introducción](#1-introducción)
2. [Sección de Usuario (Operaciones y Métricas)](#2-sección-de-usuario-operaciones-y-métricas)
   - [Gestión de Leads](#gestión-de-leads)
   - [Dashboard de Métricas](#dashboard-de-métricas)
   - [Calendario](#calendario)
3. [Sección de Administrador (Setup y Construcción)](#3-sección-de-administrador-setup-y-construcción)
   - [Constructor de Flujos (Canvas)](#constructor-de-flujos-canvas)
   - [Creación de Clientes (Tenants)](#creación-de-clientes-tenants)
   - [Conexión de APIs (Meta, OpenAI, Retell)](#conexión-de-apis-meta-openai-retell)
4. [Variables y Lógica Avanzada](#4-variables-y-lógica-avanzada)
5. [Infraestructura y Seguridad](#5-infraestructura-y-seguridad)

---

## 🚀 1. Introducción

El **AI CRM & Orchestrator** es un motor de automatización diseñado para eliminar el trabajo manual en el seguimiento de leads. A diferencia de un CRM tradicional, este sistema "piensa" y "ejecuta" acciones de forma autónoma.

**IMPORTANTE:** El sistema cuenta con dos niveles de acceso:
- **Cliente/Usuario:** Acceso exclusivo a métricas, historial y calendario.
- **Administrador:** Control total sobre la lógica, construcción de flujos y configuración de APIs.

---

## 👥 2. Sección de Usuario (Operaciones y Métricas)

Esta sección está dirigida a los clientes finales y gestores de cuentas.

### Gestión de Leads

Los usuarios pueden visualizar el estado de sus leads en tiempo real:
- **QUALIFICATION:** La IA está validando el interés.
- **SCHEDULING:** La IA está intentando agendar una cita.
- **BOOKED:** Cita confirmada.

### Dashboard de Métricas

Acceso a informes detallados sobre:
- **Llamadas:** Minutos consumidos y efectividad.
- **WhatsApp:** Mensajes enviados y tasa de respuesta.
- **Campañas:** Rendimiento por origen y costo de adquisición.

### Calendario

Visualización centralizada de todas las citas agendadas por la IA. El usuario puede ver quién, cuándo y para qué curso se ha agendado la reunión.

---

## 🔑 3. Sección de Administrador (Setup y Construcción)

Guía para los administradores que configuran la "inteligencia" del sistema.

### Constructor de Flujos (Canvas)

Es la herramienta donde se diseña la estrategia. **Solo visible para Administradores.**
- **Lead Trigger:** Inicia el proceso.
- **Llamada IA:** Conecta con agentes de voz.
- **Bucle de Reintentos:** Gestiona la persistencia de contacto.

### Creación de Clientes (Tenants)

1. **Registro:** Creación del perfil del cliente.
2. **API Key:** Generación de credenciales para ingesta.
3. **Límites:** Configuración del "Circuit Breaker" para control de gasto.

### Conexión de APIs (Meta, OpenAI, Retell)

- **Meta (WhatsApp):** Configuración de tokens y números.
- **OpenAI:** Selección de modelos de razonamiento (GPT-4o).
- **Retell AI / Ultravox:** Configuración de voces y prompts de sistema.

---

## 🧠 4. Variables y Lógica Avanzada

Mapeo dinámico de datos:
- `{{lead.nombre}}`: Nombre del lead.
- `{{course.name}}`: Programa de interés.
- `{{call.summary}}`: Resumen de la IA.

---

## 🛡️ 5. Infraestructura y Seguridad

- **Supabase:** Base de datos centralizada y segura.
- **Logs:** Auditoría completa de cada interacción.
- **Timezone Compliance:** Llamadas automáticas solo en horarios permitidos según el país del lead.

---

## 🎬 Guion para Video Explicativo

1. **El Problema:** La pérdida de leads por falta de rapidez.
2. **La Solución:** IA omnicanal 24/7.
3. **Roles:** Diferencia entre lo que ve el Admin (Constructor) y el Cliente (Métricas).
4. **Cierre:** Automatización real y escalable.

---

*Documentación Oficial - Versión 3.1 (Mayo 2026)*
