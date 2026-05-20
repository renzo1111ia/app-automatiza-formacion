# Research — HubSpot CRM Integration (Sprint 3)

**Agente:** researcher (Sonnet)  
**Fecha:** 20-05-2026  
**Scope:** HubSpot API v3, OAuth2 multi-tenant, webhooks, @hubspot/api-client@13.5.0  
**Audiencia:** planner Sprint 3  

---

## Resumen ejecutivo

- **OAuth2 Public App obligatorio** para multi-tenant. Private Apps son per-portal, incompatibles con SaaS donde el tenant conecta su propia cuenta. Usar Authorization Code flow + refresh tokens sin expiración.
- **Access token dura 30 min.** Refresh token no expira. Estrategia: refresh automático con interceptor axios o built-in SDK.
- **@hubspot/api-client@13.5.0** es el SDK oficial TypeScript. Instanciar un cliente por tenant (un client = un token). Compatible con Node 24.
- **Rate limits** (OAuth Public App): 110 req/10s por portal instalado. Daily: 250K (Free/Starter), 625K (Pro), 1M (Enterprise). Sin burst adicional con API add-on en public apps.
- **Webhooks**: HMAC SHA-256 via `X-HubSpot-Signature-v3`. Retry hasta 3 días con backoff. Registrar subscriptions por app-level (no por portal), filtrar events por portalId en handler.
- **Bidireccionalidad**: protección anti-loop obligatoria — marcar writes originados por nuestro sistema con metadata para ignorar el webhook entrante resultante.
- **Sandbox**: HubSpot Developer Test Accounts (antes "Sandbox Accounts") — aprovisionar desde developer portal, cuentas limpias con datos ficticios.
- **Complejidad global C-02**: High (OAuth flow + token refresh + webhook registry + loop prevention + field mapping).

---

## 1. Private App vs OAuth2 Public App

| Criterio | Private App | OAuth2 Public App |
|----------|-------------|-------------------|
| Multi-tenant (cada academia su cuenta) | ❌ — solo 1 portal | ✅ — N portales |
| Tenant conecta su cuenta en UI | ❌ manual: tenant copia token | ✅ botón "Conectar HubSpot" |
| Token expira | No (pero revocable) | Sí (30 min access, refresh sin expiración) |
| Webhooks | No | ✅ |
| Distribución | Solo cuenta propia | Cualquier cuenta HubSpot |

**Decisión:** OAuth2 Public App. El tenant hace clic en "Conectar HubSpot" → redirect OAuth → nuestro callback → guarda tokens cifrados en `integrations` tabla → adapter usa tokens por tenant.

**Datos a guardar en `integrations` por tenant:**
```
hub_id (portalId), access_token (AES-256), refresh_token (AES-256), 
token_expires_at (timestamp), scopes (array), connected_at
```

**Scopes mínimos recomendados:**
```
crm.objects.contacts.read crm.objects.contacts.write
crm.objects.deals.read crm.objects.deals.write
crm.schemas.contacts.read
oauth
```

---

## 2. HubSpot CRM API v3 — endpoints clave

**Base URL:** `https://api.hubapi.com`

### Contacts
```
GET  /crm/v3/objects/contacts/{contactId}
GET  /crm/v3/objects/contacts?limit=100&after={cursor}
POST /crm/v3/objects/contacts           — crear
PATCH /crm/v3/objects/contacts/{id}     — actualizar propiedades
POST /crm/v3/objects/contacts/search    — buscar por email, propiedades
POST /crm/v3/objects/contacts/batch/upsert — upsert batch (idHubspot o email)
```

**Búsqueda por email (más importante para append-only check):**
```json
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{"filters": [{"propertyName": "email","operator": "EQ","value": "lead@email.com"}]}],
  "properties": ["firstname","lastname","email","phone","hs_lead_status"]
}
```

### Deals
```
POST /crm/v3/objects/deals              — crear deal
PATCH /crm/v3/objects/deals/{id}        — actualizar
POST /crm/v3/objects/associations/contact/deal/batch/create — asociar contact↔deal
GET  /crm/v3/pipelines/deals            — listar pipelines + stages
```

### Custom Properties (para field mapping UI)
```
GET /crm/v3/properties/contacts         — listar todas las propiedades del portal
GET /crm/v3/properties/deals
POST /crm/v3/properties/contacts        — crear propiedad custom
```

### Paginación (cursor-based)
Respuesta incluye `paging.next.after` (cursor opaco). Siguiente page: `?after={cursor}`. Última page: sin `paging.next`.

