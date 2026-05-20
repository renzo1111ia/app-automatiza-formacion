# Phase 03 — Adapter Zoho CRM (3-03)

## Context Links

- Research: `plans/reports/researcher-zoho-integration-20260520.md`
- Interface base: `plans/260520-1342-sprint-3-adapter-hubspot-zoho/phase-01-integration-adapter-interface.md`
- R-014 (append-only): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- ADR deps (Zoho = REST sin SDK): `plans/reports/adr-auditoria-dependencias-20260520.md` §Sprint 3
- Sprint 2 2-26 (cifrado tokens): `plans/260520-1342-sprint-2-capa-datos/phase-06-rls-hardening-complementario.md`

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere 3-01 completo + 2-18 + 2-26 (paralelo a 3-02)
- **Descripción:** Implementar adapter Zoho CRM via REST API (sin SDK npm) con OAuth2 Multi-DC, soporte para todas las regiones de Zoho (EU/US/IN/AU etc.), Leads + Contacts + Deals, webhooks via Notifications API con renovación de canal cada 50 minutos.

## Key Insights

- **Multi-DC es el desafío central de 3-03.** Cada tenant Zoho puede estar en un DC diferente. La región se determina durante el OAuth callback via el campo `api_domain`. Si este dato no se guarda correctamente, todas las API calls fallan.
- **Sin SDK oficial.** Implementar REST pura con axios. El pattern `axios.create()` per-tenant con interceptors de token refresh cubre todas las necesidades.
- **Webhook channels expiran en máximo 1 hora.** Requiere BullMQ cron por tenant para renovar canal cada 50 min.
- **Webhook Zoho = solo IDs.** El payload NO incluye los datos. Hay que hacer GET al endpoint del módulo después de recibir el evento (2 HTTP calls por evento inbound).
- **Validación webhook:** token-based (no HMAC). El `token` que configuramos al registrar el canal se incluye en cada webhook — comparación simple.
- **Scopes Zoho:** `ZohoCRM.modules.ALL,ZohoCRM.notifications.CREATE,ZohoCRM.notifications.READ,ZohoCRM.settings.fields.READ`
- **Rate limits Zoho:** credit-based (no por segundo). Concurrencia simultánea 5-20 según edición. BullMQ concurrencia máxima: 5.

## Requirements

**Funcionales:**
- `/api/integrations/zoho/oauth/start` — redirect al tenant a Zoho OAuth (region seleccionable)
- `/api/integrations/zoho/oauth/callback` — recibir code + `api_domain` + `location`, obtener tokens, cifrar + guardar
- `ZohoAdapter.pushContact(contact, fieldMappings)` — outbound a Leads/Contacts con R-014
- `ZohoAdapter.pullContacts(since)` — inbound sync via search con criteria
- `ZohoAdapter.pushDeal(deal, fieldMappings)` — crear/actualizar deal
- `ZohoAdapter.testConnection()` — GET /crm/v7/org con token válido
- `/api/webhooks/zoho` — recibir notificaciones Zoho + validar token
- `ZohoChannelManager.ensureChannel(tenantId)` — crear/renovar canal de notificaciones
- BullMQ cron job: renovar canales Zoho antes de expiración

**No-funcionales:**
- Tokens cifrados AES-256 en BD (2-26)
- `api_domain` y `accounts_domain` guardados por tenant (no hardcoded)
- Cada archivo `< 200 líneas`
- Responder webhook 200 OK en < 100ms

## Architecture

```
src/lib/integrations/zoho/
├── zoho-adapter.ts               — implements IntegrationAdapter
├── zoho-oauth-client.ts          — Authorization Code flow multi-DC + token refresh
├── zoho-api-client.ts            — axios instance per-tenant + interceptors
├── zoho-crm-client.ts            — Leads/Contacts/Deals REST calls
├── zoho-field-metadata.ts        — GET /settings/fields para UI mapping
├── zoho-webhook-handler.ts       — validación token + routing por channel_id
└── zoho-channel-manager.ts      — registrar/renovar canal Notifications API

src/app/api/integrations/zoho/
├── oauth/start/route.ts          — GET: redirect a Zoho OAuth
├── oauth/callback/route.ts       — GET: recibir code + api_domain + guardar

src/app/api/webhooks/
└── zoho/route.ts                 — POST: webhook endpoint (PUBLIC)
```

**Datos por tenant en tabla `integrations` para Zoho:**
```typescript
{
  provider: 'zoho',
  // OAuth tokens (cifrados con 2-26)
  access_token: string,       // AES-256
  refresh_token: string,      // AES-256
  token_expires_at: Date,     // 1 hora desde emisión
  // Multi-DC routing (CRÍTICO)
  zoho_api_domain: string,    // "https://www.zohoapis.eu"
  zoho_accounts_domain: string, // "https://accounts.zoho.eu"
  zoho_dc_region: string,     // "eu" | "us" | "in" | "au" | ...
  // Webhook channel
  zoho_channel_id: string,
  zoho_channel_token: string, // token generado por nosotros
  zoho_channel_expires_at: Date,
}
```

