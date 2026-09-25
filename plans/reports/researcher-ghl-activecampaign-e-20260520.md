# Research — GoHighLevel + ActiveCampaign (Sprint 4)

**Agente:** researcher (Sonnet)
**Fecha:** 20-05-2026
**Scope:** GHL API v2 OAuth2, ActiveCampaign API v3 API Key. REST puro, sin SDK.

---

## 1. Dependencias

**GoHighLevel**: REST puro con `axios` (ya instalado). No existe SDK npm oficial mantenido.
**ActiveCampaign**: REST puro con `axios`. API Key auth, sin SDK.
**CERO dependencias nuevas de producción para ambos.**

---

## 2. GoHighLevel API v2

### Audiencia
~1.5M cuentas globales. Latam: México, Colombia, Brasil lideran. Academias llegan via agencias white-label. API v1 (API Key) end-of-support 31-dic-2025 — **solo construir contra v2 OAuth**.

### OAuth2 v2 — Authorization Code Flow

```
Base URL auth: https://marketplace.gohighlevel.com
Token URL:     https://services.leadconnectorhq.com/oauth/token
API Base:      https://services.leadconnectorhq.com
```

```ts
// 1. Redirect to auth
const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?
  response_type=code
  &client_id=${GHL_CLIENT_ID}
  &redirect_uri=${encodeURIComponent(CALLBACK_URL)}
  &scope=contacts.readonly+contacts.write+opportunities.readonly+opportunities.write`

// 2. Exchange code
const { data } = await axios.post(
  'https://services.leadconnectorhq.com/oauth/token',
  new URLSearchParams({
    client_id: GHL_CLIENT_ID,
    client_secret: GHL_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: CALLBACK_URL
  }),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
)
// data.access_token, data.refresh_token, data.locationId → guardar en DB
```

### Endpoints clave — Contacts

```ts
const headers = { Authorization: `Bearer ${accessToken}`, Version: '2021-07-28' }

// Crear/upsert contact
await axios.post(
  `https://services.leadconnectorhq.com/contacts/`,
  { firstName, lastName, email, phone, locationId: tenant.ghl_location_id },
  { headers }
)

// Actualizar contact
await axios.put(
  `https://services.leadconnectorhq.com/contacts/${contactId}`,
  { firstName, lastName, email, customFields: [{ id: 'fieldId', value: 'val' }] },
  { headers }
)

// Buscar por email
await axios.get(
  `https://services.leadconnectorhq.com/contacts/search?email=${email}&locationId=${locationId}`,
  { headers }
)
```

### Endpoints clave — Opportunities (pipeline)

```ts
// Crear opportunity
await axios.post(
  `https://services.leadconnectorhq.com/opportunities/`,
  {
    title: `Matrícula ${lead.nombre}`,
    pipelineId, pipelineStageId,
    contactId,
    monetaryValue: 0,
    assignedTo: userId
  },
  { headers }
)
```

### Webhooks GHL

```ts
// Suscribir a eventos en el marketplace app
// Eventos: ContactCreate, ContactUpdate, OpportunityStatusUpdate, etc.
// GHL envía POST al endpoint de nuestra app registrado en Marketplace
// Headers: x-webhook-signature (HMAC-SHA256)
```

### Rate limits GHL API v2

| Límite | Valor |
|--------|-------|
| Burst | 100 req/10s por location |
| Daily | 200.000 req/día por location |

---

## 3. ActiveCampaign API v3

### Audiencia
Marketing automation-first. Presente en ES y Latam. Academias con foco en email nurturing. API Key simple, sin OAuth.

### Autenticación

```ts
// Cada tenant tiene su propio API Key + Account URL
// Formato URL: https://{account}.api-us1.com

const headers = {
  'Api-Token': tenant.ac_api_key,
  'Content-Type': 'application/json'
}
const baseUrl = `https://${tenant.ac_account}.api-us1.com/api/3`
```

### Endpoints clave — Contacts

```ts
// Crear contact (upsert por email)
await axios.post(`${baseUrl}/contact/sync`, {
  contact: {
    email, firstName, lastName, phone,
    fieldValues: [{ field: '1', value: 'custom_val' }]
  }
}, { headers })

// Actualizar
await axios.put(`${baseUrl}/contacts/${contactId}`, {
  contact: { firstName, phone }
}, { headers })

