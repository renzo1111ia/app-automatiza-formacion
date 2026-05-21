---
title: "7-03 — Deals + Automations sync"
status: pending
priority: P2
estimation: 4-8h
phase_id: 7-03
sprint_id: SP-7
branch: feature/sp-7-activecampaign-adapter
created: 2026-05-21
---

# Phase 03 — Deals + Automations (7-03)

## Context Links

- [plan.md](plan.md) — overview Sprint 7
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`
- [phase-02](phase-02-contacts-tags.md) — Adapter base listo

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 7-02
- **Descripción:** Extender ACAdapter con `upsertDeal()` (pipelines de matrícula) y `triggerAutomation()` (secuencias de nurturing email).

## Key Insights

- Deals via `POST /deals` con pipeline + stage IDs (por cuenta)
- Antes de crear: `GET /deals?filters[contact]=X` para evitar duplicados
- Automations via `POST /contactAutomations` (añade contact a automation)
- Tanto pipeline como automation son **opcionales** y **configurables** por tenant

## Requirements

**Funcionales:**
- `upsertDeal(deal, fieldMappings)`: search by contactId + pipelineId → POST/PUT
- `triggerAutomation(contactId, automationId)`: POST `contactAutomations`
- Configuración por tenant: qué pipeline usar, qué automation triggear

**No funcionales:**
- Idempotente: search antes de POST
- Audit log
- Throttle compartido con 7-02 (mismo BullMQ worker `ac-push`)

## Architecture

```
src/lib/integrations/activecampaign/ac-adapter.ts (extender de 7-02)
  + upsertDeal(deal, fieldMappings): PushResult
  + triggerAutomation(contactId, automationId): { ok }

Endpoints:
  GET  /deals?filters[contact]=X&filters[pipeline]=Y
  POST /deals
  PUT  /deals/{id}
  POST /contactAutomations { contactAutomation: { contact, automation } }
```

## Related Code Files

**Modificar:**
- `src/lib/integrations/activecampaign/ac-adapter.ts`
- `src/lib/integrations/activecampaign/ac-field-mapper.ts` (defaults Deal)

## Implementation Steps

1. FieldMapper defaults Deal: title, value, currency, pipeline, stage, owner
2. `upsertDeal()`: search → POST/PUT
3. Mapping Esden stage → AC stage (configurable por tenant)
4. `triggerAutomation()`: POST `contactAutomations`
5. Configuración tenant: `ac_pipeline_id`, `ac_automation_ids[]`
6. R-014 al update deal
7. Audit log entries
8. Tests unit

## Todo List

- [ ] FieldMapper defaults Deal
- [ ] `upsertDeal()` search + POST/PUT
- [ ] Mapping stage Esden → AC
- [ ] `triggerAutomation()` POST
- [ ] Config tenant `ac_pipeline_id`
- [ ] Config tenant `ac_automation_ids[]`
- [ ] R-014 al update deal
- [ ] Audit log entries
- [ ] Tests unit

## Success Criteria

- Matrícula en Esden → Deal en pipeline AC del tenant
- 0 duplicados de deal por contact+pipeline
- Automation triggered en contact si configurado
- Audit log refleja deal y automation

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Pipeline ID inválido | Media | Medio | Validar en UI admin al guardar |
| Automation triggered múltiples veces | Alta | Bajo | Verificar `contactAutomations` existe antes de POST |
| Stage names varían | Alta | Bajo | Mapping configurable |

## Security Considerations

- RLS multi-tenant
- No log payloads
- API Key cifrada

## Next Steps

- Habilita 7-04 (webhook pull)
