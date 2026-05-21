---
title: "Sprint 1 — Capa de datos (sin ORM nuevo)"
description: "Plan operativo Sprint 1: unificación Supabase, Zod schemas, Repository pattern, RLS hardening, updates ADR y hook automation."
status: pending
priority: P1
effort: 173h
branch: feature/sp-2-capa-datos
tags: [supabase, zod, repository-pattern, rls, sprint-2, data-layer]
created: 2026-05-20
---

# Sprint 1 — Plan Operativo

| Campo            | Valor                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Sprint ID        | `SP-2`                                                                 |
| Versión objetivo | `v0.2.0`                                                               |
| Estado           | Pendiente                                                              |
| Estimación total | ~173h max / ~169h min (2-30 condicional: 7h si spike OK, 3h si plan 2) |
| Rama sugerida    | `feature/sp-2-capa-datos`                                              |

## Fases

| #   | Fase                                          | Estimación | Estado            | Archivo                                              |
| --- | --------------------------------------------- | ---------- | ----------------- | ---------------------------------------------------- |
| 1   | Unificación cliente Supabase (2-01..2-03)     | 19h        | Pendiente         | [phase-01](phase-01-unificacion-cliente-supabase.md) |
| 2   | Schemas Zod (2-04..2-11)                      | 23h        | Pendiente         | [phase-02](phase-02-schemas-zod.md)                  |
| 3   | Repository pattern (2-12..2-18)               | 31h        | Pendiente         | [phase-03](phase-03-repository-pattern.md)           |
| 4   | Refactor queries existentes (2-19..2-21)      | 18h        | Pendiente         | [phase-04](phase-04-refactor-queries.md)             |
| 5   | Type safety + ADR updates (2-22, 2-31..2-34)  | 30h        | Pendiente         | [phase-05](phase-05-type-safety-y-limpieza.md)       |
| 6   | RLS hardening complementario (2-23..2-26)     | 19h        | Pendiente         | [phase-06](phase-06-rls-hardening-complementario.md) |
| 7   | Testing + documentación (2-28, 2-29)          | 16h        | Pendiente         | [phase-07](phase-07-testing-documentacion.md)        |
| 8   | Hook automation (2-30.1 spike + 2-30.2 impl.) | 7h \| 3h   | Pendiente         | [phase-08](phase-08-hook-automation.md)              |
| —   | **Cierre sprint** (SP-2-CLOSE-1..5)           | ~10h       | Pendiente         | —                                                    |
| —   | **2-27 (next CVE)**                           | ~~6h~~     | **Movida → 1-26** | phase-06                                             |

> **Nota 2-27:** Movida a Sprint 0 como 1-26. Ver `plans/260520-1342-sprint-0-hotfixes-seguridad/phase-06-otros-criticos.md`.

## Diagrama de dependencias

```
Día 1+
  2.1 Unificación Supabase ─────────────────────────┐
  2.2 Zod schemas ──────────────────────────────────┤
  2.8 Hook automation (2-30, independiente) ────────┤
  2.6 RLS hardening (2-23..2-26, independiente) ────┤
                                                     │
Día 5+ (requiere 2.1 + 2.2 completos)               │
  2.3 Repository pattern ──────────────────────┐    │
                                               │    │
Día 10+ (requiere 2.3)                         │    │
  2.4 Refactor queries ─────────────────┐      │    │
  2.5 Type safety / ADR ────────────────┤ par. │    │
                                        │      │    │
Final (requiere 2.4 + 2.5)             │      │    │
  2.7 Testing + Docs ───────────────────┘──────┘────┘
```

## Criterios de éxito globales (SP-2-CLOSE)

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores (**baseline al iniciar Sprint 1: 164 errores `no-explicit-any`** — ver `plans/reports/lint-baseline-20260521.md`)
- [ ] `npm run build` success
- [ ] Tests integración BD real — repositorios principales pass
- [ ] 0 queries directas `pg`/`postgres` en `src/app/api/` o `src/lib/actions/`
- [ ] 0 JWTs `service_role` residuales fuera de admin scripts
- [ ] `as any` reducidos >80% (de 426 ocurrencias → <85) + 164 errores ESLint `no-explicit-any` → 0
- [ ] RLS en `ai_agents`, `web_widgets`, `programs` corregida y verificada
- [ ] `next@16.2.6` instalado (movido 1-26)
- [ ] Hook `af-productivity-logger.cjs` operativo

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
