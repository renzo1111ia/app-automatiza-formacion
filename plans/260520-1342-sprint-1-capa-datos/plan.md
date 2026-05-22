---
title: "Sprint 1 — Capa de datos (sin ORM nuevo)"
description: "Plan operativo Sprint 1: unificación Supabase, Zod schemas, Repository pattern, RLS hardening, ADR updates, hook automation y bugs Renzo + requisitos Bea (Bloque 2.9 nuevo)."
status: 🟡 En Desarrollo
priority: P1
effort: ~205h (173h base + 28h Bloque 2.9 NEW-XX docs Bea+Renzo)
branch: feature/sprint-01-capa-datos
tags: [supabase, zod, repository-pattern, rls, sprint-2, data-layer, bugs-renzo, reqs-bea]
created: 2026-05-20
updated: 2026-05-22 (kickoff sprint + integración Bloque 2.9 NEW-01/02/06/13)
---

# Sprint 1 — Plan Operativo

| Campo            | Valor                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Sprint ID        | `SP-2`                                                                             |
| Versión objetivo | `v0.2.0`                                                                           |
| Estado           | 🟡 En Desarrollo (arrancado 22-05-2026 18:45 por Javi HP)                          |
| Estimación total | **~205h** (173h base + 28h Bloque 2.9 nuevo NEW-XX)                                |
| Fechas           | Inicio Lun 08-06-2026 09:00 · Fin estim. Vie 03-07-2026 19:00 (~20 días lab × 10h) |
| Rama             | `feature/sprint-01-capa-datos` (creada 22-05-2026)                                 |
| Dev asignado     | Javi HP (solo)                                                                     |

## Fases

| #     | Fase                                            | Estimación | Estado            | Archivo                                                     |
| ----- | ----------------------------------------------- | ---------- | ----------------- | ----------------------------------------------------------- |
| 1     | Unificación cliente Supabase (2-01..2-03)       | 19h        | 🔘 Pendiente      | [phase-01](phase-01-unificacion-cliente-supabase.md)        |
| 2     | Schemas Zod (2-04..2-11)                        | 23h        | 🔘 Pendiente      | [phase-02](phase-02-schemas-zod.md)                         |
| 3     | Repository pattern (2-12..2-18)                 | 31h        | 🔘 Pendiente      | [phase-03](phase-03-repository-pattern.md)                  |
| 4     | Refactor queries existentes (2-19..2-21)        | 18h        | 🔘 Pendiente      | [phase-04](phase-04-refactor-queries.md)                    |
| 5     | Type safety + ADR updates (2-22, 2-31..2-34)    | 30h        | 🔘 Pendiente      | [phase-05](phase-05-type-safety-y-limpieza.md)              |
| 6     | RLS hardening complementario (2-23..2-26)       | 19h        | 🔘 Pendiente      | [phase-06](phase-06-rls-hardening-complementario.md)        |
| 7     | Testing + documentación (2-28, 2-29)            | 16h        | 🔘 Pendiente      | [phase-07](phase-07-testing-documentacion.md)               |
| 8     | Hook automation (2-30.1 spike + 2-30.2 impl.)   | 7h \| 3h   | 🔘 Pendiente      | [phase-08](phase-08-hook-automation.md)                     |
| **9** | **Fix bugs Renzo + reqs Bea (NEW-01/02/06/13)** | **28h**    | 🔘 Pendiente      | [phase-09](phase-09-fix-bugs-renzo-y-reqs-bea.md) **NUEVO** |
| —     | **Cierre sprint** (SP-2-CLOSE-1..5 sin CLOSE-3) | ~4h 30min  | 🔘 Pendiente      | — (CLOSE-3 manual diferido a SP-4B phase-02)                |
| —     | **2-27 (next CVE)**                             | ~~6h~~     | **Movida → 1-26** | phase-06                                                    |

> **Nota 2-27:** Movida a Sprint 0 como 1-26. Ver `plans/260520-1342-sprint-0-hotfixes-seguridad/phase-06-otros-criticos.md`.

## Diagrama de dependencias

```
Día 1+
  2.1 Unificación Supabase ─────────────────────────┐
  2.2 Zod schemas ──────────────────────────────────┤
  2.8 Hook automation (2-30, independiente) ────────┤
  2.6 RLS hardening (2-23..2-26, independiente) ────┤
  2.9 NEW-01 (fix saveOrchestratorConfig, indep.) ──┤
  2.9 NEW-13 (handoff unificado, indep.) ───────────┤
                                                     │
Día 4+ (requiere 2.2 Zod base)                       │
  2.9 NEW-02 (enum estados lead/cualificación) ─────┤
                                                     │
Día 5+ (requiere 2.1 + 2.2 completos)               │
  2.3 Repository pattern ──────────────────────┐    │
                                               │    │
Día 10+ (requiere 2.3)                         │    │
  2.4 Refactor queries ─────────────────┐      │    │
  2.5 Type safety / ADR ────────────────┤ par. │    │
  2.9 NEW-06 (oportunidades múltiples) ─┤ par. │    │
                                        │      │    │
Final (requiere 2.4 + 2.5 + 2.9)       │      │    │
  2.7 Testing + Docs ───────────────────┘──────┘────┘
```

