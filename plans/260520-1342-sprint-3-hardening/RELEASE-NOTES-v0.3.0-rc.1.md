# Release Notes — v0.3.0-rc.1 (Sprint 3 — Hardening)

## Resumen

Release candidate del MVP. Cierra Sprint 3 Hardening: observabilidad estructurada, security headers + rate limiting, migración a Node 22 LTS, sub-tareas WCAG y features adicionales del Bloque 3.B (campañas Excel + festivos + buscador Settings). Pasa a `developer`. La GA final (`v0.3.0`) saldrá tras validación SP-4B por Renzo.

## Highlights

- **Observabilidad full**: Pino 10 logger estructurado JSON, Sentry v10 manual setup, bull-board UI para colas BullMQ, endpoints `/api/health` + `/api/version`.
- **Hardening seguridad**: CSP completo con dominios LLM/Supabase/Sentry whitelistados, HSTS preload, X-Frame-Options DENY, rate limiter sliding-window con HOF `withRateLimit` para Server Actions, npm audit en CI, Renovate bot.
- **Node 22.22.3 LTS** activo en local + Dockerfile (Active LTS hasta Oct 2027). Desbloqueado lint-staged 17.
- **Sub-tareas WCAG 2.2 AA**: aria-label en botones Personalizar, heading hierarchy h1→h2 corregida, skip-link "Saltar al contenido principal".
- **Bloque 3.B (NEW-09/10/11/12)**: rename UI Historial→Leads, importación Excel campañas, festivos manuales por país, buscador integraciones en Settings.
- **E2E Sprint 3**: specs Playwright para health/version + security headers + WCAG accessibility + helper reutilizable `expectVpsServingCommit`.

## Detalle por área

### Seguridad

- `src/lib/rate-limiter.ts`: helper sliding-window con ioredis (fail-open si Redis cae).
- `src/lib/api/with-rate-limit.ts`: HOF `withRateLimit()` para wrap Server Actions críticas (4-08).
- `next.config.ts`: CSP + HSTS + X-Frame-Options DENY + Referrer-Policy + Permissions-Policy en todas las rutas. Excepción `/widget/*` con frame-ancestors abierto.
- `.github/workflows/security.yml`: npm audit en CI (falla en High/Critical).
- `.github/renovate.json`: Renovate bot con patches auto-PR, majors bloqueados.
- `docs/security/csrf-protection.md`: documenta defensa CSRF built-in Next.js.
- `docs/architecture/rate-limits.md`: tabla de buckets + cómo añadir nuevos.

### Observabilidad

- `src/lib/utils/logger.ts`: refactor a Pino 10 preservando API previa, scrubbing PII multi-nivel.
- `src/lib/core/queue/lead-sequence-queue.ts`: logging structured en Redis events + BullMQ worker lifecycle (completed/failed/stalled).
- 3 webhooks (retell + crm + whatsapp) con trace_id Pino.
- `src/app/api/admin/queues/[[...slug]]/route.ts`: Bull-board UI con guard requireApiAdmin.
- Sentry v10.53.1 setup manual (no wizard): 3 configs runtime-specific + `instrumentation.ts` + `withSentryConfig` en next.config.

### Endpoints públicos verificación VPS (SP-4-NEW-13)

- `GET /api/health` → `{ status: "ok", timestamp }` no-cache.
- `GET /api/version` → `{ version, commit, branch, deployedAt, nodeVersion }` no-cache.
- Dockerfile stage runner con ARG GIT_COMMIT_SHA + GIT_BRANCH + BUILD_TIMESTAMP.
- Helper E2E `tests/e2e/utils/vps-version.ts` con `expectVpsServingCommit(request, sha)` y `expectVpsHealthy(request)`.

### Bloque 3.B — Features Bea (NEW-09..12)

- **NEW-09 Campañas Excel**: schema Zod `campaign-import.ts`, Server Action `importCampaignFromExcel` con exceljs (rate-limited 10/min/tenant, dedup por teléfono), migración `campaigns` table con RLS multi-tenant.
- **NEW-10 Festivos**: migración `tenant_holidays` table con RLS, Server actions `getHolidays/addHoliday/removeHoliday`, helper `isBusinessDay()` para integración con scheduler BullMQ.
- **NEW-11 Rename Historial→Leads**: ya completado pre-Phase 02 (commit `a6fb1d4`). Approach B (URLs intactas, solo labels UI). 3 cambios + 2 preservaciones semánticas (DuplicateLeadDialog "Historial del número" + voice-agents tab "Historial").
- **NEW-12 Settings UX**: buscador integraciones con filter por keyword (sticky input arriba) + verificación de que "Probar conexión" CRMs ya estaba implementado desde Sprint 2 (commit `74cc137`). Mejoras 3+4 (confirmación robusta destructiva + slide-over edición) diferidas al Sprint Refinamiento post-MVP por scope.

### WCAG 2.2 AA sub-tareas

- **SP-4-WCAG-08**: aria-label + title en botones "Personalizar" (SummaryManager 2 botones + ChartManager 1 botón).
- **SP-4-WCAG-09**: heading hierarchy corregida — h1 "Métricas Generales" y h1 "Análisis Visual" bajados a h2 (mantiene 1 h1 único por página).
- **SP-4-WCAG-10**: componente `SkipLink.tsx` añadido al root layout, `<main id="main-content" tabIndex={-1}>` en DashboardShell.

