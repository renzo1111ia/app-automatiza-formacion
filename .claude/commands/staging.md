---
description: Promociona `developer` → `staging` ejecutando promote.ps1. Limpia automáticamente docs/, plans/, .claude/, .claude-plugin/, CLAUDE.md antes del merge.
argument-hint: <version>  (formato SemVer, ej. 0.1.0)
allowed-tools: [Bash, Read]
---

# Promote developer → staging

Vas a promocionar la rama `developer` a `staging` con versión **$1**.

## Reglas de seguridad (OBLIGATORIO)

1. **Requiere orden explícita del usuario** — la promoción a una rama protegida no se hace nunca sin confirmación.
2. **Verifica que el working tree está limpio** antes de arrancar (`git status --porcelain`).
3. **NO hagas push automático** — el script termina dejando el commit local; el push lo hace el usuario manualmente tras verificar.
4. Si el usuario no ha dado argumento `$1`, **detén** y pídele la versión.

## Pasos a ejecutar

1. Verificar:
   - Working tree limpio (`git status --porcelain` vacío).
   - Versión `$1` válida (regex `^v?\d+\.\d+\.\d+$`).
   - Rama actual NO es `main` ni `staging` (sería raro estar ahí).

2. Mostrar al usuario qué va a pasar y pedir confirmación explícita ("YES" literal):
   - Checkout developer + pull
   - Checkout staging + pull
   - Merge --squash developer en staging
   - Eliminar de staging: `docs/`, `plans/`, `.claude/`, `.claude-plugin/`, `CLAUDE.md`, `scripts/promote.*`
   - Commit: `chore(release): promote v$1 from developer to staging`

3. Si el usuario confirma "YES":

   En Windows / PowerShell:
   ```powershell
   .\scripts\promote.ps1 -From developer -To staging -Version $1
   ```

   En Bash / WSL / Linux / macOS:
   ```bash
   ./scripts/promote.sh --from developer --to staging --version $1
   ```

   Detecta el shell desde el entorno (`$env:SHELL` o `uname`) y usa el apropiado. Si no estás seguro, usa PowerShell (es el shell por defecto del proyecto en Windows).

4. Tras la ejecución del script:
   - Mostrar `git log --oneline -5` para verificación.
   - Mostrar `git status` para confirmar working tree limpio post-commit.
   - **NO** hacer push. Recordar al usuario que el push lo debe ejecutar él manualmente: `git push origin staging`.

## Si algo falla

- Si el working tree no está limpio: para y pide al usuario que haga commit/stash primero.
- Si el script falla a mitad: NO intentes "arreglarlo" — informa al usuario, muestra el error literal, y propón rollback manual (`git checkout developer; git branch -D staging; git checkout staging origin/staging`).
- Si el usuario no responde "YES" exactamente: cancela y no hagas nada.

## Cruce con reglas del proyecto

- Esta promoción ejecuta lo definido en [docs/release-process.md](../../docs/release-process.md) sección 3.2.
- Después de pushear staging, el CI guard `.github/workflows/staging-main-purity-check.yml` validará automáticamente que no hayan colado paths prohibidos.
- El SemVer (`$1`) debe corresponder al sprint cerrado: minor bump (`v0.x.0`) si cierre de sprint, patch (`v0.0.x`) si hotfix dentro de sprint.
