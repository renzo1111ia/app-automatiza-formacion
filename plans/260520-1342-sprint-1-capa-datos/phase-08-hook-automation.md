# Phase 08 — Hook Automation: af-productivity-logger.cjs

## Context Links

- Plan logs: `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` — spec detallada del hook + gap analysis
- Planner report: `plans/reports/planner-sistema-logs-20260520.md`
- Hook existente: `.claude/hooks/af-task-tracker.cjs` — analizado, no modificar (hint-only)
- Agente productivity: `.claude/agents/productivity.md` — ya actualizado con nuevo rol

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — independiente, puede empezar en cualquier momento del Sprint 1
- **Descripción:** Crear el hook `af-productivity-logger.cjs` que detecta automáticamente cambios de estado en `RoadMap.md` e invoca a `roadmap-keeper` y `productivity` en paralelo. En Sprint 0 el flujo es manual; este hook lo automatiza para Sprint 1 en adelante.
- **Estimación:** 7h (max) / 3h (min) — ver 2-30.1 + 2-30.2
- **Agente:** `af-agents:code`

> **Decisión de usuario (20-05-2026):** 2-30 reestructurada en dos subtareas. 2-30.1 es un spike obligatorio antes de implementar — su resultado condiciona la estimación de 2-30.2.

## Key Insights

- El hook actual `af-task-tracker.cjs` es PostToolUse hint-only — NO detecta estados, NO invoca agentes
- El nuevo hook debe detectar edits en `plans/RoadMap.md` específicamente (o `plans/logs/**`)
- **Incógnita crítica:** no se sabe si el Claude Code SDK permite que hooks PostToolUse invoquen subagentes — el spike 2-30.1 lo determina
- Gap analysis completo en `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md`

## Requirements

**2-30.1 (spike):**
- Determinar SI/NO si Claude Code SDK permite que un hook PostToolUse invoque subagentes (productivity + roadmap-keeper)
- Output: documento `plans/reports/spike-hook-postooluse-feasibility-20260520.md` con conclusión + alternativas
- No modificar ningún archivo de código durante el spike

**2-30.2 (implementación — condicional):**
- Si spike = SI: implementar hook `af-productivity-logger.cjs` que invoca agentes en paralelo
- Si spike = NO (plan B): implementar script Node de invocación manual del manager via SendMessage

**Funcionales comunes (2-30.2):**
- Detectar cuando se edita `plans/RoadMap.md` (PostToolUse: Edit o Write tool)
- Extraer: task_id (ej. `2-03`), estado anterior y nuevo (`🔘` → `🟡`, etc.)
- Emitir contexto estructurado con: task_id, timestamp, estado, delta estimado

**No-funcionales:**
- Hook < 150 líneas (KISS)
- No bloquear el flujo principal si falla
- Compatible con la configuración de hooks existente en `.claude/settings.json`

## Architecture

```
2-30.1 (spike):
  Investigar SDK → ¿hook PostToolUse puede invocar subagentes?
  Output: spike-hook-postooluse-feasibility-20260520.md (SI/NO + alternativas)
       ↓
  SI → 2-30.2 Path A (hook nativo)
  NO → 2-30.2 Path B (script manual)

2-30.2 Path A — Hook nativo:
  Trigger: PostToolUse (Edit | Write) → si archivo contiene "RoadMap.md"
    ↓ parse diff → detectar cambios de emoji de estado
    ↓ extraer task_id
    → invocar roadmap-keeper + productivity en paralelo

2-30.2 Path B — Plan B (script manual):
  Script Node: invoke-manager.cjs
    → lee último cambio de estado de RoadMap.md
    → construye SendMessage a manager con contexto estructurado
    → dev ejecuta manualmente tras cada cambio de estado
```

## Related Code Files

**Crear (2-30.1):**
- `plans/reports/spike-hook-postooluse-feasibility-20260520.md` — output del spike

**Crear (2-30.2 — según resultado spike):**
- Path A: `.claude/hooks/af-productivity-logger.cjs`
- Path B: `scripts/invoke-manager.cjs` (script manual)

**Leer para contexto:**
- `.claude/hooks/af-task-tracker.cjs` — hook existente como referencia
- `.claude/settings.json` — configuración de hooks (verificar formato)
- `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` — spec completa

**No modificar:**
- `.claude/hooks/af-task-tracker.cjs` — mantener intacto

