---
name: blocker
description: Registrar un bloqueo con impacto y posibles soluciones
---

# Blocker

Este skill registra bloqueos y calcula su impacto en el proyecto.

## Uso

```
/blocker <descripción>
```

## Acciones

### 1. Registrar bloqueo

```markdown
## Bloqueo registrado

Descripción: <descripción>
Fecha: YYYY-MM-DD HH:MM
Fase: N - <nombre>
Tarea: <tarea actual>
```

### 2. Clasificar severidad

```
- CRÍTICO: Bloquea toda la fase
- ALTO: Bloquea múltiples tareas
- MEDIO: Bloquea una tarea
- BAJO: Ralentiza pero no bloquea
```

### 3. Calcular impacto

```
- Tiempo bloqueado estimado
- Tareas afectadas
- Dependencias impactadas
```

### 4. Sugerir alternativas

```
- ¿Se puede mockear la dependencia?
- ¿Hay tareas independientes que avanzar?
- ¿Se necesita escalar?
```

### 5. Actualizar tracking

```
- SESSION_LOG.md: registrar bloqueo
- PRODUCTIVITY.md: marcar tarea como bloqueada
- Crear issue si es necesario
```

## Ejemplo

```
> /blocker "Neon no responde, connection timeout"

🚫 Blocker Registrado

Descripción: Neon no responde, connection timeout
Severidad: CRÍTICO
Fecha: 2026-02-19 14:30

Impacto:
- Fase 2 bloqueada
- Tareas afectadas: 12
- Tiempo potencial perdido: 8h

Tareas que pueden continuar:
- ✓ Configurar ESLint (no requiere DB)
- ✓ Crear README.md (no requiere DB)
- ✓ Configurar Docker (local)

Sugerencias:
1. Verificar status de Neon: https://status.neon.tech
2. Usar PostgreSQL local temporalmente
3. Contactar soporte Neon si persiste

¿Registrar en GitHub Issues? [S/N]
```

## Resolución

```
/blocker resolve "Neon restaurado, se usó PG local mientras"

✅ Blocker Resuelto

Duración: 2h 15m
Resolución: Neon restaurado, se usó PG local mientras

Impacto final:
- Tiempo perdido: 1h (se trabajó en tareas alternativas)
- Lecciones: Tener siempre PG local como backup

✅ SESSION_LOG.md actualizado
✅ PRODUCTIVITY.md actualizado
```

## Registro de bloqueos

Todos los bloqueos se guardan en:

```
.claude/productivity/BLOCKERS.md
```

Para análisis retrospectivo y mejora de estimaciones.
