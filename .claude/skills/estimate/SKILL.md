---
name: estimate
description: Re-estimar una tarea o fase con nuevo tiempo
---

# Estimate

Este skill permite ajustar estimaciones de tiempo cuando hay desviaciones.

## Uso

```
/estimate <tarea|fase> <nuevo_tiempo> [razón]
```

## Acciones

### 1. Identificar tarea/fase

```
- Buscar en PRODUCTIVITY.md
- Verificar que existe
- Obtener estimación actual
```

### 2. Calcular impacto

```
- Diferencia con estimación original
- Impacto en fase total
- Impacto en proyecto total
```

### 3. Actualizar PRODUCTIVITY.md

```markdown
| #   | Tarea      | ⏱️ Est | Est. Rev | Real | Desv | ✓   |
| --- | ---------- | ------ | -------- | ---- | ---- | --- |
| 5   | Config RLS | 1h     | 2h (+1h) | -    | -    | 🔄  |
```

### 4. Registrar razón

```
- Añadir nota en SESSION_LOG.md
- Actualizar ESTIMATES.md con nuevo dato
```

## Ejemplos

### Re-estimar tarea

```
> /estimate "Configurar RLS" 2h "Más complejo de lo esperado"

📊 Re-estimación

Tarea: Configurar RLS
Estimación original: 1h
Nueva estimación: 2h (+1h)

Razón: Más complejo de lo esperado

Impacto:
- Fase 3: 32h → 33h (+3%)
- Proyecto: 504h → 505h (+0.2%)

✅ PRODUCTIVITY.md actualizado
✅ SESSION_LOG.md actualizado
```

### Re-estimar fase completa

```
> /estimate fase:2 40h "Auth más compleja por OAuth"

📊 Re-estimación de Fase

Fase: 2 - Auth Foundation
Estimación original: 32h
Nueva estimación: 40h (+8h)

Razón: Auth más compleja por OAuth

Impacto:
- Proyecto: 504h → 512h (+1.6%)

✅ PRODUCTIVITY.md actualizado
```

## Alertas automáticas

Si desviación > 25%:

```
⚠️ Desviación significativa detectada

Considera:
- ¿La tarea está bien definida?
- ¿Hay bloqueos no identificados?
- ¿Necesita dividirse en subtareas?
```

## Histórico

Las re-estimaciones se guardan para mejorar estimaciones futuras:

```
docs/metrics/estimates_history.md
```
