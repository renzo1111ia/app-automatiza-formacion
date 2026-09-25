# Phase 04 — crm_field_mapping + write_policy (3-04)

## Context Links

- R-014 (append-only, write_policy, crm_field_mapping spec completa): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- Variables definidas cliente: `docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`
- Interface FieldMappingEntry: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/phase-01-integration-adapter-interface.md`
- Sprint 1 2-11 (Zod schema integrations): `plans/260520-1342-sprint-1-capa-datos/phase-02-schemas-zod.md`

## Overview

- **Prioridad:** P1 — define regla de negocio crítica (R-014)
- **Estado:** Pendiente — schema tabla se puede empezar antes de 3-02/3-03; write_policy enforcement requiere adapters
- **Descripción:** Implementar la tabla `crm_field_mapping` editable por tenant, el enforcement de `write_policy` (append_only / overwrite / overwrite_with_audit) en la capa de escritura, y la vista admin que permite al tenant configurar qué política aplica a cada campo.

## Key Insights

- R-014 es un requisito de negocio firmado — no es opcional. El auditor lo marcó como "Crítico" en el RoadMap.
- La tabla `crm_field_mapping` existe por tenant + por provider (un tenant puede tener mapping diferente para HubSpot y para Zoho).
- Default = `append_only` para todos los campos. El administrador debe **explícitamente** cambiar a `overwrite_with_audit` campo por campo.
- Los campos candidatos a `overwrite_with_audit` son los de estado del lead: `last_call_timestamp`, `last_whatsapp_timestamp`, `lead_status`. Los datos demográficos (nombre, email, teléfono) deben mantenerse `append_only`.
- La capa que enforcea write_policy está en los adapters (3-02/3-03) — 3-04 solo define el schema y la lógica de consulta.

## Requirements

**Funcionales:**
- Migración BD: tabla `crm_field_mapping` con columnas `id, tenant_id, provider, local_field, crm_field, write_policy, created_at, updated_at`
- Zod schema para validar filas de field mapping
- Repository `fieldMappingRepository` con métodos: `getByTenant(tenantId, provider)`, `upsert(tenantId, entries)`, `setPolicy(tenantId, provider, localField, policy)`
- Función `resolveFieldMappings(tenantId, provider)` → `FieldMappingEntry[]` para los adapters
- Valores write_policy: `append_only` (default), `overwrite`, `overwrite_with_audit`

**No-funcionales:**
- RLS: tenant solo ve sus propios mappings
- Upsert idempotente (si el campo ya existe → actualizar, si no → crear)
- Tabla inicializa con set de campos por defecto al conectar un CRM nuevo

## Architecture

```
BD (Supabase):
  crm_field_mapping
  ├── id: uuid PRIMARY KEY
  ├── tenant_id: uuid REFERENCES tenants(id) NOT NULL
  ├── provider: text CHECK IN ('hubspot', 'zoho') NOT NULL
  ├── local_field: text NOT NULL       -- nombre en nuestro sistema
  ├── crm_field: text NOT NULL         -- nombre en el CRM del tenant
  ├── write_policy: text DEFAULT 'append_only' CHECK IN ('append_only','overwrite','overwrite_with_audit')
  ├── created_at: timestamptz DEFAULT now()
  └── updated_at: timestamptz DEFAULT now()
  UNIQUE(tenant_id, provider, local_field)

src/lib/repositories/
└── field-mapping-repository.ts

src/lib/schemas/
└── field-mapping-schema.ts          -- Zod schema