### Códigos de error clave
| Código | Significado | Acción |
|--------|-------------|--------|
| 429 | Rate limit | Retry con backoff exponencial; leer `X-HubSpot-RateLimit-Remaining` header |
| 401 | Token inválido/expirado | Refresh token + retry |
| 404 | Objeto no encontrado | Log + no reintentar |
| 400 | Request malformed / campo no existe | Log error específico, no reintentar |

---

## 3. Webhooks HubSpot

### Registro de subscriptions
Las subscriptions se registran a **nivel de app** (no por portal). Una vez configuradas, aplican a todos los portales que instalen la app. Configuración en HubSpot Developer Portal → App → Webhooks tab.

**Tipos de evento principales:**
```
contact.creation          — nuevo contacto creado
contact.propertyChange    — propiedad modificada (especificar cuál)
contact.deletion          — contacto borrado
deal.creation
deal.propertyChange
deal.stageChange
```

**Enrutamiento multi-tenant en handler:**  
HubSpot envía `portalId` en cada evento. El handler extrae `portalId` → busca tenant en BD → procesa con tokens del tenant correcto.

```
POST /api/webhooks/hubspot
Body: [{ "portalId": 12345, "objectType": "contact", "eventType": "contact.creation", ... }]
```

### Validación firma X-HubSpot-Signature-v3

**Headers enviados por HubSpot:**
- `X-HubSpot-Signature-v3`: hash base64
- `X-HubSpot-Request-Timestamp`: epoch milliseconds

**Algoritmo de validación (TypeScript):**
```typescript
import { createHmac } from 'node:crypto';

function validateHubSpotSignature(
  clientSecret: string,
  method: string,      // 'POST'
  url: string,         // full URL incluyendo query string, URL-decoded
  rawBody: string,     // raw body string
  timestamp: string,   // X-HubSpot-Request-Timestamp header value
  signature: string    // X-HubSpot-Signature-v3 header value
): boolean {
  // Rechazar si timestamp > 5 minutos
  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp)) > 5 * 60 * 1000) return false;

  // Construir string: METHOD + URL + BODY + TIMESTAMP
  const sourceString = `${method}${url}${rawBody}${timestamp}`;
  
  // HMAC SHA-256 → base64
  const hash = createHmac('sha256', clientSecret)
    .update(sourceString, 'utf8')
    .digest('base64');
  
  // Comparación constant-time (evitar timing attacks)
  return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
```

**IMPORTANTE:** Leer el body como string RAW antes de `JSON.parse`. Next.js API routes: usar `request.text()` o desactivar `bodyParser` y usar `rawBody`.

### Retry policy
HubSpot reintenta durante **3 días** con backoff exponencial si el endpoint devuelve 5xx o no responde en tiempo. Responder siempre `200 OK` lo antes posible (async processing). Idempotencia: cada evento tiene `eventId` único — deduplicar en BD.

---

## 4. Rate Limits

| Plan HubSpot | Burst (10s) | Diario |
|--------------|-------------|--------|
| Free | 110/10s | 250,000 |
| Starter | 110/10s | 250,000 |
| Professional | 110/10s | 625,000 |
| Enterprise | 110/10s | 1,000,000 |

**NOTA:** Los 110/10s son por portal instalado (public app). No se pueden aumentar con add-on en public apps.

**Estrategia de rate limiting:**
- BullMQ ya instalado → queue de writes a HubSpot por tenant
- Concurrencia máxima por worker: 10 jobs simultáneos por tenant (bien bajo del límite)
- Al recibir 429: pausa el worker del tenant 10 segundos + exponential backoff
- Header `Retry-After` de HubSpot si presente: usar ese valor

---

## 5. @hubspot/api-client@13.5.0

**Instalación:** `npm install @hubspot/api-client@13.5.0`

**Instanciar per-tenant:**
```typescript
import { Client } from '@hubspot/api-client';

function createHubSpotClient(accessToken: string): Client {
  return new Client({ accessToken });
}

// Uso:
const client = createHubSpotClient(tenant.hubspotAccessToken);
const contact = await client.crm.contacts.basicApi.getById(contactId);
```

**Tipos TypeScript clave:**
```typescript
import { SimplePublicObjectInput } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { SimplePublicObjectInputForCreate } from '@hubspot/api-client/lib/codegen/crm/contacts';
```

**Retry built-in:** El SDK tiene retry automático para 429 y 5xx con backoff. Se configura con `numberOfApiCallRetries` en el constructor:
```typescript
new Client({ accessToken, numberOfApiCallRetries: 3 })
```

