# ============================================================================
# promote.ps1 — Promoción de ramas dashboard-af
# ============================================================================
# Uso:
#   .\scripts\promote.ps1 -From developer -To staging -Version 0.1.0
#   .\scripts\promote.ps1 -From staging   -To main    -Version 0.1.0
#
# Limpia automaticamente las carpetas que NO deben llegar a staging/main:
#   - docs/
#   - plans/
#   - .claude/
#   - .claude-plugin/
#   - CLAUDE.md
#   - scripts/promote.* (el propio script no tiene sentido en staging/main)
#   - .github/workflows/staging-purity-check.yml (sigue activo)
#
# Permanecen: codigo (src/, app/, lib/, components/, supabase/migrations/,
# package.json, package-lock.json, next.config.*, tsconfig.json, .env.example,
# .gitignore, .github/workflows/ (excepto el purity-check si quieres))
# ============================================================================

param(
    [Parameter(Mandatory=$true)][ValidateSet("developer","staging")]
    [string]$From,

    [Parameter(Mandatory=$true)][ValidateSet("staging","main")]
    [string]$To,

    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter()]
    [switch]$DryRun,

    [Parameter()]
    [switch]$Force
)

# Validar combinacion permitida
$allowedTransitions = @{
    "developer" = @("staging")
    "staging"   = @("main")
}

if (-not $allowedTransitions[$From] -or $allowedTransitions[$From] -notcontains $To) {
    Write-Host "ERROR: Transicion $From -> $To no permitida." -ForegroundColor Red
    Write-Host "Transiciones validas:" -ForegroundColor Yellow
    Write-Host "  developer -> staging"
    Write-Host "  staging   -> main"
    exit 1
}

# Validar formato SemVer (acepta v0.x.x o 0.x.x)
if ($Version -notmatch '^v?\d+\.\d+\.\d+$') {
    Write-Host "ERROR: Version '$Version' no tiene formato SemVer (v0.0.0)." -ForegroundColor Red
    exit 1
}
$Version = $Version -replace '^v',''

# Confirmar protected branch
if ($To -in @("staging","main") -and -not $Force) {
    Write-Host ""
    Write-Host "AVISO: Promocion a rama PROTEGIDA '$To'." -ForegroundColor Yellow
    Write-Host "Esta accion:" -ForegroundColor Yellow
    Write-Host "  1. Hace checkout de $To"
    Write-Host "  2. Merge --squash $From"
    Write-Host "  3. Elimina docs/, plans/, .claude/, .claude-plugin/, CLAUDE.md"
    Write-Host "  4. Commit con mensaje 'chore(release): promote v$Version from $From to $To'"
    Write-Host "  5. Tag 'v$Version' si To=main"
    Write-Host "  6. NO push automatico (haz git push manualmente cuando verifiques)"
    Write-Host ""
    $confirm = Read-Host "Confirma con 'YES' para continuar"
    if ($confirm -ne "YES") {
        Write-Host "Cancelado." -ForegroundColor Red
        exit 0
    }
}

# Verificar working tree limpio
$gitStatus = git status --porcelain
if ($gitStatus -and -not $DryRun) {
    Write-Host "ERROR: Working tree no esta limpio. Commit/stash primero." -ForegroundColor Red
    git status --short
    exit 1
}

# Lista de paths a eliminar en staging/main
$pathsToRemove = @(
    "docs/",
    "plans/",
    ".claude/",
    ".claude-plugin/",
    "CLAUDE.md",
    "scripts/promote.ps1",
    "scripts/promote.sh"
)

Write-Host ""
Write-Host "=== Promocion $From -> $To (v$Version) ===" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN: no se ejecutara ningun comando real." -ForegroundColor Magenta
}
Write-Host ""

function Run-Git {
    param([string]$Args)
    Write-Host "  > git $Args" -ForegroundColor Gray
    if (-not $DryRun) {
        $result = git $Args.Split(' ')
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR ejecutando: git $Args" -ForegroundColor Red
            exit 1
        }
        return $result
    }
}

# 1. Pull ultimo From
Write-Host "[1/6] Sincronizando origen..."
Run-Git "checkout $From"
Run-Git "pull origin $From"

# 2. Checkout destino + pull
Write-Host "[2/6] Checkout destino..."
Run-Git "checkout $To"
Run-Git "pull origin $To"

# 3. Merge --squash
Write-Host "[3/6] Merge --squash $From en $To..."
Run-Git "merge --squash $From"

# 4. Eliminar paths prohibidos
Write-Host "[4/6] Eliminando paths que NO deben llegar a $To..."
foreach ($p in $pathsToRemove) {
    if (Test-Path $p) {
        Write-Host "  - Eliminando $p" -ForegroundColor Yellow
        if (-not $DryRun) {
            git rm -rf --cached $p 2>$null
            if (Test-Path $p -PathType Container) {
                Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
            } else {
                Remove-Item -Force $p -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "  - $p ya no existe (skip)" -ForegroundColor DarkGray
    }
}

# 5. Commit
Write-Host "[5/6] Commit de promocion..."
$commitMsg = "chore(release): promote v$Version from $From to $To"
Run-Git "add ."
Run-Git "commit -m `"$commitMsg`""

# 6. Tag si destino=main
if ($To -eq "main") {
    Write-Host "[6/6] Creando tag v$Version..."
    Run-Git "tag -a v$Version -m `"Release v$Version`""
} else {
    Write-Host "[6/6] (Tag se crea solo cuando To=main, skip)"
}

Write-Host ""
Write-Host "=== Promocion completada localmente ===" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso MANUAL (verifica antes de pushear):" -ForegroundColor Yellow
Write-Host "  git log --oneline -5"
Write-Host "  git status"
Write-Host "  # Si OK:"
Write-Host "  git push origin $To"
if ($To -eq "main") {
    Write-Host "  git push origin v$Version"
}
Write-Host ""
