---
title: "6-03 — Webhooks HMAC + idempotency"
status: pending
priority: P2
estimation: 8-14h
phase_id: 6-03
sprint_id: SP-6
branch: feature/sprint-06-ghl-adapter
created: 2026-05-21
---

# Phase 03 — Webhooks HMAC + idempotency (6-03)

## Context Links

- [plan.md](plan.md) — overview Sprint 6
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md`
- [phase-02](phase-02-contacts-opportunities.md) — Adapter ya tiene push

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 6-01
- **Descripción:** Endpoint `POST /api/webhooks/ghl` con verificación HMAC-SHA256, idempotency check via `sync_events`, parse de eventos `ContactCreate/Update`, `OpportunityStatusUpdate` y aplicación R-014 al actualizar lead.

## Key Insights

- GHL firma webhooks con `x-webhook-signature` header (HMAC-SHA256)
- Secret de webhook configurado en Marketplace App Settings → guardar en env
- Eventos relevantes: `ContactCreate`, `ContactUpdate`, `ContactDelete`, `OpportunityStatusUpdate`
- Idempotency obligatoria — GHL puede reenviar
- Webhook registrado a nivel app, no por location → un endpoint atiende todos los tenants

## Requirements

**Funcionales:**

- Endpoint `POST /api/webhooks/ghl` verifica HMAC-SHA256
- Determinar tenant por `locationId` del payload
- Idempotency con tabla `sync_events` (event_id GHL)
- Apply R-014 al update lead
- Soporte para los 4 eventos (Contact CRUD + OpportunityStatusUpdate)

**No funcionales:**

- Respuesta 200 inmediata (proceso async vía BullMQ)
- Logging audit completo
- Constant-time HMAC comparison

## Architecture

```
GHL POST /api/webhooks/ghl
  Headers: x-webhook-signature (HMAC-SHA256)
  Body: { type, locationId, contactId/opportunityId, ... }
  → verify HMAC against GHL_WEBHOOK_SECRET (constant-time)
  → find tenant by locationId
  → idempotency check sync_events
  → enqueue BullMQ "ghl-pull" job
  → respond 200

BullMQ worker ghl-pull:
  → switch (event.type):
      case ContactCreate/Update: read contact via API → diff → R-014 → persist
      case ContactDelete: mark lead deleted (soft delete)
      case OpportunityStatusUpdate: update deal stage
  → audit log
```

## Related Code Files

**Crear:**

- `src/app/api/webhooks/ghl/route.ts`
- `src/jobs/ghl-pull.job.ts`
- `src/lib/integrations/ghl/ghl-webhook-verifier.ts`

**Modificar:**

- `.env.example` (`GHL_WEBHOOK_SECRET`)

## Implementation Steps

1. Configurar webhook secret en `.env.example`
2. `ghl-webhook-verifier.ts` con `crypto.timingSafeEqual` para HMAC
3. Route handler `/api/webhooks/ghl`:
   - Read raw body
   - Verify HMAC
   - Parse JSON
   - Lookup tenant by locationId
   - Enqueue + respond 200
4. BullMQ worker `ghl-pull.job.ts`
5. Switch en event.type
6. ContactUpdate → GET contact API → diff → R-014 → persist
7. OpportunityStatusUpdate → mapping stage → persist deal
8. Idempotency `sync_events`
9. Audit log entries
10. Tests unit + integration

## Todo List

- [ ] `GHL_WEBHOOK_SECRET` en `.env.example`
- [ ] `ghl-webhook-verifier.ts` con timing-safe compare
- [ ] Route `/api/webhooks/ghl`
- [ ] HMAC verification
- [ ] Lookup tenant by locationId
- [ ] Respond 200 inmediato + enqueue
- [ ] BullMQ worker `ghl-pull.job.ts`
- [ ] Handler ContactCreate/Update
- [ ] Handler ContactDelete (soft delete)
- [ ] Handler OpportunityStatusUpdate
- [ ] Apply R-014
- [ ] Idempotency sync_events
- [ ] Audit log entries
- [ ] Tests unit verifier
- [ ] Test integration con webhook simulado

## Success Criteria

- Webhook recibido con HMAC correcto → procesado
- Webhook con HMAC inválido → 401 + no procesado
- Webhook duplicado → no doble update
- ContactUpdate refleja en lead en <2 min
- R-014 aplicado correctamente

## Risk Assessment

| Riesgo                              | Prob  | Impacto | Mitigación                                    |
| ----------------------------------- | ----- | ------- | --------------------------------------------- |
| HMAC key incorrecta en docs GHL     | Media | Alto    | Test con webhook real desde GHL antes de prod |
| Tenant no encontrado por locationId | Baja  | Bajo    | Log warning + 200 (no error)                  |
| Webhook timing attack               | Baja  | Medio   | Constant-time compare obligatorio             |

## Security Considerations

- HMAC obligatorio con constant-time compare
- Webhook secret en env server-only
- Rate limiting básico en endpoint
- No exponer error details

## Next Steps

- Habilita 6-04 (UI con badge webhook)
