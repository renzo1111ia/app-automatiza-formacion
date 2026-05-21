---
title: "4-04 — Pull (Sheet → Esden) + conflict resolution R-014"
status: pending
priority: P2
estimation: 10-16h
phase_id: 4-04
sprint_id: SP-4
branch: feature/sp-4-google-sheets
created: 2026-05-21
---

# Phase 04 — Pull + conflict resolution R-014 (4-04)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` (sección Pull)
- R-014 (append-only write policy): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- [phase-03](phase-03-push-leads-bidireccional.md) — `_esden_updated_at` ya escrito por push

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-01 + 4-02 + 4-03 completos
- **Descripción:** Webhook `/api/webhooks/google-sheets` que recibe Drive push notifications, lee diff de la hoja, detecta edición manual (mtime > `_esden_updated_at` + 30s cooldown) y aplica conflict resolution R-014 al actualizar el lead.

## Key Insights

- Drive webhooks notifican QUE el archivo cambió, no QUÉ — hay que leer diff completo
- Distinguir push propio vs edición manual: si `_esden_updated_at` reciente (<30s) → ignorar
- Conflict resolution R-014:
  - Por defecto append-only: NO sobrescribir campos no vacíos
  - Excepción: campo configurado como `overwrite_with_audit` → sobrescribir + registrar
- Drive webhook tiene TTL 7 días → renovar día 6 (lo cubre 4-06)
- Idempotencia: el mismo webhook puede llegar varias veces → tabla `sync_events` con event_id

## Requirements

**Funcionales:**
- Endpoint `POST /api/webhooks/google-sheets` valida `X-Goog-Channel-Token`
- Pull job procesa async (BullMQ): lee filas, compara con BD, detecta cambios manuales
- Aplicar R-014 al actualizar lead (campo a campo según `write_policy`)
- Idempotency: tabla `sync_events` con clave única (resource_id, modified_time)
- Cooldown 30s post-push para evitar bucle

**No funcionales:**
- Latencia pull < 5 min
- Sin update si solo hubo push propio
- Logging de cada decisión de conflict resolution en `crm_write_audit`

## Architecture

```
Inbound:
  Drive POST /api/webhooks/google-sheets
    Headers: X-Goog-Channel-Token, X-Goog-Resource-Id, X-Goog-Message-Number
    → validate channel token (match con crm_connections.gsheet_channel_id)
    → enqueue BullMQ "sheets-pull" job (tenantId, resourceId)
    → respond 200 inmediato

BullMQ worker sheets-pull:
  → check sync_events tabla → si event_id ya procesado → return
  → drive.files.get → modifiedTime
  → si modifiedTime < lastSyncTime → return
  → sheets.values.get → leer todas las filas
  → para cada fila:
      - si _esden_updated_at > (now - 30s) → skip (push propio reciente)
      - leer lead de BD por lead_id
      - diff campo a campo
      - aplicar R-014:
          * write_policy = append_only + campo BD no vacío → skip + audit "blocked"
          * write_policy = append_only + campo BD vacío → update
          * write_policy = overwrite_with_audit → update + audit "overwrite"
      - persist lead actualizado
  → marcar event procesado en sync_events
```

## Related Code Files

**Crear:**
- `src/app/api/webhooks/google-sheets/route.ts`
- `src/jobs/sheets-pull.job.ts`
- `src/lib/integrations/sheets/sheets-conflict-resolver.ts`
- `src/db/migrations/2026XXXX_sync_events_table.sql` (si no existe ya)

**Depende de:**
- `src/lib/integrations/sheets/sheets-adapter.ts` (4-03)
- Write policy R-014 ya generalizada en Sprint 2

## Implementation Steps

1. Migration tabla `sync_events` (id, tenant_id, source, event_key UNIQUE, processed_at)
2. Implementar route handler webhook con validación de token de canal
3. Implementar BullMQ worker `sheets-pull.job.ts`
4. Implementar `sheets-conflict-resolver.ts` con lógica R-014 por campo
5. Diff campo a campo con `fieldMappings` del tenant
6. Cooldown 30s check con `_esden_updated_at`
7. Persistir lead via repository
8. Log de cada decisión en `crm_write_audit` (blocked / updated / overwritten)
9. Tests unitarios para conflict resolver (todos los casos R-014)
10. Test integration: simulación de webhook con spreadsheet real

## Todo List

- [ ] Migration tabla `sync_events`
- [ ] Route `/api/webhooks/google-sheets` con token validation
- [ ] Response 200 inmediato + enqueue
- [ ] BullMQ worker `sheets-pull.job.ts`
- [ ] Idempotency check via `sync_events`
- [ ] Lectura diff hoja vs BD
- [ ] Cooldown 30s post-push
- [ ] `sheets-conflict-resolver.ts` con R-014
- [ ] Branch `append_only` + campo no vacío → skip
- [ ] Branch `overwrite_with_audit` → update + audit
- [ ] Persist lead actualizado
- [ ] Audit log entries por decisión
- [ ] Tests unit conflict resolver (≥6 escenarios)
- [ ] Test integration con spreadsheet real

## Success Criteria

- Edición manual en Sheet refleja en lead < 5 min
- Push propio NO dispara pull (cooldown funciona)
- Conflict resolution R-014 aplica correctamente en append_only y overwrite_with_audit
- Webhook duplicado no produce doble update (idempotency)
- 0 bucles push/pull detectados en stress test

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Bucle push/pull si cooldown insuficiente | Media | Alto | Cooldown 30s + comparación `_esden_updated_at` |
| Webhook duplicado | Alta | Bajo | Tabla `sync_events` con UNIQUE constraint |
| Diff costoso en hojas grandes (>10k filas) | Baja | Medio | Leer solo rango con modifiedRange si disponible |
| Token de canal compartido entre tenants | Baja | Alto | Validación estricta tenant_id vs channel_id |

## Security Considerations

- Validación `X-Goog-Channel-Token` obligatoria — rechazar si no match
- Endpoint webhook no requiere auth de usuario pero sí token de canal
- RLS en queries de leads (worker corre con service_role pero filtra por tenant_id explícito)
- No exponer error stack traces en response 200

## Next Steps

- Habilita 4-05 (UI admin) que muestra estado de sync
- Habilita 4-06 (audit log + renew canal) que consume `crm_write_audit`