src/lib/integrations/
└── _field-mapping-resolver.ts       -- resolveFieldMappings()
```

**Campos por defecto al conectar HubSpot (seed):**
```typescript
const HUBSPOT_DEFAULT_MAPPINGS = [
  { local_field: 'email',         crm_field: 'email',         write_policy: 'append_only' },
  { local_field: 'first_name',    crm_field: 'firstname',     write_policy: 'append_only' },
  { local_field: 'last_name',     crm_field: 'lastname',      write_policy: 'append_only' },
  { local_field: 'phone',         crm_field: 'phone',         write_policy: 'append_only' },
  { local_field: 'lead_status',   crm_field: 'hs_lead_status', write_policy: 'overwrite_with_audit' },
  { local_field: 'last_call_ts',  crm_field: 'last_call_date', write_policy: 'overwrite_with_audit' },
  { local_field: 'qualified',     crm_field: 'qualification_status_ia', write_policy: 'overwrite_with_audit' },
];
```

**Campos por defecto al conectar Zoho:**
```typescript
const ZOHO_DEFAULT_MAPPINGS = [
  { local_field: 'email',        crm_field: 'Email',       write_policy: 'append_only' },
  { local_field: 'first_name',   crm_field: 'First_Name',  write_policy: 'append_only' },
  { local_field: 'last_name',    crm_field: 'Last_Name',   write_policy: 'append_only' },
  { local_field: 'phone',        crm_field: 'Phone',       write_policy: 'append_only' },
  { local_field: 'lead_status',  crm_field: 'Lead_Status', write_policy: 'overwrite_with_audit' },
  { local_field: 'qualified',    crm_field: 'Calificado_IA', write_policy: 'overwrite_with_audit' },
];
```

## Related Code Files

**Crear:**
- `supabase/migrations/YYYYMMDD_create_crm_field_mapping.sql` — migración BD
- `src/lib/schemas/field-mapping-schema.ts`
- `src/lib/repositories/field-mapping-repository.ts`
- `src/lib/integrations/_field-mapping-resolver.ts`

**Modificar:**
- `src/lib/integrations/hubspot/hubspot-adapter.ts` — usar resolver al pushContact
- `src/lib/integrations/zoho/zoho-adapter.ts` — ídem

## Implementation Steps

1. Crear migración SQL: tabla `crm_field_mapping` + RLS policy (tenant_id = auth.jwt() claim)
2. Crear `field-mapping-schema.ts` con Zod: `FieldMappingRowSchema`, `FieldMappingInsertSchema`
3. Crear `field-mapping-repository.ts`:
   - `getByTenantAndProvider(tenantId, provider)` → `FieldMappingRow[]`
   - `upsertMapping(tenantId, provider, entry)` — insert or update on conflict
   - `seedDefaultMappings(tenantId, provider)` — insertar defaults al conectar CRM
   - `setWritePolicy(tenantId, provider, localField, policy)` — update single policy
4. Crear `_field-mapping-resolver.ts`:
   - `resolveFieldMappings(tenantId, provider)` → `FieldMappingEntry[]` para los adapters
   - Cachear en Redis con TTL 5min (los mappings no cambian frecuentemente)
5. Integrar en adapters: `HubSpotAdapter.pushContact` y `ZohoAdapter.pushContact` llaman `resolveFieldMappings` antes de escribir
6. Ejecutar migración en BD local de desarrollo
7. `npm run typecheck` pass

## Todo List

- [ ] Migración SQL `crm_field_mapping` + RLS
- [ ] `field-mapping-schema.ts` — Zod schemas
- [ ] `field-mapping-repository.ts` — CRUD + seed defaults
- [ ] `_field-mapping-resolver.ts` — resolver con cache
- [ ] Integrar resolver en `HubSpotAdapter.pushContact`
- [ ] Integrar resolver en `ZohoAdapter.pushContact`
- [ ] `npm run typecheck` pass

## Success Criteria

- [ ] Tabla `crm_field_mapping` existe en BD con RLS activa
- [ ] Al conectar HubSpot nuevo: seed automático de defaults
- [ ] Al conectar Zoho nuevo: seed automático de defaults
- [ ] `getByTenantAndProvider` retorna solo los mappings del tenant solicitado
- [ ] Adapter respeta `append_only`: si campo ya existe en CRM → skip
- [ ] Adapter respeta `overwrite_with_audit`: escribe + genera `AuditEntry`
- [ ] Nunca escribe si `write_policy = append_only` y el campo ya tiene valor en CRM

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Nombres de campos CRM cambian (Zoho renombra) | Baja | Bajo | Campo `crm_field` es editable en UI admin por el tenant |
| Tenant cambia write_policy a overwrite y pierde datos | Media | Medio | UI debe mostrar advertencia clara al cambiar policy. Solo `overwrite_with_audit` disponible en MVP (no `overwrite` a secas) |
| Cache field mappings desactualizada tras edición UI | Baja | Bajo | Invalidar cache Redis al guardar cambios en UI |

## Security Considerations

- RLS: tenant solo puede leer/escribir sus propios mappings
- `write_policy` solo acepta valores del enum — validado en Zod + check BD
- En MVP: exponer solo `append_only` y `overwrite_with_audit` en UI. NO exponer `overwrite` (sin audit) — demasiado riesgo para datos de clientes.

## Agentes Esden asignados

- `af-agents:database` — migración BD + RLS + repository
- `af-agents:code` — schemas Zod + resolver + integración adapters

## Estimación

**14h total:**
- Migración BD + RLS: 3h
- Zod schema + repository: 4h
- Resolver + cache Redis: 3h
- Integrar en adapters: 2h
- Typecheck + ajustes: 2h

## Next Steps

- 3-05 UI admin muestra y edita estos field mappings
- 3-06 audit log usa `AuditEntry` generados aquí cuando `write_policy = overwrite_with_audit`
