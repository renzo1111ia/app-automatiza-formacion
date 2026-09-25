# Fase 02 — Webhook entrante Zoho + suscripción + procesador de evento (EVENT-DRIVEN)

**Contexto:** [plan.md](plan.md) · referencia `src/app/api/webhooks/google-sheets/route.ts` + `src/lib/integrations/sheets/pull-processor.ts` + `queue.ts` · reutiliza `src/lib/integrations/crm/providers/zoho.ts`

## Overview

- **Prioridad:** P1 (núcleo del sprint)
- **Estado:** 🔘 Pendiente · depende de Fase 01
- **Estimación:** 4-5h
- **El lead entra al instante**: cuando un lead entra/cambia en Zoho, Zoho hace POST a nuestro webhook → encolamos → procesamos → el lead aparece en el sistema en segundos. **Sin polling.**

## Key Insights

- **Dos vías de suscripción al evento, ambas terminan en el MISMO webhook + procesador:**
  1. **Notifications API (v8)** — nos suscribimos programáticamente (1 clic UI). Zoho POSTea a nuestra `notify_url` al ocurrir el evento. La suscripción **caduca** (renovación en Fase 05b).
  2. **Workflow Webhook manual** — el tenant crea una regla en su Zoho que POSTea a la misma URL. No caduca.
- El webhook de Zoho trae los **`ids`** de los registros afectados (no el lead completo) → hacemos `provider.getLead(id)` para traer el lead y mapearlo.
- Se reutiliza `ZohoCRMProvider` (Sprint 2) para `getLead`. El `row-mapper.ts` de Sheets NO sirve (column-letter) → `lead-mapper.ts` nuevo.
- `phone-country.ts` (Sprint 4) se reutiliza directo.
- Idempotencia por `zoho_lead_id` en `zoho_lead_synced`.

## Requirements

**Funcionales:**

- Endpoint `POST /api/webhooks/zoho` que: identifica el tenant (por token en la URL/header), valida autenticidad, encola un job por cada `id` recibido, responde 200 rápido (< 2s, no procesa síncrono).
- Worker consume el job → `provider.getLead(zoho_id)` → mapea → INSERT si nuevo / UPDATE si existe → autorelleno → `orchestrator.handleNewLead()`.
- Suscripción Notifications API: `subscribeZohoNotifications(integrationId)` registra la `notify_url` + canal + eventos (Leads.create, Leads.edit) y persiste `channel_id`/`expiry` en `zoho_sync_connections`.

**No funcionales:** webhook responde 200 SIEMPRE que pueda (encola y devuelve; el procesamiento es async). Validación de autenticidad obligatoria. Dedup de jobs por `jobId = "zoho-lead-{zohoId}"`. PII enmascarada en logs.

## Related Code Files

**Crear:**

- `src/app/api/webhooks/zoho/route.ts` — endpoint entrante. Valida `channel_token`/secret por tenant, parsea ids, encola, responde 200.
- `src/lib/integrations/zoho-pull/subscription.ts` — `subscribeZohoNotifications()`, `unsubscribeZohoNotifications()`, `renewZohoNotifications()` (usa Notifications API v8 vía el provider/cliente HTTP Zoho).
- `src/lib/integrations/zoho-pull/lead-mapper.ts` — `mapZohoLeadToInternal(zohoLead, fieldMapping)` → `{lead, lead_cualificacion, metadata}`; `suggestFieldMapping()`.
- `src/lib/integrations/zoho-pull/event-processor.ts` — `processZohoLeadEvent(job)`: `getLead(id)` → map → upsert idempotente → autorelleno → orchestrator.
- `src/lib/integrations/zoho-pull/queue.ts` — BullMQ `zoho_lead_queue`, `enqueueZohoLeadEvent()`, `startZohoLeadWorker()`, `stopZohoLeadWorker()`.

**Leer para contexto:**

- `src/app/api/webhooks/google-sheets/route.ts` (patrón webhook: valida canal, encola, 200 rápido).
- `src/app/api/webhooks/crm/route.ts` (patrón HMAC + orchestrator existente).
- `src/lib/integrations/sheets/pull-processor.ts` (autorelleno líneas ~305-328 + orchestrator).
- `src/lib/integrations/crm/providers/zoho.ts` (`getLead`, forma `CRMLead`) + `factory.ts`.
- `src/lib/integrations/sheets/phone-country.ts` (reutilizar `deriveCountryFromPhone`).

## Architecture

