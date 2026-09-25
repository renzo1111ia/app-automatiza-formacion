---
title: "Sprint 6 — GoHighLevel Adapter (OAuth2 v2)"
description: "Plan operativo Sprint 6: OAuth2 v2 setup, Contacts + Opportunities REST puro, webhooks HMAC, UI admin y tests."
status: pending
priority: P2
effort: 40-80h
branch: feature/sprint-06-ghl-adapter
sprint_id: SP-6
version_target: v0.5.2
tags: [gohighlevel, ghl, oauth2, crm, integrations, sprint-6, post-mvp, latam]
created: 2026-05-21
---

# Sprint 6 — Plan Operativo

| Campo               | Valor                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Sprint ID           | `SP-6`                                                                  |
| Versión objetivo    | `v0.5.2`                                                                |
| Estado              | Pendiente                                                               |
| Estimación total    | ~40-80h                                                                 |
| Rama sugerida       | `feature/sprint-06-ghl-adapter`                                         |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md` |

## Contexto

Adapter GoHighLevel para audiencia Latam EduTech (academias vía agencias).
OAuth2 v2 + REST puro con axios (CERO deps). Cada tenant = una Location en GHL.

## Dependencias críticas

- Sprint 2 completado y en producción
- App registrada en **GHL Marketplace** (prerequisito externo burocrático: 2-5 días hábiles)

## Fases

| #   | Fase                                              | Estimación   | Estado    | Archivo                                        |
| --- | ------------------------------------------------- | ------------ | --------- | ---------------------------------------------- |
| 1   | OAuth2 v2 setup + Marketplace app registry        | 6-12h        | Pendiente | [phase-01](phase-01-oauth2-v2-marketplace.md)  |
| 2   | Contacts + Opportunities REST puro                | 12-20h       | Pendiente | [phase-02](phase-02-contacts-opportunities.md) |
| 3   | Webhooks HMAC + idempotency                       | 8-14h        | Pendiente | [phase-03](phase-03-webhooks-hmac.md)          |
| 4   | UI admin (locationId + pipeline mapping)          | 6-12h        | Pendiente | [phase-04](phase-04-ui-admin-locationid.md)    |
| 5   | Tests (unit + integration sandbox)                | 4-10h        | Pendiente | [phase-05](phase-05-tests.md)                  |
| 6   | Cierre Sprint 6 (typecheck/lint/build + E2E + PR) | 4-12h + bugs | Pendiente | [phase-06](phase-06-cierre-sprint.md)          |

**Total**: 40-80h (coincide con rango original).

## Diagrama de dependencias

```
Prerequisito externo (en paralelo, antes del sprint)
  Registro app GHL Marketplace ──────────────────┐
                                                 │
Día 1+                                           │
  6.1 OAuth2 v2 setup ───────────────────────────┤
                                                 │
Día 3+ (requiere 6.1)                            │
  6.2 Contacts + Opportunities ──────────────────┤
  6.3 Webhooks HMAC ─────────────────────────────┤
                                                 │
Día 6+ (requiere 6.2 + 6.3)                      │
  6.4 UI admin ──────────────────────────────────┤
                                                 │
Final                                            │
  6.5 Tests ─────────────────────────────────────┘
  6.6 Cierre sprint
```

## Criterios de éxito globales (SP-6-CLOSE)

- [ ] Tenant conecta location GHL via OAuth2 v2
- [ ] Push lead → Contact en GHL < 5 min
- [ ] Push matrícula → Opportunity en pipeline GHL
- [ ] Webhook GHL → Esden con HMAC verificado
- [ ] Idempotency (no doble update)
- [ ] Rate limit 90 req/10s respetado (sin 429)
- [ ] `crm_write_audit` completo
- [ ] RLS multi-tenant
- [ ] `typecheck` + `lint` + `build` + tests sin errores

## Riesgos top-3

| Riesgo                                      | Prob  | Impacto | Mitigación                                     |
| ------------------------------------------- | ----- | ------- | ---------------------------------------------- |
| Registro GHL Marketplace tarda o se rechaza | Alta  | Alto    | Iniciar proceso ANTES del sprint (no bloquear) |
| API v2 docs incompletas                     | Media | Medio   | Test sandbox antes de implementar              |
| `locationId` confuso para tenant            | Media | Medio   | Mostrar locationId tras OAuth                  |

## Notas SDKs

- **CERO dependencias** — REST puro con `axios` ya en deps
- Endpoint base: `https://services.leadconnectorhq.com`
- API v1 EOL 31-dic-2025 → SOLO v2 OAuth

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md`
- Research: `plans/260520-1342-sprint-4-post-mvp-crms/reports/researcher-ghl-activecampaign-e-20260520.md`
- Research CRM Latam: `docs/audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md`
- Sprint 2 plan: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md`
