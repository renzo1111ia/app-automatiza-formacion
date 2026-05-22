# v0.1.0 — Sprint 0: Hotfixes de seguridad

**Fecha**: 22-05-2026 · **Tag commit**: `a387dfe` (merge PR #2) · **Branch origen**: `feature/sp-0-sprint-0-hotfixes` · **Estado**: 🟢 Released en `developer`.

## Resumen

Cierre del Sprint 0 dedicado a parchear las 4 vulnerabilidades críticas detectadas en la auditoría inicial (RLS multi-tenant tautológicas, tokens OAuth en plano, privilege escalation `is_admin`, Kong EOL) más hardening complementario de auth, webhooks, SSRF, XSS y dependencias con CVE.

## Highlights

- **RLS multi-tenant hardening** completo en `tenants` y `knowledge_base` (eliminadas policies `USING(true)` tautológicas).
- **`is_admin` movido a `app_metadata`** (cerrada privilege escalation desde `user_metadata`).
- **Auth obligatoria** en endpoints de orquestación, cron y webhooks (Retell, WhatsApp, CRM con HMAC per-tenant).
- **`next` 16.1.6 → 16.2.6** (19 CVEs incluyendo middleware bypass que invalidaba los hotfixes de auth).
- **24/24 tests E2E** Playwright pass + 2 bugs críticos detectados y corregidos en cierre (BUG-001 logout, BUG-002 admin guard).
- **Widget chatbot hardening**: `allowed_domains` + rate-limit Redis + verificación Origin/Referer.
- **Pre-push hooks** (Husky + lint-staged) + naming convention de ramas + port dev fijo 8500.

## Tiempos reales del sprint

| Bloque                                     | Estimado        | Real          |
| ------------------------------------------ | --------------- | ------------- |
| Desarrollo (1-01..1-27, 26 tareas locales) | 112h 30min      | **~7h 30min** |
| Cierre (CLOSE-1..5)                        | 5h 30min + bugs | **~3h 35min** |
| **Total Sprint 0**                         | **118h**        | **~11h 5min** |

Detalle CLOSE-1..5:

- CLOSE-1 auto-test (typecheck+lint+build): ~30min · DONE_WITH_CONCERNS (lint 128→118 errores preexistentes, no regresión).
- CLOSE-2 E2C Playwright + WCAG: ~45min · 24/24 E2E PASS + 5 WCAG findings.
- CLOSE-3 análisis cruzado docs Bea+Renzo V1: ~1h 30min (reemplazó al manual humano del dev, absorbido por SP-4B phase-01).
- CLOSE-4 corrección bugs detectados: ~25min.
- CLOSE-5 cierre formal (CHANGELOG + RoadMap update + PR): ~25min.

## Security (hotfixes que motivan el sprint)

- **RLS multi-tenant `tenants`** — eliminada policy tautológica `USING(true)`. 4 policies S/I/U/D ownership-based. Tarea 1-18. Migración `20260521000000_rls_tenants_hardening.sql`. Commit `da64297`.
- **RLS multi-tenant `knowledge_base`** — eliminado dead-letter `app.current_tenant`. 4 policies ownership-based. Tarea 1-19. Migración `20260521000001_rls_knowledge_base_hardening.sql`. Commit `da64297`.
- **Privilege escalation `is_admin`** — movido de `user_metadata` (editable por usuario) a `app_metadata` (sólo service_role). Script `migrate-is-admin-to-app-metadata.sql`. Tarea 1-16. Commit `da64297`.
- **Auth en orquestación** — `requireApiUser` + `requireTenantAccess` en deploy/graph/publish/workflows/calls/manual. Tarea 1-07. Commit `4da79b1`.
- **Auth en cron** — `requireCronSecret` timing-safe en sweep + appointments + reminders. Tarea 1-08. Commit `4da79b1`.
- **Guard orquestación user-driven** — `requireOrchestrationEnabled` (DENY by default vía `tenants.config.test_orchestrator_enabled`). Tarea 1-09. Commit `4da79b1`.
- **Validación HMAC webhooks** — Retell (`RETELL_WEBHOOK_SECRET`), WhatsApp (`WHATSAPP_APP_SECRET`), CRM (firma per-tenant atada a `tenant_id`). Tareas 1-12..1-15. Commit `a17c687`.
- **JWTs hardcoded eliminados** — 10 ocurrencias reemplazadas por `requireEnv()`/`requireEnvAny()`. Tarea 1-04. Commit `d595287`.
- **IDOR en inbox** — 9 funciones verifican ownership tenant vía `.eq("tenant_id", tenant.id)`. Tarea 1-21. Commit `da64297`.
- **SSRF en `/api/tenant/migrate`** — URL+key resueltas desde DB, `isAllowedTenantUrl()` bloquea loopback/RFC1918. Tarea 1-22. Commit `2c9437c`.
- **XSS widget embed** — validación regex UUID estricta + `JSON.stringify` antes de interpolar. Tarea 1-23. Commit `2c9437c`.
- **Widget chatbot hardening** — `allowed_domains` + `rate_limit_per_minute` + Origin/Referer + sliding-window Redis. Tarea 1-27. Migración `20260522000000_widget_hardening_allowed_domains_rate_limit.sql`. Commit `ff0583c`.
- **`crypto@1.0.1` DEPRECATED removido** — `node:crypto` built-in. Tarea 1-25. Commit `2c9437c`.
- **`axios` 1.14.0 → 1.16.1** — 15 CVEs SSRF + Prototype Pollution. Tarea 1-24. Commit `2c9437c`.
- **`next` 16.1.6 → 16.2.6** — 19 CVEs incl. middleware bypass. Tarea 1-26. Commit `1ce8e0b`. ADR-002.

## Fixed (detectados en E2C CLOSE-2)

- **BUG-001 logout redirect** — `auth.ts:108` `redirect('/login')` tras `signOut()`. Commit `8beeddd`.
- **BUG-002 admin guard `/admin`** — `middleware.ts:65` extiende guard a `/admin`. Commit `8beeddd`.
- Lint react-hooks ThemeToggle + prefer-const en `isWithinLegalWindow()`.

## Changed

- **Worker orchestrator firma corregida** — `worker.js:58` desbloquea flujo multi-día. Tarea 1-01. Commit `847ef79`.
- **Redis errors propagados** — `enqueueLeadStep` ya no silencia errores. Tarea 1-02. Commit `662073f`.
- **Postgres `app_user` least-privilege** — 4 permisos DML, 0 DDL. Tarea 1-06. Commits `67b53c8` + `1fc4992`.
- **Tenant verification CRUD admin** — `assertAdminAccess()`. Tarea 1-17. Commit `da64297`.
- **`fetchCalls` con filtro tenant** — 4 funciones usan `getActiveTenantId()`. Tarea 1-20. Commit `da64297`.

## Added

- **Playwright + 24 E2E tests** — 16 security gates + 2 core smoke + 6 smoke flows en `tests/e2e/sprint-0-close/`. Commits `00cc35a` + `163f5d5`.
- **Pre-push hooks** — Husky + lint-staged + commit-msg. Tarea 0-01. Commit `a74406e`.
- **Helpers de seguridad reutilizables** — `src/lib/api-auth.ts`, `src/lib/env.ts`, `validate-widget-origin.ts`, `rate-limit-widget.ts`.
- **Script handoff BD para VPS** — `scripts/db-export-snapshot.sh` + `docs/handoff/db-snapshot-to-vps-renzo.md`. Commit `1886785`.
- **Checklist manual** — `docs/testeos-manual.md` con quick checks clickables.
- **Naming convention Sprint 1+** — `feature/sprint-NN-<slug>` con 2 dígitos. Commit `7c9bb46`.
- **Dev port fijo `localhost:8500`** — Commit `95d470a`.
- **Política screenshots** — `docs/screenshots/` único. Commit `141fa72`.

## Migraciones SQL aplicadas

- `20260521000000_rls_tenants_hardening.sql`
- `20260521000001_rls_knowledge_base_hardening.sql`
- `20260522000000_widget_hardening_allowed_domains_rate_limit.sql`

## Variables de entorno nuevas

| Variable                | Propósito                                                | Dónde configurar                  |
| ----------------------- | -------------------------------------------------------- | --------------------------------- |
| `RETELL_WEBHOOK_SECRET` | HMAC validation webhooks Retell (1-12)                   | Easypanel env vars / `.env` local |
| `WHATSAPP_APP_SECRET`   | HMAC validation webhooks WhatsApp (1-13)                 | Easypanel env vars / `.env` local |
| `CRON_SECRET`           | `requireCronSecret` timing-safe en endpoints cron (1-08) | Easypanel env vars / `.env` local |

## ADRs aprobados en este release

- [ADR-002 — Update Next.js 16.2.6](docs/adr/ADR-002-next-upgrade-16-2-6.md) (cierre 19 CVEs).

## Breaking changes

NINGUNO en código de cliente. Cambios internos de auth requieren que los webhooks externos firmen con HMAC (configuración, no rompe API pública).

## Tareas diferidas a pre-deploy `staging`

- **1-03**: Rotar JWTs Supabase del VPS (anon + service_role). Bloqueada por acceso VPS.
- **1-05**: Password Postgres del VPS rotada. Bloqueada por acceso VPS.

## Known issues / debt aceptada

- **Lint 118 errores + 23 warnings preexistentes** del baseline `dashboard-esden`. Diferido a Sprint 1 (cerrado en ADR-019). No bloquea v0.1.0 — typecheck + build pasan en verde.
- **WCAG 2.2 AA**: 5 findings absorbidos por SP-4B phase-01 (validación Renzo).
- **Sin tests unit/integration en Sprint 0**: cobertura vía E2E + smoke flows. Vitest + 58 unit tests añadidos en Sprint 1.

## Próximos pasos

- Sprint 1 (Capa de datos sin ORM nuevo) ya cerrado y mergeado vía PR #5 → tag `v0.2.0` (release notes separadas).
- Promoción a `staging` PENDIENTE de orden explícita del usuario (requiere ejecutar 1-03 y 1-05 antes).
- SP-4B phase-01 (Renzo + equipo QA) absorberá manual humano + E2E VPS de Sprint 0.

## Contribuidores

- Javi HP (lead dev + orquestación AI).
- Renzo (tagger v0.1.0, segundo dev + QA pre-MVP).

## References

- Plan completo: [`plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md`](plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md)
- CHANGELOG: [`CHANGELOG.md` § 0.1.0](CHANGELOG.md)
- Decisiones cerradas: [`docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md`](docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md)
- Reports de cierre:
  - [`plans/reports/sp-1-close-1-auto-test-20260522.md`](plans/reports/sp-1-close-1-auto-test-20260522.md)
  - [`plans/reports/sp-1-close-2-e2c-playwright-wcag-20260522.md`](plans/reports/sp-1-close-2-e2c-playwright-wcag-20260522.md)
  - [`plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md`](plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md)

## Commits incluidos (range `fe38b0b..a387dfe`)

Total: 485 commits (incluye snapshot inicial + auditoría + scaffold Claude Code + Sprint 0 dev + Sprint 0 cierre formal).

Top-level merges:

- `a387dfe` Merge PR #2 (feature/sp-0-sprint-0-hotfixes → developer)
- `2a12c7d` Merge PR #4 (feature/sp-0-close-formal → developer) — bugs detectados en E2C aplicados también a developer
