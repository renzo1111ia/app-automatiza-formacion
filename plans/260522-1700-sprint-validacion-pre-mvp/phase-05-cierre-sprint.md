# Fase 05 — Cierre Sprint Validación Pre-MVP (SP-4B-CLOSE-1..5)

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [RoadMap](../RoadMap.md)

## Overview

Cierre del Sprint Validación. Tras este cierre se promueve el código a **v0.3.0 (MVP GA)**.

## Tareas de cierre

| Task          | Descripción                                                                                                                                                                                          | Estimación | Estado | Notas                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------ |
| SP-4B-CLOSE-1 | **Auto test consolidado** — typecheck + lint + build + test sobre el merge integrado de phases 01..04. Reporte agregado.                                                                             | 1h 30min   | 🔘     |                                                                                            |
| SP-4B-CLOSE-2 | **Test E2C local consolidado** — re-run completo de los 5 specs/suites de Sprints 0+1+2+2B+3 contra `localhost:8500` con el código mergeado.                                                         | 3h         | 🔘     | Más extenso por ser consolidado (incluye Sprint 2B Overview)                               |
| SP-4B-CLOSE-3 | **Test E2E VPS consolidado** — re-run completo contra VPS de Renzo, ya con TODOS los hotfixes aplicados durante este sprint.                                                                         | 3h         | 🔘     |                                                                                            |
| SP-4B-CLOSE-4 | **Corrección de bugs residuales** — bugs que aparezcan en los re-runs consolidados. Subtareas dinámicas (BUG-XXX por cada uno).                                                                      | (variable) | 🔘     |                                                                                            |
| SP-4B-CLOSE-5 | **Cierre Sprint Validación** — PR `feature/sprint-03b-validacion-pre-mvp` → `developer`. Tras merge: bump SemVer a **v0.3.0** (MVP GA). Pedir orden explícita al usuario para promoción a `staging`. | 1h         | 🔘     | NO promociona a staging automáticamente — sólo bumpea v0.3.0 y queda lista en `developer`. |

## Pre-requisitos del cierre

| Item                                                                                | Cómo verificar                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| Las 5 phases (01, 02, 03a, 03b, 04) tienen estado 🔵 con TODOS los BUG-XXX a 🟢     | Tabla "Estado de la fase" de cada phase         |
| `npm run typecheck` + `npm run lint` + `npm run build` verde en local               | Ejecutar antes del PR                           |
| Todos los reportes de validación en `plans/reports/sp-4b-*.md`                      | `ls plans/reports/sp-4b-*`                      |
| RoadMap actualizado: Sprint Validación 🟢 + Sprint 3 🟢 + cuadro de mando coherente | Inspección visual                               |
| CHANGELOG.md actualizado con v0.3.0 GA + nota destacando hotfixes Renzo             | Diff vs cierre Sprint 3                         |
| Documento de release notes interno listo                                            | Para handoff a Javi HP cara a promoción staging |

## Output esperado

- PR cerrado y mergeado a `developer`.
- Tag `v0.3.0` creado sobre el merge commit.
- RoadMap: Sprint Validación 🟢 + Sprint 0+1+2+2B+3 marcados como "integrados en v0.3.0 GA".
- Mensaje al usuario: "MVP v0.3.0 lista en `developer`. ¿Promovemos a `staging`? (requiere tu orden explícita por política branches protegidas)".

## Notas operativas

- **NO** hacer push a `staging` ni a `main` desde este sprint — sólo merge a `developer`.
- **NO** crear el tag v0.3.0 antes del merge — sólo tras confirmación de merge limpio.
- Si la promoción a `staging` se difiere (cliente pide pause, tema legal, etc.) → el v0.3.0 puede quedar en `developer` indefinidamente sin problemas. El siguiente sprint (Sprint 4 — Sheets) puede arrancar igualmente con base `developer` post-merge.
