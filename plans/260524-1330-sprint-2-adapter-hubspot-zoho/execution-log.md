# Sprint 2 — Execution log

> Sigue el patrón de `plans/260524-1020-doc-agent-empty-states-full/execution-log.md`.
> Mantener actualizado en CADA paso significativo.

## Resumen

- **Started:** 2026-05-24 14:00
- **Plan:** [plan.md](./plan.md) + phase-00..07
- **Branch:** `feature/sprint-02-adapter-hubspot-zoho` (creada desde developer)
- **Estado:** 🟡 EN DESARROLLO — checkpoint Phase 01 cerrada

## Phase 00 — Setup ✅

- **Started:** 2026-05-24 14:00
- **Ended:** 2026-05-24 14:25
- **Status:** 🟢 DONE
- **Commit:** `38a6667 chore(sprint-2): Phase 00 setup` (+ `38a6667 docs(readme)`)
- **Cambios:**
  - `.env.example` ampliado con `OAUTH_STATE_SECRET`, `NEXT_PUBLIC_APP_URL`, scopes HubSpot + Zoho documentados, nota multi-DC.
  - Carpetas creadas con `.gitkeep`: `src/lib/integrations/crm/oauth/`, `tests/integrations/crm/`, `tests/mocks/`.
  - `msw@^2.14.6` instalado como devDep + `tests/mocks/server.ts` con `setupServer()` lifecycle hooks + registrado en `vitest.config.ts` setupFiles.
  - `docs/adr/ADR-020-msw-v2-vitest-mocking.md`: justifica decisión vs alternativas.
  - `.gitignore`: excluye `.claude/logs/` y `.claude/agent-memory/`.
  - `README.md` + `plans/RoadMap.md`: estado Sprint 2 en desarrollo + Sprint 1 mergeado.
- **Tests:** 58 passed + 4 skipped (sin regresiones).

## Phase 01 — Foundation ✅

- **Started:** 2026-05-24 14:25
- **Ended:** 2026-05-24 14:50
- **Status:** 🟢 DONE
- **Commit:** `000cd23 feat(sprint-2): Phase 01 foundation`
- **Cambios:**
  - `src/lib/integrations/crm/interface.ts`: amplía `ICRMProvider` con `getCapabilities`, `healthcheck`, `disconnect`, `getAuthorizationUrl`, `completeOAuth`, `createLead`. Tipos `CRMCapabilities`, `CRMTokens`, `WriteContext`.
  - `src/lib/integrations/crm/crm-error.ts`: `CRMError` tipado + `mapHubSpotError` + `mapZohoError` + `networkError`.
  - `src/lib/integrations/crm/oauth/oauth-state.ts`: HMAC-SHA256 sign/verify constant-time (`timingSafeEqual`).
  - `src/lib/integrations/crm/token-manager.ts`: cache + dedup de refreshes concurrentes (`Map<id, Promise>`) + DB writeback. `registerRefresher(crm_type, fn)` para que cada provider registre su refresh callback. `resolveApiBase` con preferencia por `metadata.api_domain` (Zoho multi-DC).
  - `src/lib/integrations/crm/factory.ts`: dual-mode (legacy `getProvider(tenantId, config)` para Sprint 1 callers + nuevo `getProviderForIntegration(integrationId)` para Sprint 2). Cache TTL 30 min.
  - `src/lib/integrations/crm/providers/zoho.ts`: stubs de los 6 métodos nuevos + tipos `any` → `unknown/Record`. OAuth init flow lanza error explícito "Phase 02".
  - `supabase/migrations/20260524100000_integrations_oauth_and_audit.sql`: ALTER integrations + columnas `write_policy`, `override_fields`, `oauth_state`, `last_healthcheck_at`, `healthcheck_status`, `portal_id` + `UNIQUE` index parcial `WHERE is_active = true` + `crm_write_audit` con RLS append-only.
  - Migrations aplicadas LOCAL (`npx supabase migration up`) + VPS (via pg-meta REST).
- **Tests:** 47 nuevos en `tests/integrations/crm/` (16 oauth-state, 19 crm-error, 12 token-manager con dedup test). Total suite: 105 passed + 4 skipped.

## Phase 02 — Zoho multi-DC bugfixes (B-01..B-07) ⏳ PENDIENTE

