---
description: Promociona `staging` → `main` (PRODUCCIÓN) ejecutando promote.ps1. Crea tag SemVer y limpia automáticamente artefactos internos.
argument-hint: <version>  (formato SemVer, ej. 0.1.0 — debe coincidir con el último staging)
allowed-tools: [Bash, Read]
---

# Promote staging → main (PRODUCCIÓN)

Vas a promocionar `staging` a `main` (rama de producción) con versión **$1**. Esta es la promoción de mayor riesgo del flujo.

## Pre-requisitos (BLOQUEANTES)

1. **El cliente debe haber validado `staging`** explícitamente. Si no hay constancia escrita de la validación: detente y pídela al usuario.
2. **Requiere orden explícita del usuario** + confirmación "YES" literal en la ejecución.
3. **Working tree limpio**.
4. **La versión `$1`** debe coincidir con el último tag/commit de `staging` (es la misma versión, no se incrementa al pasar a main).
5. Si el usuario no ha dado argumento `$1`, detén y pídele la versión.

## Pasos a ejecutar

1. Verificar:
   - Working tree limpio.
   - Versión `$1` formato SemVer válido.
   - Que `staging` está al día con remoto (`git fetch origin && git log origin/staging..staging` vacío).
   - Que el último commit de `staging` corresponde a una promoción reciente (mensaje contiene `promote vX.Y.Z from developer to staging`).

2. Pedir confirmación reforzada al usuario explicando:
   - **Es promoción a PRODUCCIÓN**.
   - **Crea un tag `v$1`** que queda permanente en el historial.
   - Resúmen de cambios (`git log staging --oneline origin/main..staging`).
   - Pedir "YES" literal.

3. Si el usuario confirma "YES":

   En Windows / PowerShell:
   ```powershell
   .\scripts\promote.ps1 -From staging -To main -Version $1
   ```

   En Bash / WSL / Linux / macOS:
   ```bash
   ./scripts/promote.sh --from staging --to main --version $1
   ```

4. Tras la ejecución del script:
   - Mostrar `git log --oneline -3 main`.
   - Mostrar `git tag --list v$1` para confirmar que el tag se creó.
   - **NO** hacer push. Recordar al usuario que debe ejecutar manualmente:
     ```
     git push origin main
     git push origin v$1
     ```
   - Sugerir al usuario crear release notes en GitHub asociadas al tag `v$1` (puede pedírselo al subagente `esden-agents:documentation` o `esden-agents:deployment`).

## Si algo falla

- Si el tag `v$1` ya existe: para inmediatamente. Versión duplicada → bump version y reintentar.
- Si el script falla a mitad: NO intentes parchear. Informa al usuario con el error literal. Proponer rollback: `git checkout main && git reset --hard origin/main && git tag -d v$1` (sólo si el tag se llegó a crear local y NO se pusheó).

## Cruce con reglas del proyecto

- Esta promoción ejecuta [docs/release-process.md](../../docs/release-process.md) sección 3.3.
- El CI guard `staging-main-purity-check.yml` validará el push a main.
- El subagente `esden-agents:deployment` es responsable de verificar que el changelog está completo antes de aprobar (ver [agents/deployment.md](../agents/deployment.md)).
- El subagente `esden-agents:documentation` debe haber actualizado las release notes ANTES de esta promoción.
