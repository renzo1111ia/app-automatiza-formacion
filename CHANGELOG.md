# Changelog

Todos los cambios notables de `dashboard-af` se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

Estados oficiales de un release:

- 🟢 **Released**: tag git creado y mergeado a `developer` (o `staging`/`main` según promoción).
- 🟡 **In progress**: sprint en desarrollo activo.
- 🔘 **Backlog**: planificado, sin trabajo aún.

---

## [0.1.0] — 2026-05-22 🟢 Released

**Sprint 0 — Hotfixes de seguridad** · rama: `feature/sp-0-sprint-0-hotfixes` → mergeada en `developer` vía PR #2 (commit `a387dfe`) · tag `v0.1.0` (commit `a387dfe`, tagger Renzo).

### Tiempos reales del sprint

| Bloque                                     | Estimado        | Real          |
| ------------------------------------------ | --------------- | ------------- |
| Desarrollo (1-01..1-27, 26 tareas locales) | 112h 30min      | **~7h 30min** |
| Cierre (CLOSE-1..5)                        | 5h 30min + bugs | **~3h 35min** |
| **Total Sprint 0**                         | **118h**        | **~11h 5min** |

Detalle CLOSE-1..5:

- CLOSE-1 auto-test (typecheck+lint+build): **~30min** · DONE_WITH_CONCERNS (lint 128→118 errores preexistentes, no regresión).
- CLOSE-2 E2C Playwright + WCAG: **~45min** · 24/24 E2E PASS + 5 WCAG findings (1 serious + 4 moderate).
- CLOSE-3 análisis cruzado docs Bea+Renzo V1: **~1h 30min** (reemplazó al manual humano del dev, absorbido por SP-4B phase-01).
- CLOSE-4 corrección bugs detectados: **~25min** (BUG-001 logout redirect + BUG-002 viewer→/admin guard + 2 lint fixes en cierre formal).
- CLOSE-5 cierre formal (CHANGELOG + RoadMap update + PR): **~25min**.

Dos tareas (1-03 rotar JWTs Supabase VPS, 1-05 password Postgres VPS) quedan 🟡 **diferidas pre-deploy** — se ejecutan antes de promoción a `staging`, no bloquean `v0.1.0` en `developer`.

### Security (hotfixes que motivan el sprint)

- **RLS multi-tenant hardening**: eliminada policy tautológica `USING(true)` en `tenants` (`20260521000000_rls_tenants_hardening.sql`) y dead-letter `app.current_tenant` en `knowledge_base` (`20260521000001_rls_knowledge_base_hardening.sql`). 4 policies S/I/U/D ownership-based en cada tabla. Tareas 1-18, 1-19. Commit `da64297`.
- **Privilege escalation cerrada**: `is_admin` movido de `user_metadata` (editable por usuario) a `app_metadata` (sólo service_role). Script `migrate-is-admin-to-app-metadata.sql` aplicado. Tarea 1-16. Commit `da64297`.
- **Auth en endpoints orquestación**: `requireApiUser` + `requireTenantAccess` en deploy/graph/publish/workflows/calls/manual. Tarea 1-07. Commit `4da79b1`.
- **Auth en endpoints cron**: `requireCronSecret` timing-safe en sweep + cron/appointments/reminders. Tarea 1-08. Commit `4da79b1`.
- **Guard orquestación user-driven**: `requireOrchestrationEnabled` (DENY by default vía `tenants.config.test_orchestrator_enabled`). Tarea 1-09. Commit `4da79b1`.
- **Validación HMAC webhooks**: Retell (`x-retell-signature` + `RETELL_WEBHOOK_SECRET`), WhatsApp (`WHATSAPP_APP_SECRET` obligatorio), CRM (firma per-tenant atada a `tenant_id`). Tareas 1-12, 1-13, 1-14, 1-15. Commit `a17c687`.
- **JWTs hardcoded eliminados**: 10 ocurrencias en código fuente reemplazadas por `requireEnv()`/`requireEnvAny()` desde `src/lib/env.ts`. `grep eyJhbGci|FALLBACK_ src/` = 0. Tarea 1-04. Commit `d595287`.
- **IDOR en inbox**: 9 funciones (`updateLeadSegment`, `sendManualMessage`, `injectMockupMessage`, `toggleLeadAI`, `assignAgentToLead`, `deleteLead`, `deleteChatHistory`, `deleteLeadFacts`, `updateLeadInfo`) verifican ownership tenant vía `.eq("tenant_id", tenant.id)`. Tarea 1-21. Commit `da64297`.
- **SSRF cerrado en `/api/tenant/migrate`**: URL+key del Supabase del tenant resueltas desde DB (no de cookie `af-tenant-url`). `isAllowedTenantUrl()` bloquea loopback/RFC1918. Tarea 1-22. Commit `2c9437c`.
- **XSS widget embed sanitizado**: validación regex UUID estricta + `JSON.stringify` para `id`/`baseUrl` antes de interpolar en JS servido a terceros. Tarea 1-23. Commit `2c9437c`.
- **Widget chatbot hardening (nuevo en Sprint 0)**: `web_widgets.allowed_domains` + `rate_limit_per_minute` + verificación `Origin`/`Referer` + sliding-window Redis rate-limit (fallback ALLOW si Redis caído). Migración `20260522000000_widget_hardening_allowed_domains_rate_limit.sql`. Tarea 1-27. Commit `ff0583c`.
- **`crypto@1.0.1` DEPRECATED removido**: helpers HMAC ahora usan `node:crypto` built-in. Tarea 1-25. Commit `2c9437c`.
- **`axios` 1.14.0 → 1.16.1** (15 CVEs SSRF + Prototype Pollution). Tarea 1-24. Commit `2c9437c`.
- **`next` 16.1.6 → 16.2.6** (19 CVEs incl. middleware bypass — invalidaba auth hotfixes 1-07/1-08/1-16). Tarea 1-26 (movida desde Sprint 1 tras audit ADR 20-05-2026). Commit `1ce8e0b`.

