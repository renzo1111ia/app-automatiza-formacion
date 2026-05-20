---
title: "5-03 — GoHighLevel Adapter (OAuth2 v2)"
sprint_task: 5-03
status: pending
priority: P2
effort: 40-80h
branch: feature/sp-5-03-ghl-adapter
version_bump: v0.5.2
agents: [esden-agents:code, esden-agents:api]
---

# 5-03 — GoHighLevel Adapter

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- [researcher-ghl-activecampaign-e-20260520.md](../reports/researcher-ghl-activecampaign-e-20260520.md) — research técnico
- [Research CRM sector](../../docs/audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md) — análisis GHL Latam
- [Sprint 3 plan](../260520-1342-sprint-3-adapter-hubspot-zoho/plan.md) — IntegrationAdapter base

## Overview

- **Prioridad**: P2 (audiencia Latam EduTech — academias vía agencias)
- **Estado**: Pendiente — bloqueado por Sprint 3 + registro app GHL Marketplace
- **Descripción**: Adapter GoHighLevel con OAuth2 v2. REST puro (axios). Sync Contact + Opportunity por tenant (locationId).

## Key Insights

- **REST puro con axios** — no existe SDK npm oficial mantenido
- API v1 (API Key) en end-of-support 31-dic-2025 — **SOLO construir contra v2 OAuth**
- Cada tenant = una Location en GHL. `locationId` es el identificador clave
- Rate limits generosos: 100 req/10s por location, 200k req/día
- GHL puede tener Node.js SDK oficial (`@gohighlevel/api-client`) — evaluar si simplifica, pero preferir REST puro para no añadir dep si la API es simple
- Webhooks: eventos `ContactCreate`, `ContactUpdate`, `OpportunityStatusUpdate` — verificar HMAC-SHA256
- CRÍTICO: registrar app en GHL Marketplace antes de implementar OAuth — proceso burocrático que puede tardar días

## Requirements

**Funcionales:**
- Push: lead actualizado en Esden → Contact upsert en GHL (buscar por email)
- Opportunity básico: si lead en etapa matrícula → crear/actualizar opportunity en pipeline GHL
- UI admin: OAuth consent, locationId, pipeline mapping, test connection
- Webhook pull: ContactUpdate en GHL → update lead en Esden (con verificación HMAC)

**No funcionales:**
- Multi-tenant: locationId diferente por tenant
- Rate limiting: BullMQ throttle ≤ 90 req/10s (margen seguridad)
- Idempotente: buscar contact por email antes de crear

## Architecture

### Data flows

**Push (Esden → GHL):**
```
lead.updated
  → BullMQ job: ghl-push
    → GHLAdapter.upsertContact(tenantId, lead)
      → GET /contacts/search?email=...&locationId=... → find existing
      → Si existe: PUT /contacts/{contactId}
      → Si no: POST /contacts (con locationId del tenant)
      → Si es matrícula: POST/PUT /opportunities
      → Log crm_write_audit
```

**Pull (GHL → Esden):**
```
GHL webhook → POST /api/webhooks/ghl
  → Verify HMAC-SHA256 (x-webhook-signature header)
  → Parse ContactUpdate payload
  → Map GHL fields → EsdenLead
  → Update lead in DB
```

**OAuth2 flow:**
```
Admin "Conectar GHL"
  → Redirect: marketplace.gohighlevel.com/oauth/chooselocation?...
  → Callback: POST /oauth/token → access_token + refresh_token + locationId
  → Guardar en crm_connections
```

### Componentes nuevos
- `src/lib/integrations/ghl/ghl-adapter.ts`
- `src/lib/integrations/ghl/ghl-oauth.ts`
- `src/lib/integrations/ghl/ghl-field-mapper.ts`
- `src/app/api/webhooks/ghl/route.ts`
- `src/app/api/oauth/ghl/callback/route.ts`
- `src/jobs/ghl-push.job.ts`
- `src/components/integrations/ghl-connection-form.tsx`

## Related Code Files

**Crear:**
- `src/lib/integrations/ghl/ghl-adapter.ts`
- `src/lib/integrations/ghl/ghl-oauth.ts`
- `src/lib/integrations/ghl/ghl-field-mapper.ts`
- `src/app/api/webhooks/ghl/route.ts`
- `src/app/api/oauth/ghl/callback/route.ts`
- `src/jobs/ghl-push.job.ts`
- `src/components/integrations/ghl-connection-form.tsx`

**Modificar:**
- `src/lib/integrations/adapter-factory.ts`
- `src/db/migrations/` (columna `ghl_location_id` en crm_connections)

## Implementation Steps

1. **Prerequisito externo**: registrar app en GHL Marketplace (proceso manual, ~2-5 días hábiles)
2. **DB migration**: columna `ghl_location_id` en `crm_connections`
3. **OAuth2**: `ghl-oauth.ts` — authorization URL, token exchange, refresh
4. **GHLAdapter**: `upsertContact()` — GET search by email → PUT/POST; `upsertOpportunity()`
5. **Webhook**: `POST /api/webhooks/ghl` — HMAC verify + parse + update lead
6. **FieldMapper**: defaults GHL (firstName/lastName/email/phone + customFields)
7. **Push job**: `ghl-push.job.ts` — BullMQ, throttle 90 req/10s
8. **UI**: formulario conexión (OAuth, locationId display, pipeline ID, test connection)
9. **Tests**: contract test + integration test con GHL sandbox account
10. **Cierre**: typecheck + lint + build

## Todo

- [ ] Prerequisito: app registrada en GHL Marketplace
- [ ] DB migration ghl_location_id
- [ ] OAuth2 GHL v2 (consent + callback + refresh)
- [ ] GHLAdapter.upsertContact() (search by email + create/update)
- [ ] GHLAdapter.upsertOpportunity() (configurable)
- [ ] Webhook pull /api/webhooks/ghl (HMAC verify)
- [ ] FieldMapper GHL
- [ ] BullMQ job ghl-push (throttle 90 req/10s)
- [ ] UI admin conexión GHL
- [ ] Tests: unit + integration
- [ ] Docs: guía para tenant

## Success Criteria

- Lead en Esden → Contact en GHL en < 5 min
- Upsert por email evita duplicados
- Webhook GHL → Esden funcional con HMAC verificado
- Rate limiting respetado sin errores 429
- All tests pass

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Registro en GHL Marketplace tarda o falla | Alta | Alto | Iniciar proceso burocrático antes de escribir código |
| locationId confuso para el tenant | Media | Medio | Mostrar locationId automáticamente tras OAuth consent |
| Custom fields varían por location | Alta | Bajo | FieldMapper configurable por tenant en UI |
| API v2 docs incompletas | Media | Medio | Testear contra GHL sandbox antes de implementar |
| HMAC webhook key no documentada claramente | Media | Medio | Verificar en GHL Marketplace → App Settings |

## Security Considerations

- Tokens OAuth cifrados en `crm_connections`
- Webhook: verificar `x-webhook-signature` HMAC-SHA256 en CADA request
- `locationId` vinculado a tenant — nunca cross-tenant
- No loggear access tokens

## Next Steps

- Bloqueado por: Sprint 3 completado + app GHL Marketplace aprobada
- Puede ejecutarse en paralelo con 5-01, 5-02, 5-04
