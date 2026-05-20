---
name: status
description: Ver estado general del proyecto y progreso actual
---

# Project Status

Este skill muestra el estado general del proyecto.

## Uso

```
/status
```

## Información mostrada

### Proyecto

- Nombre y versión
- Fase actual
- Rama activa

### Progreso

- Checklist de fase actual
- Tareas completadas / pendientes
- Porcentaje de avance

### Productividad

- Tiempo estimado restante
- Tiempo invertido
- Desviación actual

### Próximos pasos

- Siguiente tarea recomendada
- Bloqueos identificados

## Ejemplo de salida

```
📊 Estado del Proyecto

Proyecto: SaaS Multi-Tenant
Versión: 0.0.1
Fase: 0 - Documentation & Planning
Rama: phase/0-documentation

Progreso: ████████░░ 80%
- Completadas: 8/10 tareas
- Pendientes: 2 tareas

⏱️ Productividad
- Invertido: 4h 30m
- Estimado restante: 1h 30m
- Desviación: +5%

📋 Próxima tarea:
→ Crear estructura de carpetas métricas
```
