# Research — Zoho CRM Integration (Sprint 3)

**Agente:** researcher (Sonnet)  
**Fecha:** 20-05-2026  
**Scope:** Zoho CRM API v7/v8, OAuth2 multi-DC, REST pura con axios, webhooks  
**Audiencia:** planner Sprint 3  

---

## Resumen ejecutivo

- **Zoho CRM API v7/v8** es la versión actual recomendada. v2 sigue operativa pero v7+ tiene rate limits mejorados y mejor soporte de tipos. Usar v7 como target mínimo.
- **Multi-región es el mayor reto de Zoho:** cada tenant vive en un DC diferente (.com, .eu, .in, .com.au, etc.). El DC correcto se devuelve durante el OAuth flow como `api_domain`. CRÍTICO: guardar `api_domain` por tenant o las llamadas fallarán.
- **OAuth2 Authorization Code con Multi-DC habilitado** es la única opción para un SaaS multi-tenant donde el tenant conecta su propia cuenta. Self-Client es para desarrollo/testing personal.
- **Sin SDK npm oficial verificado** — implementar via REST + axios es la decisión correcta (ADR confirmado). El patrón `axios.create()` per-tenant con interceptors de token refresh cubre todo.
- **Rate limits Zoho** son basados en créditos (credit-based), no requests/segundo. Concurrencia limitada a 5-25 llamadas simultáneas según edición. Importante: diseñar el adapter con concurrencia controlada.
- **Webhooks Zoho:** se llaman "Notifications" y se registran via API. El token de validación es custom (no HMAC). Canal (channel) tiene expiración: máximo 1 hora — requiere **renovación periódica** (diferencia clave vs HubSpot).
- **Módulo .com.mx:** NO existe como DC separado de Zoho. México usa `.com` (US datacenter) o `.eu` si el tenant eligió EU. Confirmar con cada tenant dónde está su organización al conectar.
- **Complejidad global C-03:** High (mayor que HubSpot por multi-DC + channel renewal + no SDK).

---

## 1. Zoho API versioning

| Versión | Estado | Recomendación |
|---------|--------|---------------|
| v2 | Operativa, legacy | NO usar para nueva implementación |
| v6 | Deprecada/transitional | NO usar |
| v7 | Estable, recomendada | ✅ Target mínimo para C-03 |
| v8 | Disponible (2025) | ✅ Preferir si los cambios son non-breaking |

**URL base (patrón):**
```
https://{api_domain}/crm/v7/{Module}
```
Donde `{api_domain}` viene del OAuth response (ej: `www.zohoapis.eu`, `www.zohoapis.com`).

**Diferencias v2 → v7 relevantes:**
- v7 usa modelo `data` consistente en requests/responses
- v7 tiene operaciones de búsqueda mejoradas (criteria más expresivos)
- v7 soporta multi-DC natively en todas las operaciones
- v7 tiene mejor tipado de errores (código + mensaje + details)

---

## 2. Multi-región routing (CRÍTICO)

### Zoho Data Centers confirmados

| Región | OAuth Token URL | API Base URL | Notas |
|--------|----------------|--------------|-------|
| US | https://accounts.zoho.com | https://www.zohoapis.com | Default, México incluido aquí |
| EU | https://accounts.zoho.eu | https://www.zohoapis.eu | España preferirá EU o US |
| India | https://accounts.zoho.in | https://www.zohoapis.in | — |
| Australia | https://accounts.zoho.com.au | https://www.zohoapis.com.au | — |
| Japan | https://accounts.zoho.jp | https://www.zohoapis.jp | — |
| Canada | https://accounts.zohocloud.ca | https://www.zohoapis.ca | — |
| UK | https://accounts.zoho.uk | https://www.zohoapis.uk | — |
| Saudi Arabia | https://accounts.zoho.sa | https://www.zohoapis.sa | — |

**NOTA sobre .com.mx:** No existe un DC dedicado México en Zoho. Los clientes mexicanos (Latam) usan `.com` (US datacenter) por defecto, salvo que hayan elegido EU explícitamente.

**España (ES):** Los tenants españoles pueden estar en `.eu` (recomendado por GDPR) o `.com`. Preguntar al tenant dónde está su cuenta durante el onboarding.

