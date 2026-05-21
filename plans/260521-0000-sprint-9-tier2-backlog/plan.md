---
title: "Sprint 9 — Tier 2 Backlog (on-demand)"
description: "Plan operativo Sprint 9: adapters Tier 2 (Clientify, Bitrix24, Pipedrive, Monday CRM, Holded) como placeholders on-demand — solo bajo pedido cliente."
status: backlog
priority: P3
effort: 30-50h por CRM (NO suma a total del sprint)
branch: feature/sp-9-{crm}-adapter (por CRM al activarse)
sprint_id: SP-9
version_target: v0.5.x (por CRM)
tags: [tier2, on-demand, backlog, clientify, bitrix24, pipedrive, monday, holded, sprint-9]
created: 2026-05-21
---

# Sprint 9 — Plan Operativo

| Campo | Valor |
|-------|-------|
| Sprint ID | `SP-9` |
| Versión objetivo | `v0.5.x` (por CRM) |
| Estado | **Backlog on-demand** |
| Estimación total | ~30-50h **cada CRM** (con Sprint 8 hecho) — NO suma proactivamente |
| Rama sugerida | `feature/sp-9-{crm}-adapter` por CRM |
| Source phase legacy | `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md` |

## Contexto

Adapters adicionales de CRMs Tier 2 (menor penetración). **No se planifica
proactivamente** — cada CRM se activa cuando un cliente lo pide explícitamente
y se aprueba el ROI.

Con Sprint 8 (generalización) completado, cada Tier 2 cuesta ~40% menos
(30-50h vs 60-100h originales).

## Modelo de ejecución

**NO se ejecuta en batch.** Cada fase es un placeholder independiente.
Para activar un CRM Tier 2:

1. Cliente (academia) solicita el conector explícitamente
2. Estimar ROI (¿cuántos tenants lo usarán?)
3. Aprobación de Renzo (usuario)
4. Activar fase Tier 2 correspondiente (crear plan detallado con phase files granulares)
5. Mini-sprint independiente con bump de versión propio

## Dependencias críticas

- **Sprint 8 completado** (genralización) — fuertemente recomendado, reduce esfuerzo ~40%
- Si Sprint 8 NO está hecho: estimación sube a 60-80h por CRM

## Fases (placeholders on-demand)

| # | CRM | Auth | Docs API | Est. con SP-8 | Est. sin SP-8 | Estado | Archivo |
|---|-----|------|----------|---------------|---------------|--------|---------|
| 1 | Clientify | API Key | Pobres | 30-50h | 60-80h | Backlog | [phase-01](phase-01-clientify.md) |
| 2 | Bitrix24 | OAuth2/webhook | Medias | 35-50h | 60-80h | Backlog | [phase-02](phase-02-bitrix24.md) |
| 3 | Pipedrive | OAuth2 | Excelentes | 25-35h | 50-70h | Backlog | [phase-03](phase-03-pipedrive.md) |
| 4 | Monday CRM | OAuth2 + GraphQL | Buenas | 40-60h | 70-100h | Backlog | [phase-04](phase-04-monday.md) |
| 5 | Holded | API Key | Razonables | 30-40h | 50-70h | Backlog | [phase-05](phase-05-holded.md) |
| 6 | Cierre genérico (template reutilizable) | — | — | — | — | Reference | [phase-06](phase-06-cierre-generico.md) |

**Total Sprint 9**: NO se suma — depende de qué CRMs se activan.

## Diagrama de dependencias

```
Prerequisito recomendado
  Sprint 8 generalización ────────────────────────┐
                                                  │
On-demand (paralelas, independientes)             │
  9.1 Clientify (si cliente lo pide) ─────────────┤
  9.2 Bitrix24  (si cliente lo pide) ─────────────┤
  9.3 Pipedrive (si cliente lo pide) ─────────────┤
  9.4 Monday    (si cliente lo pide) ─────────────┤
  9.5 Holded    (si cliente lo pide) ─────────────┤
                                                  │
Reference                                         │
  9.6 Cierre genérico template ───────────────────┘
```

## Criterios de éxito por CRM (genérico)

- [ ] Contact sync funcional (lead Esden → contact en CRM)
- [ ] Pasa `adapter.contract.test.ts` (Sprint 8)
- [ ] `IntegrationAdapter` interface implementada
- [ ] 0 dependencias nuevas de producción si es posible (REST puro)
- [ ] Documentación tenant + audit log
- [ ] RLS multi-tenant

## Riesgos top-3 (cross-CRM)

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| ROI insuficiente → CRM no rentable | Media | Bajo | Decisión tras evaluación; no implementar si <2 tenants |
| Docs API pobres (especialmente Clientify) | Alta | Medio | Spike de 4h antes de comprometer estimación |
| Sprint 8 NO está hecho → costo doble | Baja | Medio | Forzar Sprint 8 antes de cualquier Tier 2 |

## Notas SDKs

- Ninguno de los Tier 2 requiere dependencia nueva si se usa REST puro + axios
- Excepción: Monday usa GraphQL → evaluar si `graphql-request` simplifica (ADR previo)

## Referencias

- Phase legacy fuente: `plans/260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`
- Research CRM sector: `docs/audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md`
- Sprint 8 plan (generalización): `plans/260521-0000-sprint-8-generalization/plan.md`
