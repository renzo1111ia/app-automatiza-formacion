---
title: "Sprint 2 — Adapter Pattern + HubSpot + Zoho + UI Admin (MVP)"
description: "MVP de la capa de integraciones CRM multi-tenant con OAuth, write_policy, audit-log y UI de conexión."
status: pending
priority: P1
effort: 74h 00min
branch: feature/sprint-02-adapter-hubspot-zoho
tags: [sprint-2, crm, hubspot, zoho, oauth, adapter-pattern, mvp, integrations]
created: 2026-05-24
---

# Sprint 2 — Adapter HubSpot + Zoho + UI admin

## Resumen ejecutivo

MVP de la capa de integraciones CRM multi-tenant: ampliar `ICRMProvider` con OAuth + lifecycle + capabilities, arreglar 7 bugs críticos del adapter Zoho (multi-DC + refresh + paginación), implementar HubSpot como Public App OAuth2, añadir `WriteGuard` con `crm_write_audit` (append-only RLS), y refactorizar la UI de `IntegrationsManager` para gestionar conexiones reales con flow OAuth full-page. Sheets/Salesforce quedan fuera (Fase 4).

## Decisiones cliente (tomadas, no re-preguntar)

1. **HubSpot = Public App con OAuth 2.0** (multi-tenant nativo). 1 app HubSpot Developer, `HUBSPOT_CLIENT_ID` + `HUBSPOT_CLIENT_SECRET` en `.env`.
2. **1 CRM activo por tenant** (`UNIQUE(tenant_id)` en `integrations`). Cambiar de CRM = disconnect + connect.
3. **Scope MVP** = HubSpot + Zoho adapters + UI admin de conexión + `crm_write_audit` + tests Vitest+MSW. Sheets/Salesforce → Fase 4.

## Smart defaults técnicos (aplicados sin re-preguntar)

| Tema                                                      | Decisión                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| OAuth state                                               | `HMAC-SHA256(tenantId + ':' + nonce, OAUTH_STATE_SECRET)`; cookie httpOnly 15 min + columna `integrations.oauth_state`      |
| OAuth callback                                            | Full-page redirect (no popup)                                                                                               |
| Tokens                                                    | AES-256-GCM via `src/lib/crypto/token-crypto.ts` (Sprint 1) → columnas `access_token_encrypted` + `refresh_token_encrypted` |
| TokenManager                                              | `Map<integrationId, Promise<TokenPair>>` dedup in-process (no Redis MVP)                                                    |
| Refresh policy                                            | 401 → refresh + retry 1 vez. 429 → respetar `Retry-After` (cap 60s). 5xx → exp backoff 250ms→2s→8s, max 3                   |
| Refresh rotation                                          | Si HubSpot/Zoho devuelven nuevo `refresh_token`, re-cifrar y persistir inmediato                                            |
| Zoho scopes                                               | Granular (`ZohoCRM.modules.leads.READ,WRITE`, `ZohoCRM.modules.contacts.READ,WRITE`, ...) — NO `ALL`                        |
| HubSpot scope tasks                                       | Asumir `crm.objects.tasks.write`; verificar en Developer Portal (tarea pre-deploy)                                          |
| `portal_id` HubSpot + `api_domain`/`accounts-server` Zoho | Persistidos en `integrations.metadata` jsonb                                                                                |
| `write_policy` default                                    | `append_only` (R-014); UI permite cambiar a `overwrite_with_audit` por integration                                          |
| `crm_write_audit`                                         | RLS: solo `service_role` INSERT, `authenticated` SELECT. Sin UPDATE/DELETE → append-only enforced en DB                     |
| Tests                                                     | Vitest + MSW v2 (mocks de red). Integration tests con sandbox real gated por `INTEGRATION_TEST_REAL=1`, skipped en CI       |

## Tabla de fases

