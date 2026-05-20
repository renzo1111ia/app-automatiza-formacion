---
title: "Sprint 1 — Hotfixes de seguridad"
description: "Cierre de 26 vulnerabilidades críticas/high antes de cualquier feature. Objetivo: v0.1.0."
status: pending
priority: P1
effort: 105h 30min base (+ 1h condicional si 1-06 usa pg directo → 106h 30min max)
branch: feature/sp-1-sprint-1-hotfixes
sprint_id: SP-1
version_target: v0.1.0
tags: [security, rls, auth, webhooks, bullmq, hotfix, deps]
created: 2026-05-20
updated: 2026-05-20
---

# Sprint 1 — Hotfixes de seguridad

> Ref: [RoadMap.md — Fase 1](../RoadMap.md) · [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) · [Plan RLS existente](../20260519-1200-rls-multitenant-hardening/plan.md)

## Fases

| # | Archivo | Tareas | Est. | Estado |
|---|---------|--------|------|--------|
| 1 | [phase-01-orquestador-bullmq.md](phase-01-orquestador-bullmq.md) | 1-01, 1-02 | 7h | 🔘 Pendiente |
| 2 | [phase-02-secretos-y-credenciales.md](phase-02-secretos-y-credenciales.md) | 1-03, 1-04, 1-05, 1-06 | 12h base (+1h cond.) | 🔘 Pendiente |
| 3 | [phase-03-endpoints-sin-auth.md](phase-03-endpoints-sin-auth.md) | 1-07, 1-08, 1-09, 1-10, 1-11 | 17h | 🔘 Pendiente |
| 4 | [phase-04-webhooks-y-firmas.md](phase-04-webhooks-y-firmas.md) | 1-12, 1-13, 1-14, 1-15 | 18h | 🔘 Pendiente |
| 5 | [phase-05-privilege-escalation-rls.md](phase-05-privilege-escalation-rls.md) | 1-16, 1-17, 1-18, 1-19, 1-20, 1-21 | 24h | 🔘 Pendiente |
| 6 | [phase-06-otros-criticos.md](phase-06-otros-criticos.md) | 1-22, 1-23, 1-24, 1-25, 1-26 | 23h | 🔘 Pendiente |
| 7 | [phase-07-cierre-sprint.md](phase-07-cierre-sprint.md) | SP-1-CLOSE-1..5 + 5-bis | 5h 30min + bugs + variable clienta | 🔘 Pendiente |

**Total desarrollo:** ~101h base (102h max con 1-06 pg directo) · **Total con cierre:** ~106h 30min base + bugs
**Desglose delta v2**: Ph3 +1h 30min (1-09) · Ph4 +2h (1-15) · Ph6 +2h (1-22) · Ph2 +1h condicional (1-06)
**Desglose delta v3 (ADR audit)**: Ph6 +3h (1-25 crypto deprecated) · Ph6 +4h (1-26 next@16.2.6 adelantado de 2-27)

## Dependencias entre fases y orden óptimo

```
SERIE OBLIGATORIA:
  1-26 (next 16.2.6) → 1-07, 1-08, 1-16, 1-17 [middleware bypass activo sin este fix]
  1-03 → 1-04 bloquean deploy prod
  Ph2 (secretos) → deploy con keys rotadas → resto en paralelo

ORDEN ÓPTIMO — 1 dev:
  Ph6-1-26 (PRIMERO, bloquea Ph3+Ph5) → Ph2 → Ph1 → Ph3 → Ph4 → Ph5 → Ph6-resto → Ph7

ORDEN ÓPTIMO — 2 devs (paralelismo máximo):
  Día 1 simultáneo: Ph6-1-26 (dev A, ADR obligatorio) + Ph2 (dev B) + Ph6-1-24/1-25 (dev B paralelizable)
  Día 2 simultáneo: Ph1 (dev A) + Ph3 (dev B, desbloqueada por 1-26)
  Día 3 simultáneo: Ph4 (dev A) + Ph5 (dev B, desbloqueada por 1-26)
  Día 4: Ph6-1-22/1-23 (dev A o B) + Ph7 (cierre, requiere todo en 🔵)

PARALELIZABLES (no se pisan archivos):
  - Ph1: worker.js + queue/lead-sequence-queue.ts
  - Ph2-1-05/1-06: Postgres password/user (acción DB, no código)
  - Ph6-1-24: package.json (axios upgrade vía adr)
  - Ph6-1-25: package.json + grep imports crypto (sin conflicto con 1-24 si en mismo commit)
  - Ph6-1-26: package.json (next bump — DEBE hacerse ANTES que Ph3 y Ph5)
```

