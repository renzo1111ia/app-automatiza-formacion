# dashboard-af

**AI CRM + Workflow Orchestrator multi-tenant para academias formativas** (sector formación, España + Latam).

| Campo           | Valor                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión         | `v0.0.0`                                                                                                                                                                   |
| Estado          | 🟡 En desarrollo activo — Sprint 0 (hotfixes de seguridad)                                                                                                                 |
| Target MVP      | `v0.4.0` — Lun 10-08-2026                                                                                                                                                  |
| Stack           | Next.js 16 · React 19 · Tailwind · Supabase self-hosted · `@supabase/ssr` · Zod · BullMQ · LangChain (Anthropic + OpenAI + Google Genai + AWS Bedrock) · Retell · Ultravox |
| Rama de trabajo | [`developer`](https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/tree/developer) (activa)                                                               |

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
npm run dev             # http://localhost:3000

# 5. (Opcional) Tests E2E
npm run test:e2e        # requiere dev server corriendo
npm run test:e2e:ui     # modo interactivo
```

---

## Workflow de ramas

```text
feature/* ──► PR ──► developer ──► (orden explícita) ──► staging ──► (orden explícita) ──► main
```

- Trabajo activo: ramas `feature/sp-N-<slug>` (N = número de sprint) que parten de `developer`.
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

| Sprint                   | Versión          | Estado           | Notas                                                                                                        |
| ------------------------ | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **0 Hotfixes seguridad** | `v0.1.0`         | 🟡 En desarrollo | 5 tareas a 🔵 (0-00, 0-01, 1-04, 1-26 + helpers). 2 diferidas (1-03, 1-05 esperan acceso VPS). Resto en cola |
| 1 Capa datos             | `v0.2.0`         | 🔘 Pendiente     | Sin ORM nuevo. Repository pattern + Zod + RLS hardening                                                      |
| 2 HubSpot + Zoho         | `v0.3.0`         | 🔘 Pendiente     | Adapter layer + UI admin (MVP)                                                                               |
| 3 Hardening              | **`v0.4.0` MVP** | 🔘 Pendiente     | Tests E2E, observabilidad, dashboards de costes                                                              |
| 4-9 Post-MVP             | `v0.5.0+`        | 🔘 Pendiente     | Google Sheets, Salesforce, GoHighLevel, ActiveCampaign                                                       |

---

## Decisiones cerradas que conviene conocer

1. **Sin ORM nuevo.** Capa de datos = `@supabase/ssr` + Zod + Repository pattern. No Prisma, no Drizzle.
2. **Sin Dokploy, sin Airtable.** Infra = Easypanel + Supabase self-hosted.
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
5. La carpeta del sprint actual: `plans/260520-1342-sprint-0-hotfixes-seguridad/` (Sprint 0 vigente)

---

## Soporte

Lead técnico: **Javi HP** (`javihp.email@gmail.com`) — colaborador en la org `AutomatizaFormacion`.
Repo: <https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard>
