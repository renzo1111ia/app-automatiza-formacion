# Phase 02 — Adapter HubSpot (3-02)

## Context Links

- Research: `plans/reports/researcher-hubspot-integration-20260520.md`
- Interface base: `plans/260520-1342-sprint-3-adapter-hubspot-zoho/phase-01-integration-adapter-interface.md`
- R-014 (append-only): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- ADR deps (HubSpot SDK confirmado): `plans/reports/adr-auditoria-dependencias-20260520.md` §Sprint 3
- Sprint 2 2-26 (cifrado tokens): `plans/260520-1342-sprint-2-capa-datos/phase-06-rls-hardening-complementario.md`

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere 3-01 completo + 2-18 + 2-26
- **Descripción:** Implementar el adapter HubSpot completo: OAuth2 Authorization Code flow multi-tenant, cliente CRM (contacts/deals), webhook endpoint con validación de firma `X-HubSpot-Signature-v3`, y bidireccionalidad con protección anti-loop.

## Key Insights

- **OAuth2 Public App** (no Private App) — obligatorio para multi-tenant. Cada academia conecta su propia cuenta HubSpot.
- **Access token expira en 30 min.** Refresh token no expira. Interceptor en SDK para auto-refresh.
- **Rate limit OAuth Public App:** 110 req/10s por portal instalado. BullMQ queue controla concurrencia.
- **Webhook anti-loop:** property custom `esden_last_sync_source` en HubSpot + TTL en Redis por (portalId, contactId). Sin esto, outbound write → webhook → outbound write → loop infinito.
- **Webhook validation:** HMAC SHA-256 de `METHOD + URL + BODY + TIMESTAMP` firmado con `clientSecret`. Rechazar si timestamp > 5 min.
- **Bidireccionalidad full** está en scope de 3-02. Inbound (HS → nuestro sistema) + outbound (nuestro sistema → HS).
- Instalar `@hubspot/api-client@^13.5.0` mediante ADR formal antes de iniciar esta fase.

## Requirements

**Funcionales:**
- `/api/integrations/hubspot/oauth/start` — redirect al tenant a HubSpot OAuth
- `/api/integrations/hubspot/oauth/callback` — recibir code, obtener tokens, cifrar + guardar en BD
- `HubSpotAdapter.pushContact(contact, fieldMappings)` — outbound con R-014 append-only
- `HubSpotAdapter.pullContacts(since)` — inbound sync (batch con cursor pagination)
- `HubSpotAdapter.pushDeal(deal, fieldMappings)` — crear/actualizar deal en HubSpot
- `HubSpotAdapter.testConnection()` — verificar token válido con GET /crm/v3/objects/contacts?limit=1
- `/api/webhooks/hubspot` — procesar eventos inbound (contact.creation, contact.propertyChange)
- Anti-loop: ignorar webhooks que son eco de nuestros propios writes
- Queue BullMQ para outbound writes (evitar superar rate limit)

**No-funcionales:**
- Tokens cifrados AES-256 en BD (depende 2-26)
- RLS: adapter solo accede a datos del `tenantId` correcto
- Cada archivo `< 200 líneas`
- Responder webhook `200 OK` en < 100ms (procesamiento async en queue)
- Idempotencia: deduplicar eventos por `eventId` HubSpot

## Architecture

```
src/lib/integrations/hubspot/
├── hubspot-adapter.ts            — implements IntegrationAdapter
├── hubspot-oauth-client.ts       — Authorization Code flow + token refresh
├── hubspot-crm-client.ts         — contacts + deals API via @hubspot/api-client
├── hubspot-webhook-handler.ts    — validación firma + routing por portalId
└── hubspot-sync-queue.ts        — BullMQ queue para outbound writes

src/app/api/integrations/hubspot/
├── oauth/start/route.ts          — GET: redirect a HubSpot
├── oauth/callback/route.ts       — GET: recibir code + guardar tokens

src/app/api/webhooks/
└── hubspot/route.ts              — POST: webhook endpoint (PUBLIC, no auth required)
```