### Cómo determinar el DC del tenant durante OAuth

Durante el Authorization Code flow con Multi-DC habilitado, el OAuth response incluye:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "api_domain": "https://www.zohoapis.eu",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**`api_domain` es el dato crítico.** SIEMPRE guardar en `integrations` tabla:
```
zoho_dc_region: "eu" | "us" | "in" | "au" | "jp" | "ca" | "uk" | "sa"
zoho_api_domain: "https://www.zohoapis.eu"  
zoho_accounts_domain: "https://accounts.zoho.eu"
```

### Habilitar Multi-DC en Zoho API Console
- Ir a api-console.zoho.com → app → Settings → "Multi DC"
- Activar para que el token flow devuelva `api_domain`
- CRÍTICO: sin esto activado, el app solo funciona para el DC donde fue registrado

---

## 3. OAuth2 para multi-tenant SaaS

### Authorization Code Flow (recomendado)

```
Paso 1 — Redirect del tenant a Zoho:
GET https://accounts.zoho.{region}/oauth/v2/auth
  ?response_type=code
  &client_id={CLIENT_ID}
  &scope=ZohoCRM.modules.ALL,ZohoCRM.notifications.CREATE,ZohoCRM.notifications.READ
  &redirect_uri={CALLBACK_URL}
  &access_type=offline    ← IMPORTANTE para obtener refresh_token
  &state={tenantId}       ← para identificar tenant en callback

Paso 2 — Callback recibe code, POST para tokens:
POST https://accounts.zoho.{region}/oauth/v2/token
  Body: grant_type=authorization_code&code={CODE}&client_id=...&client_secret=...&redirect_uri=...

Paso 3 — Guardar access_token + refresh_token + api_domain + expires_in (3600s)

Paso 4 — Refresh cuando expires:
POST https://accounts.zoho.{region}/oauth/v2/token
  Body: grant_type=refresh_token&refresh_token={RT}&client_id=...&client_secret=...
```

**Validez del refresh_token:** Zoho refresh tokens tienen duración larga (meses), pero se invalidan si no se usan por 60 días o si el usuario revoca acceso manualmente.

### Self-Client — NO para multi-tenant
Self-Client genera tokens para el developer account personal. No permite que otro usuario autorice. Solo para desarrollo/testing local.

### Scopes necesarios para C-03
```
ZohoCRM.modules.ALL          — leer/escribir Leads, Contacts, Deals
ZohoCRM.notifications.CREATE — crear subscripciones webhook
ZohoCRM.notifications.READ   — leer subscripciones
ZohoCRM.bulk.ALL             — bulk operations (si se necesita batch)
ZohoCRM.settings.fields.READ — leer field metadata (para UI mapping)
```

---

## 4. Key REST endpoints (Zoho CRM v7)

**Patrón base:** `https://{api_domain}/crm/v7/{Module}`

### Leads
```
GET  /crm/v7/Leads/{id}
POST /crm/v7/Leads                — crear
PUT  /crm/v7/Leads                — actualizar (body con id)
POST /crm/v7/Leads/search         — buscar por criteria
     ?criteria=(Email:equals:test@mail.com)
POST /crm/v7/Leads/upsert         — upsert por campo único (Email)
```

### Contacts
```
GET  /crm/v7/Contacts/{id}
POST /crm/v7/Contacts
PUT  /crm/v7/Contacts
POST /crm/v7/Contacts/search
POST /crm/v7/Contacts/upsert
```

### Deals
```
POST /crm/v7/Deals
PUT  /crm/v7/Deals
GET  /crm/v7/Deals/{id}
```

### Field metadata (para field mapping UI)
```
GET /crm/v7/settings/fields?module=Leads
GET /crm/v7/settings/fields?module=Contacts
```
Retorna lista de campos con `api_name`, `display_label`, `data_type`, `custom_field`.

### Búsqueda por criteria (sintaxis v7)
```
GET /crm/v7/Leads/search?criteria=(Email:equals:test@email.com)
GET /crm/v7/Leads/search?criteria=((Email:equals:test@email.com)AND(Last_Name:equals:García))
```

