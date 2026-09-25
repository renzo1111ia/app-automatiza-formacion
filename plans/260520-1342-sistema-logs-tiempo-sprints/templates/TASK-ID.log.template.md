---
task_id: {TASK-ID}
sprint: {SPRINT-NUMERO}
title: {Título de la tarea copiado de RoadMap.md}
estimated: {Xh Ymin}
status_actual: {🔘|🟡|🟠|🔵|🟢}
alerta_desviacion: false
---

# Log {TASK-ID} — {Título de la tarea}

## Timeline

| Evento | Timestamp | Dev | Notas |
|--------|-----------|-----|-------|
| 🔘 → 🟡 | DD-MM-YYYY HH:MM | {dev} | Arranque |
| 🟡 → 🟠 | DD-MM-YYYY HH:MM | {dev} | Terminado local |
| 🟠 → 🔵 | DD-MM-YYYY HH:MM | {dev} | Push branch {branch-name} |
| 🔵 → 🟢 | DD-MM-YYYY HH:MM | manager | Mergeado a developer |

## Métricas

- **Estimado:** {Xh Ymin}
- **Real (🟡→🟠):** {Xh Ymin} ← solo disponible tras evento 🟠
- **Desviación:** {+/-XX%} ({dentro del rango aceptable | ⚠️ warning | 🚨 alerta})
- **Tiempo total de ciclo (🟡→🟢):** {Xh Ymin} ← solo disponible tras evento 🟢

## Eventos significativos

<!-- Añadir con formato: HH:MM — Descripción del evento -->
<!-- Ejemplo: 11:30 — Identificado mismatch firma con executeSequenceStep(). Refactor mayor evitado. -->

## Bugs encontrados durante revisión

<!-- Si no hay: escribir "(ninguno hasta cierre)" -->
<!-- Si hay: listar con formato: - [ID] Descripción → [estado: abierto|cerrado] -->