**Breaking changes vs v12:** La v13 actualiza tipos para la API v3 de HubSpot. Cambios menores en types de propiedades de objetos. No hay breaking en la API surface principal.

**Alternativa raw fetch:** Para webhooks y OAuth flow (no CRM calls), usar axios directamente es más limpio. El SDK wrapping OAuth tokens es más útil para llamadas CRM.

---

## 6. Bidireccionalidad — trade-offs

### Flujos
1. **Inbound (HubSpot → nuestro sistema):** Contact creado en HubSpot → webhook → crear/actualizar lead en nuestra BD aplicando R-014 append-only.
2. **Outbound (nuestro sistema → HubSpot):** Lead calificado por agente IA → push datos a HubSpot contact aplicando field mapping + write_policy.

### Anti-loop
**Problema:** Escribimos en HubSpot → HubSpot dispara webhook → nuestro sistema lo procesa → escribe en HubSpot → loop infinito.

**Solución recomendada (property-based):**
- Crear propiedad custom en HubSpot: `esden_last_sync_source` (tipo = string)
- Al escribir desde nuestro sistema: setear `esden_last_sync_source = "esden_sync_<timestamp>"`
- Al recibir webhook: si `esden_last_sync_source` modificado dentro de los últimos 30s → ignorar evento (es echo de nuestro write)
- Mejor aún: marcar en nuestra BD `outbound_sync_in_progress = true` + TTL 30s durante write; si llega webhook durante ese TTL para ese portalId+contactId → skip

### Conflict resolution
- Append-only (R-014) por defecto: no hay conflicto porque nunca sobrescribimos
- Para campos con `overwrite_with_audit`: "last writer wins" + audit log. En práctica, el agente IA solo escribe campos de cualificación que el humano no edita en HubSpot.

---

## 7. Sandbox HubSpot

**HubSpot Developer Test Accounts** (renombrado de "Sandbox"):
- Se crean desde HubSpot Developer Portal → Apps → Testing → "Create test account"
- Son portales limpios con datos ficticios, sin cuenta de pago real
- Limitaciones: solo 1000 contacts, algunas features premium no disponibles
- API key y OAuth funcionan igual que en producción
- **Rate limits en sandbox:** iguales que Free tier (110/10s, 250K daily)
- Para webhooks en sandbox: necesitas endpoint público → usar `ngrok` en local

**Credenciales de testing:**
- Un developer test account por cada integración que testear
- OAuth app se puede testear con el test account sin publicar en Marketplace
- Acceso desde: developers.hubspot.com → Test accounts

---

## Estimación de complejidad por componente C-02

| Componente | Complejidad | Horas est. |
|------------|-------------|-----------|
| OAuth2 Authorization Code flow + callback | High | 6h |
| Token storage + auto-refresh (interceptor) | Medium | 4h |
| HubSpot CRM adapter class (contacts + deals) | Medium | 8h |
| Webhook endpoint + signature validation | Medium | 5h |
| Webhook event processing + tenant routing | Medium | 5h |
| Anti-loop protection | Medium | 3h |
| Field mapping integration con crm_field_mapping | High | 6h |
| BullMQ queue para outbound writes | Low | 3h |
| Tests unitarios adapter | Medium | 4h |
| **Total** | | **~44h** |

**Nota:** 44h cae en el rango alto estimado (24-40h). La complejidad extra viene de OAuth flow completo + anti-loop + integración con field mapping. Si se simplifica a un solo sentido (outbound only) en primera iteración: -10h.

---

## Recomendaciones

1. Usar OAuth2 Public App, NO Private Apps.
2. Guardar access_token + refresh_token cifrados (AES-256) por tenant en tabla `integrations`. 2-26 (Sprint 2) debe estar completo antes de 3-02.
3. SDK `@hubspot/api-client@13.5.0` para llamadas CRM. Para OAuth flow y webhook validation: código propio con `node:crypto`.
4. Anti-loop: enfoque property-based + TTL en memoria (Redis/BullMQ cache).
5. Webhook handling: responder 200 inmediatamente, procesar en BullMQ queue async.
6. Sandbox: usar Developer Test Account. Para CI/CD: grabar+replay de fixtures con nock o MSW — NO llamadas reales en CI.

**Status:** DONE  
**Summary:** Research completo de HubSpot OAuth2, API v3 endpoints, webhooks, rate limits, y @hubspot/api-client@13.5.0 para contexto de Sprint 3. Complejidad 3-02 estimada en ~44h incluyendo OAuth flow, bidireccionalidad y anti-loop.