### Node 22 LTS (SP-4-NODE-22)

- `.nvmrc` 22.22.3
- `package.json` engines.node `>=22.0.0`, @types/node downgrade `^24→^22.19.19` (alinear types con runtime)
- `lint-staged` desbloqueado a `^17.0.5`
- Dockerfile 3 stages `node:20-alpine → node:22-alpine`
- `docs/dev-onboarding.md` actualizado con migración marcada completada.

## Breaking changes

NINGUNO para usuarios finales. Para devs:

- `npm install` regenera lockfile (sin cambios funcionales).
- Si tienes Node <22 local: usa `nvm install 22.22.3 && nvm use 22.22.3`.

## Migraciones SQL aplicadas

- `supabase/migrations/20260526100000_campaigns_and_holidays.sql` — crea tablas `campaigns` y `tenant_holidays` con RLS multi-tenant + índices.

> **Acción pendiente**: aplicar esta migración al VPS Dokploy vía pg-meta REST (SSH denegada) — se hace en SP-4B phase-04 bloque pre-deploy.

## Variables de entorno nuevas

- `SENTRY_DSN` — backend Sentry (opcional, sin DSN el SDK no se inicializa).
- `NEXT_PUBLIC_SENTRY_DSN` — frontend Sentry (mismo valor; expuesto al browser).
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — source maps upload (CI/Dokploy build only).
- `GIT_COMMIT_SHA`, `GIT_BRANCH`, `BUILD_TIMESTAMP` — inyectados por Dokploy en build args (no manuales).
- `LOG_LEVEL` — ya existía, ahora documentado en `.env.example` con valores Pino válidos.

## Dependencias añadidas

prod:

- `pino` ^10.3.1 (logger structured JSON)
- `@bull-board/api` ^7.1.5 + `@bull-board/express` ^7.1.5 (UI BullMQ admin)
- `@sentry/nextjs` ^10.53.1 (error tracking)
- `exceljs` ^4 (parser XLSX para NEW-09)
- `express` ^5 (transitive via @bull-board/express)

dev:

- `@types/express` ^5

## Tareas RoadMap cerradas

- SP-4-NODE-22 (Node 22 LTS migration)
- 4-03 (Observabilidad Pino + bull-board + Sentry — versión reducida sin llm_usage_logs)
- 4-06 (Rate limits + CSP headers + CSRF)
- 4-07 (Documentación final cliente: este archivo)
- 4-08 (Rate limit wrapper withRateLimit Server Actions)
- SP-4-NEW-11 (Rename Historial→Leads)
- SP-4-NEW-13 (Endpoints /api/health + /api/version)
- SP-4-WCAG-08/09/10 (sub-tareas accesibilidad)
- NEW-09 (Campañas Excel — scope MVP)
- NEW-10 (Festivos manuales)
- NEW-12 (Settings buscador integraciones — parcial, 1 de 4 mejoras)

## Tareas diferidas

- **4-01 + 4-02 + 4-09 (E2E Playwright full + Coverage 80%)** → SP-4B Validación Pre-MVP (Renzo). El Sprint 3 cubre los specs críticos (health/version, security headers, WCAG accessibility); Renzo amplía cobertura en su sprint dedicado.
- **4-05 refactor masivo WCAG 2.2 AA admin panel (24 findings DA-5)** → diferido a post-MVP. Las 3 sub-tareas críticas (WCAG-08/09/10) sí están en este RC. El resto del refactor no bloquea MVP — WCAG AA contraste y role/aria-label en charts siguen OK desde Sprint 2B.
- **NEW-12 mejoras 3+4** (confirmación robusta destructiva + edición slide-over) → Sprint Refinamiento post-MVP por scope arquitectónico.
- **NEW-09 cola configurable cadencia UI completa** → post-MVP; el schema y la tabla `campaigns.config JSONB` ya existen, solo falta la UI para configurar.
- **CHANGELOG.md backfill Sprint 1/2/2B** → se hace al subir staging.

## Pendientes operativos (acción manual, no bloquean RC)

1. Crear proyecto Sentry en sentry.io + pegar `SENTRY_DSN` en `.env.local` y panel Dokploy.
2. Configurar Dokploy build args (`GIT_COMMIT_SHA`, `GIT_BRANCH`, `BUILD_TIMESTAMP`) en `panel.automatizaformacion.com`.
3. Habilitar Renovate bot en GitHub repo settings.
4. Aplicar migración `20260526100000_campaigns_and_holidays.sql` al VPS via pg-meta REST.

## Commits del Sprint 3

(ver `git log a67977f^..HEAD --oneline` en rama `feature/sprint-03-hardening`)

## Próximos pasos

- **SP-4B** (Renzo + equipo, ~40-55h): re-test automático + E2C local + E2E VPS + manual humano absorbido de CLOSE-3 de los Sprints 0/1/2/2B/3. Bump SemVer a `v0.3.0` GA.
- Tras SP-4B: promoción a `staging` con orden explícita del usuario.

## Contribuidores

- Javi HP (orquestador + dev)