- **Status:** 🔘 Pendiente (próxima sesión)
- **Estimación:** 10h
- **Lo que falta:**
  1. `src/lib/integrations/crm/providers/zoho-dc-detector.ts`: tabla `LOCATION_TO_ACCOUNTS` (US/EU/IN/AU/JP/CA/SA/UK), `extractDCFromCallback(params)`, `exchangeCodeForTokens(opts)`.
  2. Refactor `providers/zoho.ts`: constructor sin defaults hardcoded, `apiBase = metadata.api_domain + '/crm/v8'`, `tokenUrl = metadata.accounts_server + '/oauth/v2/token'`, `moduleName = metadata.module_name ?? 'Leads'`, paths a v8, `request()` con 401 retry + 429 backoff + 5xx exp backoff.
  3. Implementar `getAuthorizationUrl/completeOAuth/healthcheck/disconnect/createLead/findLeadByEmail` reales (en Phase 01 son stubs).
  4. Paginación en `searchLeads(criteria, page, perPage)`.
  5. Registrar `callRefreshEndpoint` para Zoho en `token-manager.ts` con `registerRefresher('zoho', ...)`.
  6. `tests/mocks/zoho-handlers.ts` (MSW handlers) + `tests/integrations/crm/providers/zoho.test.ts` cubriendo B-01..B-07 + 429 + 5xx + token rotation.
- **Punto de partida próxima sesión:** leer `plans/260524-1330-sprint-2-adapter-hubspot-zoho/phase-02-zoho-multidc-bugfixes.md` step 1 + `research/researcher-02-zoho-multidc.md` §9 patches.

## Phase 03 — HubSpot Public App OAuth ⏳ PENDIENTE

- **Status:** 🔘 Pendiente
- **Estimación:** 16h
- **Bloquea:** acción manual del usuario (registrar Public App en HubSpot Developer Portal) → `HUBSPOT_CLIENT_ID` + `HUBSPOT_CLIENT_SECRET` en `.env.local` y Easypanel.
- **Puede paralelizarse con Phase 02 una vez tengamos credenciales.**

## Phase 04 — WriteGuard + crm_write_audit ⏳ PENDIENTE

- **Status:** 🔘 Pendiente
- **Estimación:** 6h
- **Tabla ya creada en Phase 01 — solo falta la función `applyWritePolicy` + tests + audit-query helper.**
- **Puede paralelizarse con 02 y 03.**

## Phase 05 — UI admin IntegrationsManager ⏳ PENDIENTE

- **Status:** 🔘 Pendiente
- **Estimación:** 12h
- **Depende de:** Phase 02 + 03 + 04 ✅

## Phase 06 — Tests coverage + docs + ADRs ⏳ PENDIENTE

- **Status:** 🔘 Pendiente
- **Estimación:** 10h
- **Incluye:** integration tests cross-provider, `docs/architecture/crm-adapters.md`, ADR-021 (write_policy semantics), ADR-022 (TokenManager dedup), update `help_sections` con sección "integrations".

## Phase 07 — Sprint close ⏳ PENDIENTE

- **Status:** 🔘 Pendiente
- **Estimación:** 6h
- **Incluye:** CLOSE-1..5 (auto-test + E2C local + bug fixes + push + PR a developer sin merge) + hand-off SP-4B phase-03.

## Acciones manuales que necesita el usuario (recordatorio)

1. **Registrar HubSpot Public App** en https://developers.hubspot.com/ → Manage Apps → Create App. Anotar `client_id` + `client_secret` + configurar `redirect_uri = http://localhost:8500/api/integrations/hubspot/callback`. Scopes mínimos en `.env.example`.
2. **Generar `OAUTH_STATE_SECRET`** local con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` y guardar en `.env.local`. Para VPS guardar también en Easypanel env vars.
3. **(Opcional) Sandbox Zoho** en https://api-console.zoho.com/ — para tests integración Phase 02 con `INTEGRATION_TEST_REAL=1`.

## Tracking de cambios externos

- Migration `20260524100000_integrations_oauth_and_audit.sql` aplicada LOCAL + VPS via pg-meta REST.
- Branch pusheada a origin: `feature/sprint-02-adapter-hubspot-zoho` con commits `38a6667` + `000cd23`.

## Próxima sesión — punto de entrada

1. Leer este `execution-log.md` primero.
2. Verificar branch al día: `git checkout feature/sprint-02-adapter-hubspot-zoho && git pull`.
3. Leer `phase-02-zoho-multidc-bugfixes.md` desde step 1.
4. Continuar implementación + tests + commit.
