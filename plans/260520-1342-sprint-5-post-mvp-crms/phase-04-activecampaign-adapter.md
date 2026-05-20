---
title: "5-04 — ActiveCampaign Adapter (API Key)"
sprint_task: 5-04
status: pending
priority: P2
effort: 20-50h
branch: feature/sp-5-04-activecampaign-adapter
version_bump: v0.5.3
agents: [esden-agents:code, esden-agents:api]
---

# 5-04 — ActiveCampaign Adapter

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- [researcher-ghl-activecampaign-e-20260520.md](../reports/researcher-ghl-activecampaign-e-20260520.md) — research técnico
- [Sprint 3 plan](../260520-1342-sprint-3-adapter-hubspot-zoho/plan.md) — IntegrationAdapter base

## Overview

- **Prioridad**: P2 (más simple de implementar — API Key, sin OAuth)
- **Estado**: Pendiente — bloqueado por Sprint 3 completado
- **Descripción**: Adapter ActiveCampaign API v3. REST puro (axios). API Key auth. Contact sync + Deal + Automation trigger. Rate limit restrictivo (5 req/s) — requiere throttling cuidadoso.

## Key Insights

- **REST puro con axios** — sin SDK npm oficial
- **API Key auth** — la auth más simple de los 4 adapters 5-01..E-04
- Rate limit restrictivo: **5 req/s por cuenta** — BullMQ throttle obligatorio
- `contact/sync` endpoint hace upsert por email automáticamente
- Webhooks AC garantizan "at least once" — idempotencia obligatoria
- URL base variable por tenant: `https://{account}.api-us1.com/api/3`
- Deals = pipelines de matrícula. Automations = secuencias de email nurturing
- **CERO dependencias nuevas**

## Requirements

**Funcionales:**
- Push: lead actualizado en Esden → Contact sync en AC (upsert por email)
- Deal básico: si lead en etapa matrícula → crear/actualizar deal en pipeline AC
- Automation trigger: añadir contact a automation si está configurado
- Webhook pull: contact_update en AC → update lead en Esden
- UI admin: API Key input, Account URL, pipeline mapping, automation mapping, test connection

**No funcionales:**
- Rate limiting: max 4 req/s por tenant-AC (margen de seguridad)
- Idempotente: `contact/sync` ya maneja upsert; deals verificar antes de crear
- Auditable: cada sync en `crm_write_audit`

## Architecture

### Data flows

**Push (Esden → ActiveCampaign):**
```
lead.updated
  → BullMQ job: ac-push (throttle: 4 req/s per tenant)
    → ACAdapter.upsertContact(tenantId, lead)
      → POST /contact/sync (upsert automático por email)
      → Si es matrícula + deal configurado: POST /deals
      → Si automation configurado: POST /contactAutomations
      → Log crm_write_audit
```

**Pull (AC → Esden):**
```
AC webhook → POST /api/webhooks/activecampaign
  → Idempotency check: event_id en tabla sync_events
  → Map AC contact fields → EsdenLead
  → Update lead en DB
```

**Setup tenant:**
```
Admin configura: API Key + Account URL
  → GET /users/me para verificar credenciales
  → Guardar en crm_connections (AC no tiene OAuth)
  → Registrar webhook en AC: POST /webhooks (events: contact_update, deal_update)
```

### Componentes nuevos
- `src/lib/integrations/activecampaign/ac-adapter.ts`
- `src/lib/integrations/activecampaign/ac-field-mapper.ts`
- `src/app/api/webhooks/activecampaign/route.ts`
- `src/jobs/ac-push.job.ts`
- `src/components/integrations/ac-connection-form.tsx`

## Related Code Files

**Crear:**
- `src/lib/integrations/activecampaign/ac-adapter.ts`
- `src/lib/integrations/activecampaign/ac-field-mapper.ts`
- `src/app/api/webhooks/activecampaign/route.ts`
- `src/jobs/ac-push.job.ts`
- `src/components/integrations/ac-connection-form.tsx`

**Modificar:**
- `src/lib/integrations/adapter-factory.ts`
- `src/db/migrations/` (columnas AC en crm_connections: `ac_account_url`, `ac_webhook_id`)

## Implementation Steps

1. **DB migration**: columnas `ac_account_url`, `ac_webhook_id` en `crm_connections`
2. **ACAdapter**: `upsertContact()` vía `contact/sync`; `testConnection()` vía `GET /users/me`
3. **Deal**: `upsertDeal()` — buscar deal existente por contactId + pipelineId antes de crear
4. **Automation trigger**: `triggerAutomation()` — opcional, configurable por tenant
5. **Webhook registro**: al activar integración → `POST /webhooks` en AC para `contact_update`
6. **Webhook pull**: `POST /api/webhooks/activecampaign` — idempotency check + parse + update lead
7. **FieldMapper**: defaults AC firstName/lastName/email/phone + fieldValues para custom fields
8. **Push job**: `ac-push.job.ts` — BullMQ throttle 4 req/s por tenant
9. **UI**: formulario conexión (API Key, Account URL, test, pipeline/automation mapping)
10. **Tests**: contract test + integration test con AC trial account
11. **Cierre**: typecheck + lint + build

## Todo

- [ ] DB migration columnas AC en crm_connections
- [ ] ACAdapter.upsertContact() via contact/sync
- [ ] ACAdapter.upsertDeal() (configurable)
- [ ] ACAdapter.triggerAutomation() (opcional)
- [ ] ACAdapter.testConnection() via GET /users/me
- [ ] Webhook registro automático al activar integración
- [ ] Webhook pull /api/webhooks/activecampaign (idempotency check)
- [ ] FieldMapper AC
- [ ] BullMQ job ac-push (throttle 4 req/s)
- [ ] UI admin conexión AC (API Key + Account URL)
- [ ] Tests: unit + integration
- [ ] Docs: guía para tenant

## Success Criteria

- Lead en Esden → Contact en AC en < 2 min (baja latencia por API Key simple)
- `contact/sync` no crea duplicados
- Webhook AC → Esden funcional con idempotency (no doble update)
- Rate limit 5 req/s respetado sin errores 429
- All tests pass

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Rate limit 5 req/s excedido con muchos leads | Alta | Medio | BullMQ throttle 4 req/s estricto + queue per-tenant |
| Webhook duplicados "at least once" | Alta | Bajo | Tabla `sync_events` con idempotency key (event_id) |
| `ac_account_url` variable por tenant | Media | Bajo | Validar formato URL al guardar (regex) |
| Custom fields ID numérico cambia entre cuentas | Alta | Bajo | FieldMapper configurable, no hardcodear field IDs |
| AC API puede cambiar formato de URL (au1, us1, eu1) | Baja | Medio | Almacenar URL completa, no derivar |

## Security Considerations

- API Key cifrado en `crm_connections`
- `ac_account_url` por tenant — nunca cross-tenant
- RLS en `crm_connections`
- No loggear API Key

## Next Steps

- Bloqueado por: Sprint 3 completado
- E-04 es el más simple — candidato a implementar antes de 5-02/5-03 si se quiere victoria rápida
- Puede ejecutarse en paralelo con 5-01, 5-02, 5-03
- Desbloquea (junto con 5-01..5-03): 5-05
