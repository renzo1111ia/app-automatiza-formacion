# Phase 03 — Integración con hook af-task-tracker

**Prioridad:** P2
**Estado:** pending
**Esfuerzo:** 1h

## Contexto

- Plan: [plan.md](plan.md)
- Hook analizado: `.claude/hooks/af-task-tracker.cjs`
- hooks.json: `.claude/hooks/hooks.json`
- Agente receptor: `.claude/agents/productivity.md`

## Estado actual del hook (análisis read-only)

### Qué hace hoy `af-task-tracker.cjs`

El hook es un **PostToolUse** (Edit|Write|MultiEdit). Funciona así:

1. Se activa cuando se edita cualquier archivo bajo `src/`, `supabase/`, `app/`, `lib/`, `components/`, `worker.js`, o `package.json`.
2. Emite un bloque `additionalContext` con hints de texto al assistant.
3. Los hints sugieren al assistant verificar el estado del RoadMap e invocar `roadmap-keeper`.
4. **NO invoca directamente a ningún agente** — solo inyecta texto de recordatorio.
5. **NO pasa `task_id`, `dev_name` ni `timestamp`** como parámetros estructurados.

### Configuración en hooks.json

```json
"PostToolUse": [
  {
    "matcher": "Edit|Write|MultiEdit",
    "hooks": [
      { "type": "command", "command": "node .../post-edit-simplify-reminder.cjs" },
      { "type": "command", "command": "node .../af-task-tracker.cjs" }
    ]
  }
]
```

### Lo que el hook NO hace (gaps detectados)

| Gap | Impacto para productivity |
|-----|--------------------------|
| No detecta cambios de estado (🔘→🟡 etc.) — solo detecta ediciones de archivos de código | Productivity NO se dispara automáticamente en transiciones de estado |
| No invoca agentes directamente — solo hints de texto | La invocación de productivity es 100% manual (vía manager) |
| No extrae task_id del contexto — el assistant lo infiere del hint | El contrato de datos hacia productivity requiere que el manager lo pase explícitamente |
| Solo cubre ediciones a `src/` — no detecta transiciones que no implican edición de código | Transiciones 🟠→🔵→🟢 (push/merge) no tienen hook |

## Contrato actual de invocación (manager → productivity)

Como el hook NO invoca directamente a productivity, el flujo real es:

```
Dev anuncia transición
    → Manager (o assistant en sesión) invoca roadmap-keeper con {task_id, dev_name, new_state}
    → roadmap-keeper actualiza RoadMap.md
    → Manager (o assistant) invoca productivity con {task_id, sprint_id, event, timestamp, dev_name, tiempo_real?}
```

### Parámetros que productivity necesita recibir del manager

```
task_id:      "1-01"                    # ID de la tarea del RoadMap
sprint_id:    "1"                        # Número del sprint
event:        "🟡|🟠|🔵|🟢"            # Nuevo estado tras la transición
timestamp:    "20-05-2026 09:15"         # Formato DD-MM-YYYY HH:MM
dev_name:     "javier"                   # Quien hace la transición
tiempo_real?  "3h 30min"                 # Solo para evento 🟠 (cuando aplica)
branch?:      "feature/sp-1-fix-worker"  # Solo para evento 🔵
```

## Cambio necesario en el hook (documentado, NO implementado aún)

Para que el sistema sea más automático, el hook debería:

1. **Detectar patrones en additionalContext** generados por roadmap-keeper cuando actualiza RoadMap.md (actualmente el hook no lee el RoadMap — solo reacciona a edits de código).
2. **Alternativa más simple**: añadir un nuevo hook `af-productivity-logger.cjs` que se active en `PostToolUse` cuando el archivo editado ES `plans/RoadMap.md`, extraiga el task_id y la transición de estado del diff, y emita un hint para que el assistant invoque productivity.

### Diseño del nuevo hook `af-productivity-logger.cjs` (spec, no implementado)

```
Trigger: PostToolUse → Edit|Write|MultiEdit → path contiene "plans/RoadMap.md"
Input: tool_input.file_path + tool_input.old_string + tool_input.new_string
Lógica:
  1. Buscar en new_string el patrón de cambio de emoji de estado
  2. Extraer task_id (patrón: "| 1-XX |" o "| 2-XX |")
  3. Extraer nuevo estado (🟡|🟠|🔵|🟢)
  4. Emitir additionalContext con hint:
     "Estado de 1-XX cambió a 🟡. Invoca productivity para registrar en plans/logs/sprint-1/1-01.log.md"
Output: additionalContext con hint estructurado

Parámetros que el hint debe incluir:
  - task_id: extraído del diff
  - new_state: emoji extraído del diff
  - timestamp: new Date().toLocaleString() en formato europeo
  - sprint_id: inferido del task_id prefix (1→1, 2→2)
```

### Alcance para Sprint 0

Para Sprint 0, el flujo **manual** (sin nuevo hook) es suficiente:
- El manager invoca `roadmap-keeper` + `productivity` en paralelo en cada transición.
- No bloquea el arranque del sprint.
- El nuevo hook `af-productivity-logger.cjs` puede implementarse en Sprint 1 como mejora.

## Decisión de implementación

| Opción | Esfuerzo | Cuando |
|--------|---------|--------|
| Flujo manual: manager invoca ambos agentes | 0h extra | Sprint 0 (ahora) |
| Nuevo hook `af-productivity-logger.cjs` | ~2h | Sprint 1 (mejora) |

**Decisión: flujo manual para Sprint 0. Hook automático en Sprint 1.**

## Success criteria de esta fase

- [ ] Gap analysis del hook documentado
- [ ] Contrato de parámetros definido (qué pasa el manager a productivity)
- [ ] Spec del futuro hook `af-productivity-logger.cjs` documentada
- [ ] Decisión de implementación registrada (manual Sprint 0 / hook Sprint 1)

## Risk assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Manager olvida invocar productivity al hacer transiciones | Media | Medio | roadmap-keeper puede emitir DONE_WITH_CONCERNS recordando al manager invocar productivity |
| Timestamp desincronizado entre roadmap-keeper y productivity | Baja | Bajo | Manager pasa el mismo timestamp a ambos agentes en la misma invocación |