### Códigos de error clave
| Código HTTP | Código Zoho | Acción |
|-------------|-------------|--------|
| 401 | INVALID_TOKEN | Refresh + retry |
| 429 | API_LIMIT_EXCEEDED | Backoff, esperar |
| 400 | MANDATORY_NOT_FOUND | Log, no reintentar |
| 400 | DUPLICATE_DATA | Ignorar o merge |
| 500 | INTERNAL_ERROR | Retry 3x con backoff |

---

## 5. Zoho Webhooks (Notifications API)

### Registro programático
```
POST https://{api_domain}/crm/v7/actions/watch
Authorization: Bearer {access_token}

{
  "watch": [{
    "channel_id": "1000000068001",         // ID único que generamos nosotros
    "events": ["Leads.create","Leads.edit","Contacts.create","Contacts.edit"],
    "token": "{RANDOM_SECURE_TOKEN}",       // para verificar que viene de Zoho
    "notify_url": "https://{our-domain}/api/webhooks/zoho",
    "expiry": 1800                          // max 3600 segundos (1 HORA)
  }]
}
```

### Validación (token-based, NO HMAC)
Zoho NO usa HMAC para firmar webhooks. En cambio, incluye el `token` que configuramos en el registro en el body del webhook. Validación:
```typescript
function validateZohoWebhook(body: ZohoWebhookPayload, expectedToken: string): boolean {
  return body.token === expectedToken;
}
```

**IMPORTANTE:** Generar un token aleatorio seguro por tenant (o por canal) con `node:crypto randomBytes(32).toString('hex')`. Guardar en BD junto con channel_id.

### Canal expira en 1 hora (MÁXIMO) — renovación obligatoria
```
PUT https://{api_domain}/crm/v7/actions/watch  ← renovar canal existente
DELETE https://{api_domain}/crm/v7/actions/watch ← cancelar
```

**Estrategia de renovación:**
- BullMQ cron job por tenant: renovar canal 10 min antes de expirar
- Si renovación falla: reintentar 3x, luego alert
- En BD: `zoho_channel_id`, `zoho_channel_token`, `zoho_channel_expires_at`

### Payload webhook Zoho
```json
{
  "module": "Leads",
  "operation": "insert",
  "ids": ["4150868000001234001"],
  "channel_id": "1000000068001",
  "token": "{nuestro_token}"
}
```
**NOTA:** Zoho solo envía los IDs, NO los datos completos. Hay que hacer GET al endpoint del módulo para obtener los datos actualizados.

---

## 6. Rate Limits Zoho CRM v7/v8

### Créditos API (rolling 24h)
| Edición | Base | Por usuario | Máximo |
|---------|------|-------------|--------|
| Free | 5,000 | N/A | 5,000 |
| Standard | 50,000 | +250/usuario | 100,000 |
| Professional | 50,000 | +500/usuario | 3,000,000 |
| Enterprise | 50,000 | +1,000/usuario | 5,000,000 |

### Concurrencia simultánea
| Edición | Llamadas simultáneas | Sub-límite ops pesadas |
|---------|---------------------|----------------------|
| Free | 5 | N/A |
| Standard | 10 | 10 |
| Professional | 15 | 10 |
| Enterprise | 20 | 10 |

**Ops pesadas (sub-límite):** Search, Convert Lead, Bulk upsert, Composite API.

**No hay límite por minuto** — el sistema es de créditos + concurrencia. Adaptar el BullMQ worker:
```
Concurrencia máxima por worker Zoho: 5 (seguro para Free tier)
Al recibir 429 API_LIMIT_EXCEEDED: pausa 30s + exponential backoff
```

---

## 7. Implementing REST adapter con axios (sin SDK)

### Estructura recomendada
```
src/lib/integrations/zoho/
├── zoho-oauth-client.ts         — OAuth flow, token refresh
├── zoho-api-client.ts           — axios instance per-tenant + interceptors
├── zoho-crm-adapter.ts          — implementation of IntegrationAdapter
├── zoho-field-metadata.ts       — fetch field list from Zoho
├── zoho-webhook-handler.ts      — webhook validation + event processing
└── zoho-channel-manager.ts     — channel registration + renewal
```

