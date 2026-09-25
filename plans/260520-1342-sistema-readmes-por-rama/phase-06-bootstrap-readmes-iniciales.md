# Phase 06 — Bootstrap inicial de los 3 README.md

**Contexto:** [plan.md](plan.md) · [phase-01](phase-01-script-generador.md) · [phase-02](phase-02-plantillas-por-rama.md)

**last_updated:** 2026-05-20

## Overview

- **Prioridad:** P1 — genera los archivos finales que justifican todo el sistema
- **Estado:** Pendiente — NO ejecutar hasta que phase-01 y phase-02 estén DONE
- **Estimación:** 1h (incluyendo revisión visual)
- **Archivos que produce:** `README.md`, `README.staging.md`, `README.main.md` en raíz del repo
- **Dependencias:** phase-01 DONE + phase-02 DONE

## Key Insights

- El bootstrap se ejecuta en rama `auditoria` (branch actual), que luego se mergeará a `developer`.
- El `README.md` existente es el bootstrap de Next.js — debe ser reemplazado completamente.
- La verificación visual es OBLIGATORIA antes del commit — el primer output establece el formato canónico.
- El commit del bootstrap incluye TODO: script + templates + cambios keeper + promote scripts + CI + los 3 READMEs — commit atómico.

## Pre-condiciones del bootstrap

Verificar ANTES de ejecutar:

- [ ] `plans/RoadMap.md` existe y tiene frontmatter correcto (`project_version: v0.0.0`)
- [ ] `scripts/generate-readmes.cjs` existe y ejecuta sin errores
- [ ] `scripts/readme-templates/README.developer.template.md` existe (path definitivo — 3-3)
- [ ] `scripts/readme-templates/README.staging.template.md` existe (path definitivo — 3-3)
- [ ] `scripts/readme-templates/README.main.template.md` existe (path definitivo — 3-3)
- [ ] Node.js 22.x disponible en el entorno
- [ ] `package.json` tiene los scripts `generate-readmes` y `generate-readmes:check` (3-1)

## Pasos del bootstrap

### Paso 1: Dry run (verificación sin escribir)

```bash
node scripts/generate-readmes.cjs --dry-run
# Las plantillas se leen desde scripts/readme-templates/ (3-3)
```

Revisar el output en consola para los 3 archivos. Verificar:
- Versión del proyecto correcta (`v0.0.0`)
- Fecha de última actualización correcta (del frontmatter del RoadMap)
- Stack table correcta
- Quick Start correcto
- RoadMap completo en developer output
- RoadMap resumido en staging output
- Solo sprints en main output
- Sin marcadores `{{...}}` sin resolver

### Paso 2: Generación real

```bash
npm run generate-readmes
# Equivale a: node scripts/generate-readmes.cjs
# Las plantillas se leen desde scripts/readme-templates/ (3-3)
```

Salida esperada:
```
Generated README.md (developer — full detail)
Generated README.staging.md (staging — by phase/sprint)
Generated README.main.md (main — sprints only)
```

### Paso 3: Verificación visual

Abrir los 3 archivos y confirmar:

**README.md (developer):**
- Cabecera con nombre del proyecto y versión
- Stack table (7 filas máximo)
- Quick Start con comandos correctos
- RoadMap completo con TODAS las tareas (1-01..1-26, 2-01..2-34, 3-XX, 4-XX, 5-XX)
- Estados visibles con iconos
- Sección Contributing con enlace a `docs/dev-onboarding.md`

**README.staging.md:**
- Tabla de fases+sprints (5 filas: 1, 2, 3, 4, 5)
- Sin tareas individuales
- % completado visible (todos en 0% al inicio)
- Sin referencias a `docs/`, `.claude/`, `plans/`

**README.main.md:**
- Tabla de sprints (5 filas)
- Sin fechas de release (todos `—` al inicio)
- Sin referencias internas de desarrollo
- Descripción orientada a deploy/producción

### Paso 4: Check de sincronización

```bash
npm run generate-readmes:check
# Equivale a: node scripts/generate-readmes.cjs --check
```

Debe salir con exit 0 (recién generados — deben coincidir). Este es el mismo comando que ejecuta el CI (`readme-sync-check`) y el pre-commit hook (3-2, 3-5).

### Paso 5: Commit atómico

```bash
git add \
  scripts/generate-readmes.cjs \
  scripts/readme-templates/ \
  package.json \
  .claude/agents/roadmap-keeper.md \
  .claude/hooks/af-readme-sync-precommit.cjs \
  scripts/promote.sh \
  scripts/promote.ps1 \
  .github/workflows/repo-purity-check.yml \
  README.md \
  README.staging.md \
  README.main.md

git commit -m "feat(scaffold): sistema de 3 README.md sincronizados por rama desde RoadMap.md"
```

> Nota: el workflow se habrá renombrado de `staging-main-purity-check.yml` a `repo-purity-check.yml` en phase-05 — usar el nombre nuevo en el `git add`.

## Checklist de validación post-commit

- [ ] `git log --oneline -1` muestra el commit correcto
- [ ] `git show --stat HEAD` lista todos los archivos esperados
- [ ] `README.md` en el repo es la versión developer (full detail), NO el bootstrap de Next.js
- [ ] `README.staging.md` existe en raíz
- [ ] `README.main.md` existe en raíz
- [ ] `node scripts/generate-readmes.cjs --check` retorna exit 0 en clean working tree

## Impacto en ramas futuras

| Acción futura | Resultado esperado |
|--------------|-------------------|
| PR de feature/* a developer | READMEs se regeneran antes del merge si RoadMap cambió |
| Promote developer → staging | README.staging.md → README.md, README.main.md se elimina |
| Promote staging → main | README.main.md → README.md (ya estaba en developer), README.staging.md se elimina |
| Cambio de estado de tarea | roadmap-keeper regenera los 3 READMEs en el mismo commit |

## Rollback plan

Si el bootstrap produce outputs incorrectos:

1. `git checkout README.md` — restaura el anterior (Next.js bootstrap)
2. Eliminar `README.staging.md` y `README.main.md`
3. Revisar el script / las plantillas con `--dry-run` hasta corregir el problema
4. Repetir el bootstrap

El rollback NO afecta a `plans/RoadMap.md` (no se toca en este bootstrap).

## Todo list

- [ ] Verificar pre-condiciones (todas las fases previas DONE)
- [ ] Ejecutar `--dry-run` y revisar output
- [ ] Ejecutar generación real
- [ ] Verificar visualmente los 3 archivos
- [ ] Ejecutar `--check`
- [ ] Hacer commit atómico con todos los archivos

## Success criteria

- `README.md` reemplaza completamente el bootstrap de Next.js
- Los 3 READMEs pasan la verificación visual de nivel de detalle
- `generate-readmes.cjs --check` retorna exit 0 tras el commit
- Ningún marcador `{{...}}` visible en los 3 outputs

## Next Steps

Tras el bootstrap, el sistema está operativo. El agente `roadmap-keeper` mantiene los READMEs sincronizados a partir de aquí en cada cambio de estado.
