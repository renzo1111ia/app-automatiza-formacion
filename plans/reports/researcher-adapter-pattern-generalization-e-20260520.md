# Research — Generalización Adapter Pattern (Sprint 5-05)

**Agente:** researcher (Sonnet)
**Fecha:** 20-05-2026
**Scope:** Extracción de patrón común tras HubSpot, Zoho, Salesforce, GHL, AC + Sheets

---

## 1. Contexto

Tras implementar 4-5 adapters, el patrón se consolida. E-05 = refactor para:
- Extraer interfaz `IntegrationAdapter` genérica
- Generalizar field mapping universal (lead → record en cualquier CRM)
- Unificar write policy R-014 (append-only + overwrite con audit)
- Crear 1 test suite que valida N adapters

---

## 2. Patrón recomendado: Strategy + Adapter

### Interfaz base
```ts
// src/lib/integrations/base/integration-adapter.interface.ts
export interface IntegrationAdapter {
  readonly id: string           // 'hubspot' | 'zoho' | 'salesforce' | 'ghl' | 'ac' | 'sheets'
  readonly name: string
  readonly authType: 'oauth2' | 'api_key'

  // Lifecycle
  connect(tenantId: string, credentials: AdapterCredentials): Promise<void>
  disconnect(tenantId: string): Promise<void>
  testConnection(tenantId: string): Promise<ConnectionStatus>

  // Core operations
  upsertContact(tenantId: string, lead: EsdenLead): Promise<AdapterResult>
  getContact(tenantId: string, externalId: string): Promise<AdapterContact | null>
  syncLead(tenantId: string, lead: EsdenLead): Promise<SyncResult>

  // Webhooks (optional — solo adapters con soporte)
  registerWebhook?(tenantId: string, webhookUrl: string): Promise<void>
  validateWebhookSignature?(payload: unknown, signature: string): boolean
  parseWebhookPayload?(payload: unknown): Partial<EsdenLead>
}
```

### Factory
```ts
// src/lib/integrations/adapter-factory.ts
const adapters: Record<string, IntegrationAdapter> = {
  hubspot: new HubSpotAdapter(),
  zoho: new ZohoAdapter(),
  salesforce: new SalesforceAdapter(),
  ghl: new GHLAdapter(),
  activecampaign: new ActiveCampaignAdapter(),
  sheets: new GoogleSheetsAdapter()
}

export function getAdapter(crmType: string): IntegrationAdapter {
  const adapter = adapters[crmType]
  if (!adapter) throw new Error(`Unknown CRM adapter: ${crmType}`)
  return adapter
}
```

---

## 3. Field Mapping universal

### Problema
Cada CRM usa diferentes nombres de campo:
- HubSpot: `firstname`, `lastname`, `email`, `phone`
- Salesforce: `FirstName`, `LastName`, `Email`, `MobilePhone`
- GHL: `firstName`, `lastName`, `email`, `phone`
- AC: `firstName`, `lastName`, `email`, `phone`
- Sheets: columnas configuradas por tenant

### Solución: FieldMapper configurable por tenant
```ts
// src/lib/integrations/field-mapper.ts
export type FieldMapping = Record<string, string>  // esden_field → crm_field

export class FieldMapper {
  constructor(private mapping: FieldMapping) {}

  toExternal(lead: EsdenLead): Record<string, unknown> {
    return Object.entries(this.mapping).reduce((acc, [esdenKey, crmKey]) => {
      acc[crmKey] = lead[esdenKey as keyof EsdenLead]
      return acc
    }, {} as Record<string, unknown>)
  }

  fromExternal(crmRecord: Record<string, unknown>): Partial<EsdenLead> {
    const reverse = Object.fromEntries(
      Object.entries(this.mapping).map(([k, v]) => [v, k])
    )
    return Object.entries(crmRecord).reduce((acc, [crmKey, val]) => {
      const esdenKey = reverse[crmKey]
      if (esdenKey) acc[esdenKey as keyof EsdenLead] = val as any
      return acc
    }, {} as Partial<EsdenLead>)
  }
}
```

### Default mappings por CRM
```ts
export const DEFAULT_FIELD_MAPPINGS: Record<string, FieldMapping> = {
  hubspot: { nombre: 'firstname', apellidos: 'lastname', email: 'email', telefono: 'phone' },
  salesforce: { nombre: 'FirstName', apellidos: 'LastName', email: 'Email', telefono: 'MobilePhone' },
  ghl: { nombre: 'firstName', apellidos: 'lastName', email: 'email', telefono: 'phone' },
  activecampaign: { nombre: 'firstName', apellidos: 'lastName', email: 'email', telefono: 'phone' },
  sheets: { nombre: 'A', apellidos: 'B', email: 'C', telefono: 'D' }  // configurable
}
```

