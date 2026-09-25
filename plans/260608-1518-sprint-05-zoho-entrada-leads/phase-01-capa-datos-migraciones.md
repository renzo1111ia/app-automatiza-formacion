# Fase 01 — Capa de datos (migraciones SQL + tipos Zod)

**Contexto:** [plan.md](plan.md) · [reporte exploración](reports/codebase-zoho-sheets-map.md) · referencia `supabase/migrations/20260527000000_sheet_connections.sql` + `20260527000002_sheets_writeback_trigger.sql`

## Overview

- **Prioridad:** P1 (bloquea todas las fases siguientes)
- **Estado:** 🔘 Pendiente
- **Estimación:** 2-3h
- Crear el esquema de datos del pull Zoho: tabla de configuración de sincronización, tabla de idempotencia, tabla outbox de writeback + trigger. Más los schemas Zod.

## Key Insights

- Zoho da IDs únicos por lead → la idempotencia es por `zoho_lead_id`, **sin hash de fila** (más simple que Sheets).
- La conexión Zoho OAuth ya vive en `integrations` (Sprint 2). Estas tablas la **referencian** vía `integration_id`, no duplican credenciales.
- RLS multi-tenant **obligatorio** (regla del proyecto) — copiar el patrón de policies de `sheet_connections`.

## Requirements

**Funcionales:**

- Persistir config de pull por tenant (criterio de búsqueda, cursor `last_synced_at`, activo/pausado, writeback on/off).
- Mapear `zoho_lead_id` externo → `lead_id` interno (idempotencia).
- Outbox de writeback (cambios de lead pendientes de enviar a Zoho).

**No funcionales:** RLS por `tenant_id` + bypass `service_role`. Índices en columnas de búsqueda. `updated_at` trigger.

## Related Code Files

**Crear:**

- `supabase/migrations/<YYYYMMDDHHMMSS>_zoho_sync_connections.sql` — tablas `zoho_sync_connections` + `zoho_lead_synced` + RLS + índices.
- `supabase/migrations/<YYYYMMDDHHMMSS>_zoho_writeback_trigger.sql` — tabla `zoho_writeback_outbox` + función `tr_lead_changes_to_zoho_writeback()` + trigger en `lead`.
- `src/lib/integrations/zoho-pull/types.ts` — schemas Zod (ZohoSyncConnectionSchema, ZohoFieldMappingSchema, ZohoPullJobSchema) + `ZohoPullError`.

**Leer para contexto:**

- `supabase/migrations/20260527000000_sheet_connections.sql` (patrón tabla + RLS).
- `supabase/migrations/20260527000002_sheets_writeback_trigger.sql` (patrón outbox + trigger).
- `src/lib/integrations/sheets/types.ts` (patrón Zod).
- `src/lib/schemas/_base.ts` (LeadStageEnum).

## Architecture

```
integrations (Sprint 2, crm_type='zoho')
   │  integration_id (FK)
   ▼
zoho_sync_connections          zoho_lead_synced
  - tenant_id                    - tenant_id
  - integration_id               - integration_id
  - search_criteria JSONB        - zoho_lead_id  (idempotencia)
  - field_mapping JSONB          - lead_id (FK lead)
  - last_synced_at  (cursor)     - last_synced_at
  - writeback_enabled
  - is_active

lead (UPDATE current_stage/...) ──trigger──► zoho_writeback_outbox
                                               - lead_id, tenant_id
                                               - changes JSONB
                                               - status, attempts
```

## Implementation Steps

1. **`zoho_sync_connections`**: `id uuid pk`, `tenant_id uuid not null`, `integration_id uuid not null references integrations`, `search_criteria jsonb` (módulo + filtro Zoho, default Leads modificados), `field_mapping jsonb` (campo Zoho → target AF), `last_synced_at timestamptz`, `writeback_enabled bool default true`, `is_active bool default true`, `last_sync_error text`, `created_at/updated_at`. Unique `(tenant_id, integration_id)`.
2. **`zoho_lead_synced`**: `id uuid pk`, `tenant_id uuid`, `integration_id uuid`, `zoho_lead_id text not null`, `lead_id uuid references lead`, `last_synced_at`, `created_at`. Unique `(integration_id, zoho_lead_id)`.
3. **RLS** en ambas: SELECT/INSERT/UPDATE/DELETE con `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())` + bypass admin (copiar patrón Sheets).
4. **Trigger `updated_at`** en `zoho_sync_connections`.
5. **`zoho_writeback_outbox`**: misma estructura que `sheets_writeback_outbox` (`lead_id`, `tenant_id`, `changes jsonb`, `status`, `attempts int default 0`, `created_at`).
6. **Función + trigger writeback**: `tr_lead_changes_to_zoho_writeback()` AFTER UPDATE en `lead` — si cambió `current_stage|status|email|telefono` Y el lead tiene fila en `zoho_lead_synced`, inserta en `zoho_writeback_outbox`. **Guard anti-bucle**: no encolar si el cambio viene del propio pull (usar flag `pg_trigger_depth()` o columna marca, igual que Sheets).
7. **Tipos Zod** en `zoho-pull/types.ts`.
8. **Aplicar local**: `npx supabase migration up` (o pg-meta REST contra local). VPS → diferido a pre-deploy.

## Todo List

- [ ] Migración `zoho_sync_connections` + `zoho_lead_synced` + RLS + índices
- [ ] Migración `zoho_writeback_outbox` + función + trigger + guard anti-bucle
- [ ] `zoho-pull/types.ts` con schemas Zod
- [ ] Aplicar migraciones en local + verificar RLS con query cross-tenant
- [ ] `npm run typecheck` verde

## Success Criteria

- Las 3 tablas existen en local con RLS habilitado.
- Query cross-tenant (tenant A leyendo datos de tenant B) devuelve 0 filas.
- El trigger inserta en outbox al cambiar `current_stage` de un lead sincronizado, y NO al cambiar uno no-Zoho.
- typecheck verde con los nuevos tipos.

## Risk Assessment

- **Bucle pull↔writeback infinito**: pull actualiza lead → trigger encola writeback → writeback actualiza Zoho → pull lo detecta como modificado → re-pull. **Mitigación**: guard en el trigger (no encolar cambios originados por el pull) + comparar `Modified_Time` Zoho vs `last_synced_at` antes de re-procesar.

## Security Considerations

- RLS obligatorio en las 3 tablas (multi-tenant).
- `integration_id` siempre validado contra el tenant del usuario (no aceptar del cliente).

## Next Steps

- Desbloquea Fase 02 (pull processor consume `zoho_sync_connections`) y Fase 03 (writeback consume `zoho_writeback_outbox`).
