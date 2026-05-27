# Runbook E2E manual — Google Sheets → orquestador agéntico

> Sprint 4 spike. Verifica el camino feliz Pull-only: nueva fila Sheet → webhook Drive → BullMQ worker → orchestrator.handleNewLead.

## Pre-requisitos

- [ ] Rama `feature/sprint-04-google-sheets` checkeada y migraciones aplicadas:
  - `supabase/migrations/20260527000000_sheet_connections.sql`
  - `supabase/migrations/20260527000001_integrations_tenant_oauth_app.sql`
- [ ] `ENCRYPTION_KEY` en `.env.local` (32 bytes hex).
- [ ] `OAUTH_STATE_SECRET` en `.env.local` (>=32 chars base64url).
- [ ] `REDIS_URL` accesible (`redis://localhost:6379` por defecto).
- [ ] Cuenta Google de pruebas con una Sheet vacía + acceso de edición.
- [ ] Proyecto Google Cloud propio del tenant de test con Sheets/Drive/Picker APIs habilitadas y OAuth Client ID Web tipo Web application (ver `docs/integrations/google-sheets-setup-tenant.md`).
- [ ] Server dev corriendo en `localhost:8500` (`npm run dev`).

## Step 1 — Login en el dashboard

1. Navegar a `http://localhost:8500/login`.
2. Iniciar sesión con tenant de prueba.
3. Comprobar que `requireCurrentTenant()` resuelve correctamente (en la siguiente acción si no, lanza error 401).

## Step 2 — Configurar credenciales OAuth de la app

1. Navegar a `http://localhost:8500/dashboard/settings/integrations/google-sheets`.
2. Estado esperado: Step 1 activo, Steps 2-4 inactivos.
3. Pegar `Client ID` y `Client Secret` del proyecto Cloud.
4. Click **Guardar y seguir**.
5. **Verificar BD**:
   ```sql
   SELECT id, crm_type, app_client_id_cipher IS NOT NULL AS has_cid,
          app_client_secret_cipher IS NOT NULL AS has_secret
   FROM integrations
   WHERE tenant_id = '<TU_TENANT_ID>' AND crm_type = 'google_sheets';
   ```
   Esperado: 1 fila con `has_cid=true` y `has_secret=true`.

## Step 3 — OAuth flow con Google

1. Step 2 ahora activo. Click **Conectar con Google**.
2. Redirige a `accounts.google.com` → elegir cuenta → ver consent screen con nombre de TU app (no de Automatiza) → aceptar.
3. Vuelve al wizard con `?connected=1` y mensaje verde "Cuenta Google conectada correctamente".
4. **Verificar BD**:
   ```sql
   SELECT credentials_cipher IS NOT NULL AS has_tokens,
          metadata->>'connected_email' AS email,
          scopes
   FROM integrations
   WHERE tenant_id = '<TU_TENANT_ID>' AND crm_type = 'google_sheets';
   ```
   Esperado: `has_tokens=true`, `email` poblado, `scopes` contiene `https://www.googleapis.com/auth/drive.file`.

## Step 4 — Conectar Sheets vía Picker

1. Step 3 ahora activo. Click **Conectar hoja(s)**.
2. Espera a que cargue el Picker. Selecciona 1 Sheet de prueba con cabeceras tipo:
   | Nombre | Email | Teléfono | Empresa | Cargo | Estado |
3. Click **Select**.
4. Toast verde "1 hoja conectada". Página recarga sola en <1s.
5. **Verificar BD**:
   ```sql
   SELECT id, spreadsheet_id, spreadsheet_name, sheet_tab_name, purpose,
          drive_channel_id IS NOT NULL AS has_watch,
          drive_channel_expiry,
          jsonb_array_length(column_mapping->'columns') AS columns
   FROM sheet_connections
   WHERE tenant_id = '<TU_TENANT_ID>';
   ```
   Esperado: 1 fila, `has_watch=true`, `drive_channel_expiry` ~+7 días, `columns >= 1`.
6. Verificar que el `column_mapping->columns` tiene targets sensatos según las cabeceras (heurística de `suggestMappingAction`).

## Step 5 — Añadir fila nueva a la Sheet

1. Abrir la Sheet en Google.
2. Añadir una fila nueva, ejemplo:
   ```
   Ana García | ana.test@example.com | +34666999888 | Esden Business School | Comercial | QUALIFICATION
   ```
3. Esperar **5-15 segundos** (Drive notifica + delay 5s del enqueue).

## Step 6 — Verificar disparador end-to-end

Ejecutar en ventana de terminal con dev server activo:

1. **Webhook llegó**: en logs dev verás:
   ```
   [webhook.google-sheets] sheets-pull enqueued desde webhook Drive
   ```
2. **Worker procesó**: en logs:
   ```
   [queue.sheets-pull] sheets-pull job START
   [queue.sheets-pull] sheets-pull job DONE { rows_total: 2, rows_new: 1, leads_created: 1 }
   ```
