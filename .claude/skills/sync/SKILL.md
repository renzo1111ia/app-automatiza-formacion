---
name: sync
description: Verificar y sincronizar coherencia entre documentos de tracking
---

# Sync

Este skill verifica que todos los documentos de tracking estén sincronizados y coherentes.

## Uso

```
/sync [--fix]
```

## Documentos verificados

| Documento          | Verifica                 |
| ------------------ | ------------------------ |
| PRODUCTIVITY.md    | Estado de fases, tiempos |
| project_roadmap.md | Checklists, estado       |
| SESSION_LOG.md     | Sesiones registradas     |
| settings.json      | Configuración agentes    |
| plugin.json        | Agentes registrados      |

## Verificaciones

### 1. Coherencia de estado

```
- ¿Fase actual es la misma en todos los docs?
- ¿Tareas completadas coinciden?
- ¿Porcentajes de progreso son correctos?
```

### 2. Coherencia de tiempos

```
- ¿Tiempos reales suman correctamente?
- ¿Desviaciones calculadas bien?
- ¿Totales de fase correctos?
```

### 3. Coherencia de agentes

```
- ¿Todos los agentes en plugin.json están documentados?
- ¿settings.json tiene todos los agentes?
- ¿Hay agentes huérfanos?
```

### 4. Coherencia de Git

```
- ¿Rama actual corresponde a fase actual?
- ¿Hay cambios sin commit?
- ¿Estamos sincronizados con remote?
```

## Ejemplo

```
> /sync

🔄 Sincronización de documentos

Verificando coherencia...

PRODUCTIVITY.md ─────────────────────
  ✅ Fase actual: 2
  ✅ Tareas completadas: 5
  ✅ Tiempo total: 3h 30m

project_roadmap.md ──────────────────
  ✅ Fase actual: 2
  ⚠️ Tareas completadas: 4 (debería ser 5)
  ✅ Estado: En progreso

SESSION_LOG.md ──────────────────────
  ✅ Última sesión registrada
  ✅ Timestamps válidos

settings.json ───────────────────────
  ✅ 15 agentes configurados

plugin.json ─────────────────────────
  ✅ 15 agentes registrados
  ✅ 8 skills registrados
  ✅ 4 hooks registrados

Git ─────────────────────────────────
  ✅ Rama: phase/2-auth (correcta)
  ⚠️ Cambios sin commit: 2 archivos
  ✅ Sincronizado con remote

Resultado: 2 inconsistencias encontradas

¿Corregir automáticamente? [S/N]
```

## Con --fix

```
> /sync --fix

🔄 Sincronización con corrección automática

Corrigiendo...

project_roadmap.md:
  ✓ Actualizado: tareas completadas 4 → 5

Git:
  ℹ️ Cambios sin commit detectados
  ℹ️ Usa /checkpoint para guardar progreso

✅ 1 corrección aplicada
⚠️ 1 acción manual requerida
```

## Cuándo usar

- Al inicio de cada sesión
- Después de resolver conflictos de merge
- Cuando algo "no cuadra"
- Antes de /sprint complete
