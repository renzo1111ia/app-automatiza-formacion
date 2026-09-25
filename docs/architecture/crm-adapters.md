# Arquitectura — Capa de Adapters CRM

> Última revisión: 2026-05-24. Sprint 2 (MVP HubSpot + Zoho).

## 1. Arquitectura general

```
┌──────────────────────────────────────────────────────────────┐
│  UI / API routes (Phase 05)                                  │
│  /dashboard/settings/integrations  +  /api/integrations/*    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │   CRMFactory        │  (cache 30 min)
                  └─────────────────────┘
                       │            │
              ┌────────┘            └─────────┐
              ▼                                ▼
   ┌─────────────────────┐         ┌────────────────────────┐
   │ TokenManager        │ ◄───── │ Provider (Hub/Zoho)    │
   │ - cache + dedup     │         │ - request() + retries │
   │ - DB writeback      │         │ - OAuth handshake     │
   └─────────────────────┘         │ - createLead/etc.     │
              │                     └────────────────────────┘
              ▼
   ┌─────────────────────┐
   │ Supabase (RLS)      │  integrations + crm_write_audit
   └─────────────────────┘
```

## 2. ICRMProvider interface

Todos los providers implementan `src/lib/integrations/crm/interface.ts`:

- **Capabilities**: `getCapabilities()` → flags estáticos para que la UI muestre/oculte features.
- **Lifecycle**: `healthcheck()`, `disconnect()`.
- **OAuth**: `getAuthorizationUrl(state, redirectUri)`, `completeOAuth(code, redirectUri)`.
- **Lead ops**: `createLead`, `getLead`, `searchLeads`, `updateLead`, `findLeadByEmail` (opcional).
- **Activities**: `addTags`, `createTask`, `createEvent`.
- **Generic action**: `executeAction(leadId, actionId, data)` — Zoho BLUEPRINT, HubSpot WORKFLOW_ENROLL.

## 3. Flujo OAuth completo

```
1. Usuario → POST /api/integrations/hubspot/auth/start
              ↓
2. Server genera state HMAC + cookie httpOnly + UPSERT integrations.oauth_state
              ↓
3. 302 → app.hubspot.com/oauth/authorize?client_id=…&state=…
              ↓
4. Usuario aprueba → HubSpot redirige a /api/integrations/hubspot/auth/callback?code=…&state=…
              ↓
5. Triple-check del state:
   - cookie === query?state                  (CSRF)
   - integrations.oauth_state === query?state (replay)
   - HMAC del state válido                   (tamper)
              ↓
6. provider.completeOAuth(code) → POST tokens
              ↓
7. encryptJson(tokens) → UPDATE integrations + portal_id (HubSpot) o metadata.api_domain (Zoho)
              ↓
8. Si HubSpot: invoke init() (auto-provisiona af_origen + af_metadata_extra)
              ↓
9. 302 → /dashboard/settings?section=integrations&success=hubspot
```

## 4. TokenManager (cache + dedup + DB writeback)

`src/lib/integrations/crm/token-manager.ts`:

- `Map<integrationId, TokenState>` en memoria — TTL implícito por `expiresAt`.
- `Map<integrationId, Promise<TokenState>>` deduplica refreshes concurrentes.
- 5 minutos de buffer antes de expirar para disparar refresh proactivo.
- Cuando refresh devuelve nuevo `refresh_token` (HubSpot rota a veces; Zoho casi nunca), se re-cifra y persiste a DB.
- Cada provider registra su callback via `registerRefresher('zoho'|'hubspot', fn)` como side-effect del import.

Escalado horizontal (post-MVP): reemplazar Map por Redis `SET NX EX 30`. La API pública `getValidTokens(id)` no cambia.

## 5. WriteGuard + write_policy

`src/lib/integrations/crm/write-guard.ts`:

| Política                | Comportamiento                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `append_only` (default) | Skip cualquier campo que YA tenga valor en el CRM. Null y string vacío SÍ son writable. NO audit.       |
| `overwrite_with_audit`  | Permite SOLO campos en `allowedOverrideFields[]`. Escribe row a `crm_write_audit` por cada cambio real. |

**Audit append-only DB-level**: la tabla `crm_write_audit` tiene RLS sin policies UPDATE/DELETE. Aunque haya un bug en la app, no se puede tamper con el log.

