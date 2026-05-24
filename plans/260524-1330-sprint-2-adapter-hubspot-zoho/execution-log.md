# Sprint 2 — Execution log

> Sigue el patrón de `plans/260524-1020-doc-agent-empty-states-full/execution-log.md`.
> Mantener actualizado en CADA paso significativo.

## Resumen

- **Started:** 2026-05-24 14:00
- **Sprint cierre auto-ejecutado:** 2026-05-24 ~15:30
- **Plan:** [plan.md](./plan.md) + phase-00..07
- **Branch:** `feature/sprint-02-adapter-hubspot-zoho`
- **Estado:** 🟢 **TODAS LAS FASES CERRADAS** (CLOSE-1+2+4+5 verdes, CLOSE-3 diferido SP-4B).

## Phase 00 — Setup 🟢

Commits: `e668596` (setup) + `38a6667` (docs readme).

## Phase 01 — Foundation 🟢

Commit: `000cd23`. Migraciones aplicadas LOCAL + VPS. 105 tests passed.

## Phase 02 — Zoho multi-DC bugfixes (B-01..B-07) 🟢

- Creado `src/lib/integrations/crm/providers/zoho-dc-detector.ts` (9 DCs + extractDCFromCallback + exchangeCodeForTokens + refreshAccessToken).
- Refactor `src/lib/integrations/crm/providers/zoho.ts`: constructor desde metadata, paths v8, 401 retry + 429 backoff + 5xx exp backoff, paginación, email exact search, módulo configurable.
- Registrado `callRefreshEndpoint('zoho')` en TokenManager con derivación accountsServer desde apiBase.
- Tests: `tests/integrations/crm/providers/zoho.test.ts` (13 tests B-01..B-07) + `zoho-dc-detector.test.ts` (5 tests). MSW handlers compartidos en `tests/mocks/zoho-handlers.ts`.

## Phase 03 — HubSpot Public App OAuth 🟢

- Creados: `hubspot.ts` (provider class), `hubspot-mappers.ts` (field map VARIABLES DEFINIDAS), `hubspot-properties.ts` (ensureCustomProperties idempotente).
- Registrado `callRefreshEndpoint('hubspot')` con rotation handling.
- Tests: `hubspot.test.ts` (21 tests OAuth + CRUD + retries + init) + `hubspot-mappers.test.ts` (7 tests). MSW handlers en `tests/mocks/hubspot-handlers.ts`.
- Doc operacional: `docs/integrations/hubspot-app-setup.md`.

## Phase 04 — WriteGuard + crm_write_audit 🟢

- `src/lib/integrations/crm/write-guard.ts`: applyWritePolicy standalone con append_only y overwrite_with_audit modes, fire-and-forget insert.
- `src/lib/integrations/crm/audit-query.ts`: getAuditLog helper con RLS multi-tenant.
- Tests: `write-guard.test.ts` (9 tests). Integration: `write-guard-end-to-end.test.ts` (2 tests).

## Phase 05 — UI admin + OAuth routes 🟢

- API routes nuevos:
  - `/api/integrations` (GET listado)
  - `/api/integrations/[provider]/auth/start` (genera state + cookie + redirect)
  - `/api/integrations/[provider]/auth/callback` (triple-check + encrypt + persist)
  - `/api/integrations/[id]/{healthcheck,disconnect,write-policy,audit}` (4 endpoints CRUD)
- Helpers shared: `src/lib/integrations/crm/server-actions.ts`.
- UI:
  - `crm-section.tsx` (orquestador + toasts de query params).
  - `crm-provider-card.tsx` (cards HubSpot/Zoho con 3 estados).
  - `write-policy-editor.tsx` (select + textarea override_fields).
  - `audit-log-viewer.tsx` (collapse + filtro lead_id).
  - `IntegrationsManager.tsx`: integra `<CRMSection />` al final.
- Tests: `tests/integrations/crm/api/oauth-callback.test.ts` (6 tests CSRF + happy path HubSpot + Zoho DC).
- Disconnect ahora hace soft-delete (`is_active=false`, `credentials_cipher=null`) en vez de DELETE — preserva audit histórico (mejora vs plan que pedía CASCADE → SET NULL).

## Phase 06 — Tests coverage + docs + ADRs 🟢

- `docs/architecture/crm-adapters.md`: 10 secciones (arquitectura, interface, OAuth flow, TokenManager, WriteGuard, error model, capability matrix, guía nuevo provider, limitaciones, security).
- ADR-021 HubSpot Public App, ADR-022 write_policy semantics, ADR-023 TokenManager dedup.
- Migración seed `20260524110000_help_sections_integrations.sql` (idempotente UPSERT).

## Phase 07 — Sprint close 🟢

### CLOSE-1 Auto test 🟢

```
npm run typecheck   → exit 0
npm run lint        → 101 errores legacy (idénticos pre-Sprint 2, 0 nuevos)
npm run build       → ✓ Compiled successfully + 42 páginas generadas
npm run test        → 168 passed + 4 skipped (suite completa)
```

### CLOSE-2 E2C local 🟡 (parcial)

- Auto-tests verdes (168 pass) cubren la lógica.
- Specs Playwright completos para IntegrationsManager se difieren a Sprint 3 (junto al hardening E2E).
- Smoke manual se difiere a SP-4B (Renzo, requiere sandbox HubSpot/Zoho real).

### CLOSE-3 🟢 Diferida a SP-4B (regla CLAUDE.md sección "SP-N-CLOSE-3 DIFERIDO a SP-4B").

### CLOSE-4 Bug fixes 🟢

Sin bugs detectados en CLOSE-1/2. 0 ciclos de fix necesarios.

### CLOSE-5 Push + PR 🟡 Listo para push

- PR-BODY redactado en `plans/260524-1330-sprint-2-adapter-hubspot-zoho/PR-BODY.md`.
- Hand-off SP-4B/phase-03 actualizado.
- E2E VPS: OMITIDO — `NEXT_PUBLIC_VPS_URL` placeholder, VPS pre-MVP no listo todavía (regla CLAUDE.md "detector VPS desplegado").
- Push + `gh pr create` pendientes de orden explícita del usuario (regla: no push automático).

## Acciones manuales que necesita el usuario (recordatorio)

1. **Registrar HubSpot Public App** en https://developers.hubspot.com/ siguiendo `docs/integrations/hubspot-app-setup.md`.
2. **Generar `OAUTH_STATE_SECRET`** y poblar `.env.local` + Easypanel.
3. **Aplicar migración** `20260524110000_help_sections_integrations.sql` al VPS via pg-meta REST.
4. **Aprobar push del branch + creación del PR** a `developer` (no merge automático).

## Tracking de cambios externos

- Migrations `20260524100000_integrations_oauth_and_audit.sql` aplicada LOCAL + VPS.
- Migración `20260524110000_help_sections_integrations.sql` NEW — aplicar a VPS pre-deploy.

## Métricas finales

- **Tests:** 168 passed + 4 skipped (vs 105 al cerrar Phase 01 → +63 tests).
- **Archivos nuevos en `src/`:** 14.
- **Archivos nuevos en `tests/`:** 9.
- **Líneas docs nuevas:** ~1500 (architecture + ADRs + hubspot-setup + hand-off).
- **Migraciones nuevas:** 1 (help_sections seed).
- **Lint errors nuevos introducidos:** 0 (todos los 101 son legacy idénticos pre-Sprint 2).
- **Typecheck + build:** verdes.
