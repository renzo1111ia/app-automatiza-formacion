---
title: "Sprint 4 — Post-MVP: integraciones CRM adicionales"
description: "Google Sheets bidireccional, Salesforce, GoHighLevel, ActiveCampaign y generalización del Adapter pattern. Cada integración es un sub-sprint independiente."
status: pending
priority: P2
effort: 200h-370h (desglosado por fase)
branch: feature/sp-5-fase-5-post-release
sprint_id: SP-5
version_target: v0.5.0+ (incremental por integración)
tags: [crm, integrations, sheets, salesforce, ghl, activecampaign, adapter-pattern]
created: 2026-05-20
---

# Sprint 4 — Post-MVP: integraciones CRM adicionales

> Ref: [RoadMap.md — Fase 4](../RoadMap.md#fase-4--sprint-4-post-release) · [Sprint 2 plan](../260520-1342-sprint-2-adapter-hubspot-zoho/plan.md) · [ADR dependencias](../reports/adr-auditoria-dependencias-20260520.md) · [Research CRM](../../docs/audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md)

## Modelo de ejecución diferente

A diferencia de Sprints 1-4 (bloques monolíticos con PR único de cierre), **Sprint 4 es incremental**:

- Cada fase 5-01..5-04 es un **sub-sprint independiente** con su propia rama feature y PR
- No es necesario completar todas las integraciones antes de hacer release — cada una puede ir a producción por separado
- 5-05 (generalización) solo se ejecuta **tras completar las 4 integraciones**
- 5-06 (Tier 2) es **completamente on-demand** — no entra en estimación ni planificación proactiva
- Version bumps: cada integración completada → v0.5.x

## Fases

| # | Archivo | Tarea RoadMap | Est. | Estado |
|---|---------|---------------|------|--------|
| 1 | [phase-01-google-sheets-bidireccional.md](phase-01-google-sheets-bidireccional.md) | 5-01 | 60-100h | Pendiente |
| 2 | [phase-02-salesforce-adapter.md](phase-02-salesforce-adapter.md) | 5-02 | 60-100h | Pendiente |
| 3 | [phase-03-gohighlevel-adapter.md](phase-03-gohighlevel-adapter.md) | 5-03 | 40-80h | Pendiente |
| 4 | [phase-04-activecampaign-adapter.md](phase-04-activecampaign-adapter.md) | 5-04 | 20-50h | Pendiente |
| 5 | [phase-05-adapter-pattern-generalization.md](phase-05-adapter-pattern-generalization.md) | 5-05 | 20-40h | Pendiente (bloqueado hasta 5-01..5-04) |
| 6 | [phase-06-tier2-on-demand.md](phase-06-tier2-on-demand.md) | 5-06 | ~30-50h cada CRM | Backlog on-demand |
| 7 | [phase-07-cierre-sprint.md](phase-07-cierre-sprint.md) | SP-5-CLOSE-1..5 | 9-12h + bugs | Pendiente |

**Total Sprint 4 estimado**: 209-382h (excluyendo Tier 2 on-demand)

## Dependencias críticas con Sprint 2

- `IntegrationAdapter` base → implementado en 3-01
- Field mapping + write policy R-014 → 3-04
- UI admin de conexión → 3-05 (reusar patrones)
- Audit log `crm_write_audit` → 3-06

## Bloqueantes externos

- Sprint 2 debe estar **completado y en producción** antes de iniciar 5-01
- `jsforce@^3.10.15` requiere ADR aprobado antes de instalar (5-02)
- GHL: requiere app registrada en GHL Marketplace antes de 5-03
