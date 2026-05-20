---
name: project-sistema-logs
description: Decisiones arquitectónicas del sistema de logs de tiempo por sprint — split roadmap-keeper/productivity, contrato de datos, modelo sonnet
metadata:
  type: project
---

# Sistema de logs de tiempo por sprint

Plan creado 20-05-2026 en `plans/260520-1342-sistema-logs-tiempo-sprints/`.

## Decisiones clave

**Split de responsabilidades aprobado:**
- `roadmap-keeper` → solo `plans/RoadMap.md` (estados visibles)
- `productivity` → solo `plans/logs/sprint-{X}/` (logs detallados)

**Why:** El usuario quiere que los logs de tiempo sean auditables en git sin contaminar el RoadMap, y que los cálculos de desviación/velocidad sean razonados (no solo formateo).

**productivity sube de haiku a sonnet** — cálculos cross-tarea y proyecciones requieren razonamiento.

**Integración con hook actual:**
- `af-task-tracker.cjs` es hint-only (PostToolUse en edits de código). NO invoca agentes.
- No hay hook que detecte transiciones de estado en RoadMap.md.
- Sprint 0: flujo manual (manager invoca ambos agentes en paralelo).
- Sprint 1: implementar `af-productivity-logger.cjs` (spec en phase-03).

**Contrato de datos manager → productivity:**
```
task_id, sprint_id, event (emoji), timestamp (DD-MM-YYYY HH:MM), dev_name, tiempo_real? (solo 🟠), branch? (solo 🔵)
```

**Cálculo tiempo_real:** timestamp(🟠) - timestamp(🟡). El tiempo 🟠→🟢 es review/merge, no trabajo.

## How to apply

- Al diseñar invocaciones del manager a productivity: usar el contrato de datos arriba.
- Al planificar Sprint 1: añadir tarea para `af-productivity-logger.cjs`.
- productivity nunca escribe en RoadMap.md — puede leerlo.