### Fixed (post-cierre, detectados en E2C CLOSE-2)

- **BUG-001 logout redirect**: `auth.ts:108` ahora hace `redirect('/login')` tras `signOut()`. Commit `8beeddd`.
- **BUG-002 admin guard `/admin`**: `middleware.ts:65` extiende guard a `/admin` (viewer no accede). Commit `8beeddd`.
- **Lint react-hooks ThemeToggle**: `eslint-disable-next-line react-hooks/set-state-in-effect` justificado en hydration-safe mount flag.
- **Lint prefer-const compliance**: `let startH` → `const startH` en `isWithinLegalWindow()`.

### Changed

- **Orchestrator worker firma corregida**: `worker.js:58` carga `lead+config+sequence` antes de llamar `executeSequenceStep(lead, tenantId, sequence, stepIndex, config)`. Desbloquea flujo multi-día. Tarea 1-01. Commit `847ef79`.
- **Redis errors propagados**: `enqueueLeadStep` ya no silencia errores Redis (catch silencioso → log estructurado + re-throw). 3 callers gestionan throw. Tarea 1-02. Commit `662073f`.
- **Postgres `app_user` least-privilege**: SQL idempotente `supabase/scripts/create-app-user.sql` + apply local OK. 4 permisos DML, 0 DDL. Tarea 1-06. Commit `67b53c8` + `1fc4992`.
- **Tenant verification en CRUD admin**: `assertAdminAccess()` en `createTenant`/`deleteTenant`/`updateTenant`/`getTenants`. Tarea 1-17. Commit `da64297`.
- **`fetchCalls` con filtro tenant**: 4 funciones (`fetchCalls`, `getCallsByPhone`, `fetchIntentosByPhone`, `fetchWhatsappByPhone`) usan `getActiveTenantId()` + `.eq("tenant_id", id)`. Tarea 1-20. Commit `da64297`.

### Added

- **Playwright setup local + 24 E2E tests Sprint 0**: 16 security gates + 2 core smoke + 6 smoke flows en `tests/e2e/sprint-0-close/`. Tarea 0-00 + 163f5d5. Commit `00cc35a` + `163f5d5`.
- **Pre-push hooks** (Husky + lint-staged + commit-msg + 3 typecheck fixes). Tarea 0-01. Commit `a74406e`.
- **Helpers de seguridad reutilizables**: `src/lib/api-auth.ts` (`requireApiUser`, `requireTenantAccess`, `requireCronSecret`, `requireOrchestrationEnabled`, `requireApiAdmin`, `assertAdminAccess`), `src/lib/env.ts` (`requireEnv`, `requireEnvAny`), `src/lib/api/validate-widget-origin.ts`, `src/lib/api/rate-limit-widget.ts`.
- **Script handoff BD para VPS**: `scripts/db-export-snapshot.sh` + `docs/handoff/db-snapshot-to-vps-renzo.md` (instrucciones Dokploy). Commit `1886785`.
- **Reports de cierre**:
  - [`plans/reports/sp-1-close-1-auto-test-20260522.md`](plans/reports/sp-1-close-1-auto-test-20260522.md)
  - [`plans/reports/sp-1-close-2-e2c-playwright-wcag-20260522.md`](plans/reports/sp-1-close-2-e2c-playwright-wcag-20260522.md)
  - [`plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md`](plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md)
- **Checklist manual `docs/testeos-manual.md`** con quick checks clickables.
- **Naming convention Sprint 1+**: `feature/sprint-NN-<slug>` con 2 dígitos. Commit `7c9bb46`.
- **Dev port fijo `localhost:8500`**. Commit `95d470a`.
- **Política screenshots**: `docs/screenshots/` único, excepciones `playwright-report/`, `test-results/`, `public/`. Commit `141fa72`.

### Deferred to pre-deploy `staging`

- **1-03**: Rotar JWTs Supabase del VPS (anon + service_role). 100% acceso VPS.
- **1-05**: Password Postgres del VPS rotada. 100% acceso VPS.

### Known issues / debt aceptada

- **Lint 118 errores + 23 warnings preexistentes** del baseline `dashboard-esden` (bajada -46 desde el baseline original de 164 errores). Decisión Javi HP 22-05-2026: diferir limpieza a Sprint 1. No bloquea `v0.1.0` porque typecheck y build pasan en verde.
- **WCAG 2.2 AA**: 5 findings (`/login`: 1 serious + 2 moderate, `/dashboard`: 1 serious + 1 moderate) absorbidos por SP-4B phase-01 (validación Renzo).
- **Sin tests unit/integration**: no definidos en `package.json` aún. Cobertura cubierta vía E2E + smoke flows en Sprint 0.

### References

- Plan: [`plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md`](plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md)
- Decisiones cerradas: [`docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md`](docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md)
- Gap analysis spec vs code: [`docs/audit/gap-analysis-spec-vs-code.md`](docs/audit/gap-analysis-spec-vs-code.md)
- Documentación cliente: `docs/Docs-entrega-clienta/` + análisis Bea+Renzo V1 en CLOSE-3 report.

---

## [Unreleased] — Sprint 1

**Sprint 1 — Capa de datos** · rama: `feature/sprint-01-capa-datos` · objetivo: consolidar `@supabase/ssr` + Zod + Repository pattern + RLS hardening sin ORM nuevo. Tag previsto: `v0.2.0`.

Estado: 🟡 In progress (kickoff `4b43b78`, NEW-01 fix `837e12f`, lint fix `98b2c70`).
