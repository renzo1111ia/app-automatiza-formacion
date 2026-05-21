---
title: "Sprint 5 — Salesforce Adapter (jsforce)"
description: "Plan operativo Sprint 5: Connected App + OAuth2, jsforce setup, mapping Lead/Contact/Opportunity, webhooks bidireccionales, UI admin, audit log y tests sandbox."
status: pending
priority: P2
effort: 60-100h
branch: feature/sprint-05-salesforce-adapter
sprint_id: SP-5
version_target: v0.5.1
tags: [salesforce, jsforce, oauth2, crm, integrations, sprint-5, post-mvp, enterprise]
created: 2026-05-21
---

# Sprint 5 — Plan Operativo

| Campo               | Valor                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Sprint ID           | `SP-5`                                                                 |
| Versión objetivo    | `v0.5.1`                                                               |
| Estado              | Pendiente                                                              |
| Estimación total    | ~60-100h                                                               |
| Rama sugerida       | `feature/sprint-05-salesforce-adapter`                                 |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md` |

## Contexto

Adapter Salesforce para tenants enterprise (universidades, escuelas de negocio).
OAuth2 Connected Apps + jsforce@3.x + sync Lead/Contact/Opportunity. Multi-tenant
con sandbox/prod por tenant.

## Dependencias críticas

- Sprint 2 (HubSpot/Zoho) **completado y en producción**
- ADR aprobado para `jsforce@^3.10.15` (proceso `af-agents:adr`) ANTES de instalar dep

## Fases

| #   | Fase                                                | Estimación   | Estado    | Archivo                                              |
| --- | --------------------------------------------------- | ------------ | --------- | ---------------------------------------------------- |
| 1   | Connected App + ADR jsforce + OAuth2 flow           | 10-14h       | Pendiente | [phase-01](phase-01-connected-app-oauth2.md)         |
| 2   | jsforce setup + DB migration + auth persistence     | 6-10h        | Pendiente | [phase-02](phase-02-jsforce-setup-migration.md)      |
| 3   | Leads + Contacts + Opportunities mapping            | 12-18h       | Pendiente | [phase-03](phase-03-leads-contacts-opportunities.md) |
| 4   | Webhooks bidireccional (Platform Events / outbound) | 10-16h       | Pendiente | [phase-04](phase-04-webhooks-bidireccional.md)       |
| 5   | UI admin (sandbox toggle + mapping)                 | 8-12h        | Pendiente | [phase-05](phase-05-ui-admin-sandbox.md)             |
| 6   | Audit log + rate limit handling                     | 4-8h         | Pendiente | [phase-06](phase-06-audit-rate-limit.md)             |
| 7   | Tests sandbox (Developer Edition free)              | 6-12h        | Pendiente | [phase-07](phase-07-tests-sandbox.md)                |
| 8   | Cierre Sprint 5 (typecheck/lint/build + E2E + PR)   | 4-10h + bugs | Pendiente | [phase-08](phase-08-cierre-sprint.md)                |

**Total**: 60-100h (coincide con rango original).

## Diagrama de dependencias

```
Día 1+
  5.1 ADR + Connected App + OAuth2 ─────────────┐
                                                │
Día 2+ (requiere 5.1)                           │
  5.2 jsforce + migration ──────────────────────┤
                                                │
Día 3+ (requiere 5.2)                           │
  5.3 Leads/Contacts/Opportunities ─────────────┤
                                                │
Día 6+ (requiere 5.3)                           │
  5.4 Webhooks bidireccional ───────────────────┤
  5.5 UI admin ─────────────────────────────────┤
  5.6 Audit + rate limit ───────────────────────┤
                                                │
Final                                           │
  5.7 Tests sandbox ────────────────────────────┘
  5.8 Cierre sprint
```

## Criterios de éxito globales (SP-5-CLOSE)

- [ ] Tenant conecta Salesforce (sandbox o prod) via OAuth2
- [ ] Push lead Esden → Lead/Contact upsert en SF (< 5 min)
- [ ] Push matrícula → Opportunity en SF
- [ ] Token expirado se renueva con `on('refresh')` listener
- [ ] `REQUEST_LIMIT_EXCEEDED` manejado con queue + backoff
- [ ] Webhook SF → Esden (Platform Events o Outbound Messages)
- [ ] Sandbox mode separado de producción
- [ ] `crm_write_audit` registra cada operación
- [ ] RLS multi-tenant
- [ ] `npm run typecheck` + `lint` + `build` + tests sin errores

## Riesgos top-3

| Riesgo                                   | Prob  | Impacto | Mitigación                                               |
| ---------------------------------------- | ----- | ------- | -------------------------------------------------------- |
| Connected App mal configurada por tenant | Alta  | Alto    | Guía paso a paso en UI + test connection                 |
| Sandbox vs prod confusión                | Media | Alto    | Toggle explícito + warning UI + columna `sf_environment` |
| API limits Edition (15k/día)             | Media | Medio   | BullMQ throttle per-tenant + alerta % cuota              |

## Notas SDKs

- `jsforce@^3.10.15` requiere ADR (`af-agents:adr`) — verificar Node 24 + Next 16 compat
- Sandbox endpoint: `https://test.salesforce.com`
- Production endpoint: `https://login.salesforce.com`

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- Research: `plans/260520-1342-sprint-4-post-mvp-crms/reports/researcher-salesforce-e-20260520.md`
- ADR deps: `plans/reports/adr-auditoria-dependencias-20260520.md`
- Sprint 2 plan: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md`
