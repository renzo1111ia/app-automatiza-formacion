# Sprint 4 — SPIKE Pull-only Google Sheets (Draft)

## Resumen

Spike incremental del Sprint 4 (Google Sheets bidireccional, post-MVP, target v0.5.0). Entrega el backend Pull-only end-to-end + UI wizard 4 pasos con Google Picker multi-hoja + framework de write-back automatizado (trigger SQL + outbox + cron). Trabajo realizado sobre un git worktree dedicado (`worktrees/sprint-04-google-sheets/`) sin tocar `developer`. **NO se mergea con este PR** — se abre en Draft para revisión incremental hasta cerrar la subtarea 8 (Full E2E con OAuth real Google + ngrok) y el protocolo CLOSE-1..5.

## Highlights

- **Backend Sheets adapter completo**: 3 SQL migrations + `GoogleSheetsAdapter` (readRows / writeCells / setupWatch) + BullMQ queue+worker + webhook `/api/webhooks/google-sheets`.
- **UI wizard 4 pasos** en `/dashboard/settings/integrations/google-sheets`: credenciales OAuth → Picker multi-hoja → mapping editor → activación.
- **Catálogo de mapping**: campos `lead` + `lead_cualificacion` + `metadata` con `ColumnMappingSchema` (Zod) y `row-mapper` testeado.
- **Write-back framework**: trigger SQL `sheet_writeback_queue` + outbox processor + cron interno (`/api/internal/sheets/cron`) listo para activar cuando se cierre el bucle bidireccional.
- **Credenciales por tenant**: cada academia trae su propio Google Cloud Project (Client ID/Secret cifrados AES-256). Documentado en `tests/e2e/sheets/sheets-spike-manual-runbook.md`.
- **48/48 tests sheets verdes** (credentials + outbox + row-mapper + types). Suite completa 268/272.
- **CSP runtime fix** para Google Picker (validado en navegador) + screenshot smoke test del wizard.
- **Aislamiento técnico**: trabajo en worktree dedicado con dev server propio (puerto 8501) — no interfiere con desarrollo paralelo en `auditoria-v2-medio-proyecto` ni Sprint 3 mergeado.

## Detalle por área

### Backend (capa de datos + adapter)

- **SQL migrations**:
  - `20260527000000_sheet_connections.sql` — tabla `sheet_connections` (tenant_id, spreadsheet_id, sheet_tab_name, purpose, column_mapping JSON, watch fields, RLS multi-tenant).
  - `20260527000001_integrations_tenant_oauth_app.sql` — añade `app_client_id_cipher` + `app_client_secret_cipher` a `integrations` (credenciales OAuth por tenant).
  - `20260527000002_sheets_writeback_trigger.sql` — trigger pl/pgsql + cola `sheet_writeback_queue` + outbox.
- **Sheets adapter** (`src/lib/integrations/sheets/`): `adapter.ts`, `credentials.ts`, `queue.ts`, `pull-processor.ts`, `outbox-processor.ts`, `row-mapper.ts`, `session.ts`, `types.ts`, `writeback.ts`, `actions.ts` (8 server actions).
- **Webhook** `/api/webhooks/google-sheets` con verificación Drive channel token + idempotencia.
- **Cron interno** `/api/internal/sheets/cron` para procesar outbox de write-back.

### Frontend (UI wizard)

- `/dashboard/settings/integrations/google-sheets/page.tsx` (Server Component).
- `SheetsWizardClient.tsx` (Client, 464 líneas) — 4 steps: credenciales → Picker → mapping → activar.
- `GooglePickerButton.tsx` (217 líneas) — integración Picker multi-hoja.
- `SheetMappingEditor.tsx` (239 líneas) — drag & drop columnas Sheet → campos `lead` / `lead_cualificacion` / `metadata`.
- `picker-actions.ts` — server action de session token para Picker (sin exponer Client ID al cliente).

### Tests + docs

- 48 unit tests sheets (vitest): `credentials.test.ts`, `outbox.test.ts`, `row-mapper.test.ts`, `types.test.ts`.
- `tests/e2e/sheets/sheets-spike-manual-runbook.md` — runbook E2E manual paso a paso (registro Cloud Console tenant → conexión OAuth → conectar Sheet → pull → write-back).
- Docs en `plans/260521-0000-sprint-4-google-sheets/`: guía Cloud Console tenant, tracking tiempos, subtareas SPIKE-PULL desglosadas.

## Breaking changes

NINGUNO. Todo el código nuevo está aislado en `/dashboard/settings/integrations/google-sheets/`, `src/lib/integrations/sheets/`, `/api/webhooks/google-sheets`, `/api/internal/sheets/cron`. Las migraciones añaden tablas y columnas nuevas (`sheet_connections`, `sheet_writeback_queue`, `integrations.app_client_id_cipher`, `integrations.app_client_secret_cipher`) sin tocar esquemas existentes.

## Migraciones SQL

