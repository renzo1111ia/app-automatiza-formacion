# Phase 02 — Actualizar .claude/agents/productivity.md

**Prioridad:** P1
**Estado:** pending
**Esfuerzo:** 1h

## Contexto

- Plan: [plan.md](plan.md)
- Agente a editar: `.claude/agents/productivity.md`
- Agente de referencia (solo lectura): `.claude/agents/roadmap-keeper.md`
- Plantillas: [templates/](templates/)
- Integración hook: [phase-03-hook-integration.md](phase-03-hook-integration.md)

## Cambios requeridos

### A) Cambio de modelo: haiku → sonnet

**Razón:** Los cálculos de desviación cross-tarea, agregación de métricas en master log, y proyección de fin de sprint por velocidad requieren razonamiento, no solo formateo mecánico.

```yaml
# Antes
model: haiku

# Después
model: sonnet
```

### B) Actualizar frontmatter description

```yaml
# Antes
description: Use this agent for time tracking, productivity metrics, effort estimation...

# Después
description: Use this agent for sprint time logging, productivity metrics, deviation analysis, and master log aggregation. Writes detailed logs to plans/logs/sprint-X/. Trigger on task state transitions (🔘→🟡→🟠→🔵→🟢), sprint start/close, or "log time", "generate sprint report", "check desviation".
```

### C) Actualizar "Archivos que gestionas"

```markdown
## Archivos que gestionas

- `.claude/productivity/` — datos brutos internos (NO sube a git)
- `plans/logs/sprint-{X}/` — logs públicos por sprint (SÍ sube a git)
- `plans/logs/sprint-{X}/_sprint-{X}.master.log.md` — agregado del sprint
- `plans/logs/sprint-{X}/{TASK-ID}.log.md` — log por tarea

NUNCA editas:
- `plans/RoadMap.md` — exclusivo de roadmap-keeper (puedes leerlo)
- `.claude/agents/roadmap-keeper.md`
- Código de la app (src/, worker.js, supabase/)
```

### D) Añadir sección "Workflow Split con roadmap-keeper"

```markdown
## Workflow Split con roadmap-keeper

Cuando una tarea cambia de estado, el manager invoca AMBOS agentes:
1. `roadmap-keeper` actualiza la celda visible en `plans/RoadMap.md`.
2. `productivity` (tú) registra el evento en `plans/logs/sprint-{X}/{TASK-ID}.log.md`.
3. `productivity` actualiza `_sprint-{X}.master.log.md` con métricas agregadas.

Los dos agentes trabajan sobre archivos distintos — no hay conflicto de escritura.

Si necesitas conocer el estado actual de una tarea: lees RoadMap.md (NO escribes en él).
Si necesitas saber qué tareas tiene un sprint: lees RoadMap.md sección del sprint.
```

### E) Añadir sección "Reglas de cálculo de tiempos"

```markdown
## Reglas de cálculo de tiempos

### Tiempo real de una tarea
- Inicio: timestamp del evento 🟡 (En Desarrollo)
- Fin del trabajo: timestamp del evento 🟠 (P. Subir GH)
- `tiempo_real = timestamp(🟠) - timestamp(🟡)`
- El tiempo entre 🟠→🔵→🟢 (review/merge) NO se cuenta como tiempo de la tarea.

### Tiempo total de ciclo (lead time)
- Desde 🟡 hasta 🟢. Métrica diferente — útil para medir throughput del equipo.

### Cálculo de desviación
- `desviacion = ((real - estimado) / estimado) * 100`
- ±25% = aceptable (sin alerta)
- >+25% a +50% = ⚠️ warning — anotar causa en el log
- >+50% = 🚨 alerta al manager — retro automática al cierre del sprint

### Velocidad del sprint
- `velocidad = horas_completadas_🟢 / dias_calendario_desde_inicio`
- Proyección de fin = `(estimacion_total - horas_completadas) / velocidad`
- Solo calcular si hay >= 2 tareas completadas (muestra insuficiente con 1)
```

### F) Actualizar sección "Responsabilidades"

Reemplazar lista actual por:

```markdown
## Responsabilidades

1. Crear y actualizar `{TASK-ID}.log.md` en cada transición de estado de la tarea
2. Crear y mantener `_sprint-{X}.master.log.md` con métricas agregadas del sprint
3. Calcular tiempos reales, desviaciones y velocidad del sprint
4. Alertar al manager cuando desviación > 25% en una tarea
5. Alertar al manager cuando > 30% de tareas del sprint tienen desviación > 30%
6. Proyectar fecha de fin de sprint basada en velocidad actual
7. Al cierre del sprint: generar sección "Métricas finales" en el master log
```

### G) Actualizar sección "Reglas"

```markdown
## Reglas

1. **Tiempos = INTERNO + PÚBLICO**: datos brutos en `.claude/productivity/` (no git); logs formateados en `plans/logs/` (sí git)
2. **Estado de tareas = leer de RoadMap.md, NUNCA escribir en él**
3. **Alertar** si desviación > 25% — anotar causa
4. **Alertar al manager** si desviación > 50% — retro automática al cierre sprint
5. **Siempre informar** tiempos estimados vs invertidos al completar una tarea
6. **Crear el dir `plans/logs/sprint-{x}/`** al arrancar la primera tarea del sprint
7. **Plantillas** en `plans/260520-1342-sistema-logs-tiempo-sprints/templates/`
```

## Archivos a modificar

- `.claude/agents/productivity.md` — edición directa

## Success criteria

- [ ] `model: sonnet` en frontmatter
- [ ] Sección "Archivos que gestionas" actualizada
- [ ] Sección "Workflow Split con roadmap-keeper" presente
- [ ] Sección "Reglas de cálculo de tiempos" presente
- [ ] Sección "Responsabilidades" actualizada
- [ ] Sección "Reglas" actualizada
- [ ] Sin referencias a `docs/planning/` (ruta antigua)

## Risk assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Productivity empiece a editar RoadMap.md | Baja | Alto | Regla explícita "NUNCA editas RoadMap.md" + lectura siempre permitida |
| Conflicto de escritura roadmap-keeper vs productivity | Muy baja | Medio | Archivos completamente distintos (RoadMap.md vs plans/logs/) |
| Master log desincronizado del RoadMap | Media | Medio | productivity lee RoadMap.md como fuente de verdad antes de actualizar |