3. **Lead creado**:
   ```sql
   SELECT id, nombre, email, telefono, current_stage, metadata->'sheet_source'
   FROM lead
   WHERE tenant_id = '<TU_TENANT_ID>'
   ORDER BY fecha_creacion DESC LIMIT 1;
   ```
   Esperado: la nueva Ana García con stage `QUALIFICATION`, `metadata.sheet_source.spreadsheet_id` y `row_index` poblados, `metadata.empresa = "Esden Business School"`, `metadata.cargo = "Comercial"`.
4. **Orquestador disparó**: en logs:
   ```
   [ORCHESTRATOR] handleNewLead leadId=... tenantId=...
   ```
   (mensaje exacto puede variar según implementación interna del orchestrator).
5. **Idempotencia**: añadir DOS filas nuevas más, esperar, recargar. `rows_new` debe sumar 2, leads totales debe ser exactamente +2. Sin duplicados.

## Step 7 — Verificar idempotencia con re-pull

1. En la UI del wizard, expandir la hoja → click sync manual (icono RefreshCw).
2. En logs verás:
   ```
   sheets-pull job DONE { rows_total: 3, rows_new: 0, rows_skipped: 2, leads_created: 0 }
   ```
   (las 2 filas ya procesadas se saltan por row_hash; la primera fila es header).

## Step 8 — Verificar write-back (si writeback_enabled)

1. Editar la hoja conectada: marcar `writeback_enabled = true` + asegurar que la columna `Estado` (mapeada a `lead.current_stage`) tiene `writeback=true`.
2. En la BD del dashboard, simular cambio de stage del lead:
   ```typescript
   import { writeBackLeadChange } from "@/lib/integrations/sheets/writeback";
   await writeBackLeadChange("<TENANT_ID>", "<LEAD_ID>", {
     changes: { "lead.current_stage": "SCHEDULING" },
   });
   ```
3. Verificar en la Sheet que la celda `Estado` de Ana cambió de `QUALIFICATION` a `SCHEDULING`.

## Step 9 — Cleanup

1. Eliminar la connection desde la UI (botón papelera).
2. Verificar `stopWatch` se llamó (sin error en logs).
3. Filas en BD:
   ```sql
   SELECT * FROM sheet_connections WHERE tenant_id = '<TU_TENANT_ID>'; -- vacío
   SELECT * FROM sheet_row_processed WHERE sheet_connection_id = '<ID_BORRADO>'; -- vacío (CASCADE)
   ```

## Criterios de éxito globales

- [ ] Step 2: credenciales cifradas correctamente (columnas no-null y descifrables).
- [ ] Step 3: OAuth tokens guardados + email del usuario detectado.
- [ ] Step 4: connection creada + watch channel registrado en Drive.
- [ ] Step 6: lead creado en <30s desde añadir fila + orchestrator invocado.
- [ ] Step 7: re-pull no duplica leads (idempotencia OK).
- [ ] Step 8: cambio de stage en Esden se refleja en la Sheet.
- [ ] Step 9: cleanup completo sin filas huérfanas.

## Troubleshooting frecuente

| Síntoma                              | Diagnóstico                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 403 al iniciar OAuth                 | Redirect URI no registrado en Google Cloud Console. Añadir `http://localhost:8500/api/integrations/google/callback`.                                                              |
| 401 callback con `invalid_state`     | `OAUTH_STATE_SECRET` cambió entre auth y callback. Reiniciar dev server.                                                                                                          |
| Picker no carga                      | Faltan APIs habilitadas: revisar Sheets API, Drive API, Picker API en Google Cloud.                                                                                               |
| Webhook no llega                     | Drive solo notifica a URLs HTTPS públicas. En local usar `ngrok` para tunelizar `localhost:8500` y registrar la URL pública en `NEXT_PUBLIC_APP_URL` antes de hacer `setupWatch`. |
| Worker no procesa jobs               | Verificar `REDIS_URL` accesible. Si BullMQ no encuentra Redis, los jobs quedan en cola pero no se ejecutan.                                                                       |
| `OAUTH_MISSING` al hacer pull manual | El tenant aún no completó Step 3 (OAuth con Google). Reintenta el flow.                                                                                                           |

## Notas técnicas

- **Watch channels TTL**: Drive limita a 7 días. Worker renueva 24h antes (no implementado el cron en este spike, requiere job adicional `sheets-channel-renew`).
- **Scope drive.file**: solo accede a archivos autorizados explícitamente. NO podemos leer otras Sheets del usuario.
- **Idempotencia**: hash SHA-256 de toda la fila stringificada. Cambios mínimos en una celda → nuevo hash → procesa como modificación.
- **Multi-tenant**: el `tenantId` se valida en cada server action contra `auth.uid()` + tabla `tenants`. El service_role bypassa RLS para webhooks/workers (no autenticados).
