---
title: "Sprint Refinamiento Herramientas Internas (post-MVP, v0.5.2) — Equipo Renzo"
sprint_id: SP-5C
version_target: v0.5.2
branch: feature/sprint-refinamiento-herramientas-post-mvp
assigned_to: 👤 Renzo + equipo de desarrollo Renzo
created: 22-05-2026 18:30 por Javi HP
status: 🔘 Pendiente (arranca tras Sprint Costes-LLM v0.5.1 mergeado a developer)
position: post-MVP, entre Sprint Costes-LLM (v0.5.1) y Sprint 5 Salesforce (v0.6.0)
---

# 👤 Sprint Refinamiento Herramientas Internas — overview

Sprint dedicado a completar dos herramientas internas que se **sacaron del MVP** por decisión del 22-05-2026 (Bea + Renzo):

- **Simulator** (`/dashboard/simulator`) — Renzo lo describe como "Sandbox 80% funcional pero no persiste en BD ni soporta voz". Bea: "no creo que ninguno de estos simuladores sean estrictamente necesarios para un primer MVP operativo".
- **Lanzador `/calls`** (`/dashboard/calls`) — Renzo lo describe como "Prototipo UI / Mockup hardcoded sin integración real con SDK de Retell". Bea: "no entiendo muy bien qué es esto".

Sacarlos del MVP libera ~25h de QA y dev del camino al v0.4.0 GA. Refinarlos post-MVP con Renzo + equipo permite que sean productos terminados sin presión de fecha.

## Asignación

- **Lead**: Renzo.
- **Equipo**: equipo de desarrollo Renzo (Renzo dev + tester(s) humano(s)).
- **Capacidad**: por confirmar (estimación inicial 8h/día × 3-4 días).
- **Duración estimada**: 3-4 días lab (18-22h dev + 4h 30min cierre).
- **Fechas**: Inicio Jue 24-09-2026 (post-Costes-LLM merge), fin estim. Mar 29-09-2026.
- **Branch**: `feature/sprint-refinamiento-herramientas-post-mvp` desde `developer` tras SP-5B mergeado.

## Estructura (2 fases + cierre)

| Fase | Archivo                                                                          | Cubre                             | Estim    |
| ---- | -------------------------------------------------------------------------------- | --------------------------------- | -------- |
| 01   | [phase-01-simulator-persistencia-voz.md](phase-01-simulator-persistencia-voz.md) | Simulator: persistencia BD + voz  | 8-10h    |
| 02   | [phase-02-lanzador-calls-retell-sdk.md](phase-02-lanzador-calls-retell-sdk.md)   | Lanzador `/calls` Retell SDK real | 10-12h   |
| 05   | [phase-05-cierre-sprint.md](phase-05-cierre-sprint.md)                           | Cierre estándar SP-5C-CLOSE-1..5  | 4h 30min |

## Fase 01 — Simulator persistencia + voz

**Estado actual (Renzo)**: el Simulator funciona en Sandbox (variables en `useState`, no persisten, no se conservan al recargar). Solo simulación texto, no voz.

**Objetivo**: simulador completo, con persistencia opcional para que clientes puedan auditar sesiones pasadas, y simulación voz para QA pre-publicación de agentes Retell/Ultravox.

**Tareas**:

1. Backend: tabla `simulator_sessions` con metadatos (`tenant_id`, `agent_id`, `started_at`, `messages[]`, `variables_captured`) (1-2h).
2. Backend: `saveSimulatorSession()` / `loadSimulatorSession()` con RLS por tenant (1-2h).
3. Frontend: switch "persistir esta sesión" + lista de sesiones guardadas (2h).
4. Frontend: integración audio (text-to-speech preview vía Retell/Ultravox preview API si existe; alternativa: navegador SpeechSynthesis) (2-3h).
5. Tests + WCAG (1-2h).

## Fase 02 — Lanzador `/calls` Retell SDK real

**Estado actual (Renzo)**: `/dashboard/calls` muestra mockup hardcoded — Dialpad funcional UI pero `handleCall()` solo simula con `setTimeout(5000)`. Transcripción es texto estático en JSX. Renzo recomienda: crear endpoint real + WebSocket.

**Objetivo**: lanzador funcional con SDK de Retell para llamadas salientes manuales desde el panel + transcripción en vivo.

**Tareas**:

1. Backend: endpoint `/api/calls/manual` que recibe `{ phone, agent_id }`, valida permisos del tenant, dispara llamada vía Retell SDK (2-3h).
2. Backend: WebSocket o SSE para transcripción en vivo (Retell SDK ofrece subscriptions; conectar al frontend) (2-3h).
3. Frontend: reemplazar mockup con llamada real al endpoint + LiveMonitor conectado al WS (3h).
4. Frontend: manejo errores (saldo insuficiente Retell, agente no encontrado, número inválido) con mensajes amigables (1-2h).
5. Tests E2E con número de test de Retell (1h).
6. Documentar en `docs/dev-onboarding.md` cómo configurar Retell sandbox para probar localmente (1h).

## Tareas de cierre (SP-5C-CLOSE-1..5)

| Task                | Descripción                                                                                      | Estim         | Estado |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------- | ------ |
| SP-5C-CLOSE-1       | Auto test (typecheck + lint + build + test)                                                      | 1h 30min      | 🔘     |
| SP-5C-CLOSE-2       | Test E2C Local Playwright sobre `/simulator` y `/calls` actualizados                             | 2h            | 🔘     |
| SP-5C-CLOSE-3       | Test Manual del Tester (Renzo absorbe — no se difiere a SP-4B porque ya estamos en sprint Renzo) | 1h            | 🔘     |
| SP-5C-CLOSE-4       | Bugs detectados                                                                                  | (variable)    | 🔘     |
| SP-5C-CLOSE-5       | PR a developer + bump v0.5.2 + invitar a planificar Sprint 5 Salesforce                          | 30min         | 🔘     |
| **Subtotal cierre** |                                                                                                  | **5h + bugs** |        |

## Pre-requisitos

- Sprint Costes-LLM (SP-5B v0.5.1) cerrado y mergeado.
- Acceso Retell sandbox configurado (test API key + número de prueba) para probar Fase 02.
- Decisión sobre persistencia Simulator: ¿guardamos TODAS las sesiones o solo las que el cliente marca? Default: marca explícita para no llenar BD.

## Riesgos

| Riesgo                                                                           | Mitigación                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Retell SDK WebSocket API requiere endpoint público (no localhost) para callbacks | Usar `ngrok` o tunneling durante dev; en VPS ya está expuesto      |
| Audio TTS browser API (SpeechSynthesis) sonido genérico vs voces Retell reales   | Aceptable como MVP de la fase; mejora opcional en sprint posterior |
| Persistencia simulador puede inflar BD                                           | Auto-purga sesiones >30 días o configurable por tenant             |

## Output esperado al cierre

- Simulator con persistencia opcional + audio TTS preview.
- Lanzador `/calls` totalmente funcional con SDK Retell + transcripción WebSocket en vivo.
- PR mergeado a `developer`, bump v0.5.2.
- Mensaje a Javi HP: "Refinamiento herramientas internas listo. Siguiente: planificar Sprint 5 Salesforce".
