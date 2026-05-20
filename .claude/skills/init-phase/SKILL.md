---
name: init-phase
description: Inicializar una nueva fase del proyecto con setup automático
---

# Init Phase

Este skill automatiza el setup de una nueva fase del proyecto.

## Uso

```
/init-phase <n>
```

## Acciones automáticas

### 1. Verificar estado actual

```
- Leer PRODUCTIVITY.md para fase actual
- Verificar que fase anterior está completada
- Verificar que estamos en rama correcta
```

### 2. Crear rama

```bash
git checkout develop
git pull origin develop
git checkout -b phase/<n>-<nombre>
git push -u origin phase/<n>-<nombre>
```

### 3. Actualizar tracking

```
- Actualizar PRODUCTIVITY.md: fase = N, estado = "En progreso"
- Actualizar SESSION_LOG.md: nuevo inicio de fase
- Actualizar project_roadmap.md: marcar fase como "En progreso"
```

### 4. Mostrar checklist

```
📋 Fase N: <nombre>

Estimación: Xh
Tareas: Y

□ Tarea 1 (30m)
□ Tarea 2 (1h)
...

Siguiente paso: <primera tarea>
```

### 5. Preparar @productivity

```
- Registrar timestamp de inicio
- Preparar tracking de tareas
```

## Ejemplo

```
> /init-phase 1

✅ Init Phase 1: Project Setup

Acciones completadas:
- ✓ Rama phase/1-project-setup creada
- ✓ PRODUCTIVITY.md actualizado
- ✓ SESSION_LOG.md actualizado

📋 Checklist de Fase 1 (16h estimadas):

□ Inicializar Next.js 16.1 (30m)
□ Configurar estructura carpetas (1h)
□ Configurar TypeScript strict (30m)
...

🎯 Siguiente: Inicializar Next.js 16.1

¿Comenzar? [S/N]
```

## Validaciones

- No permite iniciar fase si anterior no completada
- Verifica que no hay cambios sin commit
- Verifica conexión a GitHub
