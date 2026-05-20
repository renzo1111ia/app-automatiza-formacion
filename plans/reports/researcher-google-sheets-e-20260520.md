# Research — Google Sheets bidireccional + Drive API (Sprint 5)

**Agente:** researcher (Sonnet)
**Fecha:** 20-05-2026
**Scope:** Google Sheets API v4 + Drive API v3 usando `googleapis@171.4.0` (ya instalado)

---

## 1. Conclusión de dependencias

`googleapis@171.4.0` ya instalado cubre TODO lo necesario. **CERO dependencias nuevas de producción.**

```ts
import { google } from 'googleapis'
const sheets = google.sheets({ version: 'v4', auth: oauthClient })
const drive  = google.drive({ version: 'v3', auth: oauthClient })
```

---

## 2. OAuth2 — scopes mínimos

| Scope | Propósito |
|-------|-----------|
| `https://www.googleapis.com/auth/spreadsheets` | Leer y escribir celdas |
| `https://www.googleapis.com/auth/drive.file` | Acceder solo a archivos creados/abiertos por la app (scope mínimo) |

Recomendación: usar `drive.file` (no `drive` completo) — principio de mínimo privilegio.

### Patrón por tenant (multi-tenant)
- Cada tenant tiene su propio `google_oauth_token` (access + refresh) en tabla `crm_connections`
- Al instanciar: crear `OAuth2Client` con el refresh token del tenant
- Auto-refresh: `oauth2Client.on('tokens', (tokens) => { /* persiste en DB */ })`

---

## 3. Sheets API v4 — operaciones clave

### Lectura de rango
```ts
const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: 'Leads!A2:Z'
})
const rows = res.data.values ?? []
```

### Escritura append
```ts
await sheets.spreadsheets.values.append({
  spreadsheetId,
  range: 'Leads!A:Z',
  valueInputOption: 'USER_ENTERED',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: [rowData] }
})
```

### Actualización de fila existente
```ts
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `Leads!A${rowIndex}:Z${rowIndex}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [updatedRow] }
})
```

### Batch (minimiza cuota)
```ts
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [{ range: 'Leads!A2', values: [['val']] }]
  }
})
```

---

## 4. Bidireccionalidad — Estrategia

### Push: nuestro lead → Sheet
- Evento `lead.updated` → BullMQ job → `SheetsAdapter.pushLead(lead)`
- Buscar fila por `lead_id` en columna ID → UPDATE si existe, APPEND si no

### Pull: Sheet editado manualmente → nuestro sistema

**Opción A: Drive push notifications (webhook)**
- `drive.files.watch({ fileId, resource: { kind: 'api#channel', id: uuid, type: 'web_hook', address: webhookUrl } })`
- Google envía POST cuando el archivo cambia (batched, mínimo cada 3 min)
- Canal expira a los 7 días — renovar con BullMQ cron

**Opción B: Polling** (fallback/reconciliación)
- BullMQ cron cada N minutos, leer todas las filas y comparar con estado local

**Recomendación**: Drive webhook primario + polling diario como reconciliación.

### Idempotencia — evitar bucles infinitos
- Columna oculta `_esden_updated_at` en el sheet (timestamp de última escritura de nuestro sistema)
- Al recibir webhook: si `change_time > _esden_updated_at` → edición manual → procesar; si no → ignorar

---

## 5. Templates por tenant
- Copiar template maestro: `drive.files.copy({ fileId: masterTemplateId })`
- Columnas: `lead_id | nombre | email | telefono | estado | ... | _esden_updated_at`
- Cada academia tiene su propio archivo en su Drive

---

## 6. Cuotas y rate limits

| Límite | Valor |
|--------|-------|
| Reads por min/proyecto | 300 |
| Writes por min/proyecto | ~1000 |
| Reads por min/usuario | 60 |
| Drive webhook TTL | 7 días |
| Timeout request | 180s |

Error 429 → exponential backoff con jitter.

---

## 7. Data flow (ASCII)

```
Lead updated in Esden
  → BullMQ: push-to-sheet
    → SheetsAdapter(tenantId)
      → OAuth2 refresh (DB)
      → Find row by lead_id
      → APPEND or batchUpdate
      → Set _esden_updated_at

Sheet edited manually
  → Drive webhook POST
    → Check _esden_updated_at vs change_time
      → Manual? → map row → update lead in DB
      → Esden write? → skip
```

---

## 8. Risks

| Riesgo | Mitigación |
|--------|------------|
| Drive webhook TTL expira silenciosamente | BullMQ cron renovación día 6 |
| Bucle infinito push/pull | Campo `_esden_updated_at` + cooldown 30s |
| 429 cuota agotada | Exponential backoff + BullMQ retry con delay |
| OAuth revocado | Marcar `crm_connections.status = 'revoked'` en error 403 |

---

## 9. Preguntas abiertas

1. Google Cloud Project centralizado (nuestra app) vs cada tenant con su GCP project?
2. Granularidad sync: por campo vs por fila completa?
3. Frecuencia pull aceptable (webhook 3min vs polling 15min)?
4. ¿El tenant configura el spreadsheetId manualmente o lo creamos nosotros al activar la integración?

**Status:** DONE
**Summary:** googleapis@171.4.0 cubre Sheets v4 + Drive v3. Bidireccionalidad vía Drive push notifications + reconciliación. Idempotencia con `_esden_updated_at`. CERO dependencias nuevas.
