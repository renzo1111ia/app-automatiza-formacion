# Phase 05 — Ajustes CI + Pre-commit hook (readme sync)

**Contexto:** [plan.md](plan.md) · [staging-main-purity-check.yml](../../.github/workflows/staging-main-purity-check.yml)

**last_updated:** 2026-05-20

## Overview

- **Prioridad:** P2 — mejora la seguridad del sistema pero no bloquea el bootstrap
- **Estado:** Pendiente
- **Estimación:** 1h (CI 30min + pre-commit hook 30min)
- **Archivos a editar/crear:**
  - `.github/workflows/staging-main-purity-check.yml` (renombrar a `repo-purity-check.yml`)
  - `.claude/hooks/esden-readme-sync-precommit.cjs` (CREAR)
- **Dependencias:** Ninguna (puede ejecutarse en paralelo con fases 01-04)

## Key Insights

- El CI actual valida que `docs/`, `plans/`, `.claude/`, `.claude-plugin/`, `CLAUDE.md` NO existen en staging/main.
- Nuevas validaciones necesarias:
  1. En staging: `README.staging.md` y `README.main.md` NO deben existir (deben haberse renombrado/eliminado por promote).
  2. En main: idem.
  3. En developer (nuevo job): los 3 READMEs deben estar sincronizados con RoadMap.md — usar `--check` flag.
- El job de developer necesita que el runner tenga Node.js disponible (GitHub Actions ubuntu-latest lo tiene).
- No añadir secrets ni env vars — el script sólo lee archivos locales.

## Análisis del CI actual

```yaml
on:
  push:
    branches: [staging, main]
  pull_request:
    branches: [staging, main]
```

El workflow actual sólo dispara en staging/main. El nuevo job de developer necesita un trigger distinto.

## Cambio 1: Añadir checks a staging/main

En el step "Check for forbidden paths", añadir después del bucle `for p in "${FORBIDDEN[@]}"`:

```bash
# Validacion adicional: README sobrantes de otras ramas
BRANCH="${GITHUB_REF##*/}"
if [[ "$BRANCH" == "staging" || "$BRANCH" == "main" ]]; then
  README_ARTIFACTS=("README.staging.md" "README.main.md")
  for f in "${README_ARTIFACTS[@]}"; do
    if [ -f "$f" ]; then
      echo "::error::File '$f' should not exist on branch '$BRANCH'. Run promote script to rename README correctly."
      FAIL=1
    fi
  done
fi
```

## Cambio 2: Nuevo job para rama developer (README sync check)

Añadir un nuevo `job` al mismo workflow (o crear workflow separado — ver decisión abajo):

```yaml
readme-sync-check:
  name: Verify READMEs are in sync with RoadMap.md
  runs-on: ubuntu-latest
  # Solo en developer y sus feature branches (no staging/main)
  if: |
    github.ref == 'refs/heads/developer' ||
    startsWith(github.ref, 'refs/heads/feature/')

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'

    - name: Check READMEs are in sync with RoadMap.md
      run: node scripts/generate-readmes.cjs --check
```

### Decisión: mismo workflow o workflow separado

**Opción A — mismo workflow** (recomendada, KISS):
- Un solo archivo `.github/workflows/staging-main-purity-check.yml` → renombrar a `repo-purity-check.yml`
- Pros: menos archivos, todo centralizado
- Cons: el nombre del archivo ya no describe perfectamente su scope

**Opción B — workflow separado** `developer-readme-sync.yml`:
- Pros: más claro en GitHub Actions UI
- Cons: un archivo más

**Decisión para implementación: Opción A** — ampliar el mismo workflow, renombrarlo a `repo-purity-check.yml`. YAGNI — no crear otro archivo cuando el existente sirve.

## Trigger del workflow ampliado

```yaml
on:
  push:
    branches: [developer, staging, main, 'feature/**']
  pull_request:
    branches: [developer, staging, main]
```

