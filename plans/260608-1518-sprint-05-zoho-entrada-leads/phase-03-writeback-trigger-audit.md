# Fase 03 — Writeback bidireccional + trigger + audit R-014

**Contexto:** [plan.md](plan.md) · referencia `src/lib/integrations/sheets/writeback.ts` + `outbox-processor.ts` · reutiliza `ZohoCRMProvider.updateLead()` + `CrmWriteAuditRepository` + `write-guard.ts`

## Overview

- **Prioridad:** P1
- **Estado:** 🔘 Pendiente · depende de Fase 01 (outbox + trigger) y Fase 02 (idempotencia)
- **Estimación:** 2-3h
- Implementar la dirección de salida bidireccional: cuando un lead interno (originado en Zoho) cambia de stage, propagar el cambio de vuelta a Zoho con audit R-014.

## Key Insights

- El trigger SQL (Fase 01) ya llena `zoho_writeback_outbox`. Esta fase procesa ese outbox.
- Se reutiliza `ZohoCRMProvider.updateLead(leadId, data)` (Sprint 2) — no se escribe cliente nuevo.
- Audit R-014 reutiliza `CrmWriteAuditRepository.create()` con `crm_type='zoho'`, `write_policy='overwrite_with_audit'`.
- **Anti-bucle crítico**: el writeback NO debe disparar un nuevo pull que vuelva a escribir. Comparar timestamps + flag de origen.

## Requirements

**Funcionales:**

- Procesar batch de `zoho_writeback_outbox` (status=pending), por cada uno llamar `updateLead` en Zoho con los campos cambiados.
- Registrar fila en `crm_write_audit` por cada escritura exitosa.
- Re-encolar con backoff si falla; marcar `failed` al llegar a MAX_ATTEMPTS.
- Respetar `writeback_enabled` de la conexión.

**No funcionales:** best-effort en el audit (si falla el audit, no revertir la escritura ya hecha). Logging estructurado.

## Related Code Files

**Crear:**

- `src/lib/integrations/zoho-pull/writeback.ts` — `writeBackLeadChangeToZoho(tenantId, leadId, {changes})`: resuelve `zoho_lead_id` desde `zoho_lead_synced`, mapea cambios AF → campos Zoho, `provider.updateLead()`, devuelve `WrittenAudit[]`.
- `src/lib/integrations/zoho-pull/outbox-processor.ts` — `runZohoWritebackOutbox()`: reclama batch, procesa, audit, marca done/failed.

> **Nota:** el endpoint cron que dispara `runZohoWritebackOutbox()` se crea en la **Fase 05b** (`/api/internal/zoho-pull/cron`), donde se orquesta junto con la renovación de suscripción y la reconciliación diaria. Esta fase deja `runZohoWritebackOutbox()` listo para ser invocado desde ahí.

**Leer para contexto:**

- `src/lib/integrations/sheets/writeback.ts` + `outbox-processor.ts` (patrón exacto).
- `src/app/api/internal/sheets/cron/route.ts` (patrón cron fail-closed + timingSafeEqual — ya endurecido en Sprint 4 CLOSE-4).
- `src/lib/integrations/crm/write-guard.ts` (`applyWritePolicy`).
- `src/lib/repositories/integrations-repository.ts` (`CrmWriteAuditRepository`).

## Architecture

```
lead UPDATE (stage) ──trigger SQL──► zoho_writeback_outbox (pending)
                                            │
cron /api/internal/zoho-pull/cron ─► runZohoWritebackOutbox()
   (CRON_SECRET, fail-closed prod)          │ reclama batch
                                            ▼
                          writeBackLeadChangeToZoho(tenant, lead, changes)
                                            │
                  zoho_lead_synced: lead_id → zoho_lead_id
                                            │
                  applyWritePolicy(overwrite_with_audit)
                                            │
                  ZohoCRMProvider.updateLead(zoho_lead_id, mappedFields)
                                            │
                  CrmWriteAuditRepository.create({crm_type:'zoho', ...})  (R-014)
                                            │
                  outbox → done | failed(attempts++)
```

## Implementation Steps

1. **`writeback.ts`**: `writeBackLeadChangeToZoho()` — buscar `zoho_lead_id`; si la conexión tiene `writeback_enabled=false`, skip; mapear `changes` (campos AF) → campos Zoho (inverso del `field_mapping`); `applyWritePolicy()`; `provider.updateLead()`; devolver detalle para audit.
2. **`outbox-processor.ts`**: clonar `runWritebackOutbox()` de Sheets — claim en 2 pasos (SELECT ids pending + UPDATE processing), por cada uno `writeBackLeadChangeToZoho()`, audit R-014, marcar done; re-encolar `pending` con `attempts+1` si falla; `failed` al llegar MAX_ATTEMPTS.
3. **cron route**: copiar `sheets/cron/route.ts` **con el fix de seguridad ya aplicado** (fail-closed en producción + `timingSafeEqual`). Disparar writeback + pull.
4. **Anti-bucle**: al hacer `updateLead` desde writeback, registrar el timestamp; el pull processor (Fase 02) ignora cambios de Zoho cuyo `Modified_Time` ≈ el último writeback propio.
5. typecheck + lint.

## Todo List

- [ ] `writeback.ts` (`writeBackLeadChangeToZoho` + mapeo inverso + write-guard)
- [ ] `outbox-processor.ts` (`runZohoWritebackOutbox` + claim batch + audit R-014 + retry)
- [ ] cron route `/api/internal/zoho-pull/cron` (fail-closed prod + timingSafeEqual)
- [ ] Guard anti-bucle pull↔writeback
- [ ] typecheck + lint verdes

## Success Criteria

- Cambiar `current_stage` de un lead Zoho → el cambio aparece en Zoho (vía updateLead).
- `crm_write_audit` registra la escritura con `crm_type='zoho'`, `write_policy='overwrite_with_audit'`.
- NO se produce bucle infinito pull↔writeback.
- El cron es fail-closed en producción sin `CRON_SECRET`.

## Risk Assessment

- **Bucle pull↔writeback** (riesgo #1): mitigado por guard de timestamp + flag origen (Fase 01 trigger + Fase 02 pull).
- **Audit fallido tras escritura exitosa**: best-effort (loguear, no revertir) — igual que Sheets.

## Security Considerations

- Cron endpoint **fail-closed en producción** (replicar SEC-S4-01 ya corregido en Sprint 4).
- `CRON_SECRET` obligatorio en prod (ya documentado en `.env.example`).
- Comparación de secreto con `timingSafeEqual`.

## Next Steps

- Fase 04 añade la UI para que el tenant configure la conexión de entrada + dispare pull manual.
