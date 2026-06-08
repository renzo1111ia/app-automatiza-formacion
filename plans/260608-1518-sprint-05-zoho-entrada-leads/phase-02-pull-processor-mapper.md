# Fase 02 — Pull processor + lead-mapper + cola

**Contexto:** [plan.md](plan.md) · referencia `src/lib/integrations/sheets/pull-processor.ts` + `row-mapper.ts` + `queue.ts` · reutiliza `src/lib/integrations/crm/providers/zoho.ts`

## Overview

- **Prioridad:** P1
- **Estado:** 🔘 Pendiente · depende de Fase 01
- **Estimación:** 3-4h
- Implementar la ingesta de leads desde Zoho: cola BullMQ + worker + processor que consulta Zoho (`searchLeads`), mapea a lead interno, INSERT/UPDATE idempotente y dispara el orchestrator.

## Key Insights

- **No se reescribe el cliente Zoho**: se reutiliza `ZohoCRMProvider.searchLeads(criteria, page, perPage)` vía `CRMFactory.getProviderForIntegration(integrationId)`.
- El `row-mapper.ts` de Sheets es column-letter based → **NO reutilizable**. Se crea `lead-mapper.ts` que mapea `CRMLead.fields` (objeto Zoho) → payload interno usando `field_mapping`.
- `phone-country.ts` (Sprint 4) **sí se reutiliza** directo para el autorelleno de país.
- Idempotencia por `zoho_lead_id` en `zoho_lead_synced` (no hash de fila).

## Requirements

**Funcionales:**

- Cron/manual dispara un pull job por conexión Zoho activa.
- El processor consulta Zoho por `Modified_Time > last_synced_at` (paginado), mapea cada lead, INSERT si nuevo / UPDATE si ya sincronizado.
- Autorelleno: `origen='zoho_crm'`, `tipo_lead='zoho_import'`, `fecha_ingreso_crm=now`, `pais=deriveCountryFromPhone(telefono)`.
- Tras INSERT de lead nuevo → `orchestrator.handleNewLead()`.
- Actualizar `last_synced_at` (cursor) al final del batch.

**No funcionales:** dedup de jobs por `jobId = "zoho-pull-{integrationId}"`; manejo de errores Zoho (rate-limit/refresh ya cubierto por el provider); logging estructurado con PII enmascarada.

## Related Code Files

**Crear:**

- `src/lib/integrations/zoho-pull/lead-mapper.ts` — `mapZohoLeadToInternal(zohoLead, fieldMapping)` → `{lead, lead_cualificacion, metadata}`; `suggestFieldMapping(zohoFields)` (heurística).
- `src/lib/integrations/zoho-pull/pull-processor.ts` — `processZohoPullJob(job)`: factory provider → searchLeads paginado → map → upsert idempotente → orchestrator → cursor.
- `src/lib/integrations/zoho-pull/queue.ts` — BullMQ `zoho_pull_queue`, `enqueueZohoPull()`, `startZohoPullWorker()`, `stopZohoPullWorker()`.

**Leer para contexto:**

- `src/lib/integrations/sheets/pull-processor.ts` (estructura del flujo + autorelleno líneas ~305-328).
- `src/lib/integrations/sheets/queue.ts` (patrón BullMQ + dedup).
- `src/lib/integrations/crm/providers/zoho.ts` (`searchLeads`, forma de `CRMLead`).
- `src/lib/integrations/crm/factory.ts` (`getProviderForIntegration`).
- `src/lib/integrations/sheets/phone-country.ts` (reutilizar `deriveCountryFromPhone`).

## Architecture

```
cron / manual ──► enqueueZohoPull(integrationId)  (dedup jobId)
                        │
                  zoho_pull_queue (BullMQ)
                        │
                  startZohoPullWorker ──► processZohoPullJob(job)
                        │
        CRMFactory.getProviderForIntegration(integrationId)
                        │
        provider.searchLeads({Modified_Time > last_synced_at}, page…)
                        │  por cada CRMLead
        mapZohoLeadToInternal(lead, field_mapping)
                        │
        ¿zoho_lead_synced tiene zoho_lead_id?
           ├─ no  → INSERT lead + autorelleno + zoho_lead_synced + orchestrator.handleNewLead()
           └─ sí  → UPDATE lead (solo campos del mapping)
                        │
        UPDATE zoho_sync_connections.last_synced_at = max(Modified_Time)
```

## Implementation Steps

1. **`lead-mapper.ts`**: `mapZohoLeadToInternal()` recorre `field_mapping` (Zoho field → AF target), construye `lead` + `lead_cualificacion`. Default targets: `Email→email`, `Phone→telefono`, `First_Name/Last_Name→nombre`, `Lead_Status→current_stage` (con normalización al `LeadStageEnum`). `suggestFieldMapping()` heurística por nombre de campo.
2. **`queue.ts`**: clonar el patrón de `sheets/queue.ts` con nombre `zoho_pull_queue`, misma `connection` Redis, dedup `jobId`.
3. **`pull-processor.ts`**:
   - Cargar `zoho_sync_connections` activas (o la del job).
   - `provider.searchLeads()` con criterio `Modified_Time > last_synced_at`, paginar hasta agotar.
   - Por lead: `mapZohoLeadToInternal()`, buscar en `zoho_lead_synced`.
   - INSERT nuevo: autorelleno (`origen`, `tipo_lead`, `fecha_ingreso_crm`, `pais`), crear fila `zoho_lead_synced`, `orchestrator.handleNewLead()`.
   - UPDATE existente: aplicar solo campos mapeados; **guard anti-bucle** (no re-disparar writeback).
   - Actualizar cursor `last_synced_at`.
   - try/catch por lead (un lead fallido no aborta el batch); `last_sync_error` en la conexión si falla global.
4. **typecheck + lint** tras cada archivo.

## Todo List

- [ ] `lead-mapper.ts` (`mapZohoLeadToInternal` + `suggestFieldMapping`)
- [ ] `queue.ts` (BullMQ zoho_pull_queue + worker)
- [ ] `pull-processor.ts` (searchLeads paginado + upsert idempotente + autorelleno + orchestrator + cursor)
- [ ] Reutilizar `deriveCountryFromPhone` de Sheets
- [ ] typecheck + lint verdes

## Success Criteria

- Un pull manual sobre un tenant con leads en Zoho inserta los leads nuevos en `lead` con autorelleno correcto.
- Re-ejecutar el pull NO duplica (idempotencia por `zoho_lead_id`).
- Un lead modificado en Zoho actualiza el lead interno (campos mapeados).
- `orchestrator.handleNewLead()` se invoca solo para leads nuevos.

## Risk Assessment

- **Normalización de stages Zoho → LeadStageEnum**: los `Lead_Status` de Zoho son texto libre del cliente. Mitigación: tabla de mapeo configurable + fallback a `QUALIFICATION` con log de warning.
- **Volumen / rate-limit Zoho**: paginar + respetar el backoff que ya implementa el provider; cap de leads por job.

## Security Considerations

- `integrationId` resuelto del tenant autenticado, nunca del input del job sin validar.
- PII (email/teléfono) enmascarada en logs (usar helper `src/lib/security/` de Sprint 3).

## Next Steps

- Fase 03 añade el writeback (dirección inversa) consumiendo el outbox que el trigger llena.
