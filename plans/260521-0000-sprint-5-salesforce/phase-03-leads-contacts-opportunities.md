---
title: "5-03 — Leads + Contacts + Opportunities mapping"
status: pending
priority: P2
estimation: 12-18h
phase_id: 5-03
sprint_id: SP-5
branch: feature/sprint-05-salesforce-adapter
created: 2026-05-21
---

# Phase 03 — Leads + Contacts + Opportunities (5-03)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- [phase-02](phase-02-jsforce-setup-migration.md) — jsforce ya listo

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-02
- **Descripción:** Implementar `SalesforceAdapter` con métodos `upsertLead`, `upsertContact`, `upsertOpportunity`. Mapping bidireccional Esden ↔ SF con FieldMapper. Soporte sandbox + prod. BullMQ job `salesforce-push`.

## Key Insights

- Upsert por email: `conn.sobject('Lead').upsert({ Email: ... }, 'Email')`
- `Company` es required en Lead → default = nombre academia del tenant
- Conversión Lead → Contact: configurable por tenant (algunos no convierten)
- Opportunity asociada via `AccountId` o `ContactId`
- Stage names varían por org → `FieldMapper` debe permitir mapping de pipeline

## Requirements

**Funcionales:**

- `SalesforceAdapter implements IntegrationAdapter`
- `upsertLead(lead, fieldMappings)`: upsert por Email
- `upsertContact(contact, fieldMappings)`: upsert por Email (si tenant configurado para Contact en vez de Lead)
- `upsertOpportunity(deal, fieldMappings)`: upsert con `Name + Stage + Amount`
- BullMQ job `salesforce-push` escucha `lead.updated` y `deal.updated`
- FieldMapper con defaults Lead/Contact/Opportunity

**No funcionales:**

- Append-only R-014 por defecto
- Logging audit por cada upsert
- Throttle por tenant según API limits Edition

## Architecture

```
src/lib/integrations/salesforce/
├── salesforce-adapter.ts
│   - upsertLead(lead, mappings): PushResult
│   - upsertContact(contact, mappings): PushResult
│   - upsertOpportunity(deal, mappings): PushResult
│   - testConnection(): { ok, error? }
├── salesforce-field-mapper.ts
│   - DEFAULT_LEAD_MAPPING
│   - DEFAULT_CONTACT_MAPPING
│   - DEFAULT_OPPORTUNITY_MAPPING
│   - toSfLead/Contact/Opportunity(lead, mappings)
└── salesforce-connection.ts (de 5-02)

src/jobs/salesforce-push.job.ts
  - BullMQ worker
  - Throttle per-tenant (15k/día = 10/min default conservador)
  - Retry exponencial
```

## Related Code Files

**Crear:**

- `src/lib/integrations/salesforce/salesforce-adapter.ts`
- `src/lib/integrations/salesforce/salesforce-field-mapper.ts`
- `src/jobs/salesforce-push.job.ts`

**Modificar:**

- `src/lib/integrations/_integration-adapter-factory.ts` (registrar salesforce)
- `src/lib/events/lead-events.ts` (suscriptor sf-push)

## Implementation Steps

1. FieldMapper con defaults Lead (FirstName, LastName, Email, Phone, Company, LeadSource, Status)
2. FieldMapper con defaults Contact (FirstName, LastName, Email, Phone, AccountId)
3. FieldMapper con defaults Opportunity (Name, StageName, Amount, CloseDate)
4. `SalesforceAdapter.upsertLead()` con `sobject('Lead').upsert(record, 'Email')`
5. `upsertContact()` análogo
6. `upsertOpportunity()` con asociación ContactId
7. Manejar `Company` required: default = academia.name del tenant
8. Aplicar R-014: lectura previa para detectar campos no vacíos
9. BullMQ worker `salesforce-push.job.ts`
10. Throttle 10 req/min por tenant (conservador para Edition)
11. Audit log en `crm_write_audit`
12. Registrar adapter en factory

## Todo List

- [ ] FieldMapper Lead default
- [ ] FieldMapper Contact default
- [ ] FieldMapper Opportunity default
- [ ] `SalesforceAdapter.upsertLead()`
- [ ] `SalesforceAdapter.upsertContact()`
- [ ] `SalesforceAdapter.upsertOpportunity()`
- [ ] Company default = academia.name
- [ ] R-014 append-only por defecto
- [ ] BullMQ worker `salesforce-push.job.ts`
- [ ] Throttle 10 req/min
- [ ] Retry exponential backoff
- [ ] Audit log entries
- [ ] Registrar en `adapter-factory`
- [ ] Smoke test contra sandbox

## Success Criteria

- Lead en Esden → Lead en SF sandbox < 5 min, upsert por email funcional
- Si tenant config Contact: upsert Contact en lugar de Lead
- Opportunity creada con FK al Contact correcto
- `Company` siempre rellenado (default academia)
- 0 duplicados por email en sandbox

## Risk Assessment

| Riesgo                        | Prob  | Impacto | Mitigación                                                                 |
| ----------------------------- | ----- | ------- | -------------------------------------------------------------------------- |
| Stage names varían por org    | Alta  | Bajo    | Mapping configurable por tenant + default genérico                         |
| API limit hit en bulk push    | Media | Medio   | Throttle 10/min default + alerta % cuota                                   |
| `Company` field validation    | Alta  | Bajo    | Default academia.name + validación pre-push                                |
| Picklist values no permitidos | Media | Medio   | Validar antes de push o capturar `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` |

## Security Considerations

- No loggear datos de leads en stdout
- RLS asegura solo procesamos leads del tenant correcto
- Audit log con campos modificados, no payloads completos

## Next Steps

- Habilita 5-04 (webhooks bidireccional)
- Habilita 5-05 (UI admin)
