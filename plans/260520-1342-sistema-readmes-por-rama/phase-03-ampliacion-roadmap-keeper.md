# Phase 03 — Ampliación del agente `roadmap-keeper`

**Contexto:** [plan.md](plan.md) · [roadmap-keeper.md](../../.claude/agents/roadmap-keeper.md)

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente
- **Estimación:** 30min
- **Archivo a editar:** `.claude/agents/roadmap-keeper.md`
- **Dependencias:** Ninguna (paralela a phase-01 y phase-02)

## Key Insights

- El agente ya tiene `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` — Bash es suficiente para ejecutar `node scripts/generate-readmes.cjs`.
- El cambio es mínimo: añadir UNA sección nueva al final del fichero + ajustar el frontmatter `description` para mencionar READMEs.
- La atomicidad del commit (RoadMap + 3 READMEs en el mismo commit) es la regla crítica a documentar.

## Cambios a aplicar

### 1. Actualizar campo `description` del frontmatter

**Antes:**
```
description: Use this agent PROACTIVELY to maintain `plans/RoadMap.md` in real time. [...]
```

**Después:**
```
description: Use this agent PROACTIVELY to maintain `plans/RoadMap.md` in real time AND regenerate the 3 branch-specific README.md files after any RoadMap change. [...]
```

### 2. Añadir sección al final del archivo

Añadir DESPUÉS de la sección "## Si detectas inconsistencias" y ANTES de "## Status reporting":

```markdown
## Mantenimiento de READMEs por rama

Tras CUALQUIER cambio en `plans/RoadMap.md` (cambio de estado de tarea, cierre de sprint,
replanificación, bump de versión), regeneras los 3 README.md ejecutando:

```bash
node scripts/generate-readmes.cjs
```

### Qué produce el script

| Archivo | Rama destino | Nivel de detalle |
|---------|-------------|-----------------|
| `README.md` | `developer` | Full — todas las tareas con estado y estimación |
| `README.staging.md` | `staging` (se renombra al promover) | Resumen por fases + sprints, sin tareas individuales |
| `README.main.md` | `main` (se renombra al promover) | Sólo tabla de sprints + versión + fecha de release |

### Regla de atomicidad (CRÍTICA)

Los 3 archivos `README*.md` se **commitean en el mismo commit** que el cambio al RoadMap.
No hay commits parciales. Si el script falla: reporta BLOCKED al manager. No commitees el RoadMap sin los READMEs actualizados.

Flujo estándar tras actualizar RoadMap:

1. Editar `plans/RoadMap.md` (cambio de estado, estimación, etc.)
2. Ejecutar `node scripts/generate-readmes.cjs`
3. Verificar que no hay errores en la salida del script
4. `git add plans/RoadMap.md README.md README.staging.md README.main.md`
5. `git commit -m "docs(roadmap): update task X-YY status + regenerate READMEs"`

### Si el script falla

- `ERROR: plans/RoadMap.md not found` → estás en rama staging/main en vez de developer. Cambia de rama.
- `ERROR: unresolved markers` → la plantilla tiene un marcador que el script no conoce — reportar como bug al lead.
- `ERROR: template not found` → falta el archivo en `scripts/readme-templates/` — reportar al lead.
- Cualquier otro error: BLOCKED + mensaje al manager con el stderr completo.

### Verificación rápida post-commit

```bash
node scripts/generate-readmes.cjs --check
```

Exit 0 = READMEs sincronizados con RoadMap.md. Exit 1 = hay diferencias — regenerar y re-commitear.
```

## Architecture (cambio mínimo)

El agente ya tiene Bash en tools. NO hay cambios al frontmatter `tools`.
El único cambio es de documentación: dos ediciones de texto en el `.md`.

## Trigger nuevo a documentar

En la tabla "Reglas de validación cruzada con otros agentes" añadir fila:

| Agente | Te invoca cuando | Verificas |
|--------|-----------------|-----------|
| `roadmap-keeper` (auto) | Tras cualquier edición propia de RoadMap.md | Ejecutas `generate-readmes.cjs` antes de commit |

(Esto es auto-referencial — el agente se auto-invoca la comprobación, no hay otro agente que lo dispare para esto.)

## Todo list

- [ ] Editar campo `description` del frontmatter en `roadmap-keeper.md`
- [ ] Añadir sección "## Mantenimiento de READMEs por rama" en posición correcta
- [ ] Añadir fila en tabla de validación cruzada

## Success criteria

- El agente actualizado menciona explícitamente el script en su descripción
- La sección nueva describe el flujo de atomicidad de forma inequívoca
- Los comandos bash en la sección son copy-paste ejecutables

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|-----------|
| Dev olvida correr el script y commitea solo el RoadMap | Alta | Medio | CI check en developer (`--check` flag) documentado en phase-05 |
| Sección nueva rompe formato del agente | Baja | Bajo | Inspeccionar el archivo antes de editar — seguir estructura de secciones existente |

## Next Steps

Esta fase es independiente — puede ejecutarse junto con phase-01 y phase-02.
