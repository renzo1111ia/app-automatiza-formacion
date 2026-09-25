# Planner Report — Sprint 1 Operativo — 20-05-2026

**Agente:** planner
**Fecha:** 20-05-2026
**Plan creado:** `plans/260520-1342-sprint-1-capa-datos/`

---

## Resumen

Plan operativo de Sprint 1 (Fase 1 — Capa de datos) creado con 8 fases. Incorpora las 29 tareas originales del RoadMap (1-01..1-29), 5 tareas nuevas del ADR audit (1-30..1-35), y la reasignación de 1-27 a Sprint 0. El plan mapea solapes con el plan RLS existente en lugar de duplicarlos.

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `plans/260520-1342-sprint-1-capa-datos/plan.md` | Overview <80 líneas, tabla de fases, diagrama ASCII, criterios globales |
| `plans/260520-1342-sprint-1-capa-datos/phase-01-unificacion-cliente-supabase.md` | 1-01..1-03 + upgrade ssr/supabase-js conjunto |
| `plans/260520-1342-sprint-1-capa-datos/phase-02-schemas-zod.md` | 1-04..1-11, convención naming, prep Fase 2 |
| `plans/260520-1342-sprint-1-capa-datos/phase-03-repository-pattern.md` | 1-12..1-18, interface base, 7 repositorios |
| `plans/260520-1342-sprint-1-capa-datos/phase-04-refactor-queries.md` | 1-19..1-21, queries inline → repositorios |
| `plans/260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md` | 1-22 (426→<85 `as any`) + 1-31 + 1-33 + 1-34 + 1-35 ADR |
| `plans/260520-1342-sprint-1-capa-datos/phase-06-rls-hardening-complementario.md` | 1-23..1-26; 1-27 marcada movida a A-26 |
| `plans/260520-1342-sprint-1-capa-datos/phase-07-testing-documentacion.md` | 1-28, 1-29, SP-B-CLOSE-1..5 |
| `plans/260520-1342-sprint-1-capa-datos/phase-08-hook-automation.md` | 1-30: af-productivity-logger.cjs |
| `plans/reports/planner-sprint-1-operativo-20260520.md` | Este reporte |

---

## Mapa de tareas nuevas (ADR → Sprint 1)

| ID | Descripción | Fase | Estimación | Status |
|----|-------------|------|-----------|--------|
| 1-30 | Hook af-productivity-logger.cjs | 08 | 6h | Nuevo |
| 1-31 | lucide-react 0.x → 1.16.0 (major) | 05 | 4h | Nuevo |
| 1-32 | shadcn 3.x → 4.x (major) | — | — | **APLAZADO Sprint 3** (CLI tool, 0 impacto runtime) |
| 1-33 | @types/node ^20 → ^24 (alinear Node 24) | 05 | 2h | Nuevo |
| 1-34 | Investigar eslint 9→10 (peer dep bloqueante) | 05 | 2h | Nuevo (solo investigación) |
| 1-35 | langchain 1.2.39→1.4.1 + anthropic en bloque | 05 | 3h | Nuevo (MED-002/005) |

**1-27 (next@16.2.6):** Movida a Sprint 0 como A-26. CVSS 8.6/8.1 near-critical justifica adelanto. Resta 6h del total Sprint 1.

---

## Solapes con plan RLS mapeados

| Phase RLS | Corresponde a | Tratamiento en Sprint 1 |
|-----------|--------------|------------------------|
| phase-03 | 1-23..1-25 (RLS policies) | Phase 06 referencia + no duplica steps SQL |
| phase-04 | 1-02 (refactor clientes Supabase) | Phase 01 referencia steps |
| phase-05 | 1-12..1-18 (Repository pattern + Zod) | Phase 03 referencia interface base |
| phase-06 | 1-21 (workers/webhooks) | Phase 04 referencia steps worker |
| phase-07 | Tests anti-fuga | Phase 07 incorpora como parte de suite |
| phase-08 | Docs y rollout | Phase 07 coordina con 1-29 |

---

## Dependencias críticas

```
Fase 01 (Supabase unificado)  ──┐
Fase 02 (Zod schemas)          ├──→ Fase 03 (Repos) ──→ Fase 04 (Refactor) ──→ Fase 07 (Tests)
                                │                    ↗
Fase 05 (Type safety) ─────────┘  [paralelo con 04]
Fase 06 (RLS) ─────────────────────────────────────────────────────────→ Fase 07 (Tests)
Fase 08 (Hook 1-30) ───────────────── independiente, cualquier momento
```

---

## Total horas estimadas

| Bloque | Horas |
|--------|-------|
| Fase 01 — Unificación Supabase (1-01..1-03 + upgrade ssr) | 19h |
| Fase 02 — Zod schemas (1-04..1-11) | 23h |
| Fase 03 — Repository pattern (1-12..1-18) | 31h |
| Fase 04 — Refactor queries (1-19..1-21) | 18h |
| Fase 05 — Type safety + ADR (1-22, 1-31, 1-33, 1-34, 1-35) | 27h |
| Fase 06 — RLS hardening (1-23..1-26; sin 1-27) | 19h |
| Fase 07 — Testing + docs (1-28, 1-29, SP-B-CLOSE) | 19h |
| Fase 08 — Hook automation (1-30) | 6h |
| **TOTAL** | **162h** |

> RoadMap original: ~158h. +20h tareas ADR nuevas. -6h 1-27 movida Sprint 0. -10h 1-32 aplazada Sprint 3. = **~162h** (dentro del rango 120-160h previsto + ajuste ADR).

Con paralelismo de 2-3 agentes: **~75-90h reales (3-4 semanas)**.

---

## Preguntas abiertas

1. ¿1-27 (next@16.2.6) ya tiene tarea A-26 creada en `plans/260520-1342-sprint-0-hotfixes-seguridad/phase-06-otros-criticos.md`? Si no existe ese archivo, hay que crearlo.
2. ¿La BD de test para Fase 07 está disponible en Easypanel o hay que provisionar una Supabase local?
3. ¿1-35 (langchain upgrade) requiere verificación con los otros providers `@langchain/openai` y `@langchain/google-genai` además de `@langchain/anthropic`? El ADR solo menciona anthropic explícitamente.
4. ¿El SDK de hooks de Claude Code permite invocar agentes desde PostToolUse, o solo emitir `additionalContext`? Esto determina la complejidad de 1-30.

---

**Status:** DONE
**Summary:** Plan operativo Sprint 1 creado en 9 archivos. 8 fases con 34 tareas totales (1-01..1-29 originales + 1-30..1-35 ADR). 1-27 reasignada a Sprint 0. 1-32 aplazada Sprint 3. Solapes con plan RLS mapeados sin duplicación. Total estimado ~162h.