El job `purity-check` sólo se ejecuta en staging/main (condición `if`). El job `readme-sync-check` sólo en developer/feature/* (condición `if`).

## Comportamiento esperado del job readme-sync-check

| Escenario | Exit code | Mensaje |
|-----------|----------|---------|
| READMEs al día con RoadMap | 0 | "OK — READMEs are in sync" |
| RoadMap cambió, README.md desactualizado | 1 | "README.md differs from generated output" |
| `plans/RoadMap.md` no existe | 1 | "ERROR: plans/RoadMap.md not found" |
| Script no existe | 1 | Error de Node "Cannot find module" |

## Nombres de jobs en GitHub Actions UI

| Job | Aparece en | Trigger |
|-----|-----------|---------|
| `purity-check` | staging/main push/PR | Igual que ahora |
| `readme-sync-check` | developer/feature push | Nuevo |

## Todo list

- [ ] Añadir check de `README.staging.md` / `README.main.md` en step existente de purity-check
- [ ] Añadir trigger `developer` y `feature/**` al `on.push.branches`
- [ ] Añadir job `readme-sync-check` con condición `if`
- [ ] Renombrar el workflow de `Staging/Main Purity Check` a `Repo Purity Check`
- [ ] Verificar que el job no dispara en staging/main (condición if correcta)

## Success criteria

- Push a staging con `README.staging.md` presente → job `purity-check` falla con mensaje claro
- Push a developer sin regenerar READMEs → job `readme-sync-check` falla con exit 1
- Push a developer con READMEs sincronizados → ambos jobs pasan
- CI no dispara `readme-sync-check` en staging ni main

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|-----------|
| CI falla en feature/* porque `plans/RoadMap.md` no existe (branch sin RoadMap) | Baja | Medio | El script retorna exit 1 — pero todos los feature branches parten de developer que sí tiene el RoadMap |
| El job `readme-sync-check` añade ~30s a cada push en developer | Alta | Bajo | Aceptable — node + checkout rápido en ubuntu-latest |
| Renombrar el workflow rompe referencias en CLAUDE.md o docs/ | Baja | Bajo | Actualizar referencias en CLAUDE.md si las hay |

## CI bloqueante — Required Status Check (D-2)

El job `readme-sync-check` debe configurarse como **required status check** en GitHub Branch Protection Rules para la rama `developer`.

**Cómo configurarlo** (acción manual tras merge del CI):
1. GitHub repo → Settings → Branches → Branch protection rules → `developer`
2. Activar "Require status checks to pass before merging"
3. Buscar y añadir el job `readme-sync-check` como required check
4. Guardar

**Fallback si CI falla:**
El dev ejecuta `npm run generate-readmes` localmente, commitea los READMEs actualizados, y vuelve a pushear. El CI vuelve a pasar porque los archivos ya coinciden con el RoadMap.

> **Nota de rodaje:** Si el CI bloqueante genera fricción al inicio (ej. devs olvidando regenerar READMEs con frecuencia), considerar pasarlo a informativo (`continue-on-error: true`) durante 1-2 sprints mientras el equipo adopta el hábito. Activar bloqueante una vez que no haya fallos espurios durante 1 sprint completo.

## Pre-commit hook local (D-5 — Defensa en profundidad)

Estrategia: **pre-commit local + CI bloqueante** — dos capas de defensa. El hook local atrapa el error antes del push; el CI es el respaldo.

### Archivo a crear: `.claude/hooks/esden-readme-sync-precommit.cjs`

**Comportamiento:**
- Se activa antes de cada commit en rama `developer`
- Ejecuta `node scripts/generate-readmes.cjs --check`
- Si los READMEs no están sincronizados con RoadMap.md: **bloquea el commit** con mensaje claro
- Si están sincronizados: deja pasar el commit sin ruido

**Mensaje de error al desarrollador:**
```
[esden-readme-sync] ERROR: Los README.md no están sincronizados con plans/RoadMap.md.
Ejecuta: npm run generate-readmes
Luego vuelve a commitear.
```

**Scope del hook:** Solo activo en rama `developer`. En `staging` y `main` no existe `plans/RoadMap.md` — el hook debe verificar la rama actual y salir con exit 0 si no es `developer`.

```js
// Pseudocódigo del guard de rama
const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
if (branch !== 'developer' && !branch.startsWith('feature/')) {
  process.exit(0); // No aplica en staging/main
}
```

### Registro en `.claude/hooks/hooks.json`

El hook se registra en la configuración de Claude Code hooks:

```json
{
  "hooks": [
    {
      "event": "PreCommit",
      "script": ".claude/hooks/esden-readme-sync-precommit.cjs",
      "description": "Verifica que los README.md están sincronizados con RoadMap.md antes de commitear en developer"
    }
  ]
}
```

> Si `hooks.json` ya tiene otras entradas, añadir el nuevo objeto al array existente sin reemplazar los demás.

## Rollback plan

Si el nuevo job genera falsos positivos: añadir condición `continue-on-error: true` temporalmente mientras se debuggea, o eliminar el job con un PR rápido. El job existente `purity-check` no cambia en esencia — sólo se añaden checks de archivos.

Para el pre-commit hook: si genera falsos positivos, eliminar o comentar el registro en `hooks.json`. El hook en sí no toca archivos — sólo lee y sale con exit code.

## Next Steps

Esta fase es la última de las paralelas. Phase-06 (bootstrap) puede ejecutarse una vez phase-01 y phase-02 estén DONE.
