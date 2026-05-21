# CLAUDE.md — dashboard-af

Instrucciones específicas del proyecto. Se combinan con las globales de cada dev (`~/.claude/CLAUDE.md`). Cuando hay conflicto, **manda este fichero**.

## Identidad del proyecto

**dashboard-af** — AI CRM + Workflow Orchestrator multi-tenant para academias formativas (sector formación, ES + Latam). Versión actual: **v0.0.0**.

- **Stack**: Next.js 16 + React 19 + Tailwind + PostgreSQL via **Supabase self-hosted (Easypanel)** + `@supabase/ssr` + **Zod** (validaciones) + Repository pattern + RLS multi-tenant + BullMQ + LangChain multi-LLM (Anthropic + OpenAI + Google Genai + AWS Bedrock) + Retell + Ultravox. **SIN ORM nuevo** (decisión confirmada — ver memoria `project_stack_data_layer.md`).
- **Cliente final**: academias y centros de formación (cada tenant elige su CRM).
- **Audiencia interna del repo**: equipo de desarrollo Automatiza Formación.

## Documentación autoritaria

Cuando haya cualquier duda de comportamiento esperado, consultar en este orden:

1. `docs/Docs-entrega-clienta/` — **spec de la cliente, manda sobre todo lo demás**. PDFs, DOCX, prompts, diagramas.
2. `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md` — decisiones cerradas con audit trail.
3. `docs/audit/findings-summary.md` + `docs/audit/gap-analysis-spec-vs-code.md` — estado real del código vs spec.
4. `docs/audit/STACK-TECNOLOGICO.md` — stack confirmado y excluidos.
5. `plans/YYMMDD-HHmm-slug/phase-XX-name.md` — plan activo de la fase en curso.
6. Código en `src/` — **última fuente, si contradice arriba el código está mal**.

## Plan vigente (5 fases — ver `DECISIONES R-020-refinement-v2`)

| Fase                           | Contenido                                                                              | Status    |
| ------------------------------ | -------------------------------------------------------------------------------------- | --------- |
| **0 — Sprint 0**               | Hotfixes de seguridad (4 vulnerabilidades RLS multi-tenant + tokens OAuth + Kong EOL)  | Pendiente |
| **1 — Capa de datos**          | Consolidación capa Supabase + Zod + Repository pattern + RLS hardening (sin ORM nuevo) | Pendiente |
| **2 — Adapter layer + 2 CRMs** | HubSpot adapter + Zoho adapter + UI admin de conexión (**MVP**)                        | Pendiente |
| **3 — Hardening**              | Tests E2E, observabilidad, dashboards de costes                                        | Pendiente |
| **4 — Post-release**           | Google Sheets bidireccional + Salesforce + GoHighLevel + ActiveCampaign                | Futuro    |

**MVP Fase 2 = HubSpot + Zoho.** Sheets NO entra en MVP — está aplazado a Fase 4.

## Ramas y SemVer

```
feature/* → PR → developer → (orden explícita) → staging → (orden explícita) → main
```

- Trabajo activo: feature branches partiendo de `developer` (o `auditoria` durante el audit inicial).
- **`developer`** versiona TODO el scaffold de Claude Code (`.claude/`, `.claude-plugin/`, `docs/`, `plans/`, `.env.example`).
- **`staging`** y **`main`** son ramas protegidas — **NO se tocan sin orden explícita del usuario**.
- Versionado SemVer: `v0.0.0` inicial. Sprint cerrado → `v0.x.0`. Patch en sprint → `v0.0.x`. MVP completo → `v0.3.0`.
- `.env` real NUNCA va a git. Sólo `.env.example` con placeholders. Secretos por canal seguro (Easypanel env vars / vault).

## Reglas de equipo (top-level)

1. **Co-authorship**: NUNCA Claude/Anthropic/IA como co-autor de commits. Sí se permiten co-autores humanos.
2. **Push protegido**: NUNCA push directo a `staging` o `main`. Merge sólo vía PR con autorización.
3. **No `git remote add origin <url-cliente>`** — el repo local NO se conecta al GitHub del cliente (`renzo1111ia/dashboard-af`).
4. **No Prisma, no Drizzle, no ningún ORM nuevo, no Dokploy, no Airtable** — stack ya decidido en audit, no reintroducir. La capa de datos se hace con `@supabase/ssr` + Zod + Repository pattern, sin ORM heavyweight.
5. **Dependency Guard**: TODA nueva dependencia de producción debe pasar por el subagente `af-agents:adr` antes de instalarse. El hook `af-deps-guard.cjs` lo bloquea automáticamente si se intenta saltar.
6. **RLS obligatorio** en toda tabla multi-tenant. El audit detectó 4 vulnerabilidades activas — ver plan en `plans/20260519-1200-rls-multitenant-hardening/`.
7. **Nomenclatura de variables**: ley = `docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`. Cualquier campo en código que no coincida es un finding.
8. **Sincronización CRM**: append-only por defecto (R-014). Sobrescritura sólo con `write_policy: overwrite_with_audit` registrada en `crm_write_audit`.
9. **Test con BD real** en integración — NO mocks de Supabase ni mocks de la cadena RLS.

## Model Tier Policy (heredada del global, recordatorio)

| Modelo | Cuándo                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Haiku  | Docs, traducciones, listados, sync, informes con datos ya investigados                                    |
| Sonnet | Código CRUD, tests, refactor sencillo, análisis de tecnologías habituales (Next/React/Supabase/Zod)       |
| Opus   | Concurrencia, seguridad cripto, decisiones arquitectónicas con trade-offs, research multi-fuente profundo |

Quota Fallback al 80% según política global. **NUNCA Opus por defecto.**

