---
title: "5-04 — Webhooks bidireccional (Platform Events / Outbound Messages)"
status: pending
priority: P2
estimation: 10-16h
phase_id: 5-04
sprint_id: SP-5
branch: feature/sp-5-salesforce-adapter
created: 2026-05-21
---

# Phase 04 — Webhooks bidireccional (5-04)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- [phase-03](phase-03-leads-contacts-opportunities.md) — Adapter ya tiene push

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-03
- **Descripción:** Pull (SF → Esden) via Outbound Messages (sin código Apex) o Platform Events si el tenant lo soporta. Endpoint `POST /api/webhooks/salesforce` recibe XML/JSON, valida origen y actualiza lead aplicando R-014.

## Key Insights

- Outbound Messages = workflow rule en SF que envía XML al webhook — no requiere código Apex en el tenant
- Platform Events = streaming subscription pub/sub vía CometD — más complejo pero más en tiempo real
- Decisión P2: implementar Outbound Messages primero (más simple), Platform Events queda como fase futura
- SF firma Outbound Messages con `organizationId` y `sessionId` (no HMAC) → validación por org_id en BD
- Mensajes reenviados hasta 24h si no responden 200 + ACK XML

## Requirements

**Funcionales:**
- Endpoint `POST /api/webhooks/salesforce` recibe SOAP/XML
- Parse XML payload con `fast-xml-parser` (ya en deps probablemente, si no añadir via ADR)
- Validar `organizationId` contra `crm_connections.sf_org_id`
- Aplicar R-014 al actualizar lead
- Responder ACK XML obligatorio (formato SF estándar)
- Idempotency: tabla `sync_events` con `event_id` único

**No funcionales:**
- Respuesta ACK < 3s (SF marca timeout)
- Procesamiento async via BullMQ (responder 200 inmediato)
- Logging audit completo

## Architecture

```
SF Outbound Message → POST /api/webhooks/salesforce (XML SOAP)
  → parse XML
  → validate organizationId matches a tenant
  → enqueue BullMQ "sf-pull" job
  → respond ACK XML inmediato

BullMQ worker sf-pull:
  → idempotency check sync_events
  → leer registro actualizado (queryField list del XML)
  → diff con lead en BD
  → aplicar R-014 (sheets-conflict-resolver reusable de Sprint 4)
  → persist lead
  → audit log
```

## Related Code Files

**Crear:**
- `src/app/api/webhooks/salesforce/route.ts`
- `src/jobs/salesforce-pull.job.ts`
- `src/lib/integrations/salesforce/salesforce-xml-parser.ts`
- `src/db/migrations/2026XXXX_crm_connections_sf_org_id.sql` (añadir `sf_org_id`)

**Reutilizar:**
- `src/lib/integrations/conflict-resolver.ts` (de Sprint 4 si ya generalizado, o copiar de sheets)

## Implementation Steps

1. Migration añadir `sf_org_id` a `crm_connections`
2. Persistir `sf_org_id` en flow OAuth (viene en el `id` field del token response)
3. Route handler `/api/webhooks/salesforce` con parser XML
4. Validar `organizationId` contra `sf_org_id`
5. Enqueue BullMQ + respond ACK XML inmediato
6. Worker `salesforce-pull.job.ts`: idempotency + diff + R-014 + persist + audit
7. Doc para tenants: cómo configurar Workflow Rule + Outbound Message
8. Tests integration con sandbox

## Todo List

- [ ] Migration `sf_org_id`
- [ ] Persistir `sf_org_id` en OAuth callback
- [ ] Route `/api/webhooks/salesforce`
- [ ] XML parser para SOAP body
- [ ] Validación `organizationId`
- [ ] Respuesta ACK XML obligatoria
- [ ] BullMQ worker `salesforce-pull.job.ts`
- [ ] Idempotency con `sync_events`
- [ ] Apply R-014 al update
- [ ] Audit log entries
- [ ] Doc tenant: setup Workflow Rule + Outbound Message
- [ ] Test integration con sandbox

## Success Criteria

- Update en SF sandbox → lead actualizado en Esden < 5 min
- ACK XML enviado en < 3s
- 0 duplicados (idempotency funciona)
- Webhook de otro org no procesado (validation funciona)
- R-014 aplicado correctamente

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| ACK XML mal formado → SF retry continuo | Media | Alto | Test contract del formato ACK |
| Validación `organizationId` confundida | Media | Alto | Strict match + audit cuando rechaza |
| Tenant no configura Workflow Rule | Alta | Bajo | Doc clara + sin webhook = pull no funciona pero push sigue OK |

## Security Considerations

- Validación `organizationId` obligatoria
- Endpoint público sin auth (SF no soporta firma HMAC en Outbound Messages)
- Rate limiting básico en endpoint
- No exponer error traces en response

## Next Steps

- Habilita 5-05 (UI con badge de webhook configured)
- Habilita 5-06 (audit + rate limit)
