---
title: "5-01 — Google Sheets bidireccional"
sprint_task: 5-01
status: pending
priority: P2
effort: 60-100h
branch: feature/sp-5-01-google-sheets
version_bump: v0.5.0
agents: [esden-agents:code, esden-agents:api]
---

# 5-01 — Google Sheets bidireccional

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- [researcher-google-sheets-e-20260520.md](../reports/researcher-google-sheets-e-20260520.md) — research técnico
- [ADR dependencias](../reports/adr-auditoria-dependencias-20260520.md) — sección Sprint 5 Sheets
- [Sprint 3 plan](../260520-1342-sprint-3-adapter-hubspot-zoho/plan.md) — IntegrationAdapter base

## Overview

- **Prioridad**: P2 (primera fase post-MVP por valor diferencial: academias con procesos Excel/Sheets)
- **Estado**: Pendiente — bloqueado por Sprint 3 completado
- **Descripción**: Sincronización bidireccional entre leads de Esden y Google Sheets. Push (Esden → Sheet) via BullMQ. Pull (Sheet editado manualmente → Esden) via Drive push notifications + reconciliación.

## Key Insights

- `googleapis@171.4.0` YA INSTALADO — **CERO dependencias nuevas**
- Scopes mínimos: `spreadsheets` + `drive.file`
- Drive push notifications tienen TTL 7 días — requiere renovación automática
- Idempotencia crítica: campo `_esden_updated_at` en Sheet evita bucles push/pull
- Batching obligatorio para mantenerse dentro de cuota (300 reads/min, ~1000 writes/min)
- Drive webhooks notifican que el archivo cambió pero no qué cambió — hay que leer diff completo

## Requirements

**Funcionales:**
- Push: lead actualizado en Esden → fila actualizada/creada en Sheet (< 5 min latencia)
- Pull: fila editada manualmente en Sheet → lead actualizado en Esden (< 5 min via webhook)
- Template: copia de plantilla maestra al activar integración por tenant
- Field mapping configurable por tenant (qué columnas del Sheet → qué campos Esden)
- UI admin: activar/desactivar, elegir spreadsheetId, ver estado de sincronización

**No funcionales:**
- Multi-tenant: cada academia con sus propias credenciales OAuth y su propio spreadsheet
- Idempotente: mismo lead no crea duplicados en Sheet
- Resiliente: 429 → exponential backoff; token expirado → auto-refresh
- Auditable: cada sync registrado en `crm_write_audit`

## Architecture

### Data flows

**Push (Esden → Sheet):**
```
lead.updated event
  → BullMQ job: sheets-push
    → GoogleSheetsAdapter.upsertLead(tenantId, lead)
      → OAuth2Client con refresh token del tenant
      → sheets.values.get(range) para buscar row por lead_id
      → Si existe: sheets.values.update → set _esden_updated_at
      → Si no existe: sheets.values.append → con _esden_updated_at
      → Log en crm_write_audit
```

**Pull (Sheet → Esden):**
```
Drive push notification → POST /api/webhooks/google-sheets
  → Verificar token de canal en header X-Goog-Channel-Token
  → drive.files.get para obtener modifiedTime
  → Si modifiedTime > ultima_sync → leer filas con sheets.values.get
  → Comparar _esden_updated_at: si cambio es manual → update lead en DB
  → BullMQ job para procesar async
```

**Renovación canal Drive:**
```
BullMQ cron (cada 6 días)
  → Para cada tenant con Sheets activo:
    → drive.files.watch({ fileId, ... }) con nuevo channelId
    → Actualizar channel_id + expiry en crm_connections
```

### Componentes nuevos
- `src/lib/integrations/sheets/sheets-adapter.ts`
- `src/lib/integrations/sheets/sheets-oauth.ts`
- `src/lib/integrations/sheets/sheets-field-mapper.ts`
- `src/app/api/webhooks/google-sheets/route.ts`
- `src/app/api/oauth/google/callback/route.ts`
- `src/jobs/sheets-push.job.ts`
- `src/jobs/sheets-channel-renew.job.ts`

### Componentes reutilizados (Sprint 3)
- `IntegrationAdapter` base interface
- `crm_connections` tabla (agregar columnas Sheets-específicas)
- `crm_write_audit` tabla
- UI admin connection modal (extender para Sheets)
- Write policy R-014

## Related Code Files