// Buscar
await axios.get(`${baseUrl}/contacts?email=${email}`, { headers })
```

### Endpoints clave — Deals (pipeline)

```ts
// Crear deal
await axios.post(`${baseUrl}/deals`, {
  deal: {
    title: `Matrícula ${lead.nombre}`,
    value: '0',
    currency: 'eur',
    group: pipelineId,   // deal group = pipeline
    stage: stageId,
    contact: contactId
  }
}, { headers })
```

### Añadir a automation

```ts
// Trigger automación (email sequence)
await axios.post(`${baseUrl}/contactAutomations`, {
  contactAutomation: {
    contact: contactId,
    automation: automationId
  }
}, { headers })
```

### Webhooks AC

```ts
// Crear webhook (push: AC → nuestro sistema)
await axios.post(`${baseUrl}/webhooks`, {
  webhook: {
    name: 'Esden lead update',
    url: 'https://our-app/api/webhooks/activecampaign',
    events: ['contact_update', 'deal_update'],
    sources: ['public', 'admin', 'api', 'system']
  }
}, { headers })
```

AC garantiza "at least once delivery" — idempotencia obligatoria.

### Rate limits AC

| Límite | Valor |
|--------|-------|
| Standard | 5 req/s por cuenta |
| Bulk Contact Importer | 20 req/min (1 contact) / 100 req/min (batch) |

---

## 4. Comparativa GHL vs AC

| Criterio | GoHighLevel | ActiveCampaign |
|----------|-------------|----------------|
| Auth | OAuth2 v2 (complejo) | API Key (simple) |
| Audiencia ES/Latam | Latam creciente vía agencias | ES + Latam marketing |
| Objetos principales | Contact + Opportunity + Calendar | Contact + Deal + Automation |
| Webhooks | Si (marketplace app) | Si (POST a webhook URL) |
| Rate limits | Generosos (200k/día) | Restrictivos (5 req/s) |
| Docs calidad | Aceptable | Buena |
| Complejidad adapter | Mayor (OAuth, locationId) | Menor (API Key, URL simple) |
| SDK oficial npm | No existe | No existe |

---

## 5. Data flows

### GHL
```
Lead updated → BullMQ → GHLAdapter(tenant)
  → OAuth2 access token (refresh si expirado)
  → Search contact by email → create/update
  → Create/update opportunity si es matrícula
  → Set _last_sync_source = 'af'

GHL webhook → POST /api/webhooks/ghl
  → Verify HMAC-SHA256 signature
  → Map GHL fields to Esden lead fields
  → Update lead in DB
```

### ActiveCampaign
```
Lead updated → BullMQ → ACAdapter(tenant)
  → API Key header (no refresh needed)
  → contact/sync (upsert by email)
  → deal create/update si aplica
  → automation trigger si configurado

AC webhook → POST /api/webhooks/activecampaign
  → Idempotency check (at-least-once)
  → Map AC fields to Esden lead fields
  → Update lead in DB
```

---

## 6. Risks

| Riesgo | Sistema | Mitigación |
|--------|---------|------------|
| GHL API v1 deprecation confunde a clientes | GHL | Documentar en UI: solo OAuth v2 |
| AC rate limit 5 req/s — cola grande | AC | BullMQ throttle: 4 jobs/s por tenant-AC |
| GHL location vs sub-account confusión | GHL | Guía clara en UI de conexión |
| AC webhook "at least once" duplicados | AC | Idempotency key en tabla `crm_sync_log` |
| GHL custom fields varían por location | GHL | Field mapping configurable por tenant |

---

## 7. Preguntas abiertas

1. GHL: ¿registramos nuestra app en GHL Marketplace como app pública o usamos Private Integration (más simple)?
2. AC: ¿los tenants usan su propia cuenta AC o revenden via nuestra white-label?
3. ¿Prioridad de implementación: GHL antes que AC o viceversa?
4. GHL Calendar: ¿se sincroniza en 5-03 o queda fuera de scope?

**Status:** DONE
**Summary:** GHL (OAuth2 v2, 200k req/día, locationId por tenant) y AC (API Key, 5 req/s, contact/sync upsert) son REST puros sin SDK. GHL es más complejo por OAuth; AC más simple pero más restrictiva en rate limits.
