---
title: "Sprint 4 — Google Sheets bidireccional"
description: "Plan operativo Sprint 4: OAuth2 Google + plantillas Sheets por tenant, push lead → Sheet, pull Sheet → lead via Drive webhooks, conflict resolution R-014, UI admin y audit log."
status: pending
priority: P2
effort: 60-100h
branch: feature/sp-4-google-sheets
sprint_id: SP-4
version_target: v0.5.0
tags: [google-sheets, drive-api, oauth2, crm, integrations, sprint-4, post-mvp]
created: 2026-05-21
---

# Sprint 4 — Plan Operativo

| Campo | Valor |
|-------|-------|
| Sprint ID | `SP-4` |
| Versión objetivo | `v0.5.0` |
| Estado | Pendiente |
| Estimación total | ~60-100h |
| Rama sugerida | `feature/sp-4-google-sheets` |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` |

## Contexto

Sincronización bidireccional Esden ↔ Google Sheets. Primer post-MVP por valor diferencial:
muchas academias usan hojas de cálculo como CRM principal. `googleapis@171.4.0` YA INSTALADO
→ **cero dependencias nuevas**.

## Dependencias críticas

- Sprint 2 (HubSpot/Zoho adapters) **completado y en producción** — reutilizamos:
  - `IntegrationAdapter` interface
  - Tabla `crm_connections` + RLS
  - Tabla `crm_write_audit`
  - UI admin connection modal patterns
  - Write policy R-014

## Fases

| # | Fase | Estimación | Estado | Archivo |
|---|------|-----------|--------|---------|
| 1 | OAuth2 Google + Drive API setup | 6-10h | Pendiente | [phase-01](phase-01-oauth2-drive-setup.md) |
| 2 | Template Sheets por tenant + DB migration | 6-10h | Pendiente | [phase-02](phase-02-templates-tenant-migration.md) |
| 3 | Push leads (Esden → Sheet) bidireccional | 10-16h | Pendiente | [phase-03](phase-03-push-leads-bidireccional.md) |
| 4 | Pull leads (Sheet → Esden) + conflict resolution R-014 | 10-16h | Pendiente | [phase-04](phase-04-pull-conflict-resolution.md) |
| 5 | UI admin (formulario conexión + mapping) | 8-12h | Pendiente | [phase-05](phase-05-ui-admin-conexion.md) |
| 6 | Audit log + canal Drive renovación | 6-10h | Pendiente | [phase-06](phase-06-audit-log-canal-renew.md) |
| 7 | Tests (unit + integration con spreadsheet real) | 8-14h | Pendiente | [phase-07](phase-07-tests-integration.md) |
| 8 | Cierre Sprint 4 (typecheck/lint/build + E2E + PR) | 6-12h + bugs | Pendiente | [phase-08](phase-08-cierre-sprint.md) |

**Total**: 60-100h (coincide con rango original).

## Diagrama de dependencias

```
Día 1+
  4.1 OAuth2 Google + Drive setup ──────────────┐
  4.2 Template + DB migration ──────────────────┤
                                                │
Día 3+ (requiere 4.1 + 4.2)                     │
  4.3 Push leads bidireccional ─────────────────┤
  4.4 Pull + conflict resolution ───────────────┤
                                                │
Día 6+ (requiere 4.3 + 4.4)                     │
  4.5 UI admin ─────────────────────────────────┤
  4.6 Audit log + canal renew ──────────────────┤
                                                │
Final                                           │
  4.7 Tests integration ────────────────────────┘
  4.8 Cierre sprint
```

## Criterios de éxito globales (SP-4-CLOSE)

- [ ] Tenant conecta cuenta Google via OAuth2 desde UI admin
- [ ] Push Esden → Sheet < 5 min latencia
- [ ] Pull Sheet → Esden < 5 min latencia (vía Drive webhook)
- [ ] Sin duplicados (idempotencia por `_esden_updated_at`)
- [ ] Sin bucle push/pull infinito
- [ ] Canal Drive renovado antes de TTL 7 días
- [ ] `crm_write_audit` registra todo sync
- [ ] RLS tenant-only en `crm_connections`
- [ ] `npm run typecheck` + `lint` + `build` + tests sin errores

## Riesgos top-3

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Bucle push/pull infinito | Media | Alto | Campo `_esden_updated_at` + cooldown 30s |
| Canal Drive expirado silenciosamente | Alta | Medio | BullMQ cron día 6 + alerta si falla renovación |
| Cuota 429 Sheets en sync masivo | Baja-Media | Medio | Batch writes + exponential backoff |

## Notas SDKs

- `googleapis@171.4.0` YA en `package.json` — no se añade dependencia
- Scopes: `https://www.googleapis.com/auth/spreadsheets` + `https://www.googleapis.com/auth/drive.file`

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md`
- Research: `plans/260520-1342-sprint-4-post-mvp-crms/reports/researcher-google-sheets-e-20260520.md`
- ADR deps: `plans/reports/adr-auditoria-dependencias-20260520.md`
- Sprint 2 plan (base IntegrationAdapter): `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md`
