# Phase 04 — Integración en `promote.sh` + `promote.ps1`

**Contexto:** [plan.md](plan.md) · [promote.sh](../../scripts/promote.sh) · [promote.ps1](../../scripts/promote.ps1)

## Overview

- **Prioridad:** P1 — sin esto los READMEs de staging/main serían el de developer (full detail)
- **Estado:** Pendiente
- **Estimación:** 1h
- **Archivos a editar:** `scripts/promote.sh` + `scripts/promote.ps1`
- **Dependencias:** Phase-01 y phase-02 deben estar diseñadas (para saber los nombres de archivo)

## Key Insights

- Los promote scripts actualmente eliminan `docs/`, `plans/`, `.claude/`, etc. con `git rm -rf`.
- El script NO elimina `README.md` (correcto — el README debe existir en todas las ramas).
- La nueva lógica: renombrar el README correcto + eliminar los dos sobrantes.
- Los 3 archivos en developer: `README.md` (developer), `README.staging.md` (staging), `README.main.md` (main).
- Al promover a staging: `README.staging.md` → `README.md`, eliminar `README.main.md`.
- Al promover a main: `README.main.md` → `README.md`, eliminar `README.staging.md`.
- En ambos casos: el `README.md` de developer (full detail) queda sobreescrito por el correcto.

## Data flow del promote

### Antes del promote (rama developer)

```
README.md          ← full detail (developer)
README.staging.md  ← resumen por fases
README.main.md     ← tabla de sprints
```

### Después de promover a staging

```
README.md          ← renombrado desde README.staging.md
                   (README.main.md eliminado)
```

### Después de promover a main

```
README.md          ← renombrado desde README.main.md
                   (README.staging.md eliminado)
```

## Cambios a `promote.sh`

### Insertar ENTRE paso [4/6] y paso [5/6]

Insertar este bloque después del bucle `for p in "${PATHS_TO_REMOVE[@]}"`:

```bash
echo "[4b/6] Gestionando README por rama destino..."
if [[ "$TO" == "staging" ]]; then
    if [[ ! -f "README.staging.md" ]]; then
        echo "ERROR: README.staging.md no encontrado. Ejecuta primero en developer:"
        echo "  node scripts/generate-readmes.cjs"
        exit 1
    fi
    echo "  - README.staging.md → README.md"
    if [[ $DRY_RUN -eq 0 ]]; then
        mv README.staging.md README.md
        rm -f README.main.md
    else
        echo "  (DRY RUN: mv README.staging.md README.md + rm README.main.md)"
    fi

elif [[ "$TO" == "main" ]]; then
    if [[ ! -f "README.main.md" ]]; then
        echo "ERROR: README.main.md no encontrado. Ejecuta primero en developer:"
        echo "  node scripts/generate-readmes.cjs"
        exit 1
    fi
    echo "  - README.main.md → README.md"
    if [[ $DRY_RUN -eq 0 ]]; then
        mv README.main.md README.md
        rm -f README.staging.md
    else
        echo "  (DRY RUN: mv README.main.md README.md + rm README.staging.md)"
    fi
fi
```

## Cambios a `promote.ps1`

### Insertar ENTRE paso [4/6] y paso [5/6]

```powershell
# [4b/6] Gestionar README por rama destino
Write-Host "[4b/6] Gestionando README por rama destino..."
if ($To -eq "staging") {
    if (-not (Test-Path "README.staging.md")) {
        Write-Host "ERROR: README.staging.md no encontrado. Ejecuta primero en developer:" -ForegroundColor Red
        Write-Host "  node scripts/generate-readmes.cjs" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  - README.staging.md -> README.md" -ForegroundColor Yellow
    if (-not $DryRun) {
        Move-Item -Force "README.staging.md" "README.md"
        Remove-Item -Force "README.main.md" -ErrorAction SilentlyContinue
    } else {
        Write-Host "  (DRY RUN: Move README.staging.md -> README.md + Remove README.main.md)" -ForegroundColor Magenta
    }
} elseif ($To -eq "main") {
    if (-not (Test-Path "README.main.md")) {
        Write-Host "ERROR: README.main.md no encontrado. Ejecuta primero en developer:" -ForegroundColor Red
        Write-Host "  node scripts/generate-readmes.cjs" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  - README.main.md -> README.md" -ForegroundColor Yellow
    if (-not $DryRun) {
        Move-Item -Force "README.main.md" "README.md"
        Remove-Item -Force "README.staging.md" -ErrorAction SilentlyContinue
    } else {
        Write-Host "  (DRY RUN: Move README.main.md -> README.md + Remove README.staging.md)" -ForegroundColor Magenta
    }
}
```

## Idempotencia

| Escenario | Comportamiento |
|-----------|---------------|
| `README.staging.md` no existe al promover a staging | Error explícito — instruye ejecutar el script |
| `README.main.md` no existe al promover a main | Error explícito — instruye ejecutar el script |
| `README.main.md` no existe al promover a staging | `rm -f` silencioso (ya no existe — OK) |
| Promover dos veces al mismo destino | `mv` sobreescribe README.md — idempotente |
| `--dry-run` activo | Describe las acciones sin ejecutarlas |

## Cambios a `$pathsToRemove` / `PATHS_TO_REMOVE`

**No se añaden** `README.staging.md` ni `README.main.md` a la lista de paths prohibidos de promote.

Razón: estos archivos se gestionan en el paso [4b] con lógica condicional, no eliminación ciega. La lista `PATHS_TO_REMOVE` solo tiene paths que NUNCA deben llegar a staging/main (artefactos dev).

## Comentario en el header del script

Actualizar el comentario de cabecera de ambos scripts para mencionar el nuevo comportamiento:

```
# Permanecen: codigo (src/, ...), README.md (renombrado desde README.{staging,main}.md
# según rama destino), package.json, ...
```

## Todo list

- [ ] Editar `scripts/promote.sh`: insertar bloque [4b/6] en posición correcta
- [ ] Editar `scripts/promote.ps1`: insertar bloque [4b/6] equivalente
- [ ] Actualizar comentario de cabecera en ambos scripts
- [ ] Verificar que `--dry-run` funciona en el nuevo bloque
- [ ] Test manual con `--dry-run --to staging` y `--dry-run --to main`

## Success criteria

- `./scripts/promote.sh --from developer --to staging --version 0.1.0 --dry-run` muestra la acción de renombrado sin error
- Si `README.staging.md` no existe, el promote falla con mensaje claro (no con error críptico de `mv`)
- Después del promote a staging, solo existe `README.md` en la raíz (ni `README.staging.md` ni `README.main.md`)
- Comportamiento idempotente si se ejecuta dos veces

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|-----------|
| Dev hace promote sin haber ejecutado `generate-readmes.cjs` | Alta | Medio | Error explícito en el script con instrucción correctiva |
| `mv` en Windows vs Bash tienen comportamientos distintos con archivos existentes | Media | Bajo | ps1 usa `Move-Item -Force` (sobreescribe); sh usa `mv` (sobreescribe por defecto) |
| El README de developer se queda en staging por bug en el `mv` | Baja | Alto | Validar en CI (phase-05): README.staging.md no debe existir en staging |

## Security Considerations

- Los READMEs de staging/main NO deben contener info sensible de dev (credenciales, paths internos).
- Las plantillas se diseñan para excluir referencias a `.claude/`, `plans/`, `docs/audit/` — solo info pública del proyecto.

## Next Steps

Phase-05 (CI) complementa esta fase añadiendo validaciones automáticas post-promote.
