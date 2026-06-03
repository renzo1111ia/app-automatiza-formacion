# dashboard-af

**AI CRM + Workflow Orchestrator multi-tenant para academias formativas** (sector formación, España + Latam).

| Campo           | Valor                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión         | `v0.3.0-rc.1` en `developer` (Sprint 3 mergeado vía PR #22). SP-7-DEPS-AUDIT-26 🟢 mergeada encima (25→4 vulns, −84%). Roadmap MVP: SP-4B Validación (16-19/06) → MVP GA `v0.3.0` (22-06).                                                                                                |
| Estado          | 🟢 **Sprint 3 Hardening CERRADO** (PR #22, `v0.3.0-rc.1`) + 🟢 **SP-7-DEPS-AUDIT-26 CERRADA** (deps audit, −84% vulns, mergeada developer 03-06). Run E2E VPS 03-06 🟢 PASS (0 CRIT / 0 HIGH, ~392 tests). Activo ahora: `feature/sprint-04-google-sheets` (Sheets bidireccional v0.4.0). |
| Último deploy   | VPS Hetzner `dev.automatizaformacion.com` autodeploy Dokploy desde `developer` (`v0.3.0-rc.1`, Node 22.22.3). Run E2E 03-06 verde contra VPS.                                                                                                                                             |
| Target MVP      | `v0.3.0` GA — **estim. Lun 22-06-2026** (replanteo 24-05 −7 sem por ratio real Sprints 0/1/2/2B −86% a −94%). Calendario: SP-4B Renzo 16-19/06 → MVP GA 22/06.                                                                                                                            |
| Stack           | Next.js 16 · React 19 · Tailwind · Supabase self-hosted · `@supabase/ssr` · Zod · BullMQ · LangChain (Anthropic + OpenAI + Google Genai) · Retell · Ultravox · Node 22 LTS                                                                                                                |
| Rama de trabajo | `feature/sprint-04-google-sheets` — Sheets bidireccional (v0.4.0, post-MVP). Última cerrada: `feature/sp-7-deps-audit-26` (mergeada developer 03-06).                                                                                                                                     |
| Plan Sprint 3   | [`plans/260520-1342-sprint-3-hardening/plan.md`](plans/260520-1342-sprint-3-hardening/plan.md). Cerrado vía PR #22 (`v0.3.0-rc.1`). Encima: SP-4-LINT-ZERO (104→0) + SP-4-DEPRECATIONS-DEPLOY + SP-7-DEPS-AUDIT-26 (vulns −84%).                                                          |

> ⚠️ **Branding del producto** — el dashboard se entrega como SaaS multi-tenant. Cada academia/centro formativo es un tenant aislado por RLS. Los CRMs externos (HubSpot, Zoho, etc.) se conectan vía adapter layer.

---

## Documentación principal

| Documento                                          | Para qué                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`docs/dev-onboarding.md`](docs/dev-onboarding.md) | **Empieza aquí** si acabas de clonar el repo. Setup paso a paso, ramas, `.env.local`, primer arranque      |
| [`CLAUDE.md`](CLAUDE.md)                           | Reglas operativas del proyecto (modelo IA, branches, autonomía, etc.) — son ley sobre las globales del dev |
| [`plans/RoadMap.md`](plans/RoadMap.md)             | **Single source of truth** del estado del proyecto — 10 sprints, tareas, estados (🔘🟡🟠🔵🟢)              |
| [`docs/audit/`](docs/audit/)                       | Auditoría inicial (gap analysis, findings, decisiones cerradas)                                            |
| [`docs/adr/`](docs/adr/)                           | Architecture Decision Records — decisiones técnicas con trade-offs                                         |
| [`plans/reports/`](plans/reports/)                 | Reports de subagentes (ADR de dependencias, baselines, etc.)                                               |

---

## Quick start (desarrollo local)

Lee [`docs/dev-onboarding.md`](docs/dev-onboarding.md) para el setup completo. Resumen:

```powershell
# 1. Clonar y dependencias
git clone https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard.git
cd Automatiza-Formacion-DashBoard
git checkout developer
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Edita .env.local con tus credenciales locales/staging
# OBLIGATORIAS: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REDIS_URL
# Sin estas la app falla al arrancar (decisión Sprint 0 tarea 1-04 — sin fallback)

# 3. Levantar infra local (Supabase + Redis vía Docker)
npm run local:setup     # equivale a db:up + redis:up + db:seed-demo

# 4. Dev server
npm run dev             # http://localhost:8500

# 5. (Opcional) Tests E2E
npm run test:e2e        # requiere dev server corriendo
npm run test:e2e:ui     # modo interactivo
```

---

## Workflow de ramas

```text
feature/* ──► PR ──► developer ──► (orden explícita) ──► staging ──► (orden explícita) ──► main
```

- Trabajo activo: ramas `feature/sprint-NN-<slug>` (NN = número de sprint con dos dígitos, ej. `sprint-01`, `sprint-02`) que parten de `developer`. **Excepción legacy**: Sprint 0 mantiene `feature/sp-0-sprint-0-hotfixes` (no se renombra).
- **`developer`** versiona TODO el scaffold de Claude Code (`.claude/`, `.claude-plugin/`, `docs/`, `plans/`, `.env.example`).
- **`staging`** y **`main`** son ramas protegidas — **NO se tocan sin orden explícita del lead**.

### Hooks de calidad (locales)

Tras Sprint 0 tarea 0-01, el repo trae hooks de `husky` activos:

| Hook         | Qué hace                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` — eslint --fix + prettier en archivos staged                                         |
| `pre-push`   | `typecheck` + `build` + lint en archivos cambiados vs `developer`. Bloquea push a `main`/`staging` |
| `commit-msg` | Valida Conventional Commits + bloquea co-autoría de IA                                             |

Para que se activen al clonar: `npm install` corre `prepare: husky` automáticamente.

### Tests

| Comando               | Cuándo                                         |
| --------------------- | ---------------------------------------------- |
| `npm run typecheck`   | Pre-push (auto) o manual                       |
| `npm run lint`        | Pre-push solo en cambios; full en SP-X-CLOSE-1 |
| `npm run build`       | Pre-push (auto) o manual                       |
| `npm run test:e2e`    | Cierre de sprint (SP-X-CLOSE-2) o manual       |
| `npm run test:e2e:ui` | Debug interactivo                              |

---

## Estado actual del proyecto

> 📊 **Vista live**: [`plans/RoadMap.md`](plans/RoadMap.md) — se actualiza con cada cambio de estado de tarea.

| Sprint                            | Versión       | Estado            | Notas                                                                                                                                                                                                                                   |
| --------------------------------- | ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Hotfixes seguridad              | `v0.1.0`      | 🟢 Completado     | Tag v0.1.0 en `a387dfe` (PR #2). 26 tareas locales · 2 diferidas a pre-deploy VPS. ~11h efectivas vs 118h estim                                                                                                                         |
| 1 Capa datos                      | `v0.2.0`      | 🟢 Completado     | Mergeado a developer vía PR #5 (`94c035a`). 24 tareas · 8 diferidas · 6 ADRs (014-019) · 58 tests Vitest. ~12h efectivas vs 205h estim                                                                                                  |
| Autoexec doc-agent + empty-states | —             | 🟢 Completado     | 4 commits directos a developer 24-05-2026: 70 alerts→toast, EmptyState, web_widgets fix, /dashboard/docs-admin + /docs-clientes, hook `af-docs-watcher.cjs`                                                                             |
| 2 HubSpot + Zoho                  | `v0.2.7`      | 🟢 Completado     | PR #12 mergeado (`a826fd6`) + hotfix BUG-2-01 slug conflict. 170 tests + 5/5 E2E VPS verdes. [Release v0.2.7](https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/releases/tag/v0.2.7)                                |
| **2B Dashboard KPIs Overview**    | `v0.2.8`      | 🟢 **Completado** | PR #13 mergeado (`17b2902`) + bump v0.2.8 (`bbcbfd0`). 193 Vitest + **15/15 E2E VPS verdes**. 3 bugs resueltos. Ratio −86%. [Release v0.2.8](https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/releases/tag/v0.2.8) |
| **3 Hardening**                   | `v0.3.0-rc.1` | 🟢 **Completado** | PR #22 mergeado a developer (`1283995`). 22/22 tareas dev. CLOSE-1+1.5+2 🟢. Pre-release `v0.3.0-rc.1` publicado. 4 BUG-SEC resueltos en rama (`bcd36a9`).                                                                              |
| SP-7-DEPS-AUDIT-26                | `v0.3.0-rc.1` | 🟢 **Completado** | Mergeada developer 03-06. **25→4 vulns (−84%)**, 0 críticas / 0 altas. ADR-018. Run E2E VPS 03-06 🟢 PASS (0 CRIT / 0 HIGH, ~392 tests).                                                                                                |
| 4 Post-MVP                        | `v0.4.0+`     | 🟡 **En Curso**   | `feature/sprint-04-google-sheets` — Sheets bidireccional (spike E2E real validado). Después: Salesforce · GoHighLevel · ActiveCampaign · Costes-LLM                                                                                     |

---

## Decisiones cerradas que conviene conocer

1. **Sin ORM nuevo.** Capa de datos = `@supabase/ssr` + Zod + Repository pattern. No Prisma, no Drizzle.
2. **Sin Airtable.** Infra = **Dokploy** (`panel.automatizaformacion.com`) + Supabase self-hosted en VPS Hetzner.
3. **Test con BD real** en integración. NO mocks de Supabase.
4. **Co-autoría de commits**: humanos sí, IA NO.
5. **Local-first**: typecheck/lint/build/test en local (hooks). CI en GH Actions minimal (tier gratis 2000 min/mes).
6. **Variables del CRM**: nomenclatura oficial = [`docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`](docs/Docs-entrega-clienta/) (gitignored).

Ver historial completo de decisiones en [`docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md`](docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md).

---

## Para devs nuevos: orden de lectura recomendado

1. Este README (estás aquí ✅)
2. [`docs/dev-onboarding.md`](docs/dev-onboarding.md) — setup + primer arranque
3. [`CLAUDE.md`](CLAUDE.md) — reglas del proyecto
4. [`plans/RoadMap.md`](plans/RoadMap.md) — en qué sprint estamos
5. La carpeta del sprint actual: [`plans/260520-1342-sprint-3-hardening/`](plans/260520-1342-sprint-3-hardening/) (Sprint 3 vigente — rama `feature/sprint-03-hardening`)

---

## Soporte

Lead técnico: **Javi HP** (`javihp.email@gmail.com`) — colaborador en la org `AutomatizaFormacion`.
Repo: <https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard>