**Fire-and-forget**: el insert de audit es no bloqueante (`.catch` loguea error). La escritura al CRM no se bloquea por un fallo de DB.

**Caller responsibility**: DEBE llamar a `provider.getLead()` antes para pasar `currentCRMFields` al guard.

## 6. Error model

`src/lib/integrations/crm/crm-error.ts` define `CRMError` con códigos:

- `AUTH_FAILED` (401/403/invalid_grant) — el caller debe re-autenticar.
- `RATE_LIMITED` (429) — `retryAfterMs` indica espera.
- `NOT_FOUND` (404) — record no existe.
- `VALIDATION` (422/400) — payload inválido.
- `NETWORK` — fetch falló / timeout.
- `PROVIDER_ERROR` (5xx) — retryable.

`mapHubSpotError` y `mapZohoError` convierten status/body raw a `CRMError` tipado.

## 7. Capability matrix HubSpot vs Zoho

| Capability       | HubSpot            | Zoho               |
| ---------------- | ------------------ | ------------------ |
| hasBlueprints    | ❌                 | ✅                 |
| hasCustomFields  | ✅                 | ✅                 |
| hasWebhooks      | ✅                 | ✅                 |
| hasDeals         | ✅                 | ✅ (Potentials)    |
| hasTags          | ❌ (usar Lists)    | ✅ nativo          |
| hasDataCenters   | ❌ (single region) | ✅ (9 DCs)         |
| oauthFlow        | authorization_code | authorization_code |
| Token TTL        | 30 min             | 60 min             |
| Refresh rotation | Sí (a veces)       | Raramente          |

## 8. Guía — añadir nuevo provider (e.g. Salesforce en Fase 4)

1. Crear `src/lib/integrations/crm/providers/salesforce.ts` implementando `ICRMProvider`.
2. Implementar `getCapabilities`, `healthcheck`, `disconnect`, `getAuthorizationUrl`, `completeOAuth`.
3. Implementar las lead ops (`createLead`, `getLead`, ...) usando `request()` privado con retries.
4. Llamar `registerRefresher('salesforce', refreshFn)` al final del archivo.
5. Añadir case en `CRMFactory.instantiate` y `CRMFactory.createForOAuthFlow`.
6. Añadir env vars `SALESFORCE_CLIENT_ID/SECRET` a `.env.example`.
7. Añadir `'salesforce'` a `SUPPORTED_PROVIDERS` en `server-actions.ts`.
8. Añadir card en `IntegrationsManager.tsx` (sección CRMSection).
9. Crear `tests/mocks/salesforce-handlers.ts` MSW + `tests/integrations/crm/providers/salesforce.test.ts`.
10. Actualizar este doc + capability matrix.

## 9. Limitaciones conocidas

- **HubSpot disconnect no revoca remoto**: el endpoint público de revoke no existe. El usuario debe desinstalar la app desde la UI HubSpot. Documentado en `docs/integrations/hubspot-app-setup.md`.
- **Zoho refresh DC-bound**: el refresh_token sólo refresca contra el `accounts.zoho.{ext}` del DC original. La derivación se hace desde `metadata.api_domain`.
- **Search HubSpot rate limit duro 4 req/s**: cubierto por backoff 429 — Sprint 3 considerará rate-limiter in-process por integration.
- **Audit fire-and-forget puede silenciar errores DB**: Sprint 3 añadirá observabilidad (Sentry) para alertar.
- **TokenManager Map in-process**: rompe en multi-instance horizontal. Migrar a Redis cuando se escale.

## 10. Security considerations

- Tokens cifrados con AES-256-GCM (Sprint 1, `src/lib/crypto/token-crypto.ts`).
- `OAUTH_STATE_SECRET` validado al boot (>= 32 chars) — fail-fast.
- Triple validación de state OAuth (cookie + DB + HMAC) en cada callback.
- `service_role` solo se importa server-side. Verify en bundle browser (no debe aparecer).
- RLS multi-tenant en `integrations` y `crm_write_audit`. Audit table sin policies UPDATE/DELETE — append-only enforced en DB.
- 0 logs de tokens en ningún provider — solo `status code`, `error code`, `integration_id`.
