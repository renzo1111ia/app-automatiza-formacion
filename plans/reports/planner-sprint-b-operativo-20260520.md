# Planner Report — Sprint B Operativo — 20-05-2026

**Agente:** planner
**Fecha:** 20-05-2026
**Plan creado:** `plans/260520-1342-sprint-b-capa-datos/`

---

## Resumen

Plan operativo de Sprint B (Fase B — Capa de datos) creado con 8 fases. Incorpora las 29 tareas originales del RoadMap (B-01..B-29), 5 tareas nuevas del ADR audit (B-30..B-35), y la reasignación de B-27 a Sprint A. El plan mapea solapes con el plan RLS existente en lugar de duplicarlos.

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `plans/260520-1342-sprint-b-capa-datos/plan.md` | Overview <80 líneas, tabla de fases, diagrama ASCII, criterios globales |
| `plans/260520-1342-sprint-b-capa-datos/phase-01-unificacion-cliente-supabase.md` | B-01..B-03 + upgrade ssr/supabase-js conjunto |
| `plans/260520-1342-sprint-b-capa-datos/phase-02-schemas-zod.md` | B-04..B-11, convención naming, prep Fase C |
| `plans/260520-1342-sprint-b-capa-datos/phase-03-repository-pattern.md` | B-12..B-18, interface base, 7 repositorios |
| `plans/260520-1342-sprint-b-capa-datos/phase-04-refactor-queries.md` | B-19..B-21, queries inline → repositorios |
| `plans/260520-1342-sprint-b-capa-datos/phase-05-type-safety-y-limpieza.md` | B-22 (426→<85 `as any`) + B-31 + B-33 + B-34 + B-35 ADR |
| `plans/260520-1342-sprint-b-capa-datos/phase-06-rls-hardening-complementario.md` | B-23..B-26; B-27 marcada movida a A-26 |
| `plans/260520-1342-sprint-b-capa-datos/phase-07-testing-documentacion.md` | B-28, B-29, SP-B-CLOSE-1..5 |
| `plans/260520-1342-sprint-b-capa-datos/phase-08-hook-automation.md` | B-30: esden-productivity-logger.cjs |
| `plans/reports/planner-sprint-b-operativo-20260520.md` | Este reporte |

---

## Mapa de tareas nuevas (ADR → Sprint B)

| ID | Descripción | Fase | Estimación | Status |
|----|-------------|------|-----------|--------|
| B-30 | Hook esden-productivity-logger.cjs | 08 | 6h | Nuevo |
| B-31 | lucide-react 0.x → 1.16.0 (major) | 05 | 4h | Nuevo |
| B-32 | shadcn 3.x → 4.x (major) | — | — | **APLAZADO Sprint D** (CLI tool, 0 impacto runtime) |
| B-33 | @types/node ^20 → ^24 (alinear Node 24) | 05 | 2h | Nuevo |
| B-34 | Investigar eslint 9→10 (peer dep bloqueante) | 05 | 2h | Nuevo (solo investigación) |
| B-35 | langchain 1.2.39→1.4.1 + anthropic en bloque | 05 | 3h | Nuevo (MED-002/005) |

**B-27 (next@16.2.6):** Movida a Sprint A como A-26. CVSS 8.6/8.1 near-critical justifica adelanto. Resta 6h del total Sprint B.

---

## Solapes con plan RLS mapeados

| Phase RLS | Corresponde a | Tratamiento en Sprint B |
|-----------|--------------|------------------------|
| phase-03 | B-23..B-25 (RLS policies) | Phase 06 referencia + no duplica steps SQL |
| phase-04 | B-02 (refactor clientes Supabase) | Phase 01 referencia steps |
| phase-05 | B-12..B-18 (Repository pattern + Zod) | Phase 03 referencia interface base |
| phase-06 | B-21 (workers/webhooks) | Phase 04 referencia steps worker |
| phase-07 | Tests anti-fuga | Phase 07 incorpora como parte de suite |
| phase-08 | Docs y rollout | Phase 07 coordina con B-29 |

---

## Dependencias críticas

```
Fase 01 (Supabase unificado)  ──┐
Fase 02 (Zod schemas)          ├──→ Fase 03 (Repos) ──→ Fase 04 (Refactor) ──→ Fase 07 (Tests)
                                │                    ↗
Fase 05 (Type safety) ─────────┘  [paralelo con 04]
Fase 06 (RLS) ─────────────────────────────────────────────────────────→ Fase 07 (Tests)
Fase 08 (Hook B-30) ───────────────── independiente, cualquier momento
```

---

## Total horas estimadas

| Bloque | Horas |
|--------|-------|
| Fase 01 — Unificación Supabase (B-01..B-03 + upgrade ssr) | 19h |
| Fase 02 — Zod schemas (B-04..B-11) | 23h |
| Fase 03 — Repository pattern (B-12..B-18) | 31h |
| Fase 04 — Refactor queries (B-19..B-21) | 18h |
| Fase 05 — Type safety + ADR (B-22, B-31, B-33, B-34, B-35) | 27h |
| Fase 06 — RLS hardening (B-23..B-26; sin B-27) | 19h |
| Fase 07 — Testing + docs (B-28, B-29, SP-B-CLOSE) | 19h |
| Fase 08 — Hook automation (B-30) | 6h |
| **TOTAL** | **162h** |

> RoadMap original: ~158h. +20h tareas ADR nuevas. -6h B-27 movida Sprint A. -10h B-32 aplazada Sprint D. = **~162h** (dentro del rango 120-160h previsto + ajuste ADR).

Con paralelismo de 2-3 agentes: **~75-90h reales (3-4 semanas)**.

---

## Preguntas abiertas

1. ¿B-27 (next@16.2.6) ya tiene tarea A-26 creada en `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-06-otros-criticos.md`? Si no existe ese archivo, hay que crearlo.
2. ¿La BD de test para Fase 07 está disponible en Easypanel o hay que provisionar una Supabase local?
3. ¿B-35 (langchain upgrade) requiere verificación con los otros providers `@langchain/openai` y `@langchain/google-genai` además de `@langchain/anthropic`? El ADR solo menciona anthropic explícitamente.
4. ¿El SDK de hooks de Claude Code permite invocar agentes desde PostToolUse, o solo emitir `additionalContext`? Esto determina la complejidad de B-30.

---

**Status:** DONE
**Summary:** Plan operativo Sprint B creado en 9 archivos. 8 fases con 34 tareas totales (B-01..B-29 originales + B-30..B-35 ADR). B-27 reasignada a Sprint A. B-32 aplazada Sprint D. Solapes con plan RLS mapeados sin duplicación. Total estimado ~162h.