**Flujo OAuth:**
```
Tenant UI → GET /api/integrations/hubspot/oauth/start
  → redirect 302 → https://app.hubspot.com/oauth/authorize?client_id=...
  → tenant aprueba
  → GET /api/integrations/hubspot/oauth/callback?code=xxx&state=tenantId
  → POST https://api.hubapi.com/oauth/v1/token (exchange code)
  → guardar access_token(cifrado) + refresh_token(cifrado) + hub_id + expires_at
  → redirect UI → success
```

**Flujo webhook inbound:**
```
HubSpot → POST /api/webhooks/hubspot
  → validar X-HubSpot-Signature-v3 (HMAC SHA-256)
  → validar timestamp < 5min
  → extraer portalId del evento
  → buscar tenant por hub_id en BD
  → si anti-loop TTL activo para este (portalId, contactId) → skip
  → encolar en BullMQ "hubspot-inbound" queue
  → responder 200 OK
  → worker procesa: GET /crm/v3/objects/contacts/{id} → pushContact interno
```

**Anti-loop property:**
```typescript
// Al escribir outbound a HubSpot:
await client.crm.contacts.basicApi.update(hubspotId, {
  properties: {
    ...fieldsToWrite,
    esden_last_sync_source: `esden_${Date.now()}`,
  }
});
// Marcar en Redis: key = `hubspot_sync:${portalId}:${contactId}`, TTL = 30s

// Al recibir webhook:
const syncing = await redis.get(`hubspot_sync:${portalId}:${contactId}`);
if (syncing) return; // ignorar echo
```

## Related Code Files

**Instalar (via ADR):**
- `@hubspot/api-client@^13.5.0`

**Crear:**
- `src/lib/integrations/hubspot/hubspot-adapter.ts`
- `src/lib/integrations/hubspot/hubspot-oauth-client.ts`
- `src/lib/integrations/hubspot/hubspot-crm-client.ts`
- `src/lib/integrations/hubspot/hubspot-webhook-handler.ts`
- `src/lib/integrations/hubspot/hubspot-sync-queue.ts`
- `src/app/api/integrations/hubspot/oauth/start/route.ts`
- `src/app/api/integrations/hubspot/oauth/callback/route.ts`
- `src/app/api/webhooks/hubspot/route.ts`

**Modificar:**
- `src/lib/integrations/_integration-adapter-factory.ts` — registrar HubSpotAdapter
- `src/lib/schemas/integrations-schema.ts` (2-11) — extender con campos hubspot: `hub_id`, `token_expires_at`

**Leer (sin modificar):**
- `src/lib/repositories/integrations-repository.ts` (2-18)
- `src/lib/utils/encryption.ts` (2-26)

## Implementation Steps

1. **ADR formal:** solicitar aprobación `esden-agents:adr` para instalar `@hubspot/api-client@^13.5.0`
2. Instalar `npm install @hubspot/api-client@13.5.0`
3. Crear `hubspot-oauth-client.ts`:
   - `getAuthorizationUrl(tenantId, scopes)` → URL redirect
   - `exchangeCodeForTokens(code)` → `{ accessToken, refreshToken, hubId, expiresIn }`
   - `refreshAccessToken(refreshToken)` → `{ accessToken, expiresAt }`
4. Crear `hubspot-crm-client.ts`:
   - `createClientForTenant(tenantId)` → `Client` instance con auto-refresh
   - `getContactByEmail(email)` → `CrmContact | null`
   - `createContact(contact)` → `{ id }`
   - `updateContact(hubspotId, properties)` → void
   - `getDeals(contactId)` → `CrmDeal[]`
   - `createDeal(deal, contactId)` → `{ id }`
5. Crear `hubspot-adapter.ts`:
   - Implementar `IntegrationAdapter`
   - `pushContact`: check `append_only` por campo → solo escribir campos nuevos o vacíos en HS
   - `pullContacts`: paginar con cursor, retornar array de `CrmContact`
   - `pushDeal`: idem con field mapping
6. Crear `hubspot-webhook-handler.ts`:
   - `validateSignature(req)` → boolean (HMAC SHA-256 según research)
   - `handleContactCreation(event, tenantId)` → enqueue inbound
   - `handleContactPropertyChange(event, tenantId)` → enqueue inbound
