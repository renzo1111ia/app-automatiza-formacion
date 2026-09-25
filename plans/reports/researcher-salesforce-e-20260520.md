# Research — Salesforce Adapter (jsforce@3.x) — Sprint 4

**Agente:** researcher (Sonnet)
**Fecha:** 20-05-2026
**Scope:** jsforce@3.10.15, Salesforce OAuth2 Connected Apps, multi-tenant

---

## 1. Dependencia

`jsforce@^3.10.15` — NO instalado, requiere ADR antes de instalar.

- Node.js >= 18 — compatible con Node 24
- Sin peer deps críticas
- Repositorio activo: github.com/jsforce/jsforce

---

## 2. OAuth2 + Connected Apps

### Setup Salesforce (por tenant)
Cada academia enterprise crea su propia "Connected App" en su Salesforce org:
1. Setup → App Manager → New Connected App
2. Enable OAuth Settings → callback URL = `https://our-app/api/oauth/salesforce/callback`
3. Scopes: `api`, `refresh_token, offline_access`
4. Obtener `Consumer Key` (clientId) + `Consumer Secret` (clientSecret)

### jsforce OAuth2 flow
```ts
import jsforce from 'jsforce'

const oauth2 = new jsforce.OAuth2({
  loginUrl: 'https://login.salesforce.com',  // sandbox: test.salesforce.com
  clientId: tenant.sf_client_id,
  clientSecret: tenant.sf_client_secret,
  redirectUri: `${APP_URL}/api/oauth/salesforce/callback`
})

// Autorización — redirigir al usuario
const authUrl = oauth2.getAuthorizationUrl({ scope: 'api refresh_token' })

// Callback — intercambiar code por tokens
const conn = new jsforce.Connection({ oauth2 })
await conn.authorize(code)
// conn.accessToken, conn.refreshToken, conn.instanceUrl → guardar en DB
```

### Reconexión con refresh token
```ts
const conn = new jsforce.Connection({
  oauth2,
  accessToken: tenant.sf_access_token,
  refreshToken: tenant.sf_refresh_token,
  instanceUrl: tenant.sf_instance_url
})
conn.on('refresh', (accessToken) => {
  // persiste nuevo accessToken en DB
})
```

---

## 3. Endpoints clave — Lead / Contact / Opportunity

### Lead (prospecto sin cuenta)
```ts
// Crear lead
const result = await conn.sobject('Lead').create({
  FirstName: 'María', LastName: 'García',
  Email: 'maria@example.com', Phone: '+34600000000',
  LeadSource: 'Web', Status: 'Open - Not Contacted',
  Company: 'Academia XYZ'  // requerido en SF
})

// Actualizar
await conn.sobject('Lead').update({ Id: sfLeadId, Status: 'Working' })

// Upsert por email (evita duplicados)
await conn.sobject('Lead').upsert({ Email: 'maria@example.com', ... }, 'Email')

// Buscar
const leads = await conn.sobject('Lead').find({ Email: 'maria@example.com' }).limit(1)
```

### Contact (lead convertido)
```ts
await conn.sobject('Contact').create({
  FirstName, LastName, Email, AccountId
})
```

### Opportunity (oportunidad de matrícula)
```ts
await conn.sobject('Opportunity').create({
  Name: `Matrícula ${lead.nombre}`,
  StageName: 'Prospecting',
  CloseDate: '2026-12-31',
  AccountId
})
```

### Custom Objects (Education Cloud)
```ts
// Si el tenant usa Education Cloud
await conn.sobject('hed__Application__c').create({ ... })
```

---

## 4. Sandbox vs Producción

| | Sandbox | Producción |
|---|---|---|
| loginUrl | `https://test.salesforce.com` | `https://login.salesforce.com` |
| instanceUrl | `*.sandbox.my.salesforce.com` | `*.my.salesforce.com` |
| Datos | Copia de prod (o vacío) | Real |

Por tenant: guardar `sf_environment: 'sandbox' | 'production'` en `crm_connections`.

---

## 5. Multi-tenant — un tenant = una Salesforce org

Cada academia tiene su propia org de Salesforce. El adapter instancia una `jsforce.Connection` por tenant usando sus credenciales OAuth almacenadas en `crm_connections`.

No hay "shared app" entre tenants — cada Connected App puede ser diferente por tenant (o compartir misma Connected App de nuestra plataforma si la registramos como Salesforce ISV).

---

## 6. Salesforce → nuestro sistema (webhooks)

**Opción A: Outbound Messages** (SOAP, obsoleto)
**Opción B: Platform Events** (Streaming API) — recomendado para enterprise
```ts
const topic = '/data/LeadChangeEvent'
conn.streaming.topic(topic).subscribe((message) => {
  // message.payload.ChangeEventHeader + campos cambiados
})
```
**Opción C: Apex Triggers → HTTP callout** — requiere configuración en org del cliente

**Recomendación Sprint 4**: Solo push (Esden → SF). Pull (SF → Esden) como feature adicional bajo pedido — complejidad alta, requiere configuración en cada org.

---

## 7. Rate limits por edición

| Edición SF | API calls/día |
|---|---|
| Essentials | 15.000 |
| Professional | 15.000 |
| Enterprise | 100.000+ |
| Unlimited | 200.000+ |

Cuota diaria por org, no por usuario. jsforce maneja el límite devolviendo error `REQUEST_LIMIT_EXCEEDED`.

---

## 8. Risks

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Connected App mal configurada por el cliente | 401 en todos los calls | Guía setup detallada en UI admin |
| Sandbox vs prod mezclado | Datos reales en sandbox | Campo `sf_environment` explícito + warning en UI |
| API limits de edición Essentials | 15k calls/día — restrictivo | Queue BullMQ con rate limiting |
| Custom fields no mapeados | Datos perdidos | Field mapping configurable por tenant |
| Education Cloud no disponible en todas las orgs | Objetos custom inexistentes | Detección dinámica de objetos disponibles |

---

## 9. Preguntas abiertas

1. ¿Los clientes enterprise tienen orgs Salesforce propias o necesitan ayuda para crearlas?
2. ¿Se soporta Education Cloud o solo Sales Cloud estándar?
3. ¿Pull SF → Esden entra en scope de 4-02 o queda para 4-06?
4. ¿Se registra nuestra app como Salesforce ISV (una Connected App global) o cada tenant registra la suya?

**Status:** DONE
**Summary:** jsforce@3.x cubre OAuth2 + CRUD completo (Lead/Contact/Opportunity). Multi-tenant via Connection por tenant con refresh token. Push (Esden→SF) en scope 4-02; pull (SF→Esden) via Streaming API como feature adicional.
