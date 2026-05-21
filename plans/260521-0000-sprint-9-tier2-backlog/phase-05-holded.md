---
title: "9-05 — Holded Adapter (on-demand)"
status: backlog
priority: P3
estimation: 30-40h (con SP-8) / 50-70h (sin SP-8)
phase_id: 9-05
sprint_id: SP-9
branch: feature/sp-9-holded-adapter (al activarse)
created: 2026-05-21
---

# Phase 05 — Holded Adapter (placeholder on-demand)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`

## Overview

- **Prioridad:** P3 — **placeholder on-demand**
- **Estado:** Backlog
- **Audiencia:** PYME española. ERP + CRM combinado.
- **Complejidad:** Media. Modelo de datos mezcla ERP (facturas, productos) con CRM.

## Condiciones de activación

1. Academia ya usa Holded como ERP y quiere sync de leads
2. ROI positivo
3. Aprobación Renzo
4. Sprint 8 recomendado

## Spec API

- **Auth:** API Key (simple)
- **Base URL:** `https://api.holded.com/api/`
- **Headers:** `key: <api_key>`
- **Webhooks:** soportados con limitaciones
- **Rate limit:** 5 req/s (similar a AC)

## Template de mini-sprint

```
plans/YYMMDD-HHmm-sprint-9-05-holded/
├── plan.md
├── phase-01-api-key-auth.md
├── phase-02-contacts-y-leads.md
├── phase-03-webhook-pull.md
├── phase-04-ui-admin.md
└── phase-05-tests-cierre.md
```

## Pasos mínimos

1. Spike 3h (ya que docs son razonables, no necesita 4h)
2. `HoldedAdapter implements IntegrationAdapter`
3. Contact + Lead sync via REST + API Key
4. Webhook pull con verificación básica
5. UI admin (similar a AC, sin OAuth wizard)
6. Tests + PR

## Estimación

- **Con Sprint 8:** 30-40h
- **Sin Sprint 8:** 50-70h

## Success Criteria

- Contact sync funcional
- Pasa contract test
- 0 deps nuevas
- Doc tenant para setup API Key

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Modelo de datos ERP+CRM confuso | Media | Bajo | Solo mapear entidad "contact" + "lead", ignorar entidades ERP-only |
| Rate limit 5 req/s | Media | Bajo | Throttle 4 req/s (igual que AC) |
| Webhooks limitados | Media | Bajo | Polling fallback si necesario |

## Próximos pasos

- Esperar academia con Holded como ERP que solicite integración
- Es el más simple del Tier 2 (auth simple + docs OK)