7. Crear route `/api/webhooks/hubspot/route.ts` (Next.js App Router):
   - Desactivar bodyParser de Next.js para leer raw body
   - Validar firma antes de cualquier otra lógica
   - Encolar en BullMQ + responder 200 inmediatamente
8. Crear routes OAuth start/callback
9. Crear `hubspot-sync-queue.ts`: BullMQ queue `hubspot-outbound`, worker con concurrencia 10
10. Registrar `HubSpotAdapter` en factory (3-01)
11. `npm run typecheck` + `npm run build`

## Todo List

- [ ] ADR `@hubspot/api-client@13.5.0` aprobado
- [ ] `npm install @hubspot/api-client@13.5.0`
- [ ] `hubspot-oauth-client.ts` — Authorization Code flow completo
- [ ] `hubspot-crm-client.ts` — contacts + deals + auto-refresh
- [ ] `hubspot-adapter.ts` — implements IntegrationAdapter + R-014
- [ ] `hubspot-webhook-handler.ts` — validación firma + routing
- [ ] Route `/api/webhooks/hubspot` — raw body + 200 inmediato
- [ ] Routes OAuth `/api/integrations/hubspot/oauth/start` + `/callback`
- [ ] `hubspot-sync-queue.ts` — BullMQ outbound queue
- [ ] Anti-loop Redis TTL implementado
- [ ] Registrar en factory
- [ ] `npm run typecheck` pass + `npm run build` pass

## Success Criteria

- [ ] Tenant puede completar OAuth flow HubSpot desde UI admin
- [ ] `testConnection()` retorna `{ ok: true }` con token válido
- [ ] `pushContact` respeta append-only: no sobreescribe campos existentes (write_policy: append_only)
- [ ] `pushContact` con `overwrite_with_audit` escribe + genera AuditEntry
- [ ] Webhook valida firma correctamente (rechaza requests sin firma)
- [ ] Webhook anti-loop: no procesa eco de nuestros propios writes
- [ ] Webhook responde 200 en < 100ms

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| 2-26 no disponible → tokens en claro | Alta | Critical | Bloquear 3-02 hasta 2-26 completo. Tokens sin cifrar = vulnerabilidad inaceptable. |
| Webhook raw body en Next.js App Router | Media | Medio | Usar `request.arrayBuffer()` + `Buffer.toString()` o custom middleware. Testear bien. |
| Anti-loop TTL muy corto → eco procesa igualmente | Baja | Medio | TTL mínimo 30s. Si hay latencia alta en HubSpot, aumentar a 60s. |
| Rate limit 110 req/10s superado en sync masiva | Baja | Bajo | BullMQ concurrencia = 10. Con 10 req/s estamos muy por debajo del límite. |

## Security Considerations

- `clientSecret` HubSpot NUNCA en código — solo en variables de entorno (`HUBSPOT_CLIENT_SECRET`)
- Webhook: validar `X-HubSpot-Signature-v3` SIEMPRE. Sin validación = endpoint público explotable.
- Timestamp validation: rechazar si > 5 min (previene replay attacks)
- OAuth state parameter: incluir `tenantId` hasheado (no plain) para evitar CSRF
- Tokens en BD: AES-256 (2-26). No logear tokens nunca.
- RLS garantiza que un tenant no puede leer tokens de otro

## Agentes Esden asignados

- `esden-agents:api` — OAuth routes + webhook endpoint
- `esden-agents:code` — adapter, crm-client, webhook handler

## Estimación

**44h total:**
- OAuth flow + token storage: 6h
- CRM client (contacts + deals + auto-refresh): 8h
- Adapter implementando interface + R-014: 8h
- Webhook handler + firma validation: 5h
- Webhook route (raw body + queue): 4h
- Anti-loop implementation: 3h
- BullMQ outbound queue: 3h
- OAuth routes: 3h
- Typecheck + build + ajustes: 4h

## Next Steps

- 3-03 Zoho adapter (paralelo con 3-02 tras 3-01 completo)
- 3-04 field mapping usa este adapter para testing
- 3-07 tests sandbox HubSpot