## Solape con plan RLS existente

El plan `plans/20260519-1200-rls-multitenant-hardening/` cubre su **Fase 1** (hotfix vulnerabilidades H1-H4).
Mapeo explícito para evitar duplicación:

| Tarea Sprint 1 | Cubierta en plan RLS | Acción en este plan |
|---|---|---|
| 1-03 (rotar JWTs) | phase-01 Paso 3 | Referir, no duplicar steps |
| 1-04 (quitar JWTs hardcoded) | phase-01 Pasos 2+5 | Referir, no duplicar steps |
| 1-18 (RLS tenants USING true) | phase-01 Paso 1 | Referir, no duplicar steps |
| 1-16 (privilege escalation is_admin) | DA-2-005 — NO cubierto en plan RLS | Implementar en Ph5 |

## Criterios de éxito del Sprint 1

- [ ] 0 credenciales hardcoded en `src/` (`grep -rE "(eyJhbGci|FALLBACK_)" src/` → sin resultados)
- [ ] 0 endpoints de orquestación sin auth accesibles desde internet
- [ ] 0 webhooks con validación de firma omitida incondicionalmente
- [ ] `worker.js:58` firma corregida — flujo multi-día funciona en tests
- [ ] RLS `tenants` no devuelve registros ajenos a usuario autenticado
- [ ] `SP-1-CLOSE-1` typecheck + lint + build + tests → 0 errores
- [ ] `CHANGELOG.md` entrada `## [v0.1.0]` completa (gatekeeper deployment)
- [ ] Todas las tareas en 🔵 o 🟢 antes de SP-1-CLOSE-5

## Tracking de tiempos

Cada tarea de este sprint tiene log detallado en `plans/logs/sprint-1/1-XX.log.md`.
Resumen agregado del sprint en `plans/logs/sprint-1/sprint-1.log.md`.

Responsabilidades:
- `roadmap-keeper`: actualiza estado visible (🔘→🟡→🟠→🔵→🟢) en `plans/RoadMap.md`.
- `productivity` (logger): registra eventos detallados con timestamp en `plans/logs/sprint-1/`.

Cada cambio de estado dispara ambos agentes via hook.

## Dependencias críticas entre tareas (v3)

**1-26 DEBE completarse ANTES de:**
- 1-07, 1-08 (Ph3 — endpoints sin auth): el middleware bypass CVE GHSA-492v-c6pp-mqqv anula la auth añadida por estas tareas si next sigue en 16.1.6.
- 1-16, 1-17 (Ph5 — privilege escalation): el middleware bypass también invalida las protecciones de `app_metadata` si next no está parcheado.

**1-25 es paralelizable** con cualquier tarea — solo toca `package.json` + imports `src/`. Sin conflicto de archivos con Ph1-Ph5.

**2-27 (Sprint 2) queda marcada como MOVIDA A 1-26**: la tarea 2-27 del plan Sprint 2 planificaba el update de next con 6h estimadas (asumiendo posible major). Dado que es minor (16.1.6 → 16.2.6), la estimación baja a 4h. Actualizar Sprint 2 en fase de planificación.

## Top-5 riesgos del Sprint

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| Rotación JWTs rompe servicios en producción | Alta | Crítico | Ph2 primero; coordinar ventana de mantenimiento; env vars antes de deploy |
| next@16.2.6 introduce regresión en middleware o Server Actions | Media | Alto | Smoke test manual rutas críticas (login, dashboard, api/auth) + rollback inmediato si falla |
| Fix BullMQ worker.js introduce regresión en flujo existente | Media | Alto | Tests de integración previos + feature flag desactivable |
| crypto@1.0.1 removal — import olvidado en algún archivo | Baja | Medio | `grep -r "from 'crypto'" src/` exhaustivo antes de cerrar 1-25 |
| axios upgrade rompe API calls existentes (breaking changes) | Media | Medio | Pasar por `esden-agents:adr`; comparar CHANGELOG axios 1.x→2.x |