---

## 4. Write Policy R-014 generalizada

```ts
// src/lib/integrations/base/write-policy.ts
export type WritePolicy = 'append_only' | 'overwrite_with_audit'

export async function applyWritePolicy(
  adapter: IntegrationAdapter,
  tenantId: string,
  lead: EsdenLead,
  policy: WritePolicy
): Promise<SyncResult> {
  if (policy === 'append_only') {
    // Solo crear si no existe
    const existing = await adapter.getContact(tenantId, lead.email)
    if (existing) return { skipped: true, reason: 'already_exists' }
    return adapter.upsertContact(tenantId, lead)
  }

  // overwrite_with_audit
  const result = await adapter.upsertContact(tenantId, lead)
  await logToAudit(tenantId, lead.id, adapter.id, result)
  return result
}
```

---

## 5. Test suite universal (1 suite × N adapters)

```ts
// src/lib/integrations/__tests__/adapter.contract.test.ts
// Contract test: cada adapter debe pasar el mismo contrato

const TEST_ADAPTERS = ['hubspot', 'zoho', 'salesforce', 'ghl', 'activecampaign']

for (const adapterId of TEST_ADAPTERS) {
  describe(`${adapterId} adapter contract`, () => {
    const adapter = getAdapter(adapterId)
    const tenantId = `test-tenant-${adapterId}`

    it('exposes required interface', () => {
      expect(typeof adapter.upsertContact).toBe('function')
      expect(typeof adapter.getContact).toBe('function')
      expect(typeof adapter.testConnection).toBe('function')
    })

    it('maps EsdenLead to external format correctly', () => {
      const mapper = new FieldMapper(DEFAULT_FIELD_MAPPINGS[adapterId])
      const external = mapper.toExternal(MOCK_LEAD)
      expect(external).toHaveProperty(DEFAULT_FIELD_MAPPINGS[adapterId]['email'])
    })

    it('handles connection error gracefully', async () => {
      // Prueba con credenciales inválidas → debe lanzar AdapterConnectionError
    })
  })
}
```

---

## 6. Estructura de archivos post-E-05

```
src/lib/integrations/
├── base/
│   ├── integration-adapter.interface.ts
│   ├── write-policy.ts
│   └── adapter-error.ts
├── field-mapper.ts
├── adapter-factory.ts
├── hubspot/
│   ├── hubspot-adapter.ts
│   └── hubspot-field-mapping.ts
├── zoho/
│   ├── zoho-adapter.ts
│   └── zoho-field-mapping.ts
├── salesforce/
│   ├── salesforce-adapter.ts
│   └── salesforce-field-mapping.ts
├── ghl/
│   ├── ghl-adapter.ts
│   └── ghl-field-mapping.ts
├── activecampaign/
│   ├── activecampaign-adapter.ts
│   └── activecampaign-field-mapping.ts
├── sheets/
│   ├── sheets-adapter.ts
│   └── sheets-field-mapping.ts
└── __tests__/
    └── adapter.contract.test.ts
```

---

## 7. Inspiración en proyectos conocidos

- **Stripe**: `PaymentMethod` adapter pattern — cada provider implementa `charge()`, `refund()`, `createCustomer()`
- **Shopify Apps**: `FulfillmentService` interface — múltiples providers de fulfillment con mismo contrato
- **Twilio**: `MessageChannel` abstraction — SMS, WhatsApp, Voice con misma API de envío

Patrón común: interfaz estrecha (5-7 métodos) + factory + FieldMapper configurable + contract tests.

---

## 8. Cuándo ejecutar E-05

**Solo tiene sentido después de 4+ adapters reales implementados.** El refactor extrae lo común observado en la práctica, no lo que se asume de antemano (YAGNI).

Señales de que es el momento correcto:
- 3+ adapters con código duplicado visible
- FieldMapper implementado de forma diferente en cada adapter
- Los tests de cada adapter copian los mismos escenarios

---

## 9. Preguntas abiertas

1. ¿La interfaz `IntegrationAdapter` ya existe en Sprint 3 o se crea desde cero en 5-05?
2. ¿Se incluye `Sheets` en el test suite de contrato o queda separado (no es un CRM)?
3. ¿Write policy R-014 se configura por tenant-CRM o hay un default global?

**Status:** DONE
**Summary:** Patrón Strategy+Adapter con interfaz de 7 métodos, FieldMapper configurable, write policy R-014 generalizada y 1 test suite de contrato para N adapters. Ejecutar solo tras 4+ adapters reales.
