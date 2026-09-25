---
title: "Sistema de logs de tiempo por sprint"
description: "Diseño e implementación del sistema de logs detallados por tarea/sprint bajo plans/logs/, con agente productivity como logger y split de responsabilidades vs roadmap-keeper."
status: pending
priority: P1
effort: 3h 30min
branch: auditoria
tags: [productivity, logging, sprint-tracking, agents]
created: 2026-05-20
---

# Plan — Sistema de logs de tiempo por sprint

## Contexto

Split de responsabilidades aprobado por el usuario (20-05-2026):
- `roadmap-keeper` → edita `plans/RoadMap.md` (estados visibles).
- `productivity` → escribe logs detallados en `plans/logs/sprint-X/`.

## Fases

| # | Fase | Archivo | Estado | Esfuerzo |
|---|------|---------|--------|----------|
| 01 | Estructura de carpetas | [phase-01-estructura-carpetas.md](phase-01-estructura-carpetas.md) | pending | 30min |
| 02 | Actualizar productivity agent | [phase-02-actualizar-productivity-agent.md](phase-02-actualizar-productivity-agent.md) | pending | 1h |
| 03 | Integración con hook | [phase-03-hook-integration.md](phase-03-hook-integration.md) | pending | 1h |
| 04 | Formato de logs (plantillas) | [phase-04-formato-logs.md](phase-04-formato-logs.md) | pending | 1h |

## Dependencias

```
phase-04 (plantillas) → debe existir antes de phase-02 (el agente referencia las plantillas)
phase-03 (hook) → requiere entender el contrato del hook antes de phase-02
phase-01 → independiente, puede ir primero
```

Orden recomendado: 01 → 04 → 03 → 02

## Archivos que afecta este plan

| Archivo | Acción |
|---------|--------|
| `.claude/agents/productivity.md` | Editar (model haiku→sonnet + nuevas secciones) |
| `plans/logs/` | Crear estructura (dirs + plantillas) — solo en Sprint 0 real |
| `plans/260520-1342-sistema-logs-tiempo-sprints/templates/` | Crear plantillas ahora |

## Archivos que NO toca este plan

- `plans/RoadMap.md` — exclusivo del roadmap-keeper
- `.claude/agents/roadmap-keeper.md` — solo lectura
- `.claude/hooks/af-task-tracker.cjs` — solo documentado, no modificado
- `src/`, `worker.js`, `supabase/` — código de la app intocable

## Decisión de modelo

`productivity` sube de `haiku` → `sonnet` porque:
- Cálculo de desviación cross-tarea requiere razonamiento
- Agregación en master log no es solo formateo mecánico
- Proyección de fin de sprint por velocidad requiere inferencia
