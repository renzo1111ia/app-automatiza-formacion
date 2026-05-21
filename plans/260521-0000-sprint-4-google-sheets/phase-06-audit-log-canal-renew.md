---
title: "4-06 — Audit log + canal Drive renovación"
status: pending
priority: P2
estimation: 6-10h
phase_id: 4-06
sprint_id: SP-4
branch: feature/sprint-04-google-sheets
created: 2026-05-21
---

# Phase 06 — Audit log + canal Drive renovación (4-06)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` (sección canal renew + audit)
- Sprint 2 audit log: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-06-write-audit-y-visualizacion.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-03 + 4-04
- **Descripción:** Extender `crm_write_audit` con campos específicos Sheets y un cron BullMQ que renueva el canal Drive cada 6 días (TTL Google = 7 días).

## Key Insights

- `crm_write_audit` ya existe (Sprint 2) — sólo necesita aceptar `crm_type='sheets'`
- Canal Drive: `drive.files.watch` devuelve `{ id, resourceId, expiration }`
- Renovación: nuevo `watch()` con nuevo channelId + stop del anterior (`drive.channels.stop`)
- Si renovación falla → alerta via log + status `error` en UI badge
- Cron BullMQ con frecuencia diaria (verifica todos los canales próximos a expirar)

## Requirements

**Funcionales:**

- Audit entries Sheets con: `crm_type='sheets'`, `operation`, `field`, `old_value`, `new_value`, `decision` (blocked/updated/overwritten)
- Job cron `sheets-channel-renew` BullMQ ejecuta diariamente
- Para cada tenant con Sheets activo + `gsheet_channel_expiry < now + 24h`:
  - Llamar `drive.files.watch` con nuevo channelId
  - Persistir nuevo `gsheet_channel_id` + `gsheet_channel_expiry`
  - Stop del canal anterior
- Health check endpoint `/api/health/integrations/sheets` para monitoring externo

**No funcionales:**

- Cron idempotente: si ya se renovó hoy, skip
- Métricas: contador de renovaciones exitosas vs fallidas

## Architecture

```
Audit:
  Cada push o pull en 4-03/4-04 escribe en crm_write_audit con:
    - tenant_id, crm_type='sheets', lead_id
    - operation: 'push' | 'pull'
    - field, old_value, new_value (si overwrite)
    - decision: 'created' | 'updated' | 'blocked' | 'overwritten'
    - source: 'sheets-push.job' | 'sheets-pull.job'

Canal renew:
  BullMQ Repeatable Job "sheets-channel-renew" (cron diario 03:00)
    → query crm_connections WHERE crm_type='sheets' AND gsheet_channel_expiry < now() + 24h
    → para cada uno:
        - generar nuevo channelId (uuid)
        - drive.files.watch({ fileId: spreadsheetId, channelId, address: webhook_url, token })
        - update crm_connections SET gsheet_channel_id, gsheet_channel_expiry
        - drive.channels.stop(oldChannelId, oldResourceId)
        - audit entry "channel_renewed"
    → on error: log + audit "channel_renew_failed" + status='error'
```

## Related Code Files

**Crear:**

- `src/jobs/sheets-channel-renew.job.ts`
- `src/app/api/health/integrations/sheets/route.ts`

**Modificar:**

- `src/lib/integrations/sheets/sheets-adapter.ts` (helper para audit entries)
- `src/lib/jobs/scheduler.ts` (registrar el cron)

**Depende de:**

- `crm_write_audit` (Sprint 2)
- `crm_connections.gsheet_channel_*` (4-02)

## Implementation Steps

1. Helper `writeSheetsAuditEntry()` reusable desde push y pull jobs
2. Implementar `sheets-channel-renew.job.ts` con BullMQ Repeatable
3. Query tenants con canales próximos a expirar
4. Llamar `drive.files.watch` con nuevo channelId
5. Persistir nuevo channel + expiry
6. Stop del canal anterior con `drive.channels.stop`
7. Manejo de errores: 404 (canal ya expirado) vs 401 (revoked) vs 500
8. Audit entries de cada renovación
9. Endpoint health check `/api/health/integrations/sheets` (lista canales y expiraciones)
10. Test integration: simular expiración inminente y verificar renovación

## Todo List

- [ ] Helper `writeSheetsAuditEntry()`
- [ ] Verificar audit entries en push (4-03)
- [ ] Verificar audit entries en pull (4-04)
- [ ] BullMQ Repeatable job `sheets-channel-renew`
- [ ] Query tenants con expiración <24h
- [ ] Llamar `drive.files.watch` con nuevo channel
- [ ] Persistir nuevo channel + expiry
- [ ] Stop del canal anterior
- [ ] Manejo de errores tipo-discriminado
- [ ] Audit entry "channel_renewed" / "channel_renew_failed"
- [ ] Endpoint health check
- [ ] Test integration renovación
- [ ] Métrica simple (contador en log)

## Success Criteria

- Canal Drive renovado automáticamente día 6 (antes de TTL 7)
- 0 webhooks perdidos por canal expirado en 7 días continuos
- `crm_write_audit` contiene todas las decisiones de push/pull con campos correctos
- Health check responde 200 con info de canales activos
- Renovación fallida queda registrada y refleja `status='error'` en UI

## Risk Assessment

| Riesgo                                            | Prob  | Impacto | Mitigación                                            |
| ------------------------------------------------- | ----- | ------- | ----------------------------------------------------- |
| Cron no ejecuta (worker caído)                    | Baja  | Alto    | Alerta si último `channel_renewed` > 7d               |
| Stop del canal anterior falla pero watch nuevo OK | Media | Bajo    | Log warning, continuar (canales viejos expiran solos) |
| Drive `files.watch` rate-limited en bulk renew    | Baja  | Medio   | Throttle 1 req/s en el cron loop                      |

## Security Considerations

- Token de canal almacenado en `crm_connections.gsheet_channel_token` cifrado
- Cada tenant tiene su propio channelId y token (no compartidos)
- Health check sin info sensible (solo contadores)

## Next Steps

- Habilita 4-07 (tests integration) que valida audit + canal renew
- Cierra la espina dorsal de observabilidad del Sprint
