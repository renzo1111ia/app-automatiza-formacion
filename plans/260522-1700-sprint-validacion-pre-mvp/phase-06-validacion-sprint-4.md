# Fase 06 — Validación Sprint 4 (Google Sheets pull/writeback bidireccional)

> **Creado 03-06-2026** tras sesión SPIKE Pull-8 E2E real. Hand-off para que Renzo
> valide Sprint 4 contra VPS. Sprint 4 es post-MVP (Sheets) pero se documenta su
> validación siguiendo el protocolo de cierre del proyecto.

## Context Links

- [Sprint 4 plan](../260521-0000-sprint-4-google-sheets/PENDIENTES-POST-CLEAR-030626.md)
- [Runbook E2C local](../../tests/e2e/sheets/sheets-e2c-local-runbook.md)
- [Runbook DEPLOY VPS](../260521-0000-sprint-4-google-sheets/DEPLOY-SPRINT4-VPS.md) — **leer antes de promover**
- [Guía setup tenant](../../docs/integrations/google-sheets-setup-tenant.md)

## Overview

- **Sprint validado**: Sprint 4 — Google Sheets como CRM (pull + writeback + audit R-014).
- **Branch origen**: `feature/sprint-04-google-sheets`.
- **Estado**: 🟡 Validado E2E en LOCAL (03-06-2026). Pendiente validación VPS por Renzo.
- **Tester**: Renzo + equipo.

## 1. Comandos de test automático

```bash
cd worktrees/sprint-04-google-sheets
npm run typecheck    # exit 0
npm test             # 278 pass (4 skipped)
npm run build        # exit 0
# lint: baseline preexistente ~105 (NO de este sprint). Sin regresión nueva.
```

## 2. Tests unitarios añadidos en Sprint 4

- `tests/unit/sheets/pull-processor.test.ts` (4 tests): INSERT lead nuevo, SKIP
  idempotente, UPDATE en edición (BUG-4-08), semáforo AF 🔴→🟢.
- `tests/unit/sheets/outbox.test.ts` (actualizado): claim en 2 pasos (BUG-4-06).

## 3. Flujos validados E2E en local (a re-validar en VPS)

| Flujo                  | Cómo probar en VPS                                  | Esperado                                                              |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| **Pull automático**    | Conectar Sheet → añadir fila                        | Lead en `/dashboard/historial` < 1 min, `current_stage=QUALIFICATION` |
| **Idempotencia**       | Re-sync misma Sheet                                 | 0 leads nuevos                                                        |
| **Editar fila**        | Cambiar un dato de fila ya importada                | Lead ACTUALIZADO (no duplicado) — BUG-4-08                            |
| **Writeback**          | Cambiar `current_stage` de un lead con origen Sheet | Celda Estado actualizada en Sheet + fila en `crm_write_audit`         |
| **Autorelleno Estado** | Añadir fila con Estado vacío                        | Celda Estado ← QUALIFICATION en la Sheet                              |
| **Semáforo AF**        | (si tenant tiene `status_column`)                   | Columna AF: 🔴 al procesar, 🟢 al terminar                            |

## 4. Checklist manual del dev (derivado de E2C local)

- [ ] Login + tenant ready.
- [ ] Wizard Sheets: credenciales cifradas (Step 1), OAuth conectado (Step 2), Sheet + watch (Step 3).
- [ ] Ver leads en `/dashboard/historial` con su `current_stage`.
- [ ] WCAG del wizard ≥ 95 (pendiente Lighthouse).

## 5. BUGs detectados y corregidos en el SPIKE (verificar no-regresión en VPS)

| ID          | Descripción                                                 | Fix                              |
| ----------- | ----------------------------------------------------------- | -------------------------------- |
| BUG-4-03    | Worker sheets-pull no arrancaba                             | `instrumentation.ts`             |
| BUG-4-04/05 | Columnas fantasma `current_stage`/advisor                   | migración `20260603100000`       |
| BUG-4-06    | Outbox claim: order+limit en UPDATE (PostgREST)             | claim 2 pasos                    |
| BUG-4-07    | Guía setup 404                                              | ruta `/docs/integrations/[slug]` |
| BUG-4-08    | Editar fila duplicaba lead                                  | UPDATE en vez de INSERT          |
| BUG-4-09    | `removeOnComplete:{count}` bloqueaba jobId → 2º cambio mudo | `removeOnComplete: true`         |

## 6. Variables de entorno nuevas para VPS

Ver detalle en [DEPLOY-SPRINT4-VPS.md](../260521-0000-sprint-4-google-sheets/DEPLOY-SPRINT4-VPS.md) §2.
Ninguna NUEVA respecto a Sprint 1/2 salvo confirmar `NEXT_PUBLIC_APP_URL` = HTTPS
público real (Drive solo notifica a HTTPS), `REDIS_URL` accesible para el worker.

## 7. Notas de despliegue (CRÍTICO — orden)

1. **Migración `20260603100000` PRIMERO** (con backfill, idempotente). Verificar columnas + backfill + `NOTIFY pgrst`.
2. Migraciones preexistentes corregidas también en VPS (help_sections, campaigns, writeback_trigger, crm_write_audit).
3. Código después.
4. Columna AF: configuración por-tenant (`status_column`), opcional, no global.
5. Leads históricos: backfilleados por la migración (no se pierde `status`).

Detalle completo + rollback en el runbook DEPLOY-SPRINT4-VPS.md.

---

> Generado 03-06-2026. Estado: 🟡 local-validado, pendiente VPS.
