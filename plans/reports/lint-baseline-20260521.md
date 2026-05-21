---
title: "Lint baseline — deuda técnica detectada al iniciar Sprint 0"
date: 2026-05-21
author: setup automático tarea 0-01 (pre-push hooks)
related_log: ./lint-baseline-20260521.raw.log
related_task: Sprint 1 · tarea NUEVA (ver más abajo)
status: documented
---

# Lint baseline — 21-05-2026

## TL;DR

Al instalar `husky` + `lint-staged` en la tarea 0-01 del Sprint 0, ejecutar `npm run lint` reveló deuda técnica pre-existente. Este documento la cuantifica y la planifica para que NO se pierda.

| Métrica              | Antes config | Tras excluir no-prod |
| -------------------- | ------------ | -------------------- |
| Total problems       | 980          | **190**              |
| Errores              | 327          | **164**              |
| Warnings             | 653          | 26                   |
| Archivos con errores | 70           | 45                   |

**Exclusiones aplicadas en `eslint.config.mjs`** (commit `a74406e` y siguientes):

- `src/scratch/**` — código de debug (ya estaba excluido del tsconfig)
- `src/scripts/**` — utilidades manuales (one-off migrations)
- `scripts/**` — seed-demo, seed.ts
- `.claude/**` — scripts del plugin Claude Code
- `docs/**` — documentación
- `supabase/**` — migrations + seed.sql
- `worker.js` — refactor planificado en Sprint 0 tarea 1-01
- `*.config.{js,mjs,cjs,ts}` — configs

Estas exclusiones son DEFENSIVAS: el código fuera de `src/` (excepto scripts/) no debe lintearse con reglas de producción. Si se quiere lintear, basta con crear un override específico.

## Distribución de los 164 errores reales

### Por regla

| Regla                                | Count | %   | Severidad |
| ------------------------------------ | ----- | --- | --------- |
| `@typescript-eslint/no-explicit-any` | 162   | 99% | Tipado    |
| `prefer-const`                       | 1     | <1% | Trivial   |
| `@typescript-eslint/no-unused-vars`  | 1     | <1% | Trivial   |

**El 99% es uso de `any`.** Esto es el patrón clásico de un codebase que no priorizó tipado estricto desde el día 1. Cada `any` rompe el contrato TypeScript y oculta bugs.

### Por carpeta

| Carpeta           | Archivos | Concentración esperada                                                                                                                                     |
| ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/`        | 25       | Integraciones (HubSpot, Zoho, Retell, Ultravox, WhatsApp), processors BullMQ, core (sweep-queue, scheduler, feature-flags), actions (tenant, auth, widget) |
| `src/app/`        | 12       | Routes API (orchestration, webhooks), páginas dashboard (settings, knowledge, playground)                                                                  |
| `src/components/` | 8        | Charts (Recharts ecosystem suele usar `any`), AIAgentInbox, ThemeToggle                                                                                    |
| `src/types/`      | 1        | `database.ts` — tipos Supabase autogenerados                                                                                                               |

### Top archivos (líneas con `any`)

Ver `lint-baseline-20260521.raw.log` para el listado completo línea-a-línea. Resumen:

- `src/types/database.ts:550` — tipos Supabase autogen (3 `any` consecutivos) → **fix: regenerar tipos con `supabase gen types`**
- `src/lib/integrations/*` — 8 archivos, 1 `any` cada uno → callbacks de SDKs externos
- `src/lib/core/processors/*` — 4 processors BullMQ → jobs.data typings
- `src/app/api/orchestration/*` — 3 endpoints → request/response bodies sin Zod schemas

## Por qué NO se arregla en Sprint 0

1. **Estimación realista:** 162 errores × 2-3 min cada = **8-10h**. Casos con genéricos Supabase: +2h. **Total 10-12h**.
2. **Buffer Sprint 0:** solo 2h 30min. No cabe sin colisión con tareas de seguridad.
3. **Encaje natural en Sprint 1 (Capa datos):** el 60%+ de los `any` están en `src/lib/supabase/`, `src/lib/actions/`, `src/lib/core/processors/`, `src/lib/integrations/`. Sprint 1 va a consolidar precisamente esa capa con Repository pattern + Zod validators. Es el momento ideal para tipar de verdad.
4. **Mejor ROI tipando con contexto:** arreglar `any` aislado es subóptimo. Hacerlo cuando se reescribe el módulo con Zod schemas significa cero refactor doble.

## Tarea planificada

→ **Sprint 1 — tarea NUEVA `2-XX Lint cleanup baseline (`no-explicit-any` x162)`** (ver `plans/260520-1342-sprint-1-capa-datos/`).

Estimación: **8-10h** distribuidas a lo largo del Sprint 1, no como bloque único.

**Estrategia incremental:**

1. Regenerar `src/types/database.ts` con `supabase gen types typescript --local` → fix instant de 3 errores.
2. Cada fase del Sprint 1 que toque un módulo de `src/lib/` debe dejar ese módulo con **0 errores `no-explicit-any`** antes de cerrar la fase.
3. Tracking en `plans/logs/sprint-2/lint-debt.log.md` — checklist por archivo.
4. Al cerrar Sprint 1 (SP-2-CLOSE-1): `npm run lint` debe estar en **0 errores**.

## Compromiso

- El **pre-push hook** ya lintea archivos cambiados → garantiza que **NO se introducen nuevos `any` en código nuevo**.
- El SP-1-CLOSE-1 del Sprint 0 NO exige lint a 0 errores (sería irreal), pero sí exige **no haber aumentado el baseline**.
- Sprint 1 cierra con `npm run lint` → 0 errores.

## Métrica de seguimiento

Comparar al cerrar cada sprint:

```
# Sprint 0 close (objetivo)
npm run lint 2>&1 | tail -3
# ✖ ≤164 problems  ≤164 errors  XX warnings   ← NO subir el techo

# Sprint 1 close (objetivo)
npm run lint 2>&1 | tail -3
# ✓ 0 problems
```

## Referencias

- Log raw original: `./lint-baseline-20260521.raw.log` (327 errors antes de excluir no-prod)
- Plan Sprint 0: `plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md`
- Plan Sprint 1: `plans/260520-1342-sprint-1-capa-datos/plan.md`
- Decisión: ver memoria `project-roadmap-state.md` sección "Próximo paso lógico"
