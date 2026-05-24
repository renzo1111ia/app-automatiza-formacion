# Fase 04 — Validación Sprint 3 (Hardening — release candidate v0.3.0-rc.1)

> **Skeleton expandido 24-05-2026** tras research R3. Versión corregida `v0.4.0-rc.1` → `v0.3.0-rc.1` (RoadMap rebajada de versiones MVP). Estructura preparada con 5 subdominios técnicos de Sprint 3 para auto-fill en `SP-4-CLOSE-5`.

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 3 plan](../260520-1342-sprint-3-hardening/plan.md)
- [Sprint 3 phase-01 E2E](../260520-1342-sprint-3-hardening/phase-01-e2e-tests-playwright.md)
- [Sprint 3 phase-02 Observabilidad](../260520-1342-sprint-3-hardening/phase-02-observabilidad-logging-metricas.md)
- [Sprint 3 phase-03 Node 22 LTS](../260520-1342-sprint-3-hardening/phase-03-migracion-node-22-lts.md)
- [Sprint 3 phase-04 WCAG](../260520-1342-sprint-3-hardening/phase-04-wcag-22-aa.md)
- [Sprint 3 phase-05 Headers + Rate limits](../260520-1342-sprint-3-hardening/phase-05-hardening-headers-rate-limits.md)
- [Sprint 3 phase-08 Features Bloque 3.B NEW-09..12](../260520-1342-sprint-3-hardening/phase-08-features-bloque-3b.md)
- [RoadMap Sprint 3](../RoadMap.md)

## Overview

- **Sprint validado**: Sprint 3 — Hardening (SP-4, **v0.3.0-rc.1** release candidate, NO confundir con v0.4.0).
- **Branch origen**: `feature/sprint-03-hardening` (mergeado a `developer` al cierre Sprint 3).
- **Estado**: 🔘 **Plantilla expandida con 5 subdominios**. Se auto-fill en `SP-4-CLOSE-5`.
- **Tester**: Renzo + equipo Renzo.
- **Importancia especial**: esta fase cierra el camino al MVP GA (v0.3.0). El cierre de SP-4B (phase-05) detona el bump v0.3.0-rc.1 → v0.3.0.

## Resumen del Sprint 3 a validar (auto-fill al cierre)

<!-- AUTOFILL-START: Resumen Sprint 3 -->

PENDIENTE — se rellena en SP-4-CLOSE-5 con los 5 subdominios + features Bloque 3.B:

1. **Phase-01 E2E Playwright completo** (32-36h): suite 6+ golden paths, coverage ≥80%.
2. **Phase-02 Observabilidad** (7-9h): Pino + bull-board + Sentry. (`llm_usage_logs` MOVIDO a Sprint Costes-LLM v0.5.1).
3. **Phase-03 Node 22 LTS** (4-6h): migración runtime VPS + local + `.nvmrc` actualizado.
4. **Phase-04 WCAG 2.2 AA** (28-40h): 24 findings DA-5 resueltos.
5. **Phase-05 Headers + Rate limits** (16-20h): CSP, HSTS, X-Frame, rate limit Redis, `withRateLimit` HOF Server Actions (4-08).
6. **Phase-08 Features Bloque 3.B** (19-25h): NEW-09 Excel + filtros + cola, NEW-10 festivos manuales, NEW-11 rename Historial→Leads (PRIMERO), NEW-12 Settings UX.

Total Sprint 3: 112-144h.

<!-- AUTOFILL-END -->

## 1. Test automático (código)

### 1.1 Node 22 LTS migration

```bash
node --version   # debe devolver v22.13.x (no v20.x)
nvm use          # selecciona automáticamente versión .nvmrc
npm ci           # NO warnings EBADENGINE
```

### 1.2 Build + tests

```bash
npm run typecheck                 # exit 0
npm run lint                      # 0 errors, 0 warnings
npm run build                     # exit 0
npm run test                      # 250+ pass (170 Sprint 2 + ~10 Sprint 2B + ~70 Sprint 3)
npm run test -- --coverage        # coverage report
```

**Resultados esperados:**

- Coverage `lines ≥ 80%`, `functions ≥ 80%`.
- Build con tamaño bundle dentro presupuesto definido en phase-06.
- 0 EBADENGINE warnings en `npm ci` VPS (Node 22 alpine + lint-staged 17 desbloqueado).

## 2. Test E2C local (Playwright contra `localhost:8500`)

### 2.1 Suite E2E Playwright completa (phase-01 Sprint 3)

```bash
npm run dev
PLAYWRIGHT_BASE_URL=http://localhost:8500 npx playwright test
```

**Specs creados en Sprint 3 phase-01** (~6 golden paths):

<!-- AUTOFILL-START: Specs phase-01 Sprint 3 -->

