# Phase 01 — IntegrationAdapter Interface + Factory (3-01)

## Context Links

- RoadMap: `plans/RoadMap.md` §Fase 3, tarea 3-01
- R-016 (provider abstraction pattern): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-016`
- R-014 (append-only write policy): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- Sprint 2 Phase 03 (integrations-repository 2-18): `plans/260520-1342-sprint-2-capa-datos/phase-03-repository-pattern.md`

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — puede iniciar en paralelo con Sprint 2 si 2-11 (Zod schemas integrations) está disponible
- **Descripción:** Definir la interface TypeScript `IntegrationAdapter` y el factory pattern por tenant. Esta es la base que implementan HubSpot adapter (3-02) y Zoho adapter (3-03). Ningún código de negocio debe acoplarse a un CRM concreto — solo a esta interface.

## Key Insights

- El patrón replica R-016 (`VoiceProvider` interface) para integraciones CRM: misma filosofía, diferente dominio.
- La factory recibe `tenantId` → lee las integraciones activas del tenant → devuelve el adapter correcto.
- Los métodos de la interface deben ser CRM-agnósticos: `pushContact`, `pullContacts`, no `createHubSpotContact`.
- El adapter NO gestiona field mapping — eso es responsabilidad de la capa superior (3-04). El adapter trabaja con el modelo de datos genérico de la aplicación.
- Un tenant puede tener múltiples integraciones activas (ej: HubSpot + Zoho simultáneo). La factory debe soportar `getAdapters(tenantId): IntegrationAdapter[]`.

## Requirements

**Funcionales:**
- Interface `IntegrationAdapter` con métodos: `pushContact`, `pullContacts`, `pushDeal`, `testConnection`, `getProvider`
- Factory `getIntegrationAdapters(tenantId)`: devuelve array de adapters activos del tenant
- Tipos de entrada/salida CRM-agnósticos (nuestro modelo de datos, no el del CRM)
- Soporte para `write_policy` de R-014: el adapter recibe la política y la aplica

**No-funcionales:**
- Interface en archivo dedicado `< 100 líneas`
- Factory `< 80 líneas`
- Zero referencias a HubSpot/Zoho en los tipos de la interface

## Architecture

```
src/lib/integrations/
├── _integration-adapter-interface.ts   — interface + tipos genéricos
├── _integration-adapter-factory.ts     — factory por tenant
├── hubspot/                            — 3-02
│   ├── hubspot-adapter.ts
│   ├── hubspot-oauth-client.ts
│   ├── hubspot-crm-client.ts
│   └── hubspot-webhook-handler.ts
└── zoho/                               — 3-03
    ├── zoho-adapter.ts
    ├── zoho-oauth-client.ts
    ├── zoho-api-client.ts
    ├── zoho-webhook-handler.ts
    └── zoho-channel-manager.ts

Flujo de uso:
  src/lib/actions/crm-sync.ts
    → const adapters = await getIntegrationAdapters(tenantId)
    → for (const adapter of adapters) { await adapter.pushContact(contact, fieldMappings) }
```

**Tipos genéricos de entrada/salida:**
```typescript
// _integration-adapter-interface.ts

export type CrmProvider = 'hubspot' | 'zoho';
export type WritePolicy = 'append_only' | 'overwrite' | 'overwrite_with_audit';

export interface CrmContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  leadStatus?: string;
  customFields?: Record<string, unknown>;
}

export interface CrmDeal {
  name: string;
  stage?: string;
  amount?: number;
  associatedContactEmail?: string;
  customFields?: Record<string, unknown>;
}

export interface FieldMappingEntry {
  localField: string;         // nombre en nuestro sistema
  crmField: string;           // nombre en el CRM del tenant
  writePolicy: WritePolicy;   // por defecto append_only
}

export interface PushResult {
  success: boolean;
  crmId?: string;             // ID del registro en el CRM
  wasCreated: boolean;        // true si creado, false si actualizado
  fieldsWritten: string[];
  fieldsSkipped: string[];    // skipped por append_only con valor existente
  auditEntries?: AuditEntry[]; // populated if overwrite_with_audit
}

export interface AuditEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
  source: string;
}

export interface IntegrationAdapter {
  getProvider(): CrmProvider;

  testConnection(): Promise<{ ok: boolean; error?: string }>;

  pushContact(
    contact: CrmContact,
    fieldMappings: FieldMappingEntry[]
  ): Promise<PushResult>;

  pullContacts(since?: Date): Promise<CrmContact[]>;

  pushDeal(
    deal: CrmDeal,
    fieldMappings: FieldMappingEntry[]
  ): Promise<PushResult>;
}
```

## Related Code Files

**Crear:**
- `src/lib/integrations/_integration-adapter-interface.ts`
- `src/lib/integrations/_integration-adapter-factory.ts`

**Depende de (Sprint 2, lectura):**
- `src/lib/repositories/integrations-repository.ts` (2-18)
- `src/lib/schemas/integrations-schema.ts` (2-11)

## Implementation Steps

1. Crear `src/lib/integrations/` directory
2. Crear `_integration-adapter-interface.ts` con todos los tipos y la interface
3. Crear `_integration-adapter-factory.ts`:
   - Importar `integrationsRepository` de Sprint 2
   - `getIntegrationAdapters(tenantId)` → query `integrations` donde `tenant_id = tenantId AND status = 'active'`
   - Por cada integration: instanciar el adapter correcto según `provider` field
   - Return array de adapters
4. Stub vacío de `HubSpotAdapter` y `ZohoAdapter` (solo para que factory compile) — se completan en 3-02/3-03
5. `npm run typecheck` — verificar que los tipos compilan sin errores

## Todo List

- [ ] Crear directorio `src/lib/integrations/`
- [ ] `_integration-adapter-interface.ts` — tipos + interface
- [ ] `_integration-adapter-factory.ts` — factory por tenant
- [ ] Stubs `hubspot/hubspot-adapter.ts` + `zoho/zoho-adapter.ts` (clase vacía que implementa interface)
- [ ] `npm run typecheck` pass

## Success Criteria

- [ ] Interface `IntegrationAdapter` tipada sin referencias a HubSpot/Zoho
- [ ] Factory `getIntegrationAdapters(tenantId)` retorna array correcto según BD
- [ ] Stubs compilables (no implementados)
- [ ] `npm run typecheck` pass

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Sprint 2 2-18 no disponible al iniciar | Media | Bajo | Si 2-18 no está: escribir interface + factory con tipo inline provisional, refactorizar cuando 2-18 entregue |
| Interface muy genérica → dificulta implementación CRM-específica | Baja | Medio | Iterar interface después de 3-02 primera implementación si los tipos no encajan |

## Security Considerations

- La factory solo devuelve adapters de integraciones del `tenantId` solicitado — RLS en BD garantiza esto (2-23..2-25)
- Los tokens NO se exponen en los tipos de la interface — solo el adapter los maneja internamente
- `FieldMappingEntry` no expone datos de otro tenant

## Agentes Esden asignados

- `esden-agents:code` — implementación TypeScript

## Estimación

**12h total:**
- Interface + tipos: 4h
- Factory + integración repos B: 4h
- Stubs 3-02/3-03: 2h
- Typecheck + ajustes: 2h

## Next Steps

- 3-02 HubSpot adapter implementa `IntegrationAdapter`
- 3-03 Zoho adapter implementa `IntegrationAdapter`
- 3-04 field mapping usa `FieldMappingEntry[]` de esta interface
