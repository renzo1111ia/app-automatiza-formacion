# Phase 04 — Formato de logs y plantillas

**Prioridad:** P1
**Estado:** pending
**Esfuerzo:** 1h

## Contexto

- Plan: [plan.md](plan.md)
- Plantillas: [templates/](templates/)
- Estructura: [phase-01-estructura-carpetas.md](phase-01-estructura-carpetas.md)

## Dos tipos de archivo

### 1. Log por tarea: `{TASK-ID}.log.md`

Un archivo por tarea. Se crea cuando la tarea pasa a 🟡 (primer evento). Cada cambio de estado añade una fila al Timeline.

**Plantilla:** [templates/TASK-ID.log.template.md](templates/TASK-ID.log.template.md)

**Secciones:**
- Frontmatter YAML con metadatos de la tarea
- Timeline tabular con todos los eventos de estado
- Métricas (estimado, real, desviación, tiempo de ciclo)
- Eventos significativos (texto libre, chronológico)
- Bugs encontrados durante revisión (puede quedar vacío)

**Reglas de relleno:**
- `status_actual`: siempre el último estado alcanzado
- `tiempo_real`: solo se puede calcular cuando hay evento 🟠 (Terminado local)
- `desviacion`: se calcula y escribe en el evento 🟠. Si > 25%: añadir ⚠️ en frontmatter
- `tiempo_ciclo_total`: se calcula y escribe en el evento 🟢

### 2. Master log del sprint: `_sprint-{X}.master.log.md`

Un archivo por sprint. Se crea con la primera tarea del sprint que pasa a 🟡. Se actualiza en cada transición de cualquier tarea del sprint.

**Plantilla:** [templates/_sprint-X.master.log.template.md](templates/_sprint-X.master.log.template.md)

**Secciones:**
- Frontmatter YAML con estado agregado del sprint
- Tabla de estado por tarea (snapshot actual)
- Métricas agregadas (estimado total, real acumulado, velocidad, proyección)
- Tabla de tareas con desviación > 25% (vacía si no hay)
- Bugs encontrados en SP-X-CLOSE-4 (se rellena al llegar a esa fase)
- Enlaces

**Reglas de actualización:**
- Actualizar tras CADA evento de estado (aunque sea solo una fila del timeline)
- `tiempo_real_acumulado`: suma de `tiempo_real` de tareas en 🟢 + en-progreso
- `velocidad`: solo calcular si >= 2 tareas completadas
- `fin_estimado_proyectado`: recalcular si velocidad cambia > 20% respecto al anterior

## Data flow completo

```
Manager pasa {task_id, sprint_id, event, timestamp, dev_name, tiempo_real?, branch?}
    ↓
productivity lee `plans/RoadMap.md` para obtener: título tarea, estimación
    ↓
productivity abre/crea `plans/logs/sprint-{X}/{TASK-ID}.log.md`
    ↓
productivity añade fila al Timeline + actualiza Métricas
    ↓
productivity abre `plans/logs/sprint-{X}/_sprint-{X}.master.log.md`
    ↓
productivity actualiza tabla de estado + métricas agregadas
    ↓
productivity retorna DONE (o DONE_WITH_CONCERNS si desviación > 25%)
```

## Cálculos derivados (examples)

### Desviación de tarea 1-01

```
estimado: 4h = 240 min
real: 3h 30min = 210 min
desviacion = ((210 - 240) / 240) * 100 = -12.5% ✓ dentro del rango
```

### Velocidad del sprint (ejemplo tras 4 días con 3 tareas completadas)

```
tareas_completadas: 1-09 (1h), 1-23 (45min), 1-24 (2h) = 3h 45min = 225 min
dias_desde_inicio: 4
velocidad = 225 / 4 = 56.25 min/día

estimacion_total: 94h = 5640 min
horas_completadas: 225 min
restante: 5640 - 225 = 5415 min
proyeccion_dias = 5415 / 56.25 = 96.3 días ⚠️ alerta: velocidad muy baja
```

### Alerta de sprint en riesgo

Si proyección > fin estimado original: emitir DONE_WITH_CONCERNS con nota al manager.

## Success criteria

- [ ] Plantilla `{TASK-ID}.log.template.md` creada en `templates/`
- [ ] Plantilla `_sprint-X.master.log.template.md` creada en `templates/`
- [ ] Data flow documentado
- [ ] Cálculos de desviación y velocidad ejemplificados
- [ ] Reglas de cuándo crear/actualizar cada archivo definidas

## Risk assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| productivity no encuentra estimación en RoadMap.md | Baja | Medio | Leer celda Estimación de la fila de la tarea; si vacía → usar "N/D" y marcar DONE_WITH_CONCERNS |
| Master log con datos incorrectos si productivity falla a mitad | Media | Bajo | Los logs son append-only — el dato anterior es siempre correcto; rerun seguro |
| Dos sesiones actualizando el master log simultáneamente | Muy baja | Medio | Sprint 1 es trabajo secuencial, no paralelo |
