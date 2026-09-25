## Resumen

Sprint 4 entrega la **integración bidireccional con Google Sheets por tenant**: los leads originados en una hoja se sincronizan al CRM (pull por webhook ~15s) y los cambios de stage del lead se reflejan de vuelta en la hoja (writeback con audit R-014).

## Highlights

- 🔄 Flujo **bidireccional completo** Sheet ↔ CRM, validado end-to-end con OAuth real + ngrok (03-06-2026).
- 🔐 **OAuth Google por tenant** con tokens cifrados AES-256-GCM + state HMAC-SHA256 verificado en tiempo constante.
- 🧙 **Wizard de 4 pasos** + Google Picker multi-sheet + editor de mapeo de columnas.
- 📝 **Writeback automático** vía outbox + cron, con audit R-014 append-only (`overwrite_with_audit`).
- 🧩 **Autorelleno de campos**: origen, fecha_ingreso_crm, tipo_lead, país por prefijo telefónico; semáforo de columna AF.
- 🛡️ **Endurecimiento de seguridad en el cierre**: cron Sheets fail-closed en producción + writeback `RAW` (anti formula injection).

## Detalle por área

### Capa de datos / Backend

- Adapter Sheets API, queue + worker, webhook de pull, pull-processor, outbox-processor de writeback, row-mapper, credentials por tenant, sesión y tipos (`src/lib/integrations/sheets/*`).
- Trigger SQL que encola en `sheets_writeback_outbox` cuando un lead originado de Sheet cambia campos relevantes.

### Frontend

- Página `/dashboard/settings/integrations/google-sheets` con wizard, `GooglePickerButton`, `SheetMappingEditor`, `SheetsWizardClient`.
- Ajuste CSP para permitir Google Picker.

### Seguridad (security delta CLOSE-1.5 — OWASP 2021)

- Auditados 21 archivos: **0 CRÍTICO**, 1 ALTO, 4 MEDIO, 4 BAJO, 3 INFO.
- **SEC-S4-01 (ALTO) FIXED**: `authorize()` del cron Sheets ahora fail-closed en producción + `timingSafeEqual`.
- **SEC-S4-07 (MEDIO) FIXED**: `writeCells` usa `valueInputOption: RAW` en lugar de `USER_ENTERED`.
- Report completo: `plans/reports/security-delta-sprint-4-20260608.md`.

## Breaking changes

- NINGUNO.

## Migraciones SQL

- `supabase/migrations/20260527000000_sheet_connections.sql`
- `supabase/migrations/20260527000002_sheets_writeback_trigger.sql`
- `supabase/migrations/20260603100000_*` (campos autogenerados leads — aplicada en local; **pendiente VPS pre-deploy**).

## Variables de entorno nuevas

- `CRON_SECRET` — **obligatoria en producción** (el endpoint `/api/internal/sheets/cron` es fail-closed sin ella). Generar con `openssl rand -base64 48`. Configurar en panel Dokploy (Environment).
- Credenciales OAuth Google por tenant (Client ID/Secret) — almacenadas cifradas en BD, no en env.

## Tareas RoadMap cerradas

- Sprint 4 (Fase 4) — SPIKE-PULL 1..9 + cierre formal CLOSE-1/1.5/2/4.

## Tareas diferidas

- BUG-4-XX (MEDIO, backlog): channel_token de webhook con comparación no constant-time.
- BUG-4-XX (MEDIO, backlog): PII de leads en `error.message` propagados a UI / `last_sync_error`.
- Migración VPS de campos autogenerados (`20260603100000`) — pre-deploy.

## ADRs aprobados

- Ninguno nuevo en este release (Sheets sigue el patrón de adapter ya definido en Sprint 2).

## Contribuidores

- Javi HP (desarrollo + cierre).

## Commits incluidos

```text
320cc49 chore(release): cerrar Sprint 4 Google Sheets v0.4.0
3f15f09 Merge fix(deploy): docs/*.md en imagen standalone (BUG-4-07 VPS)
60810d4 fix(deploy): incluir docs/*.md en imagen standalone (BUG-4-07 en VPS)
f89aab9 Merge Sprint 4 Google Sheets: flujo bidireccional + fix cross-tenant
5010dd9 chore(scripts): helper apply-vps-migration para pg-meta REST
19d1f4d fix(sheets): conexión OAuth Google por tenant activo (cross-tenant)
0d8aa64 fix(ci): regenerar package-lock con npm 10 (Node 22, paridad runner)
119d939 fix(ci): resincronizar package-lock con deps WASM de @tailwindcss/oxide
2303ea0 Merge PR #23: SP-7-DEPS-AUDIT-26 — deps audit (25→4 vulns, −84%) + CI gate fix
0198411 ci(security): gate npm audit determinista — solo high/critical bloquean
e8a2463 feat(sheets): SPIKE pull-8 E2E real — flujo bidireccional Google Sheets
141b352 docs(close): cerrar SP-7-DEPS-AUDIT-26 + run E2E VPS 03-06 (PASS)
04c7f59 fix(e2e): determinismo en test token-crypto authTag tamper
73f1610 docs(adr): cerrar SP-7-DEPS-AUDIT-26 en ADR-018 + actualizar RoadMap
1191bfd chore(deps): SP-7-DEPS-AUDIT-26 — 25 → 4 vulns (-84%)
```

## Validación

- CLOSE-1 🟢: typecheck 0 · lint 0 · build OK · tests **321/325** (4 skip, 0 fail).
- CLOSE-1.5 🟢: security delta sin críticos; 2 findings fixed in-session.
- CLOSE-2 🟢: **20/20** specs E2C Playwright local (4 nuevos Sprint 4 + smoke + regresión Sprint 3).
- Flujo funcional completo validado manualmente E2E con OAuth real (03-06-2026, 14 leads en BD).

## Próximos pasos

- **SP-4B Validación Pre-MVP** (Renzo) → cierra **MVP GA `v0.3.0`**.
- No se promociona a `staging`/`main` sin orden explícita del usuario.
