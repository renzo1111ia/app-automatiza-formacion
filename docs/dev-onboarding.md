---
title: "Dev Onboarding — dashboard-af"
audience: equipo de desarrollo (interno)
status: vigente
date: 2026-05-20
---

# Dev Onboarding — dashboard-af

Guía de arranque para cualquier dev que se incorpore al proyecto. Lee esto antes de tocar nada.

## 1. Qué es este proyecto

dashboard-af — AI CRM + Workflow Orchestrator multi-tenant para academias formativas. Stack: Next.js 16 + React 19 + Supabase (sin ORM nuevo) + Zod + BullMQ + LangChain multi-LLM + Retell/Ultravox + Easypanel. Versión actual: **v0.0.0**.

Lee [`CLAUDE.md`](../CLAUDE.md) del repo raíz para la visión completa del proyecto y las reglas top-level.

## 2. Setup local (primer arranque)

### 2.1 Requisitos previos

- **Node.js** 22.x LTS o superior (Next.js 16 lo exige).
- **npm** 10.x (o pnpm 9.x si prefieres).
- **Git** 2.40+.
- **Docker Desktop** (para PostgreSQL local si no usas el Supabase remoto del equipo).
- **Claude Code CLI** instalado (`npm i -g @anthropic-ai/claude-code` o desde extensión IDE).

### 2.2 Clonar el repo

```powershell
git clone <repo-url> dashboard-af
cd dashboard-af
git checkout developer    # la rama de integración del equipo
```

> ⚠️ **NUNCA** ejecutes `git remote add origin <url-del-cliente>`. Este repo no se conecta al GitHub del cliente.

### 2.3 Variables de entorno

```powershell
cp .env.example .env.local
```

Edita `.env.local` con valores reales. **Las claves reales NO están en git** — pídelas por canal seguro:

- Pide a Javier (Auditor) o al lead del equipo el bundle de secretos (Easypanel env vars, 1Password, o vault interno).
- Para los CRMs de Fase 2 (HubSpot + Zoho) necesitas crear apps OAuth2 en sus developer portals con tu cuenta o usar las credenciales sandbox compartidas.

`.env.local` está en `.gitignore` — nunca lo commitees por accidente.

### 2.4 Instalar dependencias

```powershell
npm install
```

> ⚠️ **Dependency Guard activo**: si intentas instalar una NUEVA dependencia de producción (`npm install <pkg>` sin `-D`), el hook [`af-deps-guard.cjs`](../.claude/hooks/af-deps-guard.cjs) lo bloqueará. Debes pasar por el subagente `af-agents:adr` que verifica compatibilidad y documenta en `docs/adr/`. Esto NO aplica a `npm install` plano (lockfile install) ni a `--save-dev`.

### 2.5 Levantar dev server

```powershell
npm run dev
```

App en `http://localhost:3000`. Worker BullMQ en proceso aparte:

```powershell
node worker.js
```

## 3. Trabajo con Claude Code

### 3.1 Lo que ya tienes al clonar

Al abrir el repo en Claude Code, automáticamente carga:

- **`CLAUDE.md`** del repo raíz (instrucciones específicas Esden, additive a tu `~/.claude/CLAUDE.md` global).
- **`.claude/agents/`** — 19 subagentes especializados (orquestador `af-agents:manager` + 18 más).
- **`.claude/skills/`** — 28 skills filtradas (saas-agents + globales relevantes; sin payment-integration, sin pinokio, sin gepeto).
- **`.claude/hooks/`** — 14 hooks ClaudeKit Engineer + 4 hooks específicos Esden, registrados en `.claude/hooks/hooks.json`.
- **`.claude/rules/`** — 5 normas (development, documentation, orchestration, primary-workflow, team-coordination).
- **`.claude/settings.json`** — permisos del proyecto y plugins habilitados (`context7` + `playwright`).
- **`.claude-plugin/plugin.json`** — manifest del plugin `af-agents` v0.0.0.

**No necesitas copiar nada de la config global de ningún compañero.** Todo viaja en el repo.

### 3.2 Plugins recomendados (instalación 1ª vez)

Asegúrate de tener instalados los plugins oficiales referenciados en `.claude/settings.json enabledPlugins`:

```
/plugin install context7@claude-plugins-official
/plugin install playwright@claude-plugins-official
```

(Si ya los tienes globalmente, Claude Code los reutilizará.)

### 3.3 Cómo trabajar (resumen)

