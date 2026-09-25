# Reporte de exploración — Adapter Zoho (Sprint 2) + patrón Sheets (Sprint 4)

> Generado 08-06-2026 para planificar Sprint 5 Zoho entrada de leads. Resumen del mapa de subsistemas.

## 1. Adapter Zoho existente (Sprint 2) — `src/lib/integrations/crm/`

| Archivo                             | Qué hace                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm/interface.ts`                  | Contrato `ICRMProvider` (getLead, searchLeads, createLead, updateLead, addTags, executeAction, createEvent, createTask) + tipos `CRMLead`, `CRMTokens`, `WriteContext`, `CRMCapabilities` |
| `crm/providers/zoho.ts`             | `ZohoCRMProvider implements ICRMProvider` — cliente Zoho CRM v8, multi-DC, 401→refresh retry, rate-limit 429, 5xx backoff                                                                 |
| `crm/providers/zoho-dc-detector.ts` | Detecta DC desde callback OAuth, `exchangeCodeForTokens`, `refreshAccessToken`                                                                                                            |
| `crm/token-manager.ts`              | Cache in-process + dedup refresh + writeback DB cifrado AES-256                                                                                                                           |
| `crm/factory.ts`                    | `CRMFactory.getProviderForIntegration(integrationId)`                                                                                                                                     |
| `crm/write-guard.ts`                | `applyWritePolicy()` (append_only / overwrite_with_audit) + audit rows                                                                                                                    |
| `crm/audit-query.ts`                | Helpers consulta `crm_write_audit`                                                                                                                                                        |
| `crm/server-actions.ts`             | `requireTenantId()`, `getIntegrationByProvider()`, schemas Zod                                                                                                                            |
| `crm/oauth/oauth-state.ts`          | HMAC-signed state CSRF OAuth                                                                                                                                                              |

**Clave:** El adapter Zoho **YA LEE leads**: `getLead(id)`, `searchLeads(criteria, page, perPage)`, `findLeadByEmail()`. OAuth multi-DC completo, tokens cifrados en `integrations.credentials_cipher`, `api_domain` en `integrations.metadata`. Lo que NO existe: flujo de pull periódico/por-evento + webhook Zoho entrante (`src/app/api/webhooks/zoho/` no existe).

## 2. Patrón Sheets (Sprint 4) — `src/lib/integrations/sheets/`

| Archivo               | Qué hace                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `adapter.ts`          | `GoogleSheetsAdapter` (readRows, writeCells, setupWatch). NO implementa ICRMProvider                              |
| `credentials.ts`      | Creds OAuth por tenant, cifradas                                                                                  |
| `pull-processor.ts`   | `processSheetPullJob()` — lee, hash idempotencia, INSERT/UPDATE lead, autorelleno, `orchestrator.handleNewLead()` |
| `outbox-processor.ts` | `runWritebackOutbox()` + `renewExpiringWatchChannels()`                                                           |
| `writeback.ts`        | `writeBackLeadChange()` — escribe cambios en Sheets conectadas                                                    |
| `queue.ts`            | BullMQ `sheets_pull_queue` + worker                                                                               |
| `row-mapper.ts`       | `mapRowToLead()`, `hashRow()` (column-letter based — NO reutilizable para Zoho)                                   |
| `phone-country.ts`    | `deriveCountryFromPhone()` (libphonenumber-js — SÍ reutilizable)                                                  |
| `actions.ts`          | 8 Server Actions (connect, mapping, toggle, disconnect, pull manual)                                              |

**UI:** `src/app/dashboard/settings/integrations/google-sheets/` — wizard 4 pasos + Google Picker + MappingEditor.

**Flujo PULL:** Drive push → `/api/webhooks/google-sheets` → `enqueueSheetPull` → worker → `processSheetPullJob`.
**Flujo WRITEBACK:** trigger SQL `trg_lead_writeback` → `sheets_writeback_outbox` → cron `/api/internal/sheets/cron` → `runWritebackOutbox` → `writeBackLeadChange`.
**Audit R-014:** `outbox-processor.ts:50` → `CrmWriteAuditRepository.create()` con `write_policy: overwrite_with_audit`.
**Autorelleno:** `pull-processor.ts:305` — `origen`, `tipo_lead`, `fecha_ingreso_crm`, `pais = deriveCountryFromPhone()`.

## 3. Migraciones SQL Sheets (a replicar)

- `20260527000000_sheet_connections.sql`: `sheet_connections` + `sheet_row_processed` + RLS.
- `20260527000002_sheets_writeback_trigger.sql`: `sheets_writeback_outbox` + trigger en `lead`.

## 4. Modelo compartido

- `integrations` (`crm_type IN ('hubspot','zoho','google_sheets',...)`, `credentials_cipher`, `metadata`, `data_center`). **Zoho ya tiene row aquí.**
- `crm_write_audit` — append-only, repo `CrmWriteAuditRepository`.
- `lead.current_stage` = `LeadStageEnum` (`QUALIFICATION|SCHEDULING|COMPLETED|DROPPED|UNREACHABLE`), `lead.origen` TEXT libre.

## Decisión de arquitectura clave

Zoho tiene **webhooks nativos** (Notifications API) **y** pull periódico (`searchLeads` por `Modified_Time`). Para un sprint de 10-15h: **implementar PULL periódico por cron** (el adapter ya lee) como base, y dejar webhook Zoho entrante como mejora opcional/posterior. El writeback usa `ZohoCRMProvider.updateLead()` (ya existe).

## REUTILIZAR vs CREAR

**Reutiliza directo:** `ZohoCRMProvider` (lectura+escritura), `token-manager`, `factory`, `write-guard`, `CrmWriteAuditRepository`, `phone-country.ts`, OAuth Sprint 2.
**Crear nuevo:** tabla `zoho_sync_connections`, tabla `zoho_lead_synced`, tabla `zoho_writeback_outbox` + trigger SQL, `zoho-pull/pull-processor.ts`, `zoho-pull/lead-mapper.ts`, `zoho-pull/writeback.ts`, `zoho-pull/queue.ts`, `zoho-pull/actions.ts`, cron `/api/internal/zoho-pull/cron`, UI `settings/integrations/zoho-pull/`, (opcional) webhook `/api/webhooks/zoho`.
