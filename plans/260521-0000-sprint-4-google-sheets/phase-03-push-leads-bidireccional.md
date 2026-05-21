---
title: "4-03 — Push leads bidireccional (Esden → Sheet)"
status: pending
priority: P2
estimation: 10-16h
phase_id: 4-03
sprint_id: SP-4
branch: feature/sprint-04-google-sheets
created: 2026-05-21
---

# Phase 03 — Push leads bidireccional (4-03)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` (sección Push)
- [phase-01](phase-01-oauth2-drive-setup.md) + [phase-02](phase-02-templates-tenant-migration.md) — bloqueantes

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-01 + 4-02 completos
- **Descripción:** Implementar `SheetsAdapter.upsertLead()` con find-by-id + append/update + marca `_esden_updated_at`. Trigger vía BullMQ job `sheets-push` escuchando `lead.updated`.

## Key Insights

- Find-by-id: leer columna `lead_id` con `sheets.values.get`, buscar match, devolver índice fila
- Append vs Update: si encuentra fila → `values.update`; si no → `values.append`
- `_esden_updated_at` se setea SIEMPRE en push — esto rompe el bucle push/pull (4-04 lo verifica)
- Batch obligatorio: si llega lote de >50 leads, agrupar en `values.batchUpdate`
- Cuota: 300 reads/min, ~1000 writes/min — BullMQ throttle 5 jobs/s por tenant

## Requirements

**Funcionales:**

- Implementar `SheetsAdapter` que extiende `IntegrationAdapter` (Sprint 2)
- `upsertLead(tenantId, lead)`: find → append/update → marca timestamp
- BullMQ job `sheets-push` registrado, escucha event `lead.updated`
- Soportar lote: `batchUpsertLeads(tenantId, leads[])` para sync masivo
- Append-only por defecto (R-014) excepto en campos explícitamente marcados `overwrite_with_audit`

**No funcionales:**

- Idempotente: re-push del mismo lead actualiza fila existente, no crea duplicado
- Latencia push < 5 min desde event `lead.updated`
- Exponential backoff en 429

## Architecture

```
Event flow:
  domain event "lead.updated"
    → enqueue BullMQ "sheets-push" job (tenantId, leadId)
      → SheetsAdapter.upsertLead(tenantId, lead)
        → getAuthenticatedClient(tenantId) (de 4-01)
        → sheets.values.get(spreadsheetId, "A:A") → find row by lead_id
        → si existe: sheets.values.update(`Sheet1!A{row}`, [values])
        → si no:    sheets.values.append("Sheet1", [values])
        → set _esden_updated_at = now()
        → audit log entry

src/lib/integrations/sheets/sheets-adapter.ts
  class SheetsAdapter implements IntegrationAdapter
    - getProvider() = 'sheets'
    - testConnection()
    - upsertLead(lead, fieldMappings)
    - batchUpsertLeads(leads[])
    - pushDeal(deal, fieldMappings)  // opcional fase 1

src/jobs/sheets-push.job.ts
  - BullMQ worker
  - Concurrency: 5 jobs/s por tenant
  - Retry: exponential backoff 3 intentos
```

## Related Code Files

**Crear:**

- `src/lib/integrations/sheets/sheets-adapter.ts`
- `src/lib/integrations/sheets/sheets-field-mapper.ts`
- `src/jobs/sheets-push.job.ts`

**Modificar:**

- `src/lib/integrations/_integration-adapter-factory.ts` (registrar `sheets`)
- `src/lib/events/lead-events.ts` (suscriptor sheets-push)

## Implementation Steps

1. Implementar `sheets-field-mapper.ts` con mapping default lead → columnas Sheet
2. Implementar `SheetsAdapter.upsertLead()` con find-by-id
3. Manejar caso "spreadsheet vacío" (solo headers) → append
4. Setear `_esden_updated_at` en cada write
5. Implementar `batchUpsertLeads()` con `values.batchUpdate`
6. Implementar BullMQ worker `sheets-push.job.ts`
7. Suscribir worker a evento `lead.updated`
8. Manejar 429 con exponential backoff (BullMQ retry options)
9. Manejar 401/403 → marcar `status='revoked'` en `crm_connections`
10. Log de cada operación en `crm_write_audit`
11. Tests unitarios con mocks de googleapis

## Todo List

- [ ] `sheets-field-mapper.ts` con defaults
- [ ] `SheetsAdapter` esqueleto + `implements IntegrationAdapter`
- [ ] `upsertLead()` find-by-id implementado
- [ ] Append vs update logic
- [ ] `_esden_updated_at` setter en cada write
- [ ] `batchUpsertLeads()` para lotes
- [ ] BullMQ worker `sheets-push.job.ts`
- [ ] Suscripción a evento `lead.updated`
- [ ] Throttle 5 jobs/s por tenant
- [ ] Retry exponential backoff
- [ ] Manejo 401/403/429
- [ ] Audit log entries
- [ ] Tests unit con mocks googleapis
- [ ] Registrar adapter en factory

## Success Criteria

- Lead nuevo en Esden aparece en Sheet del tenant < 5 min
- Lead modificado actualiza la misma fila (no duplica)
- `_esden_updated_at` queda escrito en cada operación
- 429 manejado con retry sin pérdida de jobs
- Token revocado refleja `status='revoked'` en BD

## Risk Assessment

| Riesgo                                        | Prob  | Impacto | Mitigación                                        |
| --------------------------------------------- | ----- | ------- | ------------------------------------------------- |
| Cuota 1000 writes/min excedida en sync masivo | Media | Medio   | Batch + throttle BullMQ por tenant                |
| Race condition find→update                    | Baja  | Medio   | Mutex BullMQ por (tenantId, leadId)               |
| Sheets API renombra hoja "Sheet1"             | Baja  | Bajo    | Leer nombre real con `spreadsheets.get` y cachear |
| Lead sin lead_id (legacy)                     | Media | Bajo    | Validación pre-push: skip si no lead_id           |

## Security Considerations

- No loggear valores de leads en stdout
- `crm_write_audit` registra solo campos modificados, no payloads completos
- RLS garantiza que el worker solo procesa leads del tenant correcto

## Next Steps

- Habilita 4-04 (pull) que asume `_esden_updated_at` ya gestionado
- Habilita 4-06 (audit log) que consume las entries generadas