### Axios instance per-tenant con auto-refresh
```typescript
import axios, { AxiosInstance } from 'axios';

function createZohoAxiosClient(tenant: ZohoTenantConfig): AxiosInstance {
  const client = axios.create({
    baseURL: tenant.apiDomain + '/crm/v7',
    timeout: 10000,
  });

  // Request interceptor: inject access token
  client.interceptors.request.use(async (config) => {
    const token = await getValidAccessToken(tenant); // refreshes if expired
    config.headers.Authorization = `Zoho-oauthtoken ${token}`;
    return config;
  });

  // Response interceptor: retry on 401
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        await refreshZohoToken(tenant);
        return client(error.config);
      }
      return Promise.reject(error);
    }
  );

  return client;
}
```

### Zod schema para Zoho Lead
```typescript
const ZohoLeadSchema = z.object({
  id: z.string(),
  Last_Name: z.string(),
  First_Name: z.string().optional(),
  Email: z.string().email().optional(),
  Phone: z.string().optional(),
  Lead_Status: z.string().optional(),
  Lead_Source: z.string().optional(),
  // Custom fields del portal — extender dinámicamente
}).passthrough(); // .passthrough() permite campos custom del portal
```

---

## 8. Sandbox Zoho CRM

**Developer Edition Zoho:**
- Disponible en: zoho.com/crm/developer → "Developer Edition" (gratuita)
- Es una org completa con CRM pero sin usuarios reales
- Permite OAuth apps y Notifications API igual que producción
- **Rate limits:** Free tier (5,000 créditos/día, 5 concurrent)
- Registrar la app en api-console.zoho.com apuntando a la Developer Edition

**Multi-DC en sandbox:** La Developer Edition usa `.com` (US). Para testear EU: crear una cuenta de prueba en zoho.eu.

**Recomendación para CI/CD:** Al igual que HubSpot, NO llamadas reales en CI. Usar fixtures grabados (axios-mock-adapter o nock). Solo tests reales en staging manual.

---

## Estimación de complejidad por componente C-03

| Componente | Complejidad | Horas est. |
|------------|-------------|-----------|
| OAuth2 Multi-DC flow + region detection | High | 8h |
| Token storage + auto-refresh (interceptor) | Medium | 4h |
| Zoho CRM adapter (Leads + Contacts + Deals) | Medium | 10h |
| Channel registration + renovación cron | High | 8h |
| Webhook handler + token validation | Medium | 4h |
| Webhook event processing (fetch full record) | Medium | 5h |
| Field metadata endpoint (para UI mapping) | Low | 3h |
| Field mapping integration con crm_field_mapping | High | 6h |
| Tests unitarios adapter | Medium | 5h |
| **Total** | | **~53h** |

**Nota:** 53h es más alto que HubSpot (~44h) por: (1) multi-DC complejidad extra, (2) channel renewal management, (3) ausencia de SDK (más código manual), (4) webhooks de 2 pasos (recibir IDs → fetch datos).

---

## Recomendaciones

1. **Multi-DC es el riesgo #1.** Testear con tenant en `.eu` Y en `.com` antes de dar por completado C-03.
2. Guardar `api_domain` y `accounts_domain` por tenant en BD — son el enrutador de todas las llamadas.
3. Channel renewal: BullMQ recurring job con periodo 50min (10 min buffer antes de expirar en 60min).
4. Al recibir webhook con solo IDs: GET inmediato para datos completos antes de procesar (añade latencia ~100-300ms, aceptable).
5. Sin SDK: toda la lógica OAuth + retry + error handling es responsabilidad del adapter. Invertir tiempo en los interceptors bien diseñados desde el inicio.
6. Field names Zoho son snake_case con mayúscula inicial (`Last_Name`, `Lead_Status`). El field mapping debe traducir entre naming de Zoho y nuestras variables internas.

**Preguntas abiertas:**
- ¿Los tenants españoles estarán en `.eu` o `.com`? Determina la región default a mostrar en UI de conexión.
- ¿Hay tenants en India o Japan? Si no, simplificar UI a 3 opciones: EU / US-Latam / Other.
- ¿El cliente tiene ya cuentas Zoho Developer Edition para testing?

**Status:** DONE  
**Summary:** Research completo de Zoho CRM API v7, OAuth2 Multi-DC, webhooks (Notifications API con channel renewal), rate limits credit-based, y patron axios per-tenant. Complejidad C-03 ~53h, mayor que HubSpot por multi-DC y ausencia de SDK oficial.
