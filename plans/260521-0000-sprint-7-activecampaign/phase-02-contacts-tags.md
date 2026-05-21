---
title: "7-02 — Contacts + Tags (contact/sync upsert)"
status: pending
priority: P2
estimation: 5-10h
phase_id: 7-02
sprint_id: SP-7
branch: feature/sp-7-activecampaign-adapter
created: 2026-05-21
---

# Phase 02 — Contacts + Tags (7-02)

## Context Links

- [plan.md](plan.md) — overview Sprint 7
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`
- [phase-01](phase-01-api-key-auth-migration.md) — auth listo

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 7-01
- **Descripción:** Implementar `ACAdapter.upsertContact()` usando endpoint `contact/sync` (upsert automático por email) + soporte de tags. BullMQ job `ac-push` con throttle 4 req/s.

## Key Insights

- `POST /contact/sync` → upsert automático por email (NO duplica)
- Tags via `POST /contactTags` (asociación) — separado del contact
- Custom fields = `fieldValues: [{ field, value }]`
- Throttle obligatorio: 4 req/s (margen sobre los 5 del límite)

## Requirements

**Funcionales:**
- `ACAdapter implements IntegrationAdapter`
- `upsertContact(contact, fieldMappings)`: POST `contact/sync`
- Soporte tags: `applyTags(contactId, tags[])`
- BullMQ job `ac-push` con throttle 4 req/s por tenant
- FieldMapper con defaults + custom fields

**No funcionales:**
- Append-only R-014 por defecto
- Audit log por operación
- Retry exponencial en 429

## Architecture

```
src/lib/integrations/activecampaign/
├── ac-adapter.ts
│   - upsertContact(contact, fieldMappings)
│   - applyTags(contactId, tags[])
│   - testConnection()
├── ac-field-mapper.ts
├── ac-api-client.ts (de 7-01)
└── ac-auth.ts (de 7-01)

src/jobs/ac-push.job.ts
  - Throttle 4 req/s per tenant
  - Retry exponencial
```

## Related Code Files

**Crear:**
- `src/lib/integrations/activecampaign/ac-adapter.ts`
- `src/lib/integrations/activecampaign/ac-field-mapper.ts`
- `src/jobs/ac-push.job.ts`

**Modificar:**
- `src/lib/integrations/_integration-adapter-factory.ts` (registrar ac)
- `src/lib/events/lead-events.ts` (suscriptor ac-push)

## Implementation Steps

1. FieldMapper defaults: firstName, lastName, email, phone + custom fields
2. `upsertContact()`: payload `{ contact: { email, firstName, ... }, fieldValues: [...] }`
3. POST `contact/sync` → response incluye contact.id
4. `applyTags(contactId, tags)`: POST `contactTags` por cada tag
5. R-014 append-only: lectura previa para detectar campos no vacíos
6. BullMQ worker con throttle 4 req/s
7. Manejo 429 → backoff y retry
8. Audit log entries
9. Registrar adapter en factory

## Todo List

- [ ] FieldMapper defaults
- [ ] `upsertContact()` con `contact/sync`
- [ ] Custom fields via `fieldValues`
- [ ] `applyTags()` POST `contactTags`
- [ ] R-014 append-only
- [ ] BullMQ worker `ac-push.job.ts`
- [ ] Throttle 4 req/s
- [ ] Retry exponencial
- [ ] Audit log entries
- [ ] Registrar en factory
- [ ] Smoke test trial account

## Success Criteria

- Lead Esden → Contact AC < 2 min, sin duplicados
- Tags aplicados correctamente
- 0 errores 429 con throttle
- Audit log refleja cada operación

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| 5 req/s excedido | Alta | Medio | Throttle 4 req/s + queue per-tenant |
| Custom fields IDs distintos por cuenta | Alta | Bajo | Mapping configurable por tenant |
| Tag ID vs Tag Name confusion | Media | Bajo | UI muestra ambos al configurar |

## Security Considerations

- No log payloads
- RLS multi-tenant
- API Key cifrada

## Next Steps

- Habilita 7-03 (Deals + Automations)
