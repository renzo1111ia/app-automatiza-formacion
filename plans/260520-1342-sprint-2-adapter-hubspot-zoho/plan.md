---
title: "Sprint 2 — Adapter Layer + HubSpot + Zoho MVP"
description: "Plan operativo Sprint 2: IntegrationAdapter interface, HubSpot OAuth2 adapter, Zoho multi-DC adapter, field mapping, UI admin, audit log."
status: pending
priority: P1
effort: 104h
branch: feature/sprint-02-adapter-hubspot-zoho
tags: [hubspot, zoho, crm, adapter-pattern, oauth2, multi-tenant, sprint-3]
created: 2026-05-20
---

# Sprint 2 — Plan Operativo

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| Sprint ID        | `SP-3`                                         |
| Versión objetivo | `v0.3.0`                                       |
| Estado           | Pendiente                                      |
| Estimación total | ~104h (rango: 96h–112h según sandbox blockers) |
| Rama sugerida    | `feature/sprint-02-adapter-hubspot-zoho`       |

## Dependencias críticas de Sprint 1

Sprint 2 **no puede iniciar** hasta que estén completas:

- **2-18** `integrations-repository.ts` — el adapter lee/escribe tokens desde este repo
- **2-11** Zod schemas de `integrations` — los tipos del adapter se derivan de estos schemas
- **2-26** Cifrado AES-256 de OAuth tokens en BD — prerequisito de seguridad para 3-02 y 3-03
- **2-23..2-25** RLS en tabla `integrations` — cada tenant solo ve sus propias integraciones

## Fases

| #   | Fase                                                   | Estimación | Estado    | Archivo                                               |
| --- | ------------------------------------------------------ | ---------- | --------- | ----------------------------------------------------- |
| 1   | IntegrationAdapter interface + factory                 | 12h        | Pendiente | [phase-01](phase-01-integration-adapter-interface.md) |
| 2   | Adapter HubSpot (OAuth2, contacts, deals, webhooks)    | 44h        | Pendiente | [phase-02](phase-02-adapter-hubspot.md)               |
| 3   | Adapter Zoho (OAuth2 multi-DC, leads, deals, webhooks) | 28h        | Pendiente | [phase-03](phase-03-adapter-zoho.md)                  |
| 4   | crm_field_mapping + write_policy (R-014)               | 14h        | Pendiente | [phase-04](phase-04-field-mapping-write-policy.md)    |
| 5   | UI admin panel — conectar CRM del tenant               | 20h        | Pendiente | [phase-05](phase-05-ui-admin-conexion-crm.md)         |
| 6   | crm_write_audit log + visualización                    | 10h        | Pendiente | [phase-06](phase-06-write-audit-y-visualizacion.md)   |
| 7   | Tests de integración sandbox HubSpot + Zoho            | 20h        | Pendiente | [phase-07](phase-07-tests-sandbox.md)                 |
| 8   | Cierre Sprint 2                                        | ~10h       | Pendiente | [phase-08](phase-08-cierre-sprint.md)                 |

## Diagrama de dependencias

```
Día 1+
  3.1 Interface + factory ──────────────────────────────┐
  3.4 field_mapping schema (solo tabla BD) ─────────────┤
                                                        │
Día 4+ (requiere 3.1 + deps Sprint 1)                   │
  3.2 HubSpot adapter ────────────────┐ paralelo        │
  3.3 Zoho adapter ───────────────────┤                 │
                                      │                 │
Día 10+ (requiere 3.2 + 3.3 + 3.4)   │                 │
  3.4 write_policy impl ──────────────┘                 │
  3.5 UI admin ─────────────────────────────────────────┤
  3.6 audit log + viz ──────────────────────────────────┤
                                                        │
Final (requiere 3.2..3.6)                               │
  3.7 Tests sandbox ────────────────────────────────────┘
  3.8 Cierre sprint
```

## Criterios de éxito globales (SP-3-CLOSE)

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm run build` success
- [ ] Tenant puede conectar cuenta HubSpot via OAuth2 desde UI admin
- [ ] Tenant puede conectar cuenta Zoho via OAuth2 desde UI admin
- [ ] Push de lead a HubSpot respeta R-014 append-only
- [ ] Push de lead a Zoho respeta R-014 append-only
- [ ] Webhook HubSpot valida firma `X-HubSpot-Signature-v3`
- [ ] Webhook Zoho valida token de canal
- [ ] `crm_write_audit` registra toda sobrescritura con `overwrite_with_audit`
- [ ] RLS: tenant solo ve sus propias integraciones
- [ ] Tests sandbox HubSpot + Zoho pasan

## Riesgos top-3

| Riesgo                                                  | Prob  | Impacto | Mitigación                                                                                                 |
| ------------------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Sprint 1 incompleto (2-18/2-26) bloquea inicio Sprint 2 | Media | Alto    | Verificar estado Sprint 1 antes de iniciar Sprint 2; tareas 3.1+3.4 schema pueden avanzar sin 2.3 completo |
| Zoho multi-DC: tenant en DC inesperado rompe calls      | Media | Alto    | Test obligatorio con tenant EU + tenant US; guardar api_domain en OAuth callback                           |
| HubSpot webhook loop infinito sin anti-loop             | Alta  | Medio   | Anti-loop property-based desde día 1 de 3-02, no retroactivo                                               |

## Notas SDKs

- **HubSpot:** instalar `@hubspot/api-client@^13.5.0` via ADR (ADR confirmado en `plans/reports/adr-auditoria-dependencias-20260520.md`)
- **Zoho:** REST pura con axios — SIN SDK npm (decisión ADR confirmada)

## Referencias

- RoadMap: `plans/RoadMap.md` líneas 268-305
- Decisiones R-014 (append-only) + R-016 (provider abstraction): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md`
- ADR deps: `plans/reports/adr-auditoria-dependencias-20260520.md`
- Research HubSpot: `plans/reports/researcher-hubspot-integration-20260520.md`
- Research Zoho: `plans/reports/researcher-zoho-integration-20260520.md`
- Sprint 1 plan: `plans/260520-1342-sprint-1-capa-datos/plan.md`
