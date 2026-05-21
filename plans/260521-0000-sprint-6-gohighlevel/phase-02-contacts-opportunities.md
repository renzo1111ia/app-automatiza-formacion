---
title: "6-02 — Contacts + Opportunities REST puro"
status: pending
priority: P2
estimation: 12-20h
phase_id: 6-02
sprint_id: SP-6
branch: feature/sp-6-ghl-adapter
created: 2026-05-21
---

# Phase 02 — Contacts + Opportunities REST (6-02)

## Context Links

- [plan.md](plan.md) — overview Sprint 6
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md`
- [phase-01](phase-01-oauth2-v2-marketplace.md) — OAuth listo

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 6-01
- **Descripción:** Implementar `GHLAdapter` con `upsertContact` (search-by-email + POST/PUT) y `upsertOpportunity` (búsqueda en pipeline + create/update). REST puro con axios. BullMQ job `ghl-push` con throttle 90 req/10s.

## Key Insights

- No existe SDK npm oficial mantenido → axios directo
- `GET /contacts/?email=...&locationId=...` → search; si no hay → `POST /contacts/`
- Pipeline IDs varían por location → mapping configurable por tenant
- Rate limit: 100 req/10s por location → usar 90 (margen)
- Custom fields = `customFields: [{ id, value }]` por payload

## Requirements

**Funcionales:**
- `GHLAdapter implements IntegrationAdapter`
- `upsertContact(contact, fieldMappings)`: search → upsert por email
- `upsertOpportunity(deal, fieldMappings)`: search en pipeline → upsert
- `testConnection()`: `GET /locations/{locationId}`
- FieldMapper con defaults + custom fields configurables
- BullMQ job `ghl-push` con throttle 90 req/10s por tenant

**No funcionales:**
- Append-only R-014 por defecto
- Audit log por operación
- Retry exponencial en 429/5xx

## Architecture

```
src/lib/integrations/ghl/
├── ghl-adapter.ts
├── ghl-api-client.ts        — axios instance con interceptors
├── ghl-field-mapper.ts
└── ghl-oauth.ts             — de 6-01

src/jobs/ghl-push.job.ts
  - BullMQ worker
  - Throttle 90 req/10s por tenant
  - Retry exponencial

Endpoints GHL usados:
  GET  /contacts/?email=...&locationId=...
  POST /contacts/
  PUT  /contacts/{contactId}
  GET  /opportunities/search?...
  POST /opportunities/
  PUT  /opportunities/{opportunityId}
  GET  /locations/{locationId} (testConnection)
```

## Related Code Files

**Crear:**
- `src/lib/integrations/ghl/ghl-adapter.ts`
- `src/lib/integrations/ghl/ghl-api-client.ts`
- `src/lib/integrations/ghl/ghl-field-mapper.ts`
- `src/jobs/ghl-push.job.ts`

**Modificar:**
- `src/lib/integrations/_integration-adapter-factory.ts` (registrar ghl)
- `src/lib/events/lead-events.ts` (suscriptor ghl-push)

## Implementation Steps

1. `ghl-api-client.ts`: axios instance con baseURL + interceptor de auth + retry 429
2. FieldMapper defaults Contact (firstName, lastName, email, phone, source, tags)
3. FieldMapper defaults Opportunity (name, monetaryValue, pipelineId, pipelineStageId, status)
4. `upsertContact`: GET search → POST/PUT
5. `upsertOpportunity`: GET search (filtros pipeline+contactId) → POST/PUT
6. Custom fields mapper (campo `customFields: [{ id, value }]`)
7. `testConnection`: GET location
8. BullMQ worker `ghl-push.job.ts` con throttle
9. R-014 append-only logic
10. Audit log entries
11. Registrar adapter en factory

## Todo List

- [ ] `ghl-api-client.ts` con axios + interceptors
- [ ] FieldMapper Contact defaults
- [ ] FieldMapper Opportunity defaults
- [ ] Custom fields support
- [ ] `upsertContact` search + POST/PUT
- [ ] `upsertOpportunity` search + POST/PUT
- [ ] `testConnection`
- [ ] R-014 append-only
- [ ] BullMQ worker `ghl-push.job.ts`
- [ ] Throttle 90 req/10s
- [ ] Retry exponencial 429/5xx
- [ ] Audit log entries
- [ ] Registrar en factory
- [ ] Smoke test sandbox

## Success Criteria

- Lead en Esden → Contact en GHL location del tenant < 5 min
- Upsert por email sin duplicados
- Opportunity creada en pipeline correcto del tenant
- Throttle respeta 90 req/10s
- 0 errores 429 en tests

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Custom fields IDs varían por location | Alta | Bajo | FieldMapper configurable por tenant |
| Pipeline IDs no documentados | Alta | Medio | Endpoint GET pipelines en UI admin (6-04) |
| API v2 changes durante development | Media | Medio | Pin a versión de API en headers |

## Security Considerations

- No loggear access_token
- Custom fields no exponen datos sensibles
- RLS multi-tenant

## Next Steps

- Habilita 6-03 (webhooks pull)
- Habilita 6-04 (UI admin)
