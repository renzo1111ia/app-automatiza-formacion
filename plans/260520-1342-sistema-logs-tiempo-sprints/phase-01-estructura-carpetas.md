# Phase 01 — Estructura de carpetas plans/logs/

**Prioridad:** P1
**Estado:** pending
**Esfuerzo:** 30min

## Contexto

- Plan: [plan.md](plan.md)
- RoadMap: [plans/RoadMap.md](../../RoadMap.md)

## Descripción

Definir y documentar la estructura de directorios que usará el agente `productivity` para persistir logs de tiempo por sprint. Los directorios reales bajo `plans/logs/` NO se crean ahora — se crean cuando arranque Sprint 0 (primera tarea pase a 🟡).

## Estructura objetivo

```
plans/
└── logs/
    ├── sprint-1/
    │   ├── _sprint-1.master.log.md     # Agregado del sprint (creado en primer arranque)
    │   ├── 1-01.log.md                 # Log por tarea
    │   ├── 1-02.log.md
    │   ├── ...
    │   └── 1-24.log.md
    ├── sprint-2/
    │   ├── _sprint-2.master.log.md
    │   ├── 2-01.log.md
    │   └── ...
    └── sprint-3/
        └── ...
```

## Convenciones de nomenclatura

| Elemento | Patrón | Ejemplo |
|----------|--------|---------|
| Directorio sprint | `sprint-{numero}` | `sprint-1` |
| Master log | `_sprint-{numero}.master.log.md` | `_sprint-1.master.log.md` |
| Log por tarea | `{TASK-ID}.log.md` | `1-01.log.md` |

- El prefijo `_` en el master log lo coloca primero en listados alfabéticos.
- Task IDs en MAYÚSCULAS para alinearse con RoadMap.md.
- Todos los logs suben a git (son documentación pública del sprint).

## Regla de creación

| Evento | Acción del agente productivity |
|--------|-------------------------------|
| Primera tarea del sprint pasa a 🟡 | Crear `plans/logs/sprint-{x}/` + `_sprint-{x}.master.log.md` |
| Cualquier tarea pasa a 🟡 | Crear `plans/logs/sprint-{x}/{TASK-ID}.log.md` si no existe |
| Cualquier cambio de estado | Actualizar `{TASK-ID}.log.md` + `_sprint-{x}.master.log.md` |

## Archivos a crear

- Solo plantillas en `plans/260520-1342-sistema-logs-tiempo-sprints/templates/` (ver phase-04)
- Los archivos reales bajo `plans/logs/` los crea `productivity` en tiempo de ejecución

## Success criteria

- [ ] Estructura documentada y aprobada
- [ ] Convenio de nombres definido y sin ambigüedades
- [ ] Reglas de creación claras (cuándo se crean los dirs reales)
- [ ] Plantillas listas en `templates/` (phase-04)
