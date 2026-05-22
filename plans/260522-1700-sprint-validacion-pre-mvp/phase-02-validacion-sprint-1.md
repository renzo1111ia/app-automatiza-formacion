# Fase 02 — Validación Sprint 1 (Capa de datos)

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 1 plan](../260520-1342-sprint-1-capa-datos/plan.md)
- [RoadMap Sprint 1](../RoadMap.md)

## Overview

- **Sprint validado**: Sprint 1 — Capa de datos sin ORM nuevo (SP-2, v0.2.0).
- **Branch origen**: `feature/sprint-01-capa-datos` (mergeado a `developer` al cierre Sprint 1).
- **Estado**: 🔘 **Plantilla vacía**. Se rellena automáticamente en `SP-2-CLOSE-5` (cierre Sprint 1) por el agente `roadmap-keeper`.
- **Tester**: por asignar dentro del equipo Renzo.

## Resumen del Sprint 1 a validar

> Pendiente de rellenar al cierre Sprint 1. Origen: `plans/260520-1342-sprint-1-capa-datos/plan.md` (29 tareas en 8 bloques: unificación cliente Supabase, Zod schemas, Repository pattern, refactor queries, type safety, RLS hardening complementario, testing+docs, hardening dependencias).

## 1. Test automático (código)

> ⏳ Pendiente — al cierre Sprint 1, listar aquí:
>
> - Comandos exactos: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (con threshold de coverage si se define en Sprint 1).
> - Nueva suite unit/integration en `tests/` (tarea 2-28).
> - Cambios en `npm scripts` introducidos.

## 2. Test E2C local (Playwright contra `localhost:8500`)

> ⏳ Pendiente — al cierre Sprint 1, listar aquí:
>
> - Nuevas specs E2E que cubren los repositories.
> - Flujos golden path validados (CRUD via repos en lugar de queries directas).
> - Comando `npm run test:e2e -- tests/e2e/sprint-1/*.spec.ts`.

## 3. Test E2E VPS (Playwright contra VPS Renzo)

> ⏳ Pendiente — al cierre Sprint 1, listar aquí:
>
> - Migraciones SQL nuevas a aplicar en VPS (probable: RLS hardening 2-23..2-26).
> - Variables de entorno nuevas (si las hay).
> - Comando: `BASE_URL=https://dev.automatizaformacion.com npm run test:e2e -- tests/e2e/sprint-1/*.spec.ts`.

## 4. Test manual del tester (humano)

> ⏳ Pendiente — al cierre Sprint 1, replicar checklist desde `docs/testeos-manual.md` sección Sprint 1.

## 5. Hotfixes encontrados durante la validación

| BUG-ID  | Severidad | Descripción | Fix aplicado | Commit | Estado |
| ------- | --------- | ----------- | ------------ | ------ | ------ |
| BUG-XXX | —         | —           | —            | —      | 🔘     |

## 6. Subida a GH

- Convención: `fix(validacion-sp1): <descripcion>`.

## Estado de la fase

| Bloque             | Estado       |
| ------------------ | ------------ |
| 1. Test automático | 🔘 Plantilla |
| 2. Test E2C local  | 🔘 Plantilla |
| 3. Test E2E VPS    | 🔘 Plantilla |
| 4. Test manual     | 🔘 Plantilla |
| 5. Hotfixes        | 🔘 Plantilla |
| 6. Subida GH       | 🔘 Plantilla |
