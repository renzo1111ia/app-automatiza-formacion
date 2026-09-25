---
title: "5-06 — Audit log + rate limit handling"
status: pending
priority: P2
estimation: 4-8h
phase_id: 5-06
sprint_id: SP-5
branch: feature/sprint-05-salesforce-adapter
created: 2026-05-21
---

# Phase 06 — Audit log + rate limit handling (5-06)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- Sprint 2 audit log: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-06-write-audit-y-visualizacion.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-03 + 5-04
- **Descripción:** Garantizar audit entries completas para todas las operaciones SF (push/pull) y gestionar `REQUEST_LIMIT_EXCEEDED` con queue + backoff + alerta de % cuota.

## Key Insights

- Salesforce expone `limits.dailyApiRequests` via REST `/services/data/vXX/limits/`
- Capturar `REQUEST_LIMIT_EXCEEDED` → pausar queue 5 min + alert
- Audit entries deben incluir `sf_environment` para distinguir sandbox vs prod
- API limit por Edition: Essentials 15k/día, Professional 100k/día, Enterprise 1M/día

## Requirements

**Funcionales:**

- Helper `writeSalesforceAuditEntry()` reusable desde push y pull
- Cron BullMQ que consulta `limits` endpoint diariamente y persiste % cuota
- Manejo de `REQUEST_LIMIT_EXCEEDED`:
  - Pausar cola del tenant 5 min
  - Audit entry "rate_limited"
  - Alerta visible en UI badge
- Métricas en log: `sf.push.success`, `sf.push.failed`, `sf.pull.success`

**No funcionales:**

- Cron diario sin sobrecargar API
- Logs sin payloads completos
- Alerts no spammear (1 por hora máx)

## Architecture

```
Audit entries (crm_write_audit):
  - tenant_id, crm_type='salesforce'
  - sf_environment ('sandbox'|'production')
  - object_type ('Lead'|'Contact'|'Opportunity')
  - operation: 'upsert'|'pull'
  - sf_object_id (Salesforce Id)
  - field, old_value, new_value
  - decision: 'created'|'updated'|'blocked'|'rate_limited'

Rate limit:
  BullMQ Repeatable "sf-limits-check" (cron 06:00 diario)
    → para cada tenant SF activo:
        - getJsforceConnection
        - GET /services/data/vXX/limits/
        - persist usage% en crm_connections.sf_api_usage_pct
        - si > 80% → audit "high_usage" + UI badge warning
```

## Related Code Files

**Crear:**

- `src/jobs/salesforce-limits-check.job.ts`
- `src/lib/integrations/salesforce/salesforce-audit-helper.ts`
- `src/db/migrations/2026XXXX_crm_connections_sf_api_usage.sql`

**Modificar:**

- `src/lib/integrations/salesforce/salesforce-adapter.ts` (catch REQUEST_LIMIT_EXCEEDED)
- `src/jobs/salesforce-push.job.ts` (pause queue on rate limit)

## Implementation Steps

1. Migration añadir `sf_api_usage_pct` + `sf_api_usage_checked_at` a `crm_connections`
2. Helper `writeSalesforceAuditEntry()` con todos los campos requeridos
3. Update push job (5-03) para usar el helper
4. Update pull job (5-04) para usar el helper
5. Catch `REQUEST_LIMIT_EXCEEDED` en adapter → throw `RateLimitError` (tipo común)
6. Push job: si `RateLimitError` → pause queue del tenant 5 min + audit
7. BullMQ Repeatable `sf-limits-check.job.ts` cron diario
8. Query `/services/data/vXX/limits/`
9. Persistir usage_pct + audit si > 80%
10. UI badge consume `sf_api_usage_pct` para warning

## Todo List

- [ ] Migration `sf_api_usage_pct`
- [ ] Helper `writeSalesforceAuditEntry()`
- [ ] Wire helper en push job
- [ ] Wire helper en pull job
- [ ] Catch `REQUEST_LIMIT_EXCEEDED` → RateLimitError
- [ ] Pause queue tenant 5 min en RateLimitError
- [ ] BullMQ Repeatable `sf-limits-check`
- [ ] Query limits endpoint
- [ ] Persist usage_pct
- [ ] Audit entry "high_usage"
- [ ] UI badge muestra usage
- [ ] Alert (log only) si > 90%

## Success Criteria

- Cada operación push/pull genera audit entry con campos correctos
- `REQUEST_LIMIT_EXCEEDED` no produce loss de datos (jobs reanudados tras pausa)
- `sf_api_usage_pct` actualizado diariamente
- UI badge muestra warning si > 80%

## Risk Assessment

| Riesgo                                  | Prob  | Impacto | Mitigación                                        |
| --------------------------------------- | ----- | ------- | ------------------------------------------------- |
| Cron limits-check falla silenciosamente | Baja  | Medio   | Health check endpoint que valida ultima ejecución |
| Pause queue no se reanuda               | Baja  | Alto    | Timer absoluto 5 min + healthcheck                |
| Audit overflow en bulk syncs            | Media | Bajo    | Batch insert si >100 entries por job              |

## Security Considerations

- Audit entries con valores parciales (truncar strings >500 chars)
- No log de access_token incluso en error traces
- RLS en `crm_write_audit`

## Next Steps

- Habilita 5-07 (tests sandbox)