- `supabase/migrations/20260527000000_sheet_connections.sql`
- `supabase/migrations/20260527000001_integrations_tenant_oauth_app.sql`
- `supabase/migrations/20260527000002_sheets_writeback_trigger.sql`

Aplicación: local OK (Supabase self-hosted dev). **VPS pendiente** — diferido a SP-4B (validación pre-MVP) según política "local-aplicable vs pre-deploy" del CLAUDE.md.

## Variables de entorno nuevas

NINGUNA a nivel `.env.example`. Las credenciales OAuth de Google son **por tenant** (no globales): cada academia configura su propio Client ID + Client Secret desde el wizard y se cifran en `integrations.app_client_id_cipher` / `app_client_secret_cipher` con la `ENCRYPTION_KEY` ya existente del Sprint 1.

## Tareas RoadMap cerradas (subtareas SPIKE-PULL)

- ✅ SP-4-SPIKE-PULL-1 — Foundation (SQL + types + credentials + OAuth refactor) — commit `d639971`.
- ✅ SP-4-SPIKE-PULL-2 — Sheets adapter + queue + worker + webhook + writeback + actions — commit `f752b74`.
- ✅ SP-4-SPIKE-PULL-3 — UI wizard 4 steps + Picker multi-hoja + mapping editor — commit `e1a3ec4`.
- ✅ SP-4-SPIKE-PULL-4 — Docs guía Cloud Console + tests unit + runbook E2E — commit `6de8045`.
- ✅ SP-4-SPIKE-PULL-5 — RoadMap tracking del spike — commit `42b150f`.
- ✅ SP-4-SPIKE-PULL-6 — Write-back automation (trigger SQL + outbox + cron) — commit `4cdb460`.
- ✅ SP-4-SPIKE-PULL-7 — CSP runtime fix Google Picker + screenshot smoke — commit `2e8a199`.
- ✅ SP-4-SPIKE-PULL-fixes — Tracking sesión 27-28 mayo + lint fixes `actions.ts` — commits `d720d4c`, `a78830b`, `c9e6238`.

## Tareas diferidas (pendientes para cerrar Sprint 4)

- 🔘 SP-4-SPIKE-PULL-8 — Full E2E con OAuth real Google + ngrok (necesita exponer webhook + cuenta Google del tester).
- 🔘 SP-4-CLOSE-1..5 — Protocolo de cierre estándar (auto-test + E2C local + corrección bugs + push validado + PR final ready-for-review).
- 🔘 Aplicar migraciones SQL contra VPS dev — diferido a SP-4B (pre-deploy MVP GA).
- 🔘 Hand-off a SP-4B `phase-NN-validacion-sprint-4.md` — pendiente generar plantilla.

## ADRs aprobados

Ninguno nuevo en este spike. Reutiliza ADRs existentes (ADR-014 a ADR-019 del Sprint 1 sobre cifrado AES-256 de credenciales OAuth).

## Contribuidores

- @Ai2You (Javi HP, dev principal del spike).

## Commits incluidos (10)

```
c9e6238 fix(sprint-4): usar block disable/enable para no-explicit-any en insert sheet_connections
a78830b fix(sprint-4): lint errors en actions.ts (no-explicit-any + unused import)
d720d4c docs(sprint-4): tracking tiempos reales sesion 27-28 mayo + subtareas SPIKE-PULL desglosadas
2e8a199 fix(sprint-4): CSP permite Google Picker + screenshot smoke test wizard
4cdb460 feat(sprint-4): write-back automation (trigger SQL + outbox + cron) + .secrets/ gitignored
42b150f docs(sprint-4): RoadMap update - registrar spike Sheets Pull-only 27-05-2026
6de8045 feat(sprint-4): docs guia tenant Google Cloud + tests unit + runbook E2E manual
e1a3ec4 feat(sprint-4): UI wizard Google Sheets (4 steps + Picker multi-hoja + mapping editor)
f752b74 feat(sprint-4): sheets adapter + queue + worker + webhook + writeback + actions
d639971 feat(sprint-4): sheets foundation - SQL migrations + types + credentials + OAuth refactor
```

Diff total: 32 ficheros · +4739 / −84 líneas.

## Próximos pasos

1. **Mantener este PR en Draft** hasta cerrar SP-4-SPIKE-PULL-8 (Full E2E OAuth real + ngrok).
2. Tras cerrar la subtarea 8: ejecutar protocolo CLOSE-1..5 estándar (`/auto-test` + `/e2ctotal` + push validado + transición Draft → Ready).
3. Hand-off a SP-4B (validación pre-MVP) cuando el sprint cierre: aplicar migraciones VPS dev + ejecutar runbook E2E contra entorno real.
4. **NO mergear sin orden explícita del usuario** — política CLAUDE.md sobre push protegido.

---

**Generado**: 28-05-2026 sesión cierre Sprint 4 SPIKE. Push `c9e6238` validado contra `origin/feature/sprint-04-google-sheets`. Husky pre-push OK (typecheck + build + lint).
