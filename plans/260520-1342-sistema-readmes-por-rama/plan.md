---
title: "Sistema de 3 README.md sincronizados por rama"
description: "Script Node + plantillas Mustache-like para generar README.developer/staging/main desde RoadMap.md como single source of truth"
status: pending
priority: P2
effort: 8h
branch: auditoria
tags: [readme, roadmap, scripts, automation, developer, staging, main]
created: 2026-05-20
last_updated: 2026-05-20
---

# Plan — Sistema de 3 README.md por rama

> Fuente única: `plans/RoadMap.md`. Tres outputs filtrados según audiencia (developer / staging / main).
> Deploy: rama `developer` cuando el scaffold se commitee.

## Fases

| # | Fase | Archivo | Estimación | Estado |
|---|------|---------|-----------|--------|
| 1 | Script generador `generate-readmes.cjs` | [phase-01](phase-01-script-generador.md) | 2h | Pendiente |
| 2 | Plantillas por rama (3 templates) | [phase-02](phase-02-plantillas-por-rama.md) | 1h | Pendiente |
| 3 | Ampliación `roadmap-keeper.md` | [phase-03](phase-03-ampliacion-roadmap-keeper.md) | 30min | Pendiente |
| 4 | Integración en `promote.sh` + `promote.ps1` | [phase-04](phase-04-integracion-promote-scripts.md) | 1h | Pendiente |
| 5 | Ajustes CI `staging-main-purity-check.yml` | [phase-05](phase-05-actualizar-ci-purity-check.md) | 30min | Pendiente |
| 6 | Bootstrap inicial (primeros 3 READMEs) | [phase-06](phase-06-bootstrap-readmes-iniciales.md) | 1h | Pendiente |

**Total estimado: 8h** (script 4h + plantillas 1h + integración promote 1h + CI + pre-commit hook 1h + bootstrap inicial 1h)

## Dependencias entre fases

```
phase-01 (script) ──────────────────────────────────► phase-06 (bootstrap)
phase-02 (templates) ─────────────────────────────────► phase-06
phase-03 (roadmap-keeper) ──► independiente
phase-04 (promote) ─────────────────────────────────── phase-06 requiere que 04 esté diseñado
phase-05 (CI) ──────────────────────────────────────── independiente, puede hacerse en paralelo con 04
```

Phase-06 (bootstrap) se ejecuta ÚLTIMA — necesita fase-01 implementada + fase-02 implementada.

## Archivos que toca este plan

| Archivo | Fase | Operación |
|---------|------|-----------|
| `scripts/generate-readmes.cjs` | 01 | CREAR |
| `scripts/readme-templates/README.developer.template.md` | 02 | EXISTE (movida de plans/templates/) |
| `scripts/readme-templates/README.staging.template.md` | 02 | EXISTE (movida de plans/templates/) |
| `scripts/readme-templates/README.main.template.md` | 02 | EXISTE (movida de plans/templates/) |
| `.claude/agents/roadmap-keeper.md` | 03 | EDITAR (sección nueva) |
| `scripts/promote.sh` | 04 | EDITAR |
| `scripts/promote.ps1` | 04 | EDITAR |
| `.github/workflows/staging-main-purity-check.yml` | 05 | EDITAR (renombrar + ampliar) |
| `.claude/hooks/af-readme-sync-precommit.cjs` | 05 | CREAR |
| `package.json` | 01 | EDITAR (añadir scripts) |
| `README.md` | 06 | REEMPLAZAR |
| `README.staging.md` | 06 | CREAR |
| `README.main.md` | 06 | CREAR |

> Fases 01+02 no comparten archivos — paralelizables.
> Fases 03+04+05 no comparten archivos — paralelizables entre sí.
> Las plantillas de `plans/260520-1342-sistema-readmes-por-rama/templates/` ya están copiadas a `scripts/readme-templates/` — la carpeta `plans/templates/` queda como referencia histórica del plan.

## Key constraints

- `plans/RoadMap.md` SÓLO existe en rama `developer`.
- CI bloquea `docs/`, `plans/`, `.claude/`, `.claude-plugin/`, `CLAUDE.md` en staging/main.
- Los 3 READMEs deben PRE-GENERARSE en developer; promote los renombra/elimina al copiar.
- 0 nuevas dependencias npm (Node built-ins únicamente).

## Decisiones confirmadas (post-planificación)

| # | Decisión | Estado |
|---|----------|--------|
| 3-1 | `npm run generate-readmes` + `generate-readmes:check` en `package.json` | Recommended |
| 3-2 | Job `readme-sync-check` como required status check en GitHub (rama `developer`) | Recommended |
| 3-3 | Path definitivo de plantillas: `scripts/readme-templates/` (ya movidas) | Recommended |
| 3-4 | Registrar como tarea 2-35 en Sprint 1 (`plans/260520-1342-sprint-1-capa-datos/`) | Recommended |
| 3-5 | Pre-commit hook local `.claude/hooks/af-readme-sync-precommit.cjs` (defensa en profundidad) | Recommended |