## Criterios de éxito globales (SP-2-CLOSE)

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores (**baseline al iniciar Sprint 1: 128 errores `no-explicit-any`** — reducido vs 164 iniciales por Sprint 0; ver `plans/reports/sp-1-close-1-auto-test-20260522.md`)
- [ ] `npm run build` success
- [ ] Tests integración BD real — repositorios principales pass
- [ ] 0 queries directas `pg`/`postgres` en `src/app/api/` o `src/lib/actions/`
- [ ] 0 JWTs `service_role` residuales fuera de admin scripts
- [ ] `as any` reducidos >80% (de 426 ocurrencias → <85) + errores ESLint `no-explicit-any` → 0
- [ ] RLS en `ai_agents`, `web_widgets`, `programs` corregida y verificada
- [ ] `next@16.2.6` ya instalado (Sprint 0 1-26 ✅)
- [ ] Hook `af-productivity-logger.cjs` operativo
- [ ] **Bloque 2.9** completo: NEW-01 saveOrchestratorConfig fix + tabla orchestrator consolidada · NEW-02 enum estados unificado propagado a Supabase+Zoho+dashboard · NEW-06 modelo oportunidades múltiples + dedup · NEW-13 política handoff "ilocalizable" implementada
- [ ] Hand-off `SP-4B phase-02` documentado en `SP-2-CLOSE-5` (comandos test, specs Playwright, BUG-XXX detectados, vars VPS, checklist manual)
- [ ] CLOSE-3 (manual) DIFERIDO a SP-4B phase-02 bloque 4 (Renzo) — no se ejecuta en este sprint

## Riesgos top-3

| Riesgo                                                 | Prob  | Impacto | Mitigación                                                               |
| ------------------------------------------------------ | ----- | ------- | ------------------------------------------------------------------------ |
| Supabase SSR 0.10.3 rompe cookie middleware            | Media | Alto    | Upgrade conjunto ssr + supabase-js; test auth flows antes de mergear     |
| lucide-react 1.x renombra iconos → build roto          | Baja  | Medio   | Inventario iconos usados antes del upgrade; prueba visual completa       |
| Refactor 2-19..2-21 rompe Server Actions en producción | Media | Alto    | Ejecutar en feature branch; typecheck + tests de integración antes de PR |

## 2-35 — Sistema de 3 READMEs por rama (tarea adicional Sprint 1)

| Campo          | Valor                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Tarea ID       | 2-35                                                                                                     |
| Descripción    | Sistema de 3 README.md sincronizados por rama desde RoadMap.md como single source of truth               |
| Estimación     | 8h (script 4h + plantillas 1h + integración promote 1h + CI + pre-commit hook 1h + bootstrap inicial 1h) |
| Estado         | Pendiente                                                                                                |
| Independencia  | Puede ejecutarse en cualquier momento del Sprint 1 — sin dependencias de 2-01..2-34                      |
| Plan detallado | `plans/260520-1342-sistema-readmes-por-rama/plan.md`                                                     |

**Entregables de 2-35:**

- `scripts/generate-readmes.cjs` — script Node sin dependencias externas
- `scripts/readme-templates/` — 3 plantillas (ya creadas)
- `package.json` — scripts `generate-readmes` y `generate-readmes:check`
- `.claude/hooks/af-readme-sync-precommit.cjs` — pre-commit hook local
- `.github/workflows/repo-purity-check.yml` — CI ampliado con job `readme-sync-check` (required status check en `developer`)
- `README.md`, `README.staging.md`, `README.main.md` — bootstrap inicial

> **Nota roadmap-keeper:** El agente `roadmap-keeper` deberá añadir 2-35 a `plans/RoadMap.md` cuando procese este sprint. El roadmap-keeper NO debe modificar `plans/RoadMap.md` autónomamente fuera de su flujo — esta nota es para que lo registre en la próxima actualización de estados.

## Referencias

- RoadMap: `plans/RoadMap.md` líneas 160-252
- Plan RLS existente: `plans/20260519-1200-rls-multitenant-hardening/`
- ADR audit: `plans/reports/adr-auditoria-dependencias-20260520.md`
- Plan logs: `plans/260520-1342-sistema-logs-tiempo-sprints/`
- Sprint 0: `plans/260520-1342-sprint-0-hotfixes-seguridad/`
- Plan READMEs: `plans/260520-1342-sistema-readmes-por-rama/`
