# Fase 05b — Cron de renovación de suscripción + reconciliación diaria (red de seguridad)

**Contexto:** [plan.md](plan.md) · referencia `src/lib/integrations/sheets/outbox-processor.ts` (`renewExpiringWatchChannels`) + `src/app/api/internal/sheets/cron/route.ts`

## Overview

- **Prioridad:** P1 (sin esto, el webhook deja de llegar cuando caduca la suscripción, y los leads perdidos no se recuperan)
- **Estado:** 🔘 Pendiente · depende de Fase 02 (suscripción + event-processor)
- **Estimación:** 1-2h
- **Importante:** este cron NO hace polling de leads como mecanismo principal. Solo: (1) **renueva** las suscripciones Notifications API antes de que caduquen, y (2) una vez al día, **reconcilia** por si algún webhook se perdió.

## Key Insights

- La entrada de leads es **event-driven** (Fase 02). Este cron es el **backstop**, no el camino feliz.
- **Renovación**: las suscripciones de la Notifications API de Zoho caducan (~1 día). Hay que renovarlas antes (igual que Sheets renueva los Drive watch channels antes del TTL de 7 días).
- **Reconciliación**: 1 vez/día, `searchLeads(Modified_Time > last_reconciled_at)` y reprocesa por el MISMO `event-processor` (idempotente → no duplica). Recupera lo que el webhook no entregó.
- Los tenants con **Workflow Webhook manual** (fallback) NO necesitan renovación (no caduca), pero SÍ se benefician de la reconciliación.

## Requirements

**Funcionales:**

- Cron endpoint que: (a) renueva suscripciones Notifications API con `expiry` próximo; (b) si toca (1×/día por tenant), ejecuta reconciliación incremental.
- Reconciliación reutiliza `event-processor.processZohoLeadEvent` (idempotente) — no es código nuevo de ingesta.
- Actualizar `last_reconciled_at` por conexión.

**No funcionales:** cron **fail-closed en producción** (`CRON_SECRET` + `timingSafeEqual`, replica SEC-S4-01 ya corregido en Sprint 4). Cap de leads por reconciliación para no saturar.

## Related Code Files

**Crear:**

- `src/app/api/internal/zoho-pull/cron/route.ts` — endpoint cron (renovación + reconciliación + dispara writeback outbox de Fase 03). Fail-closed prod.
- `src/lib/integrations/zoho-pull/maintenance.ts` — `renewExpiringZohoSubscriptions()` + `runZohoReconciliation()` (1×/día, idempotente vía event-processor).

**Leer para contexto:**

- `src/lib/integrations/sheets/outbox-processor.ts` (`renewExpiringWatchChannels` — patrón renovación).
- `src/app/api/internal/sheets/cron/route.ts` (cron fail-closed + timingSafeEqual ya endurecido).
- `src/lib/integrations/zoho-pull/event-processor.ts` (Fase 02 — reutilizado por la reconciliación).
- `src/lib/integrations/zoho-pull/subscription.ts` (Fase 02 — `renewZohoNotifications`).

## Architecture

```
cron externo (Dokploy schedule / etc.) cada ~30-60 min
        │  POST /api/internal/zoho-pull/cron  (CRON_SECRET, fail-closed prod)
        ▼
  1) renewExpiringZohoSubscriptions()
        └─ por cada zoho_sync_connections con expiry < ahora+margen
             → subscription.renewZohoNotifications()  → nuevo expiry

  2) runZohoReconciliation()   (solo si last_reconciled_at < hoy)
        └─ provider.searchLeads(Modified_Time > last_reconciled_at)
             → por cada lead: enqueueZohoLeadEvent()  (mismo flujo Fase 02, idempotente)
             → last_reconciled_at = now

  3) runZohoWritebackOutbox()  (Fase 03)
```

## Implementation Steps

1. **`maintenance.ts`** → `renewExpiringZohoSubscriptions()`: query conexiones con `channel_expiry < now + margen`, llamar `subscription.renewZohoNotifications()`, actualizar expiry. Log de renovaciones.
2. **`maintenance.ts`** → `runZohoReconciliation()`: por conexión activa cuya `last_reconciled_at` sea de ayer o antes, `searchLeads(Modified_Time > last_reconciled_at)` paginado con cap, `enqueueZohoLeadEvent()` por lead (idempotente), actualizar `last_reconciled_at`.
3. **cron route**: copiar `sheets/cron/route.ts` (fail-closed prod + timingSafeEqual). Orquestar: renovación → reconciliación (si toca) → writeback outbox.
4. typecheck + lint.

## Todo List

- [ ] `maintenance.ts` (`renewExpiringZohoSubscriptions` + `runZohoReconciliation`)
- [ ] cron route `/api/internal/zoho-pull/cron` (fail-closed prod)
- [ ] Reutilizar `event-processor` para la reconciliación (no reimplementar ingesta)
- [ ] typecheck + lint verdes

## Success Criteria

- Una suscripción próxima a caducar se renueva automáticamente (sigue llegando el webhook).
- Un lead creado en Zoho mientras el webhook estaba caído se recupera en la siguiente reconciliación (sin duplicar).
- El cron es fail-closed en producción sin `CRON_SECRET`.

## Risk Assessment

- **Reconciliación duplicando leads**: mitigado — usa el mismo `event-processor` idempotente (idempotencia por `zoho_lead_id`).
- **Coste de la reconciliación**: 1×/día + cap de leads; no es polling continuo.

## Security Considerations

- Cron fail-closed en producción (replica SEC-S4-01). `CRON_SECRET` + `timingSafeEqual`.

## Next Steps

- Fase 06 (tests + cierre).