### Escalado proactivo por contexto/dificultad (anticipar, no esperar a que falle)

Filosofía base (idéntica a la global `~/.claude/CLAUDE.md`):

- **Haiku** para editar archivos y acciones sencillas con poco contexto. Si hay mucho contexto o le cuesta → **subir a Sonnet**.
- **Sonnet** para la mayoría de tareas y codificación. Si hay mucho contexto o le cuesta → **subir a Opus**.
- **Opus** reservado para investigación, mucho contexto y programación compleja donde Sonnet puede fallar.

Triggers de escalado **preventivo** (antes de empezar la tarea, sin esperar a fallar):

| Trigger                                                                                                   | Acción                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Haiku necesita >5 archivos de contexto, o el archivo objetivo >300 líneas                                 | Subir a Sonnet desde el inicio                     |
| Haiku tarea con lógica condicional no trivial (>1 if/else anidado o branching no lineal)                  | Subir a Sonnet desde el inicio                     |
| Sonnet necesita >15 archivos de contexto cross-package o cross-stack                                      | Subir a Opus desde el inicio                       |
| Sonnet tarea con concurrencia, criptografía, RLS multi-tenant, OAuth multi-DC, transacciones distribuidas | Subir a Opus desde el inicio                       |
| Sonnet tarea de research multi-fuente (3+ docs/webs/repos a sintetizar) o trade-offs arquitectónicos      | Subir a Opus desde el inicio                       |
| Cualquier modelo: bucle de >2 reintentos sobre el mismo error/test                                        | Escalar al siguiente tier y reintentar UNA vez más |

**Aplicación en `dashboard-af`:**

- Sprint 0 (hotfixes RLS, JWT, crypto, next bump): orquestación en **Sonnet**, escalada puntual a **Opus** para decisiones de RLS multi-tenant y firma de webhooks.
- Sprint 1 (capa de datos, Zod, Repository): **Sonnet** por defecto. **Opus** sólo para diseño del Repository pattern multi-tenant y cifrado AES-256 de tokens OAuth (tarea 2-26).
- Sprint 2 (adapter HubSpot + Zoho): **Sonnet** para adapters y OAuth flow estándar. **Opus** para Zoho multi-DC y diseño del `IntegrationAdapter` interface.
- Tareas de docs/READMEs/logs/traducciones/listados: **Haiku** salvo que el contexto pase de 5 archivos.

**Diferencia con regla global #6:**

- Regla #6 es reactiva (escalar tras fallo confirmado).
- Esta regla es preventiva (escalar antes de empezar si pinta complejo).
- Quota Fallback al 80% es ortogonal (escala/desciende por cuota, no por dificultad).

**Aplicación al abrir chat nuevo:** si el prompt del usuario contiene una tarea claramente compleja (research multi-fuente, refactor cross-package, decisión arquitectónica, debug no trivial), arrancar directamente en el tier adecuado sin esperar a fallar en uno inferior.

## Execution Autonomy

- Tras "adelante" / "sí" / "procede" → ejecutar TODA la tarea sin preguntar archivo por archivo.
- Confirma SÓLO antes de: acciones GitHub (push, PR, merge, tag), planes de tareas/sprints, ediciones de `staging`/`main`.
- Permiso de documentación persistente: si el usuario autoriza editar docs/.md, ese permiso vale para todo el proyecto hasta que diga "modo planificación sin permisos de edición".

## Phase/Sprint Completion Protocol (automático)

Al cerrar fase, ejecutar SIN preguntar:

1. `npm run typecheck` + `npm run lint` + `npm run build` + tests (vía subagente `af-agents:testing`).
2. Si hay UI nueva: browser tests con Playwright.
3. Informe al usuario con: tests passed/failed/fixed + lo implementado + invitación a probar manual (si aplica).

## Productivity Time Format

- Duración: `2h 30min`, `45min`. NUNCA decimales.
- Fechas de sprint: `DD-MM-YYYY HH:MM` (europeo).
- Tablas de tareas: sólo duración.
- Identificadores técnicos `ck-*` (carpetas `plans/YYMMDD-HHmm-slug/`): mantienen formato compacto.

## Orquestador y subagentes

El orquestador es **`af-agents:manager`** (Opus). Coordina 19 subagentes especializados (14 del patrón saas-agents adaptados a AF + debugger, journal-writer, mcp-manager, code-simplifier, researcher, brainstormer de la config global).

Para delegar: `Task(subagent_type="af-agents:database", prompt="...")`.

Ver detalle completo de cada subagente en `.claude/agents/*.md`.

## Skills disponibles

28 skills en `.claude/skills/`. Conjunto enfocado: 8 de gestión de sprint (saas-agents) + ~20 globales filtradas (ck-plan, ck-debug, ck-security, code-review, fix, ship, watzup, retro, backend/frontend-development, databases, web-testing, security-scan, docs, docs-seeker, research, brainstorm, find-skills, mcp-management, skill-creator).

**Excluidas explícitamente del proyecto**: payment-integration, pinokio, gepeto, MCPs personales (Gmail/Calendar/Drive/Gamma/pencil).

## MCP servers activos

- ✅ `plugin:context7:context7` — docs Next/React/Supabase/Zod/HubSpot/Zoho.
- ✅ `plugin:playwright:playwright` — browser tests Fase 3.
- 🔜 (Fase 4) MCP/skill Google Sheets — añadir cuando lleguemos a esa fase.

## Para el equipo de desarrollo

Cuando clones este repo, lee primero [docs/dev-onboarding.md](docs/dev-onboarding.md). Cubre setup, ramas, .env, primer arranque y cómo trabajar con Claude Code en este proyecto.
