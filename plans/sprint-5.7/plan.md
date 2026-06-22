---
title: "Sprint 5.7 — Output-WhatsApp"
description: "Configuración, mapeo y envío automatizado de notificaciones salientes a través de la API de WhatsApp Cloud (Meta WABA), integrando plantillas y flujos."
status: pending
priority: P1
effort: 20-30h
version_target: v0.5.70
branch: sprint-5.7
sprint_id: SP-5.7-WABA
tags: [whatsapp, meta, waba, notifications, templates, crm]
created: "2026-06-15"
blockedBy: [sprint-5.5]
blocks: []
---

# Plan — Sprint 5.7: Output-WhatsApp

> **Fuente de verdad de la planificación:** `plans/RoadMap.md` § "Fase 5.7 — Sprint 5.7".
> **Componente UI de referencia:** `src/components/orchestrator/AgentFlowBuilder.tsx` (Nodo Plantilla Meta).
> **Integración Meta de referencia:** `src/lib/integrations/telephony/providers/twilio.ts` (modelo de adaptador).

## Objetivo

El objetivo de este sprint es habilitar el canal de salida oficial de WhatsApp mediante Meta Cloud API. Esto incluye la gestión y sincronización de plantillas aprobadas por Meta, el mapeo dinámico de variables de leads (`nombre`, `fecha`, etc.) a los parámetros de la plantilla, y el motor de envío automatizado que se puede disparar desde las acciones del Flow Builder (Constructor de Flujos).

## Fases

| #   | Fase                                                                             | Archivo                                             | Estim. | Estado       |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------ | ------------ |
| 01  | **Capa de datos y Configuración** (Tablas para plantillas, números y logs)       | [phase-01](phase-01-setup-db.md)                     | 3-4h   | ✅ Completado |
| 02  | **Cliente API de Envío** (Llamadas REST a Meta Cloud API para plantillas/texto)    | [phase-02](phase-02-api-client.md)                  | 6-8h   | ✅ Completado |
| 03  | **UI de Configuración y Mapeo** (Gestión de plantillas y variables del lead)      | [phase-03](phase-03-ui-templates.md)                | 5-7h   | ✅ Completado |
| 04  | **Pruebas y Cierre** (Simulación de webhooks de entrega, logs y validación)      | [phase-04](phase-04-tests-cierre.md)                | 4-5h   | ✅ Completado |

**Total estimado:** 18-24h dev + cierre.

## Criterios de éxito (cierre OK cuando)

- La aplicación puede enviar plantillas aprobadas de Meta WhatsApp completando las variables del lead dinámicamente.
- Se registran en base de datos los logs de envío con estado (`enviado`, `entregado`, `leído`).
- El administrador puede ver y sincronizar las plantillas de Meta desde la interfaz de la aplicación.
- RLS tenant-only aplicado estrictamente en las tablas de WABA y plantillas.
- Todos los tests unitarios y de integración están en verde.