**Flujo OAuth Multi-DC:**
```
UI Tenant → selecciona region (EU / US-Latam / Other)
  → GET /api/integrations/zoho/oauth/start?region=eu
  → redirect 302 → https://accounts.zoho.eu/oauth/v2/auth?client_id=...
  → tenant aprueba
  → GET /api/integrations/zoho/oauth/callback?code=xxx&state=tenantId
  → POST https://accounts.zoho.{region}/oauth/v2/token
    → response incluye access_token + refresh_token + api_domain + expires_in
  → guardar todo cifrado en BD (incluyendo api_domain)
  → POST /crm/v7/actions/watch — registrar canal webhook
  → redirect UI → success
```

**Flujo webhook inbound:**
```
Zoho → POST /api/webhooks/zoho
  → leer body: { module, operation, ids: [...], channel_id, token }
  → buscar integration por channel_id en BD
  → validar body.token === integration.zoho_channel_token
  → encolar en BullMQ "zoho-inbound" queue
  → responder 200 OK
  → worker: GET {api_domain}/crm/v7/{Module}/{id} — fetch datos completos
  → procesar evento (crear/actualizar lead con R-014)
```

**axios instance per-tenant:**
```typescript
// zoho-api-client.ts
function createZohoClient(tenant: ZohoTenantConfig): AxiosInstance {
  const client = axios.create({
    baseURL: `${tenant.apiDomain}/crm/v7`,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(async (config) => {
    const token = await getValidZohoToken(tenant); // auto-refresh si expiró
    config.headers.Authorization = `Zoho-oauthtoken ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        await refreshZohoAccessToken(tenant);
        return client(error.config);
      }
      return Promise.reject(error);
    }
  );
  return client;
}
```

## Related Code Files

**Sin nuevas dependencias npm** (axios ya instalado, REST pura)

**Crear:**
- `src/lib/integrations/zoho/zoho-adapter.ts`
- `src/lib/integrations/zoho/zoho-oauth-client.ts`
- `src/lib/integrations/zoho/zoho-api-client.ts`
- `src/lib/integrations/zoho/zoho-crm-client.ts`
- `src/lib/integrations/zoho/zoho-field-metadata.ts`
- `src/lib/integrations/zoho/zoho-webhook-handler.ts`
- `src/lib/integrations/zoho/zoho-channel-manager.ts`
- `src/app/api/integrations/zoho/oauth/start/route.ts`
- `src/app/api/integrations/zoho/oauth/callback/route.ts`
- `src/app/api/webhooks/zoho/route.ts`

**Modificar:**
- `src/lib/integrations/_integration-adapter-factory.ts` — registrar ZohoAdapter
- `src/lib/schemas/integrations-schema.ts` (2-11) — extender con campos Zoho

**Leer (sin modificar):**
- `src/lib/repositories/integrations-repository.ts` (2-18)
- `src/lib/utils/encryption.ts` (2-26)

## Implementation Steps

1. Crear `zoho-oauth-client.ts`:
   - `getAuthorizationUrl(tenantId, region)` → URL redirect (region determina accounts domain)
   - `exchangeCodeForTokens(code, region)` → `{ accessToken, refreshToken, apiDomain, accountsDomain, expiresIn }`
   - `refreshAccessToken(tenantId)` → actualizar token en BD + retornar nuevo token
2. Crear `zoho-api-client.ts`:
   - `createZohoClient(tenantConfig)` → axios instance con interceptors
   - Función helper `getValidZohoToken(tenantId)` — lee BD, refresca si expirado
3. Crear `zoho-crm-client.ts`:
   - `getLeadByEmail(client, email)` → `ZohoLead | null` (search by criteria)
   - `createLead(client, data)` → `{ id }`
   - `updateLead(client, id, data)` — solo campos con valor no-existente (append_only)
   - `upsertLead(client, data, email)` — check by email → create or update
   - `getContactByEmail(client, email)` + `createContact` + `updateContact`
   - `createDeal(client, data)` + `updateDeal`
4. Crear `zoho-field-metadata.ts`:
   - `getModuleFields(client, module)` → lista de `{ api_name, display_label, data_type, is_custom }`
   - Cachear respuesta en Redis con TTL 1h (los field schemas no cambian frecuentemente)
5. Crear `zoho-adapter.ts`:
   - Implementar `IntegrationAdapter`
   - Mapear `CrmContact` → campos Zoho Leads/Contacts según field mapping
   - Aplicar write_policy de R-014 en cada campo antes de llamar al crm-client
6. Crear `zoho-channel-manager.ts`:
   - `ensureChannel(tenantId)` → crear si no existe, renovar si expira en < 10min
   - `registerChannel(tenantId)` → POST /crm/v7/actions/watch
   - `renewChannel(tenantId)` → PUT /crm/v7/actions/watch
   - BullMQ repeatable job: cada 50 min, llamar `ensureChannel` por tenant activo
7. Crear `zoho-webhook-handler.ts`:
   - `validateToken(body, expectedToken)` → boolean
   - `handleNotification(body, tenantId)` → enqueue BullMQ
   - Worker: fetch datos completos → procesar evento inbound
8. Crear routes OAuth + webhook
9. Registrar `ZohoAdapter` en factory (3-01)
10. `npm run typecheck` + `npm run build`

## Todo List

- [ ] `zoho-oauth-client.ts` — OAuth Multi-DC completo
- [ ] `zoho-api-client.ts` — axios per-tenant + interceptors
- [ ] `zoho-crm-client.ts` — Leads/Contacts/Deals REST
- [ ] `zoho-field-metadata.ts` — fields endpoint + cache Redis
- [ ] `zoho-adapter.ts` — implements IntegrationAdapter + R-014
- [ ] `zoho-channel-manager.ts` — registrar + renovar canal cada 50min
- [ ] `zoho-webhook-handler.ts` — token validation + enqueue
- [ ] Route `/api/webhooks/zoho`
- [ ] Routes OAuth `/api/integrations/zoho/oauth/start` + `/callback`
- [ ] Registrar en factory
- [ ] `npm run typecheck` pass + `npm run build` pass

## Success Criteria

- [ ] Tenant EU puede completar OAuth Zoho y conectar su cuenta `.eu`
- [ ] Tenant US/Latam puede conectar cuenta `.com`
- [ ] `api_domain` guardado correctamente según región del tenant
- [ ] `testConnection()` retorna `{ ok: true }` con credenciales válidas
- [ ] `pushContact` respeta append-only por campo
- [ ] Canal webhook creado y renovado automáticamente antes de expirar
- [ ] Webhook valida token correctamente
- [ ] Webhook recibe IDs → fetch datos → procesa evento

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Tenant en DC inesperado (ej: India) sin soporte UI | Media | Medio | UI ofrece 3 opciones: EU / Americas / Otro (manual). "Otro" permite ingresar región custom. |
| Channel expira durante pruebas → webhook no llega | Alta | Bajo | Fácil de detectar: log expiry warnings. Renovación cron mitigación principal. |
| Zoho rate limit en sync inicial masiva | Media | Medio | sync inicial: BullMQ concurrencia = 3 (muy conservador). Aumentar tras confirmar edición del tenant. |
| Field names Zoho con mayúsculas (`Last_Name`) vs nuestros campos camelCase | Alta | Bajo | Normalización en `zoho-crm-client.ts`: siempre traducir entre sistemas. Mapeo explícito. |
| 2-26 no disponible → tokens en claro | Alta | Critical | Igual que 3-02: bloquear hasta 2-26 completo |

## Security Considerations

- `ZOHO_CLIENT_ID` y `ZOHO_CLIENT_SECRET` solo en env vars, nunca en código
- Webhook: validar token SIEMPRE antes de procesar (previene spoofing)
- `api_domain` guardado en BD — si un atacante pudiera modificarlo, podría redirigir API calls. RLS protege esto.
- Token Zoho channel: `node:crypto randomBytes(32).toString('hex')` — no predecible
- Tokens OAuth cifrados AES-256 (2-26)
- Multi-DC: NUNCA hacer llamada API a `.com` si el tenant está en `.eu` — violación de data residency

## Agentes Esden asignados

- `esden-agents:api` — OAuth routes + webhook endpoint + channel manager
- `esden-agents:code` — adapter, crm-client, field metadata

## Estimación

**28h total** (estimación conservadora post-research, menor que HubSpot porque:
- No HMAC para webhooks → validación más simple
- Menos features bidireccionales a implementar en primera iteración
- Pero extra complejidad por multi-DC + channel renewal)

Desglose:
- OAuth Multi-DC flow + region detection: 6h
- axios per-tenant + interceptors + token refresh: 4h
- Zoho CRM client (Leads/Contacts/Deals REST): 8h
- Channel manager + cron renewal: 4h
- Webhook handler + route: 3h
- Field metadata + cache: 2h
- Typecheck + build + ajustes: 3h

## Next Steps

- 3-04 field mapping se integra con ambos adapters (3-02 + 3-03)
- 3-07 tests sandbox Zoho (Developer Edition)