PENDIENTE — se auto-fill con paths exactos. Probable:

- `tests/e2e/dashboard/overview.spec.ts` (KPIs cross-canal cubre Sprint 2B también)
- `tests/e2e/leads/leads-table.spec.ts` (rename NEW-11 ya aplicado)
- `tests/e2e/conversaciones/inbox.spec.ts`
- `tests/e2e/widget/embed-chat.spec.ts` (4-09)
- `tests/e2e/voice-agents/retell-flow.spec.ts`
- `tests/e2e/calendar/appointments.spec.ts` + festivos NEW-10
- `tests/e2e/settings/crm-connection.spec.ts` (NEW-12 buscador + probar conexión)
- `tests/e2e/campanas/import-excel.spec.ts` (NEW-09)
- `tests/e2e/security/rate-limit.spec.ts` (phase-05)
- `tests/e2e/security/csp-headers.spec.ts` (phase-05)
<!-- AUTOFILL-END -->

### 2.2 WCAG axe-core (phase-04 Sprint 3)

```bash
npx playwright test tests/e2e/a11y/
```

Esperado: 0 violations critical, Lighthouse a11y ≥ 90 en todas las rutas MVP.

## 3. Test E2E VPS (Playwright contra `dev.automatizaformacion.com`)

```bash
PLAYWRIGHT_BASE_URL=https://dev.automatizaformacion.com npx playwright test
```

### 3.1 Headers de seguridad

