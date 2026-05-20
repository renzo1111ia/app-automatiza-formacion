---
name: sprint
description: Gestionar fases/sprints del proyecto - iniciar, revisar, completar
---

# Sprint Management

Este skill permite gestionar las fases del proyecto.

## Uso

```
/sprint <action> [args]
```

## Acciones

### Iniciar fase

```
/sprint start <n>
```

Inicia la fase N del proyecto:

1. @productivity registra inicio
2. @git crea rama phase/N-\*
3. @plan muestra checklist

### Ver estado

```
/sprint status
```

Muestra:

- Fase actual
- Progreso del checklist
- Tiempo invertido
- Tareas pendientes

### Revisar fase

```
/sprint review
```

Antes de completar:

1. @test ejecuta validaciones
2. @security audit
3. @productivity reporte

### Completar fase

```
/sprint complete
```

Si review OK:

1. @plan marca checks
2. @git crea PR a develop
3. @productivity genera reporte final