1. **Lee el plan activo**: `plans/YYMMDD-HHmm-slug/` más reciente.
2. **Lanza el orquestador**: pídele al manager que coordine. Ejemplo: *"@manager arranca Fase 1"*.
3. El manager delega a especialistas (`af-agents:database`, `:api`, `:code`, `:testing`...) en paralelo cuando puede.
4. **NUNCA implementes código directamente desde el orquestador** — siempre vía Task tool al especialista.
5. Al cerrar fase, el Phase Completion Protocol corre automático: typecheck + lint + build + tests + browser tests si UI.

### 3.4 Slash commands

Los comandos `/si-edita-doc`, `/no-edita-doc`, `/commit-actual` viven en la **config global** de cada dev (no en el repo). Si tu equipo quiere unificarlos a nivel proyecto, pídeselo al lead — se pueden mover a `.claude/commands/` cuando se decida.

## 4. Ramas y SemVer

```
feature/* → PR → developer → (orden explícita) → staging → (orden explícita) → main
```

- Trabaja siempre en una rama `feature/fase-X-descripcion` partiendo de `developer`.
- Cuando termines: PR a `developer` (review obligatoria del lead).
- `staging` y `main` son **protegidas** — sólo se mueven con orden explícita de Javier o el lead.
- **`staging` y `main` NUNCA reciben** `docs/`, `plans/`, `.claude/`, `.claude-plugin/`, ni `CLAUDE.md`. Sólo código.
- Promociones `developer → staging → main` se hacen vía script `scripts/promote.ps1` (Windows) o `scripts/promote.sh` (Bash). El script limpia automáticamente los artefactos internos. Ver [docs/release-process.md](release-process.md) para el detalle.
- Un CI guard (`.github/workflows/staging-main-purity-check.yml`) bloquea cualquier intento de meter docs/plans/.claude en `staging` o `main`.

**Versionado**:
- `v0.0.0` ahora.
- Patch durante sprint en curso → `v0.0.x`.
- Sprint cerrado → bump a `v0.x.0`.
- MVP completo (post Fase 3, pre Fase 4) → `v1.0.0`.

Tags los crea el script `promote.ps1` automáticamente al promocionar a `main`.

## 5. Reglas top-level que tienes que conocer YA

1. **No Co-Authored-By Claude/Anthropic/IA** en commits. Sí humanos.
2. **No push directo** a `staging` o `main`.
3. **No `git remote add origin <url-cliente>`**.
4. **No introducir Prisma, Dokploy, Airtable** — stack ya decidido en audit.
5. **`.env` real nunca a git** — sólo `.env.example`.
6. **RLS obligatorio** en multi-tenant. Hay 4 vulnerabilidades activas detectadas en audit — ver `plans/20260519-1200-rls-multitenant-hardening/`.
7. **Append-only en sync CRM** por defecto. Sobrescritura sólo con audit trail.
8. **Tests con BD real**, NO mocks de Supabase.

## 6. Recursos clave

| Recurso | Dónde |
| --- | --- |
| Spec autoritaria cliente | `docs/Docs-entrega-clienta/` |
| Audit completo | `docs/audit/findings-summary.md` |
| Decisiones del Auditor | `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md` |
| Stack confirmado | `docs/audit/STACK-TECNOLOGICO.md` |
| Plan rearmado (5 fases) | Ver R-020-refinement-v2 en DECISIONES |
| Backlog | `docs/roadmap/deep-improvement-backlog.md` |
| Plans activos | `plans/YYMMDD-HHmm-slug/` |
| Reports de subagentes | `plans/*/reports/` |

## 7. Si te atascas

1. Pregunta al manager: *"@manager status"*.
2. Activa skill `blocker` para registrar el bloqueo con impacto.
3. Si es bug: lanza subagente `debugger` para root cause analysis.
4. Si nada de lo anterior: escala al lead o a Javier (Auditor).

## 8. Política de modelos (heredada de la config global de Javier)

Cada dev puede tener su propia política, pero el proyecto recomienda:

| Modelo | Cuándo |
| --- | --- |
| Haiku | Docs, listados, sync, informes con datos ya investigados |
| Sonnet | Código CRUD, tests, refactor sencillo, librerías mainstream |
| Opus | Concurrencia, seguridad cripto, decisiones arquitectónicas, research profundo |

**Nunca Opus por defecto.** Quota Fallback al 80% según política global.

---

**Última actualización**: 20-05-2026.
**Mantenedor**: Javier HP (Auditor).
**Contacto**: admin@2you.ai.
