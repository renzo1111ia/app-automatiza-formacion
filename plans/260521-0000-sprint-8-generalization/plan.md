---
title: "Sprint 8 — Generalización del Adapter Pattern"
description: "Plan operativo Sprint 8: análisis de duplicaciones tras 4+ adapters reales, refactor a IntegrationAdapter base genérico, FieldMapper universal, WritePolicy R-014, CRM factory y contract test."
status: pending
priority: P3
effort: 20-40h
branch: feature/sprint-08-adapter-generalization
sprint_id: SP-8
version_target: v0.5.4 (patch refactor)
tags: [refactor, adapter-pattern, generalization, sprint-8, yagni]
created: 2026-05-21
---

# Sprint 8 — Plan Operativo

| Campo               | Valor                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| Sprint ID           | `SP-8`                                                                             |
| Versión objetivo    | `v0.5.4` (patch — refactor sin nueva funcionalidad)                                |
| Estado              | Pendiente                                                                          |
| Estimación total    | ~20-40h                                                                            |
| Rama sugerida       | `feature/sprint-08-adapter-generalization`                                         |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md` |

## Contexto

YAGNI: refactor para EXTRAER lo común **observado** en 4+ adapters reales,
no lo asumido. Hasta tener 4 adapters productivos no se ejecuta.

## Dependencias críticas

- **Mínimo 4 adapters CRM productivos** entre Sprints 2-7:
  - Sprint 2: HubSpot + Zoho (2)
  - Sprint 4: Google Sheets (3)
  - Sprint 5: Salesforce (4) → ya hay 4
  - Sprint 6: GHL (5)
  - Sprint 7: ActiveCampaign (6)
- Idealmente con 6 adapters productivos para refactor más rico

## Fases

| #   | Fase                                                                        | Estimación  | Estado    | Archivo                                           |
| --- | --------------------------------------------------------------------------- | ----------- | --------- | ------------------------------------------------- |
| 1   | Análisis de duplicaciones reales en N adapters                              | 3-6h        | Pendiente | [phase-01](phase-01-analisis-duplicaciones.md)    |
| 2   | Refactor IntegrationAdapter base + FieldMapper + WritePolicy + AdapterError | 8-14h       | Pendiente | [phase-02](phase-02-refactor-base.md)             |
| 3   | CRM factory dinámico + refactor de cada adapter existente                   | 4-10h       | Pendiente | [phase-03](phase-03-factory-refactor-adapters.md) |
| 4   | Docs (ADR) + contract.test.ts + verificar 0 regresiones                     | 3-6h        | Pendiente | [phase-04](phase-04-docs-contract-test.md)        |
| 5   | Cierre Sprint 8 (typecheck/lint/build + 0 regresiones + PR)                 | 2-4h + bugs | Pendiente | [phase-05](phase-05-cierre-sprint.md)             |

**Total**: 20-40h (coincide con rango original).

## Diagrama de dependencias

```
Día 1
  8.1 Análisis duplicaciones ─────────────┐
                                          │
Día 2+ (requiere 8.1)                     │
  8.2 Refactor base ──────────────────────┤
                                          │
Día 3+ (requiere 8.2)                     │
  8.3 Factory + refactor adapters ────────┤
                                          │
Día 5+ (requiere 8.3)                     │
  8.4 Docs + contract test ───────────────┤
                                          │
Final                                     │
  8.5 Cierre sprint ──────────────────────┘
```

## Criterios de éxito globales (SP-8-CLOSE)

- [ ] Interfaz `IntegrationAdapter` definitiva con 5-7 métodos core + opcionales
- [ ] N adapters (mínimo 4) hacen `implements IntegrationAdapter`
- [ ] `FieldMapper` único usado por todos
- [ ] `applyWritePolicy()` única usada por todos
- [ ] `adapter-error.ts` tipificado
- [ ] `adapter.contract.test.ts` verde para todos los adapters
- [ ] 0 regresiones en tests existentes
- [ ] 0 cambios de comportamiento (refactor puro)
- [ ] `typecheck` + `lint` + `build` sin errores

## Riesgos top-3

| Riesgo                                              | Prob  | Impacto | Mitigación                                       |
| --------------------------------------------------- | ----- | ------- | ------------------------------------------------ |
| Sobreabstracción → interfaz que no encaja con todos | Media | Alto    | Interfaz estrecha (7 métodos max), opcionales    |
| Regresión en producción por refactor                | Baja  | Alto    | 0 cambios de comportamiento, tests antes/después |
| Sprint bloqueado si <4 adapters listos              | Media | Bajo    | Sprint 8 es P3 — diferible sin impacto funcional |

## Notas SDKs

- **NO se añaden dependencias nuevas** — refactor puro
- Inspiración: Stripe PaymentMethod, Shopify FulfillmentService, Twilio MessageChannel

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md`
- Research: `plans/260520-1342-sprint-4-post-mvp-crms/reports/researcher-adapter-pattern-generalization-e-20260520.md`
- Sprint 2 plan (base original): `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md`
