---
title: "Sprint 7 — ActiveCampaign Adapter (API Key)"
description: "Plan operativo Sprint 7: API Key auth, contact/sync upsert, tags, deals, automations trigger, UI admin y tests."
status: pending
priority: P2
effort: 20-50h
branch: feature/sp-7-activecampaign-adapter
sprint_id: SP-7
version_target: v0.5.3
tags: [activecampaign, api-key, crm, integrations, sprint-7, post-mvp]
created: 2026-05-21
---

# Sprint 7 — Plan Operativo

| Campo | Valor |
|-------|-------|
| Sprint ID | `SP-7` |
| Versión objetivo | `v0.5.3` |
| Estado | Pendiente |
| Estimación total | ~20-50h |
| Rama sugerida | `feature/sp-7-activecampaign-adapter` |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md` |

## Contexto

Adapter más simple del bloque post-MVP — API Key auth (sin OAuth) + REST puro.
Candidato a "victoria rápida" tras Sprint 2. Rate limit restrictivo (5 req/s)
requiere throttling cuidadoso.

## Dependencias críticas

- Sprint 2 (HubSpot/Zoho) completado y en producción

## Fases

| # | Fase | Estimación | Estado | Archivo |
|---|------|-----------|--------|---------|
| 1 | API Key auth + DB migration | 3-6h | Pendiente | [phase-01](phase-01-api-key-auth-migration.md) |
| 2 | Contacts + Tags (contact/sync upsert) | 5-10h | Pendiente | [phase-02](phase-02-contacts-tags.md) |
| 3 | Deals + Automations sync | 4-8h | Pendiente | [phase-03](phase-03-deals-automations.md) |
| 4 | Webhook pull + idempotency | 3-8h | Pendiente | [phase-04](phase-04-webhook-pull.md) |
| 5 | UI admin (API Key + Account URL + mapping) | 3-8h | Pendiente | [phase-05](phase-05-ui-admin.md) |
| 6 | Tests + Cierre Sprint 7 (incluye PR) | 4-10h + bugs | Pendiente | [phase-06](phase-06-tests-cierre.md) |

**Total**: 22-50h (coincide con rango original 20-50h).

## Diagrama de dependencias

```
Día 1
  7.1 API Key auth + migration ─────────────┐
                                            │
Día 2+ (requiere 7.1)                       │
  7.2 Contacts + Tags ──────────────────────┤
  7.3 Deals + Automations ──────────────────┤
                                            │
Día 3+ (requiere 7.2)                       │
  7.4 Webhook pull ─────────────────────────┤
                                            │
Día 4+ (requiere 7.2 + 7.3 + 7.4)           │
  7.5 UI admin ─────────────────────────────┤
                                            │
Final                                       │
  7.6 Tests + Cierre ───────────────────────┘
```

## Criterios de éxito globales (SP-7-CLOSE)

- [ ] Tenant configura API Key + Account URL
- [ ] Push lead → Contact sync en AC < 2 min
- [ ] Tags aplicados según mapping
- [ ] Deal creado en pipeline AC si matrícula
- [ ] Automation triggered si configurado
- [ ] Webhook pull con idempotency
- [ ] Rate limit 5 req/s respetado (throttle 4 req/s)
- [ ] `crm_write_audit` completo
- [ ] RLS multi-tenant
- [ ] `typecheck` + `lint` + `build` + tests sin errores

## Riesgos top-3

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Rate limit 5 req/s en sync masivo | Alta | Medio | Throttle 4 req/s estricto |
| Webhook "at least once" duplicado | Alta | Bajo | sync_events idempotency |
| Custom field IDs varían por cuenta | Alta | Bajo | FieldMapper configurable |

## Notas SDKs

- **CERO dependencias** — REST puro con `axios`
- API Key en header `Api-Token`
- URL base por tenant: `https://{account}.api-us1.com/api/3`

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`
- Research: `plans/260520-1342-sprint-4-post-mvp-crms/reports/researcher-ghl-activecampaign-e-20260520.md`
- Sprint 2 plan: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md`