```
Lead entra/cambia en Zoho
        │  (al instante)
        ▼
  Zoho POST ──► /api/webhooks/zoho?token=<por-tenant>
        │            valida secret/token por tenant
        │            extrae ids[], encola, responde 200 (<2s)
        ▼
  zoho_lead_queue (BullMQ, dedup jobId="zoho-lead-{id}")
        │
  startZohoLeadWorker ──► processZohoLeadEvent(job)
        │
  CRMFactory.getProviderForIntegration(integrationId)
        │
  provider.getLead(zoho_id)   ── trae el lead completo
        │
  mapZohoLeadToInternal(lead, field_mapping)
        │
  ¿zoho_lead_synced tiene zoho_lead_id?
     ├─ no  → INSERT lead + autorelleno (origen='zoho_crm', tipo_lead='zoho_import',
     │         fecha_ingreso_crm, pais) + zoho_lead_synced + orchestrator.handleNewLead()
     └─ sí  → UPDATE lead (campos del mapping) + guard anti-bucle

Suscripción (1 vez, al conectar desde UI):
  subscribeZohoNotifications(integrationId)
     → Notifications API: notify_url=/api/webhooks/zoho?token=...,
       events=[Leads.create, Leads.edit], channel_id, expiry
     → persiste en zoho_sync_connections
```

## Implementation Steps

1. **`subscription.ts`**: `subscribeZohoNotifications()` llama Notifications API v8 (`/actions/watch` o `/notifications`) con `notify_url`, `channel_id`, `events`, `token`; persiste `channel_id`+`expiry`+`token` en `zoho_sync_connections`. `unsubscribe`/`renew` análogos.
2. **`webhook/zoho/route.ts`**: resuelve tenant por `?token=` (o header), valida contra `zoho_sync_connections.channel_token` con `timingSafeEqual`; parsea body Zoho (`ids[]`, `operation`, `module`); por cada id `enqueueZohoLeadEvent()`; responde `200 {ok:true}` siempre que valide (no procesa síncrono). Si no valida → 403.
3. **`lead-mapper.ts`**: `mapZohoLeadToInternal()` mapea `CRMLead.fields` → payload AF según `field_mapping`; normaliza `Lead_Status` Zoho → `LeadStageEnum` (fallback `QUALIFICATION` + warning).
4. **`queue.ts`**: BullMQ `zoho_lead_queue`, misma `connection` Redis, dedup `jobId="zoho-lead-{zohoId}"` (evita procesar 2 veces el mismo evento).
5. **`event-processor.ts`**: `getLead(id)`; si Zoho devuelve 404 (lead borrado) → marcar/skip; map; buscar en `zoho_lead_synced`; INSERT (autorelleno + orchestrator) o UPDATE (guard anti-bucle).
6. typecheck + lint tras cada archivo.

## Todo List

- [ ] `subscription.ts` (subscribe/unsubscribe/renew Notifications API)
- [ ] `webhook/zoho/route.ts` (valida token, encola, 200 rápido)
- [ ] `lead-mapper.ts` (`mapZohoLeadToInternal` + normalización stages)
- [ ] `queue.ts` (BullMQ zoho_lead_queue + worker + dedup)
- [ ] `event-processor.ts` (getLead + upsert idempotente + autorelleno + orchestrator)
- [ ] Reutilizar `deriveCountryFromPhone`
- [ ] typecheck + lint verdes

## Success Criteria

- Crear un lead en Zoho → en segundos aparece en el sistema (vía webhook, sin esperar cron).
- El webhook responde 200 en < 2s (procesamiento async en el worker).
- Re-entrega del mismo evento NO duplica (dedup jobId + idempotencia `zoho_lead_id`).
- Webhook con token inválido → 403 (no procesa).
- Autorelleno correcto (`origen='zoho_crm'`, país por prefijo, etc.).

## Risk Assessment

- **Pérdida de webhook puntual** (Zoho caído / server reiniciando): mitigado por la **reconciliación diaria** de Fase 05b (red de seguridad).
- **Suscripción caducada** sin renovar → dejan de llegar eventos: mitigado por el cron de renovación de Fase 05b.
- **Normalización stages Zoho → LeadStageEnum**: texto libre del cliente; mapeo configurable + fallback.
- **Webhook abierto a internet**: validación de token por tenant obligatoria (`timingSafeEqual`).

## Security Considerations

- Validación de autenticidad del webhook **obligatoria** (token por tenant, comparación constant-time). Un webhook público sin validar = inyección de leads falsos.
- `integrationId` resuelto del registro de suscripción, nunca del body del webhook sin validar.
- PII enmascarada en logs (helper `src/lib/security/` Sprint 3).

## Next Steps

- Fase 03 (writeback dirección inversa) · Fase 05b (renovación suscripción + reconciliación diaria que respalda este webhook).