- [ ] `Content-Security-Policy` presente en respuestas (validar con `curl -I` o axe).
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains` presente.
- [ ] `X-Frame-Options: DENY` o `SAMEORIGIN`.
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `Permissions-Policy` configurado.

### 3.2 Rate limits

- [ ] `POST /api/auth/login` con 6 requests en 1 min → 6º devuelve 429.
- [ ] `POST /api/integrations/oauth/[provider]/auth/start` con 11 requests en 1 min → 11º devuelve 429.
- [ ] Endpoints normales `/api/*` con 101 requests/min → 101º devuelve 429.

### 3.3 Observabilidad

- [ ] Logs Pino estructurados visibles en Dokploy con `tenant_id`, `request_id`, `severity`.
- [ ] bull-board UI accesible en `/admin/bull-board` (solo admin) con cola visible.
- [ ] Sentry recibe errores: forzar error 500 con request inválido → ver event en Sentry dashboard.

## 4. Test manual del tester (humano) — 4-5h

> Más extenso que phases anteriores: cubre EXPERIENCIA COMPLETA MVP + 24 findings WCAG + features NEW-09..12.

### Bloque A — Flujo completo MVP (1h)

- [ ] Landing → onboarding → crear tenant → conectar CRM → crear lead manual → simulator → ver dashboard → conversación whatsapp → agendamiento → leer audit log.

### Bloque B — Features Sprint 3 visibles (1h 30min)

- [ ] **NEW-09**: importar Excel campaña, filtrar leads por estado+origen+país, configurar cadencia envío.
- [ ] **NEW-10**: añadir festivos ES en `/dashboard/calendar/holidays`, programar campaña → debe saltar festivos.
- [ ] **NEW-11**: verificar UI dice "Leads" no "Historial" en sidebar + headers + breadcrumbs.
- [ ] **NEW-12**: buscador integraciones filtra, "Probar conexión" muestra ✅/❌, borrar requiere texto confirm, edit abre Sheet lateral.

### Bloque C — WCAG manual (1h)

- [ ] Recorrido por teclado completo (Tab + Shift+Tab + Enter + Space + Esc).
- [ ] Screen reader (NVDA Windows / VoiceOver Mac) en 5 rutas críticas: `/login`, `/dashboard`, `/dashboard/settings`, `/dashboard/conversaciones`, `/dashboard/calendar`.
- [ ] Contraste manual con eyeball + axe DevTools en componentes problemáticos (DA-5-010).

### Bloque D — Performance + observabilidad (30 min)

- [ ] Lighthouse en `/dashboard`: Performance ≥ 80, A11y ≥ 90, Best Practices ≥ 90, SEO ≥ 90.
- [ ] Sentry: forzar error con `?force_error=true` (si endpoint debug existe) → ver en Sentry.
- [ ] bull-board: ver cola activa con jobs reales.

## 5. Hotfixes encontrados durante la validación

<!-- AUTOFILL-START: Hotfixes Sprint 3 validación -->

PENDIENTE — se rellena durante SP-4B ejecución por Renzo:

| BUG-ID   | Severidad | Descripción | Fix aplicado | Commit | Estado |
| -------- | --------- | ----------- | ------------ | ------ | ------ |
| BUG-3-XX | —         | —           | —            | —      | 🔘     |

<!-- AUTOFILL-END -->

## 6. Bug regression baseline Sprint 3

<!-- AUTOFILL-START: Bugs regression Sprint 3 -->

PENDIENTE — se rellena en SP-4-CLOSE-5 con bugs cerrados durante Sprint 3:

- Bugs WCAG-XX detectados y fixed en phase-04.
- Bugs rate-limit edge cases fixed en phase-05.
- Bugs NEW-09/10/11/12 fixed en phase-08.
- Bug Node 22 migration prebuilt binaries fixed en phase-03 (si hubo).
<!-- AUTOFILL-END -->

## 7. Env vars NUEVAS que necesita el VPS

<!-- AUTOFILL-START: Env vars Sprint 3 -->

Esperado tras Sprint 3 (validar en CLOSE-5):

| Var                             | Propósito                                         | Dónde obtener                                                                    |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `SENTRY_DSN`                    | Sentry SDK init para error tracking (phase-02)    | Sentry project → Settings → Client Keys                                          |
| `SENTRY_ORG` / `SENTRY_PROJECT` | source-maps upload (opcional)                     | Sentry                                                                           |
| `PINO_LOG_LEVEL`                | Logging level (debug/info/warn/error)             | Default: `info`                                                                  |
| `BULL_BOARD_USER`               | Basic auth bull-board admin UI (phase-02)         | Generado                                                                         |
| `BULL_BOARD_PASS`               | idem                                              | `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` |
| `RATE_LIMIT_REDIS_URL`          | Redis para rate limiter distribuido (phase-05)    | Reusa `REDIS_URL` o instancia dedicada                                           |
| `CSP_REPORT_URI`                | Endpoint donde reportar violations CSP (opcional) | Sentry recibe report-uri                                                         |

<!-- AUTOFILL-END -->

## 8. Notas de despliegue

<!-- AUTOFILL-START: Notas despliegue Sprint 3 -->

1. **Dockerfile cambia 3 stages**: `node:20-alpine` → `node:22-alpine` (phase-03).
2. **Dokploy Clean Cache OBLIGATORIO** en redeploy (Node version change invalida prebuilt binaries de native deps).
3. **Migración SQL NEW-10**: `supabase/migrations/YYYYMMDD_tenant_holidays.sql` aplicar al VPS via pg-meta REST.
4. **Sentry setup**: crear proyecto en Sentry.io, obtener DSN, configurar source-maps upload en build.
5. **bull-board access**: solo admin, basic auth con vars `BULL_BOARD_USER/PASS`.
6. **Rate limiter**: depende de Redis disponible y accesible desde middleware Edge/Node.
7. **CSP headers**: validar primero en `staging` (si existe) o `dev.automatizaformacion.com` con header `Content-Security-Policy-Report-Only` antes de enforce.
8. **Restart Next.js en Dokploy** tras añadir env vars.
<!-- AUTOFILL-END -->

## 9. Status final SP-4B phase-04

<!-- AUTOFILL-START: Status final -->

PENDIENTE de auto-fill al cierre Sprint 3. Plantilla esperada:

- ⏳ Pendiente de Renzo: ejecutar checklist manual cuando Sprint 3 desplegado en VPS.
- 🟢/🟡/🔴 Auto-tests verdes: X pass, X skipped.
- 🟢/🟡 Coverage ≥ 80%.
- 🟢/🟡/🔴 Build verde con Node 22.
- 🟢/🟡/🔴 E2E completo VPS.
- 🟢/🟡 Lighthouse a11y ≥ 90 en rutas MVP.
- 🟢/🟡 Headers seguridad presentes.
- 🟢/🟡 Rate limits activos.
- 🟢/🟡 Observabilidad operativa.
- 🟢/🟡 X bugs cerrados con regression checks.
<!-- AUTOFILL-END -->

## 10. Hand-off a phase-05 (Cierre SP-4B → MVP GA v0.3.0)

Tras completar phase-01 + 02 + 03a + 03b + 04 con TODO verde, Renzo ejecuta **[phase-05-cierre-sprint.md](phase-05-cierre-sprint.md)** que detona el bump v0.3.0-rc.1 → v0.3.0 GA (MVP completo).

## Estado de la fase

| Bloque             | Estado                             |
| ------------------ | ---------------------------------- |
| 1. Test automático | 🔘 Skeleton-ready                  |
| 2. Test E2C local  | 🔘 Skeleton-ready                  |
| 3. Test E2E VPS    | 🔘 Skeleton-ready                  |
| 4. Test manual     | 🔘 Skeleton-ready                  |
| 5. Hotfixes        | 🔘 Plantilla                       |
| 6. Bugs regression | 🔘 Plantilla                       |
| 7. Env vars        | 🔘 Skeleton-ready (probable lista) |
| 8. Notas deploy    | 🔘 Skeleton-ready                  |
| 9. Status final    | 🔘 Plantilla                       |
