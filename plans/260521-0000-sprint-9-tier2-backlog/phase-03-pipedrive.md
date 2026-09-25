---
title: "9-03 — Pipedrive Adapter (on-demand)"
status: backlog
priority: P3
estimation: 25-35h (con SP-8) / 50-70h (sin SP-8)
phase_id: 9-03
sprint_id: SP-9
branch: feature/sprint-09-pipedrive-adapter (al activarse)
created: 2026-05-21
---

# Phase 03 — Pipedrive Adapter (placeholder on-demand)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`

## Overview

- **Prioridad:** P3 — **placeholder on-demand**
- **Estado:** Backlog
- **Audiencia:** genérica. Penetración baja en formación, base instalada legacy.
- **Complejidad:** Baja-media. API limpia, similar a HubSpot.

## Condiciones de activación

1. Tenant(s) con Pipedrive legacy lo solicitan
2. ROI positivo (mínimo 2 tenants)
3. Aprobación Renzo
4. Sprint 8 recomendado

## Spec API

- **Auth:** OAuth2
- **Base URL:** `https://api-proxy.pipedrive.com/api/v1/` (Marketplace) o `https://<company>.pipedrive.com/api/v1/`
- **Webhooks:** bien documentados (`person.added`, `person.updated`, `deal.added`, `deal.updated`)
- **Rate limit:** 100 req/2s por token (relajado)

## Template de mini-sprint

```
plans/YYMMDD-HHmm-sprint-9-03-pipedrive/
├── plan.md
├── phase-01-oauth2.md
├── phase-02-persons-deals.md
├── phase-03-webhook-pull.md
├── phase-04-ui-admin.md
└── phase-05-tests-cierre.md
```

## Pasos mínimos

1. Registrar app en Pipedrive Marketplace (sandbox primero)
2. `PipedriveAdapter implements IntegrationAdapter`
3. Person + Deal sync vía REST (sin SDK)
4. Webhook pull con verificación de origen
5. Tests + UI
6. PR + bump versión

## Estimación

- **Con Sprint 8:** 25-35h (el más rápido de Tier 2)
- **Sin Sprint 8:** 50-70h

## Success Criteria

- Person + Deal sync funcional
- Webhook pull con idempotency
- Pasa contract test
- 0 deps nuevas

## Risk Assessment

| Riesgo                                  | Prob  | Impacto | Mitigación                                         |
| --------------------------------------- | ----- | ------- | -------------------------------------------------- |
| Marketplace app review tarda            | Media | Bajo    | Docs Pipedrive son claras, review suele ser rápido |
| URL variable: company-specific vs proxy | Baja  | Bajo    | Almacenar URL completa                             |
| Custom fields IDs por cuenta            | Alta  | Bajo    | FieldMapper configurable                           |

## Next Steps

- Esperar pedido cliente
- Es el Tier 2 candidato a "victoria rápida" si se activa
