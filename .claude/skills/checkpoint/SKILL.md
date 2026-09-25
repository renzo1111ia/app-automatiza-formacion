---
name: checkpoint
description: Guardar progreso parcial sin completar la fase
---

# Checkpoint

Este skill guarda el progreso actual sin necesidad de completar la fase.

## Uso

```
/checkpoint [mensaje]
```

## Acciones

### 1. Verificar estado actual

```
- Tareas completadas
- Tareas en progreso
- Cambios sin commit
```

### 2. Crear commit de checkpoint

```bash
git add .
git commit -m "checkpoint: <mensaje>

Progreso de fase N:
- Completadas: X/Y tareas
- En progreso: Z tarea
- Tiempo invertido: Xh

"
```

### 3. Push a remote

```bash
git push origin phase/<n>-<nombre>
```

### 4. Actualizar tracking

```
- SESSION_LOG.md: registrar checkpoint
- PRODUCTIVITY.md: actualizar tiempos reales
```

### 5. Generar resumen

```
📍 Checkpoint guardado

Progreso: 45%
Completadas: 5/11 tareas
Tiempo invertido: 3h 45m

Próxima sesión:
→ Continuar con: "Tarea X"
```

## Ejemplo

```
> /checkpoint "Fin de sesión - auth endpoints listos"

📍 Checkpoint: Fin de sesión - auth endpoints listos

Commit: abc1234
Rama: phase/2-auth

Progreso de Fase 1:
├─ ✅ Tabla users (45m)
├─ ✅ POST /auth/register (1h 30m)
├─ ✅ POST /auth/login (1h 15m)
├─ 🔄 JWT generation (en progreso)
└─ ⏳ 10 tareas pendientes

Tiempo invertido: 3h 30m / 32h estimado
Progreso: 11%

✅ Commit creado y pusheado
✅ SESSION_LOG.md actualizado
✅ PRODUCTIVITY.md actualizado

Próxima sesión:
→ Continuar con: JWT generation
→ Estimación restante: 28h 30m
```

## Diferencia con /sprint complete

| /checkpoint             | /sprint complete          |
| ----------------------- | ------------------------- |
| Guarda progreso parcial | Cierra fase completamente |
| No crea PR              | Crea PR a develop         |
| No genera tag           | Genera tag semver         |
| Para pausas             | Para finalizar            |

## Uso recomendado

- Al final de cada sesión de trabajo
- Antes de cambiar de tarea larga
- Cuando hay progreso significativo
- Antes de operaciones riesgosas
