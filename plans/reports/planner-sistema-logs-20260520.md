# Planner Report — Sistema de logs de tiempo por sprint

**Fecha:** 20-05-2026
**Plan:** `plans/260520-1342-sistema-logs-tiempo-sprints/`
**Agente:** productivity (actualizado)

---

## Resumen de lo planificado

Sistema split de responsabilidades para tracking de tiempo por sprint:
- `roadmap-keeper` → gestiona `plans/RoadMap.md` (estados visibles, sin cambios)
- `productivity` → escribe logs detallados en `plans/logs/sprint-{X}/` (nuevo rol)

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `plans/260520-1342-sistema-logs-tiempo-sprints/plan.md` | Overview del plan, 4 fases |
| `plans/260520-1342-sistema-logs-tiempo-sprints/phase-01-estructura-carpetas.md` | Estructura dirs + convenciones de nomenclatura |
| `plans/260520-1342-sistema-logs-tiempo-sprints/phase-02-actualizar-productivity-agent.md` | Spec detallada de todos los cambios al agente |
| `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` | Análisis del hook + gap analysis + spec hook futuro |
| `plans/260520-1342-sistema-logs-tiempo-sprints/phase-04-formato-logs.md` | Formato de logs + data flow + cálculos |
| `plans/260520-1342-sistema-logs-tiempo-sprints/templates/TASK-ID.log.template.md` | Plantilla por tarea |
| `plans/260520-1342-sistema-logs-tiempo-sprints/templates/_sprint-X.master.log.template.md` | Plantilla master log del sprint |

---

## Cambios aplicados a `.claude/agents/productivity.md`

| Cambio | Detalle |
|--------|---------|
| `model: haiku` → `model: sonnet` | Razonamiento requerido para cálculos cross-tarea |
| `description` actualizada | Refleja nuevo rol de logger + triggers de invocación |
| "Archivos que gestionas" | Actualizado a `plans/logs/sprint-{X}/` + regla NUNCA editar RoadMap.md |
| Nueva sección "Workflow Split" | Define el flujo paralelo con roadmap-keeper |
| Nueva sección "Parámetros esperados" | Contrato de datos del manager → productivity |
| Nueva sección "Reglas de cálculo" | tiempo_real, ciclo, desviación, velocidad |
| Nueva sección "Flujo por evento" | Steps detallados para 🟡/🟠/🔵/🟢 |
| "Responsabilidades" actualizada | 7 responsabilidades concretas |
| "Reglas" actualizadas | Compatibles con nuevo flujo |
| Nueva sección "Status reporting" | Formato de cierre estándar |
| Referencia a plantillas | Apunta a `plans/260520-1342-sistema-logs-tiempo-sprints/templates/` |

---

## Hallazgos del análisis del hook

`af-task-tracker.cjs` es un PostToolUse hint-only:
- **NO invoca agentes directamente** — solo emite `additionalContext` de texto
- **NO detecta transiciones de estado** — reacciona a edits de código (`src/`, `supabase/`)
- **NO pasa task_id/timestamp estructurados** — el assistant los infiere del contexto

**Decisión de integración:**
- Sprint 0: flujo **manual** — el manager invoca roadmap-keeper y productivity en paralelo
- Sprint 1: implementar `af-productivity-logger.cjs` (spec en phase-03) para automatizar la detección desde edits a RoadMap.md

---

## Archivos NO tocados (según reglas estrictas)

- `plans/RoadMap.md` — intacto
- `.claude/agents/roadmap-keeper.md` — solo leído
- `.claude/hooks/af-task-tracker.cjs` — solo analizado
- `src/`, `worker.js`, `supabase/` — no tocados

---

## Preguntas abiertas

1. ¿Quién es el `dev_name` default cuando el manager hace transiciones automáticas (ej. merge de PR)? — sugerencia: `"manager"` como en el ejemplo del roadmap-keeper
2. ¿El hook futuro `af-productivity-logger.cjs` entra en Sprint 1 como tarea formal del plan operativo, o es opcional?
3. ¿Los datos en `.claude/productivity/` (no git) son necesarios o basta con `plans/logs/` (git)? Con el nuevo diseño, los logs formateados ya contienen todo — se puede omitir el dir interno si se prefiere.

---

**Status:** DONE
**Summary:** Plan de 4 fases creado, plantillas generadas, `productivity.md` actualizado con nuevo rol de logger + modelo sonnet + workflow split documentado.