## Implementation Steps

### 2-30.1 — Spike: capacidades PostToolUse SDK (1h)

1. Leer `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` completamente
2. Revisar documentación Claude Code SDK sobre hooks PostToolUse: ¿pueden invocar agentes o solo emitir contexto?
3. Revisar `.claude/settings.json` y `.claude/hooks/af-task-tracker.cjs` para entender el modelo de ejecución actual
4. Documentar conclusión en `plans/reports/spike-hook-postooluse-feasibility-20260520.md`:
   - Resultado: SI / NO
   - Evidencia técnica que sustenta la conclusión
   - Si NO: 2-3 alternativas viables con sus trade-offs
5. Comunicar resultado al manager antes de iniciar 2-30.2

### 2-30.2 — Implementación (6h si spike = SI | 2h si spike = NO)

**Path A — Hook nativo (6h):**

1. Crear `.claude/hooks/af-productivity-logger.cjs`
2. Registrar en `.claude/settings.json` como PostToolUse para Edit y Write
3. Lógica de detección:
   ```js
   // Si tool_input.file_path incluye 'RoadMap.md'
   // Comparar old_string vs new_string buscando cambios de emoji
   // Regex: /\| [1-5]-\d+ \|.*?(🔘|🟡|🟠|🔵|🟢)/
   ```
4. Extraer task_id, from_status, to_status, sprint_id
5. Invocar roadmap-keeper + productivity en paralelo
6. Test: editar línea de estado en RoadMap.md en dev → verificar activación y output correcto

**Path B — Script manual (2h):**

1. Crear `scripts/invoke-manager.cjs`
2. Lee último diff de `plans/RoadMap.md` (git diff o lectura directa)
3. Construye payload SendMessage con: task_id, from_status, to_status, timestamp, sprint_id
4. Dev ejecuta `node scripts/invoke-manager.cjs` tras cada cambio de estado
5. Documentar en `plans/260520-1342-sistema-logs-tiempo-sprints/` el nuevo flujo manual

## Todo List

- [ ] 2-30.1: Leer spec completa phase-03-hook-integration.md
- [ ] 2-30.1: Investigar capacidades SDK PostToolUse (¿puede invocar agentes?)
- [ ] 2-30.1: Escribir spike-hook-postooluse-feasibility-20260520.md con conclusión SI/NO
- [ ] 2-30.1: Comunicar resultado al manager
- [ ] 2-30.2: Según resultado spike — implementar Path A (hook) o Path B (script)
- [ ] 2-30.2: Test del comportamiento elegido
- [ ] 2-30.2: Documentar comportamiento final en comentario al inicio del archivo creado

## Success Criteria

- Spike concluye con SI o NO documentado y evidenciado
- 2-30.2 implementado según resultado del spike
- Si Path A: hook se activa cuando se edita `plans/RoadMap.md`; output incluye task_id, from_status, to_status, timestamp, sprint_id; agentes reciben el evento
- Si Path B: script ejecutable manualmente; manager recibe payload correcto via SendMessage
- En ambos casos: no rompe flujo normal de edición de archivos

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| SDK no permite invocar agentes desde hook | Media | Bajo | Plan B ya previsto — estimación 2h, sin bloqueo |
| Spike consume más de 1h sin conclusión clara | Baja | Bajo | Límite estricto: si en 1h no hay respuesta definitiva → asumir NO y ejecutar plan B |
| Hook falla silenciosamente | Baja | Bajo | Añadir try/catch con log de error en stderr; error no bloquea el flujo |
| Script manual (plan B) no se ejecuta por olvido del dev | Media | Bajo | Documentar en onboarding; añadir recordatorio en template de cierre de tarea |

## Security Considerations

- El hook / script NO debe leer ni escribir archivos fuera de `plans/` y `.claude/`
- No incluir secrets ni keys en el hook

## Agente Esden

- **Responsable:** `af-agents:code` (2-30.1 + 2-30.2)
- **Revisión:** `af-agents:code` (code review del hook/script antes de activar)

## Next Steps

- 2-30.1 debe ejecutarse al inicio del sprint — determina el alcance real de 2-30.2
- Resultado del spike se comunica al manager antes de proceder con 2-30.2
- Si Path A: hook activo desde inicio de Sprint 1 — automatiza tracking de tiempo
- Si Path B: flujo manual documentado para el equipo
