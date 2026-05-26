---
title: "Sprint Costes-LLM — Centro de costes LLM (post-Sheets, patch v0.5.1)"
description: "Tracking de tokens y dashboard de costes LLM por tenant/proveedor. Reagrupa trabajo que originalmente vivía en Sprint 3 (4-03 parcial, 4-04) y Sprint 1 (2-36), movido fuera del MVP a petición de la clienta (22-05-2026). Orden definitivo: JUSTO DESPUÉS de Sprint 4 (Google Sheets v0.5.0), antes de Sprint 5 (Salesforce v0.6.0)."
status: pending
priority: P2
effort: 23-31h base (+ 5h 30min cierre estándar)
branch: feature/sprint-costes-llm-post-mvp
sprint_id: SP-5B
version_target: v0.5.1
tags:
  - observabilidad
  - llm-costs
  - tracking-tokens
  - dashboard-admin
  - langchain-callback
  - post-mvp
  - post-sheets
created: 2026-05-22
last_updated: 2026-05-22
---

# Sprint Costes-LLM (post-Sheets v0.5.1)

> Ref: [RoadMap.md — Fase 4.5](../RoadMap.md#fase-45--sprint-costes-llm-post-sheets-patch-v051)

## Origen del sprint

**Decisión 22-05-2026** (clienta, confirmada por Javi HP): el centro de costes LLM **no es necesario para el MVP** (`v0.4.0`). Se extrae de Sprint 3 y se difiere a este sprint post-Sheets patch (`v0.5.1`), insertado entre Sprint 4 (Google Sheets `v0.5.0`) y Sprint 5 (Salesforce `v0.6.0`).

**Orden definitivo** (decisión 22-05-2026 tarde): Sprint 3 (MVP) → Sprint 4 (Sheets) → **Sprint Costes-LLM** → Sprint 5 (Salesforce) → Sprint 6 (GHL) → Sprint 7 (AC) → Sprint 8 (generalización). Fechas Sprints 5-8 desplazadas +4 días respecto al plan original.

**Trabajo trasladado:**

| Origen                           | Tarea original                                                                           | Aquí |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ---- |
| Sprint 3 phase-02 (4-03 parcial) | Tabla `llm_usage_logs` + RLS + `llm-cost-tracker.ts` LangChain CallbackHandler           | C-01 |
| Sprint 3 phase-03 entera (4-04)  | Dashboard de costes LLM por tenant/proveedor (Recharts)                                  | C-02 |
| Sprint 1 phase-04 (2-36)         | `token_usage` (`completion.usage`) en `chat_messages` para todos los consumidores OpenAI | C-03 |

**Lo que SE QUEDA en MVP** (Sprint 3 phase-02 reducido):

- Pino logging estructurado en API Routes, Server Actions y BullMQ Workers
- Métricas BullMQ vía bull-board (`/admin/queues`)
- Sentry para captura de errores

> El logging y las métricas de cola son necesarias para operar en producción y depurar incidencias. El tracking de costes LLM no — la cliente está de acuerdo en operar v0.4.0 sin visibilidad de costes y añadirla en v0.5.1.

## Prerrequisito

- Sprint 3 cerrado (`v0.4.0` MVP) y mergeado a `developer`.
- **Sprint 4 (Google Sheets `v0.5.0`) cerrado y mergeado a `developer`** — este sprint arranca tras Sheets, no antes.
- Pino logger (`src/lib/logger.ts`) creado en Sprint 3 phase-02 — base sobre la que registrar los logs de los callbacks LLM.

## Fases

| #   | Archivo                                                                        | Tareas RoadMap   | Est.            | Estado    |
| --- | ------------------------------------------------------------------------------ | ---------------- | --------------- | --------- |
| 1   | [phase-01-tabla-llm-usage-y-tracker.md](phase-01-tabla-llm-usage-y-tracker.md) | C-01             | 5-7h            | Pendiente |
| 2   | [phase-02-dashboard-costes-llm.md](phase-02-dashboard-costes-llm.md)           | C-02             | 16-22h          | Pendiente |
| 3   | [phase-03-token-usage-chat-messages.md](phase-03-token-usage-chat-messages.md) | C-03             | 2h              | Pendiente |
| 4   | [phase-04-cierre-sprint.md](phase-04-cierre-sprint.md)                         | SP-5B-CLOSE-1..5 | 5h 30min + bugs | Pendiente |

**Total desarrollo:** 23-31h · **Total con cierre:** ~28-37h · **Objetivo:** 27h base

## Dependencias entre fases

```
PREREQUISITO GLOBAL:
  Sprint 3 (v0.4.0) cerrado y mergeado a developer
  Sprint 4 (Google Sheets v0.5.0) cerrado y mergeado a developer

ORDEN ÓPTIMO (1 dev):
  Ph1 (tabla + tracker) → Ph3 (token_usage chat_messages)
                       → Ph2 (dashboard Recharts) — depende de Ph1
                       → Ph4 (cierre)

PARALELIZABLES (2+ devs):
  Ph1 y Ph3 — tocan archivos distintos (Ph3 modifica server actions, Ph1 crea tabla nueva)
  Ph2 — bloqueada por Ph1 (necesita tabla llm_usage_logs)

DEPENDENCIAS INTERNAS:
  Ph1 crea llm_usage_logs + tracker → Ph2 lee esa tabla
  Ph3 backfilling no necesario — solo aplica a chats nuevos desde el deploy
```

## Solapes con sprints anteriores

| Sprint anterior          | Componente reutilizado                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Sprint 3 (4-03 reducido) | Pino logger (`src/lib/logger.ts`) — se inyecta dentro del LangChain CallbackHandler               |
| Sprint 1 (2-09)          | Zod schemas `ai_agent_variants` y `chat_messages` con whitelist `model_name` (2-35)               |
| Sprint 0 (1-27)          | Patrón Server Action hardening — el endpoint de dashboard de costes va por `withRateLimit` (4-08) |

## Criterios de éxito del Sprint

- [ ] Tabla `llm_usage_logs` creada con RLS multi-tenant funcional (INSERT como tenant A no visible por tenant B)
- [ ] `llm-cost-tracker.ts` LangChain CallbackHandler captura tokens en todas las llamadas OpenAI/Anthropic/Google (Bedrock descartado del stack 26-05-2026)
- [ ] `chat_messages.metadata.token_usage` poblado para nuevos mensajes (WhatsApp, Widget, Rescue, FactExtractor)
- [ ] Dashboard admin visible: gráfica costes por proveedor por mes + evolución por tenant por semana
- [ ] Dashboard tenant visible: sólo costes del tenant activo
- [ ] Precios actualizados de mayo 2026 (DA-4-005 corregido) — constante `src/lib/llm-pricing.ts`
- [ ] `npm run typecheck` + `lint` + `build` → 0 errores
- [ ] CHANGELOG entrada `## [v0.5.1]` completa
- [ ] PR a `developer` con bump `v0.5.1`

## Tracking de tiempos

Logs en `plans/logs/sprint-costes-llm/C-XX.log.md` (misma estructura Sprints 1/2/3).

## Riesgos top-3

| Riesgo                                                                        | Prob  | Impacto | Mitigación                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LangChain CallbackHandler no captura llamadas OpenAI **directas** (no por LC) | Alta  | Alto    | Inventario en Ph1: identificar todos los `openai.chat.completions.create()` directos y envolverlos en wrapper que también persista en `llm_usage_logs`. El widget (`widget.ts`) es uno de ellos |
| Recharts pesa ~150KB extra en bundle del dashboard                            | Baja  | Bajo    | Recharts ya está en stack (Sprint 1/2), no es dep nueva                                                                                                                                         |
| Precios LLM cambian entre v0.5.1 release y deploy real                        | Media | Bajo    | `llm-pricing.ts` es constante editable; commit + redeploy en <5min                                                                                                                              |

## Orden fijo en el roadmap

**Decisión clienta 22-05-2026 (tarde):** este sprint va JUSTO DESPUÉS de Sprint 4 (Google Sheets `v0.5.0`), antes de Sprint 5 (Salesforce `v0.6.0`). Inicio Lun 24-08-2026 09:00, fin estimado Jue 27-08-2026 19:00. Bloquea la fecha de inicio de Sprint 5 — se desplaza +4 días respecto al plan original.

## Referencias

- RoadMap: [`plans/RoadMap.md`](../RoadMap.md) §Fase 4.5
- Researcher observabilidad: `plans/reports/researcher-observability-d-20260520.md` §4 (Dashboard costes)
- DA-4 audit: `docs/audit/deep/DA-4-llm-voice-deep.md` — token_usage no persistido (F-DA-4)
- Informe Renzo: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf` §3 ⚠️ (widget mismo bug que WhatsApp)
- Origen del split: Sprint 3 plan.md (4-04 movida) + Sprint 1 phase-04 (2-36 movida)