| #   | Fase                                                                                                               | Status       | Est.      | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------ | --------- | ---------- |
| 00  | [Setup + env + estructura carpetas + dep msw](./phase-00-setup.md)                                                 | 🔘 Pendiente | 2h 00min  | —          |
| 01  | [Foundation: interface + tabla integrations + TokenManager](./phase-01-foundation-interface-integrations-table.md) | 🔘 Pendiente | 14h 00min | 00         |
| 02  | [Zoho multi-DC bugfixes (B-01..B-07) + tests](./phase-02-zoho-multidc-bugfixes.md)                                 | 🔘 Pendiente | 10h 00min | 01         |
| 03  | [HubSpot Public App OAuth + ICRMProvider impl + tests](./phase-03-hubspot-public-app-oauth.md)                     | 🔘 Pendiente | 16h 00min | 01         |
| 04  | [WriteGuard + crm_write_audit + tests](./phase-04-write-guard-audit-log.md)                                        | 🔘 Pendiente | 6h 00min  | 01         |
| 05  | [UI admin IntegrationsManager + OAuth flow + WCAG](./phase-05-ui-admin-integrations.md)                            | 🔘 Pendiente | 12h 00min | 02, 03, 04 |
| 06  | [Tests coverage + docs + ADRs 020/021/022](./phase-06-tests-coverage-docs.md)                                      | 🔘 Pendiente | 10h 00min | 05         |
| 07  | [Sprint close: CLOSE-1..5 + hand-off SP-4B](./phase-07-sprint-close.md)                                            | 🔘 Pendiente | 6h 00min  | 06         |

**Paralelismo posible:** Fase 02 (Zoho) y Fase 03 (HubSpot) pueden ejecutarse en paralelo tras cerrar Fase 01. Fase 04 (WriteGuard) también puede arrancar en paralelo con 02/03.

**Camino crítico:** 00 → 01 → (02‖03‖04) → 05 → 06 → 07. Total secuencial ~74h, con paralelismo óptimo ~52h reales.

## Dependencias clave

- **Sprint 1 (cerrado):** `src/lib/crypto/token-crypto.ts` (AES-256-GCM), `ENCRYPTION_KEY` env, Repository pattern Supabase, migración base `integrations` (`20260522220003_integrations_table.sql`).
- **Externos:** Cuenta HubSpot Developer para registrar app, cuenta Zoho API Console (DC global). Renzo gestiona credenciales del sandbox para tests.
- **Env vars nuevas:** `OAUTH_STATE_SECRET`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` (redirect_uri base).

## Acceptance criteria global (cierre Sprint 2)

- [ ] `ICRMProvider` ampliado con `init/healthcheck/disconnect/getAuthorizationUrl/completeOAuth/createLead/getCapabilities`, sin romper código Sprint 1.
- [ ] Migración SQL aplicada local + revisada para VPS: columnas `access_token_encrypted`, `refresh_token_encrypted`, `expires_at`, `metadata`, `write_policy`, `override_fields`, `oauth_state`, `last_healthcheck_at`, `healthcheck_status`, `portal_id` + `UNIQUE(tenant_id)`.
- [ ] Tabla `crm_write_audit` creada con RLS append-only (solo `service_role` INSERT, `authenticated` SELECT, sin UPDATE/DELETE policies).
- [ ] Zoho adapter: bugs B-01..B-07 corregidos. Multi-DC funcional (test contra mock EU + US). 401 → refresh + retry. Paginación completa. Email exact search.
- [ ] HubSpot adapter: OAuth full flow start → callback → tokens cifrados. CRUD contactos + tasks + meetings. Custom properties `af_origen` + `af_metadata_extra` auto-provisionadas en `init()`. Field mapping documentado.
- [ ] `WriteGuard` standalone: filtra payload por `append_only` (skip campos no vacíos en CRM) o por `override_fields` whitelist; inserta `crm_write_audit` con `service_role` en `overwrite_with_audit`.
- [ ] `TokenManager` deduplica refreshes concurrentes por `integrationId`; persiste tokens rotados a DB encriptados.
- [ ] UI `IntegrationsManager` muestra HubSpot + Zoho como cards con estados `disconnected/connected/error`; botones `Conectar`/`Test connection`/`Disconnect`/`Reconnect`; toggle `write_policy`; viewer básico de `crm_write_audit`.
- [ ] OAuth flow E2E manual local: conectar HubSpot sandbox → callback → tokens persistidos cifrados → healthcheck verde. Idem Zoho EU.
- [ ] Tests Vitest+MSW: cobertura ≥80% en `crm/` (providers + factory + token-manager + write-guard + oauth-state).
- [ ] WCAG 2.2 AA en pantalla `IntegrationsManager` (axe-core sin violations críticas).
- [ ] ADRs 020 (Public App), 021 (write_policy semantics), 022 (TokenManager dedup) aprobados.
- [ ] Documentación `docs/architecture/crm-adapters.md` creada; `help_sections` actualizado con sección "Integrations".
- [ ] CLOSE-1..5 completados; PR a `developer` abierto SIN merge (espera orden explícita del usuario).
- [ ] Hand-off `plans/260522-1700-sprint-validacion-pre-mvp/phase-03-validacion-sprint-2.md` actualizado con comandos de test, specs Playwright y env vars VPS.