**Crear:**
- `src/lib/integrations/sheets/sheets-adapter.ts`
- `src/lib/integrations/sheets/sheets-oauth.ts`
- `src/lib/integrations/sheets/sheets-field-mapper.ts`
- `src/lib/integrations/sheets/sheets-template.ts`
- `src/app/api/webhooks/google-sheets/route.ts`
- `src/app/api/oauth/google-sheets/callback/route.ts`
- `src/jobs/sheets-push.job.ts`
- `src/jobs/sheets-channel-renew.job.ts`
- `src/components/integrations/sheets-connection-form.tsx`

**Modificar:**
- `src/lib/integrations/adapter-factory.ts` (registrar sheets adapter)
- `src/db/migrations/` (columnas Sheets en crm_connections: `spreadsheet_id`, `channel_id`, `channel_expiry`)

## Implementation Steps

1. **DB migration**: añadir columnas `spreadsheet_id`, `gsheet_channel_id`, `gsheet_channel_expiry`, `gsheet_template_id` a `crm_connections` donde `crm_type = 'sheets'`
2. **OAuth2**: implementar `sheets-oauth.ts` — flow completo + refresh automático + persistencia en DB
3. **SheetsAdapter**: implementar `upsertLead()` con lógica find-by-id + append/update + `_esden_updated_at`
4. **Template**: implementar `sheets-template.ts` — copiar template al activar integración
5. **Push job**: `sheets-push.job.ts` — registrar en BullMQ, escuchar `lead.updated`
6. **Webhook pull**: `POST /api/webhooks/google-sheets` — validar token canal, leer diff, detectar edición manual
7. **Renovación canal**: `sheets-channel-renew.job.ts` — BullMQ cron cada 6 días
8. **Field mapper**: `sheets-field-mapper.ts` — columna por letra vs nombre de columna
9. **UI**: formulario de conexión en admin — OAuth consent, spreadsheetId, mapping de columnas
10. **Tests**: contract test + integration test con spreadsheet real de prueba
11. **Cierre**: typecheck + lint + build + browser test del flujo completo

## Todo

- [ ] DB migration crm_connections columnas Sheets
- [ ] OAuth2 flow Google (consent screen + callback)
- [ ] SheetsAdapter.upsertLead() — find row + append/update
- [ ] Template copy al activar integración
- [ ] BullMQ job sheets-push (lead.updated → push)
- [ ] Webhook pull /api/webhooks/google-sheets
- [ ] Idempotency: _esden_updated_at check
- [ ] Canal Drive watch + renovación cron
- [ ] FieldMapper Sheets (columnas configurables)
- [ ] UI admin: formulario conexión Sheets
- [ ] Tests: unit + integration
- [ ] Docs: guía configuración para academia

## Success Criteria

- Lead actualizado en Esden → fila en Sheet actualizada en < 5 min
- Fila editada manualmente en Sheet → lead en Esden actualizado en < 5 min (vía webhook)
- Sin duplicados en Sheet para el mismo lead
- Sin bucle infinito push/pull con campo `_esden_updated_at`
- Token OAuth expirado se renueva automáticamente sin error en producción
- Canal Drive renovado antes de expirar (TTL 7 días, renovar día 6)
- All tests pass: typecheck + lint + build

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Bucle push/pull infinito | Media | Alto | Campo `_esden_updated_at` + cooldown 30s obligatorio |
| Canal Drive expirado silenciosamente | Alta | Medio | BullMQ cron día 6 + alerta si renovación falla |
| Cuota 429 Sheets | Baja-Media | Medio | Batch writes + exponential backoff en BullMQ retry |
| OAuth revocado por usuario | Media | Medio | Detección 403 → marcar `status='revoked'` + notificar admin |
| Template mal configurado por tenant | Media | Bajo | Validar columnas requeridas al activar integración |

## Security Considerations

- Tokens OAuth almacenados cifrados en `crm_connections` (usar columna `encrypted_credentials`)
- Webhook URL pública — validar `X-Goog-Channel-Token` en cada request
- Scope mínimo `drive.file` — no `drive` completo
- No loggear tokens en application logs
- RLS: tenant solo accede a sus propias `crm_connections`

## Next Steps

- Bloqueado por: Sprint 3 completado (IntegrationAdapter base)
- Desbloquea: 5-05 (generalización) cuando se completan 5-01..5-04
- Puede ejecutarse en paralelo con 5-02, 5-03, 5-04 (archivos distintos)
