---
title: "9-04 — Monday CRM Adapter (on-demand)"
status: backlog
priority: P3
estimation: 40-60h (con SP-8) / 70-100h (sin SP-8)
phase_id: 9-04
sprint_id: SP-9
branch: feature/sprint-09-monday-adapter (al activarse)
created: 2026-05-21
---

# Phase 04 — Monday CRM Adapter (placeholder on-demand)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`

## Overview

- **Prioridad:** P3 — **placeholder on-demand**
- **Estado:** Backlog
- **Audiencia:** equipos de gestión de proyectos. Fit BAJO con formación — solo si tenant tiene Monday como CRM corporativo.
- **Complejidad:** Media-alta — **GraphQL en vez de REST** (único Tier 2 con esta característica).

## Condiciones de activación

1. Cliente específico lo pide con ROI muy claro (no es prioritario para sector)
2. Aprobación Renzo + evaluación esfuerzo extra por GraphQL
3. Sprint 8 muy recomendado (la generalización ayuda a aislar GraphQL del resto)

## Spec API

- **Auth:** OAuth2 + GraphQL
- **Base URL:** `https://api.monday.com/v2/`
- **Body:** GraphQL queries/mutations
- **Webhooks:** soportados (notifications via items_create, change_column_value)
- **Rate limit:** 5000 puntos/min (complejidad-based, no req-based)

## Spike obligatorio

- 6h de exploración GraphQL queries básicas (items, columns, boards)
- Evaluar si añadir `graphql-request` (ADR) o usar fetch nativo con queries strings
- Probar webhook subscription

## Template de mini-sprint

```
plans/YYMMDD-HHmm-sprint-9-04-monday/
├── plan.md
├── phase-01-oauth2-graphql-setup.md
├── phase-02-items-columns-mapping.md
├── phase-03-webhook-pull.md
├── phase-04-ui-admin (con boardId selector).md
└── phase-05-tests-cierre.md
```

## Pasos mínimos

1. Spike GraphQL (6h)
2. ADR `graphql-request` (si se decide instalar)
3. `MondayAdapter implements IntegrationAdapter`
4. FieldMapper specifically para columns Monday (cada column tiene tipo)
5. Webhook subscription via mutation
6. UI: selector de board + mapping columnas
7. Tests + PR

## Estimación

- **Con Sprint 8:** 40-60h
- **Sin Sprint 8:** 70-100h
- **Spike obligatorio:** 6h fixed

## Success Criteria

- Items + columns sync funcional
- Pasa contract test
- FieldMapper soporta column types Monday (text, status, person, date)

## Risk Assessment

| Riesgo                                                    | Prob  | Impacto | Mitigación                                                                         |
| --------------------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------------- |
| GraphQL incompatible con IntegrationAdapter REST-oriented | Media | Alto    | Métodos opcionales en interfaz (Sprint 8) + adapter encapsula GraphQL internamente |
| Column types complejos (status, dropdown)                 | Alta  | Medio   | FieldMapper específico por column type                                             |
| Rate limit basado en complejidad de query                 | Media | Medio   | Optimizar queries + cache resultados                                               |

## Next Steps

- Esperar pedido cliente específico
- Es el Tier 2 menos prioritario para el sector formación
