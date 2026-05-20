# Phase 06 — crm_write_audit Log + Visualización (3-06)

## Context Links

- R-014 (crm_write_audit spec): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- Field mapping + write_policy: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/phase-04-field-mapping-write-policy.md`
- Interface AuditEntry: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/phase-01-integration-adapter-interface.md`
- UI admin: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-conexion-crm.md`

## Overview

- **Prioridad:** P1 — R-014 requiere explícitamente registro de audit para sobrescrituras
- **Estado:** Pendiente — requiere 3-04 (write_policy enforcement) + 3-05 (UI base)
- **Descripción:** Tabla `crm_write_audit` en BD que registra cada sobrescritura con `write_policy = overwrite_with_audit`. Vista en el panel admin que permite al administrador ver el historial de cambios con filtros.

## Key Insights

- El audit log es un requisito legal/de negocio, no solo técnico. R-014 dice explícitamente "comunicado al cliente (el centro de formación)" y "registrado en crm_write_audit".
- La tabla es append-only por naturaleza — nunca se borra ni modifica una entrada. Solo INSERT.
- La visualización es simple: tabla paginada con filtros por fecha + campo + proveedor. No hace falta gráficos.
- Volumen estimado: bajo. Dado que la mayoría de campos son `append_only`, solo los campos de estado del lead disparan audit entries. En una academia de 100-500 leads activos, esperamos < 1000 entradas por mes.

## Requirements

**Funcionales:**
- Tabla BD `crm_write_audit`: `id, tenant_id, provider, local_field, crm_field, old_value (jsonb), new_value (jsonb), source, agent_id, triggered_by, created_at`
- Repository `writeAuditRepository.insert(entry)` — solo INSERT, nunca UPDATE/DELETE
- Los adapters insertan en audit cuando `write_policy = overwrite_with_audit` y el campo tenía valor previo
- API endpoint (o Server Action) `getWriteAuditLog(tenantId, filters)` para la UI
- Página o tab en `/admin/integraciones` mostrando el audit log paginado
- Filtros: por proveedor (hubspot/zoho), por campo, por rango de fechas

**No-funcionales:**
- Insert de audit no debe bloquear la operación principal (async con try/catch separado)
- RLS: tenant solo ve su propio audit log
- Paginación: max 50 entradas por página
- Sin borrado ni edición expuestos en UI

## Architecture

```
BD (Supabase):
  crm_write_audit
  ├── id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  ├── tenant_id: uuid REFERENCES tenants(id) NOT NULL
  ├── provider: text CHECK IN ('hubspot','zoho') NOT NULL
  ├── local_field: text NOT NULL
  ├── crm_field: text NOT NULL
  ├── old_value: jsonb
  ├── new_value: jsonb NOT NULL
  ├── source: text NOT NULL              -- 'agent_ia' | 'manual_sync' | 'webhook_inbound'
  ├── agent_id: uuid REFERENCES ai_agents(id)   -- nullable
  ├── triggered_by: text                -- identificador del proceso
  └── created_at: timestamptz DEFAULT now()
  INDEX(tenant_id, created_at DESC)     -- para queries de historial paginadas

src/lib/repositories/
└── write-audit-repository.ts           -- solo insert + query

src/lib/schemas/
└── write-audit-schema.ts               -- Zod

UI tab en /admin/integraciones (añadir a 3-05):
└── _components/write-audit-log-table.tsx
```

## Related Code Files

**Crear:**
- `supabase/migrations/YYYYMMDD_create_crm_write_audit.sql`
- `src/lib/schemas/write-audit-schema.ts`
- `src/lib/repositories/write-audit-repository.ts`
- `src/app/(dashboard)/admin/integraciones/_components/write-audit-log-table.tsx`

**Modificar:**
- `src/lib/integrations/hubspot/hubspot-adapter.ts` — insertar en audit al overwrite_with_audit
- `src/lib/integrations/zoho/zoho-adapter.ts` — ídem
- `src/app/(dashboard)/admin/integraciones/page.tsx` — añadir tab/sección audit log

## Implementation Steps

1. Migración SQL: tabla `crm_write_audit` + índice `(tenant_id, created_at DESC)` + RLS
2. Crear `write-audit-schema.ts` Zod
3. Crear `write-audit-repository.ts`:
   - `insert(entry)` — solo INSERT (no update/delete)
   - `getByTenant(tenantId, filters: { provider?, localField?, fromDate?, toDate?, limit?, offset? })` → paginado
4. Integrar en adapters: dentro del bloque `overwrite_with_audit`, después de escribir en CRM, llamar `writeAuditRepository.insert(...)` en try/catch separado (fallo de audit no bloquea operación)
5. Crear `write-audit-log-table.tsx`: tabla con columnas "Fecha | Proveedor | Campo | Valor anterior | Valor nuevo | Origen"
6. Añadir tab "Historial de cambios" en `/admin/integraciones/page.tsx`
7. `npm run typecheck` pass

## Todo List

- [ ] Migración SQL `crm_write_audit` + RLS + índice
- [ ] `write-audit-schema.ts` Zod
- [ ] `write-audit-repository.ts` — insert + query paginado
- [ ] Integrar audit insert en `HubSpotAdapter`
- [ ] Integrar audit insert en `ZohoAdapter`
- [ ] `write-audit-log-table.tsx` — tabla con filtros
- [ ] Tab "Historial de cambios" en página admin
- [ ] `npm run typecheck` pass

## Success Criteria

- [ ] Tabla `crm_write_audit` existe en BD con RLS
- [ ] Cada write con `overwrite_with_audit` genera exactamente 1 entrada en audit
- [ ] Fallo al insertar audit NO interrumpe la operación principal
- [ ] UI muestra historial paginado con filtros funcionales
- [ ] Solo rol `admin` del tenant accede al historial

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Insert audit falla silenciosamente | Baja | Medio | Log del error siempre (aunque no bloquee). Monitorear en 4-03 (observabilidad) |
| `old_value` es null si el campo no existía previamente | Alta | Bajo | `old_value: null` es válido — indica "campo nuevo, no había valor previo" |
| Volumen alto en futuro (>10k entradas) | Baja | Bajo | Índice en `(tenant_id, created_at DESC)` cubre el caso. Si crece: particionado por mes en Fase 3 |

## Security Considerations

- RLS: tenant solo puede SELECT sobre sus propias entradas (no INSERT/UPDATE/DELETE desde cliente)
- El INSERT viene siempre desde el servidor (adapter) con service role
- `old_value` y `new_value` son jsonb — evitar guardar datos sensibles completos (PII). En MVP: guardar solo el valor tal como viene del CRM field (ya es dato que existe en CRM).

## Agentes Esden asignados

- `af-agents:database` — migración + repository
- `af-agents:uxui` — tabla UI + tab
- `af-agents:code` — integración en adapters

## Estimación

**10h total:**
- Migración + RLS: 2h
- Zod schema + repository: 3h
- Integración en adapters: 2h
- UI tabla + tab: 3h

## Next Steps

- 3-07 tests verifican que `crm_write_audit` se rellena correctamente
- Sprint 3: añadir alertas/dashboard de audit para supervisor
