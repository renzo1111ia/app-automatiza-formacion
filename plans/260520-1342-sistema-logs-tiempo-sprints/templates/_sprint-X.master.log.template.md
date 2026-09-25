---
sprint: {SPRINT-NUMERO}
status: {🟡 En curso | 🟢 Completado}
inicio: DD-MM-YYYY HH:MM
fin_estimado: DD-MM-YYYY
fin_real: {DD-MM-YYYY | —}
estimacion_total: {Xh}
tiempo_real_acumulado: {Xh Ymin}
desviacion_acumulada: {+/-XX%}
velocidad_actual: {Xh/día | N/D (< 2 tareas completadas)}
fin_estimado_proyectado: {DD-MM-YYYY | N/D}
last_updated: DD-MM-YYYY HH:MM
---

# Master Log Sprint {SPRINT-NUMERO} — {Nombre del sprint}

## Resumen de estado

| Estado | Cantidad | Tareas |
|--------|----------|--------|
| 🔘 Pendiente | {N} | {lista de task IDs} |
| 🟡 En Desarrollo | {N} | {lista de task IDs} |
| 🟠 P. Subir GH | {N} | {lista de task IDs o —} |
| 🔵 Subida rama | {N} | {lista de task IDs o —} |
| 🟢 COMPLETADA | {N} | {lista de task IDs o —} |

## Métricas agregadas

- **Tiempo estimado total:** {Xh}
- **Tiempo real acumulado (tareas 🟢):** {Xh Ymin}
- **% completado (por estimación):** {XX%}
- **Velocidad:** {Xh/día} (calculado con >= 2 tareas completadas)
- **Fin estimado original:** {DD-MM-YYYY}
- **Fin estimado proyectado (por velocidad):** {DD-MM-YYYY | N/D}

## Tareas con desviación > 25%

<!-- Si no hay: escribir "(ninguna)" -->

| Tarea | Estimado | Real | Desviación | Causa |
|-------|----------|------|------------|-------|
| {TASK-ID} | {Xh} | {Xh Ymin} | {+XX%} ⚠️ | {descripción causa} |

## Bugs detectados en SP-{X}-CLOSE-4

<!-- Se rellena cuando se ejecuta la fase de cierre del sprint -->
<!-- Si no hay: escribir "(vacío hasta llegar a la fase)" -->

## Detalle por tarea

| Tarea | Título (corto) | Estimado | Real | Desviación | Estado |
|-------|----------------|----------|------|------------|--------|
| {TASK-ID} | {título} | {Xh} | {Xh Ymin \| —} | {%\|—} | {emoji} |

## Métricas finales del sprint

<!-- Solo se rellena al cierre del sprint (todas las tareas en 🟢) -->

- **Fecha inicio real:** {DD-MM-YYYY HH:MM}
- **Fecha cierre real:** {DD-MM-YYYY HH:MM}
- **Duración total:** {X días}
- **Estimación total:** {Xh}
- **Tiempo real total:** {Xh Ymin}
- **Desviación global:** {+/-XX%}
- **Tareas con desviación > 25%:** {N} de {total}
- **Bugs en cierre:** {N}

## Enlaces

- [RoadMap Sprint {NUMERO}](../../RoadMap.md)
- [Plan operativo Sprint {NUMERO}](../../{PLAN-DIR}/plan.md)
- [Reports](../../reports/)
