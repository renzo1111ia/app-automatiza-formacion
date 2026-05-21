# Testeos manuales — dashboard-af

Checklist de pruebas manuales que el equipo de desarrollo debe ejecutar antes del cierre de cada sprint. Complementa a los tests automatizados (`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`).

## Convenciones

- **Estado**: `[ ]` pendiente · `[~]` yo lo estoy haciendo · `[x]` hecho.
- Marcar la fecha y el dev en la columna **Notas** al cerrar (`DD-MM-YYYY HH:MM · Javi`).
- Si el test falla, anotar el bug encontrado en notas y abrir tarea en la sección "Bugs detectados" del RoadMap del sprint en curso.
- Los pasos asumen `.env.local` configurado y `npm run dev` corriendo. El puerto puede ser **3000** o **3001** (si 3000 está ocupado). Los enlaces de este doc usan `localhost:3000` — sustituye por `3001` si tu server arrancó ahí.
- **URLs clickables**: en VSCode Markdown Preview y en GitHub los enlaces `[texto](http://localhost:3000/...)` se abren con Ctrl+Click.

---

## Índice por sprint

- [Sprint 0 — Hotfixes seguridad](#sprint-0--hotfixes-seguridad)
- [Sprint 1 — Capa de datos](#sprint-1--capa-de-datos)
- [Sprint 2 — Adapter HubSpot + Zoho](#sprint-2--adapter-hubspot--zoho)
- [Sprint 3 — Hardening](#sprint-3--hardening)
- [Sprint 4 — Google Sheets bidireccional](#sprint-4--google-sheets-bidireccional)
- [Sprint 5 — Salesforce adapter](#sprint-5--salesforce-adapter)
- [Sprint 6 — GoHighLevel adapter](#sprint-6--gohighlevel-adapter)
- [Sprint 7 — ActiveCampaign adapter](#sprint-7--activecampaign-adapter)
- [Sprint 8 — Adapter pattern generalization](#sprint-8--adapter-pattern-generalization)
- [Sprint 9 — CRMs Tier 2 on-demand](#sprint-9--crms-tier-2-on-demand)

---

## Sprint 0 — Hotfixes seguridad

> Versión objetivo: `v0.1.0` · Rama: `feature/sp-0-sprint-0-hotfixes` · Bloque cubierto: tareas 1-07..1-25.

### Pre-requisitos del entorno

Antes de empezar, asegúrate de tener en `.env.local` las nuevas vars añadidas en este sprint:

```bash
CRON_SECRET=<openssl rand -base64 48>
WHATSAPP_APP_SECRET=<el real desde Meta App Dashboard, o un valor de test>
WHATSAPP_VERIFY_TOKEN=<random string para webhook verify>
ALLOW_INTERNAL_TENANT_URLS=true   # solo dev local; bypassa SSRF allowlist para Supabase local
```

Migraciones SQL aplicadas en local (deberían estarlo ya tras tirar `db:reset`):

```powershell
docker exec -i supabase_db_automatiza-formacion-dashboard psql -U postgres -d postgres < supabase/migrations/20260521000000_rls_tenants_hardening.sql
docker exec -i supabase_db_automatiza-formacion-dashboard psql -U postgres -d postgres < supabase/migrations/20260521000001_rls_knowledge_base_hardening.sql
docker exec -i supabase_db_automatiza-formacion-dashboard psql -U postgres -d postgres < supabase/scripts/migrate-is-admin-to-app-metadata.sql
```

### A) Quick checks clickables (smoke ~10 min)

> Si solo dispones de 10 minutos, ejecuta esta lista. Cubre los gates más visibles sin necesidad de preparar usuarios, calcular firmas, ni manipular DB. Para el cierre formal `SP-1-CLOSE-3` hay que pasar también la tabla completa más abajo (sección B).

| #    | Estado | URL / Acción                                                                                                                                                                      | Esperado                                                    |
| ---- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Q-01 | `[ ]`  | [GET /login](http://localhost:3000/login)                                                                                                                                         | `200` página de login renderiza                             |
| Q-02 | `[ ]`  | [GET /dashboard](http://localhost:3000/dashboard) (sin sesión)                                                                                                                    | Redirect a `/login`                                         |
| Q-03 | `[ ]`  | [GET /api/orchestration/workflows?tenantId=00000000-0000-0000-0000-000000000000](http://localhost:3000/api/orchestration/workflows?tenantId=00000000-0000-0000-0000-000000000000) | `401 Unauthorized`                                          |
| Q-04 | `[ ]`  | [GET /api/orchestration/sweep](http://localhost:3000/api/orchestration/sweep)                                                                                                     | `401` o `503`                                               |
| Q-05 | `[ ]`  | [GET /api/cron/appointments/reminders](http://localhost:3000/api/cron/appointments/reminders)                                                                                     | `401` o `503`                                               |
| Q-06 | `[ ]`  | [GET /api/admin/tenants/00000000-0000-0000-0000-000000000000/client-sql](http://localhost:3000/api/admin/tenants/00000000-0000-0000-0000-000000000000/client-sql)                 | `401`                                                       |
| Q-07 | `[ ]`  | [GET /api/tenant/migrate](http://localhost:3000/api/tenant/migrate)                                                                                                               | `401`                                                       |
| Q-08 | `[ ]`  | [GET /api/widget/embed.js](http://localhost:3000/api/widget/embed.js) (sin id)                                                                                                    | `400 Missing widget ID`                                     |
| Q-09 | `[ ]`  | [GET /api/widget/embed.js?id=hacker';alert(1);//](http://localhost:3000/api/widget/embed.js?id=hacker%27;alert%281%29;//)                                                         | `400 Invalid widget ID format`                              |
| Q-10 | `[ ]`  | [GET /api/widget/embed.js?id=11111111-1111-1111-1111-111111111111](http://localhost:3000/api/widget/embed.js?id=11111111-1111-1111-1111-111111111111)                             | `200` body contiene `"11111111-..."` y NO contiene `alert(` |

Comandos curl para los POST (no clickables, copiar y pegar):

```bash
# Q-11: Retell webhook sin firma → 401/503
curl -i -X POST http://localhost:3000/api/webhooks/retell -H "content-type: application/json" -d '{"event":"call_ended"}'

# Q-12: Retell tools sin firma → 401/503
curl -i -X POST http://localhost:3000/api/webhooks/retell/tools -H "content-type: application/json" -d '{"name":"book_appointment","args":{},"call":{"metadata":{}}}'

# Q-13: WhatsApp sin x-hub-signature-256 → 401 (si WHATSAPP_APP_SECRET está set) o 503
curl -i -X POST http://localhost:3000/api/webhooks/whatsapp -H "content-type: application/json" -d '{"object":"whatsapp_business_account","entry":[]}'

# Q-14: CRM webhook sin x-tenant-id → 400
curl -i -X POST http://localhost:3000/api/webhooks/crm -H "content-type: application/json" -d '{"telefono":"+34600000000"}'

# Q-15: CRM con x-tenant-id pero sin firma → 401/403/503
curl -i -X POST http://localhost:3000/api/webhooks/crm -H "x-tenant-id: 00000000-0000-0000-0000-000000000000" -H "content-type: application/json" -d '{"telefono":"+34600000000"}'
```

> **Nota**: el spec automatizado [`tests/e2e/core/sprint-0-security.spec.ts`](../tests/e2e/core/sprint-0-security.spec.ts) cubre estos 15 quick checks. Si `npm run test:e2e` pasa, A) ya está OK; pero la firma manual del dev sigue siendo obligatoria para el cierre.

---

### B) Tabla completa de tests del cierre — Sprint 0

> **Para el cierre formal `SP-1-CLOSE-3`**. Cubre TODOS los gates 1-07..1-26 incluyendo casos que requieren login con usuarios distintos, manipular `tenants.config` en Supabase Studio, y calcular HMAC con clave real.

| #        | Estado | Test                                                   | URL / Comando                                                                                                                                     | Esperado                                                                                             | Setup previo                                                                                                                                                                                                       | Notas |
| -------- | :----: | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| SP0-T-01 | `[ ]`  | Login válido + cookie de sesión                        | [/login](http://localhost:3000/login)                                                                                                             | Redirect a `/dashboard` + cookie `sb-*-auth-token`                                                   | Credenciales válidas (p.ej. `admin@2you.ai`)                                                                                                                                                                       |       |
| SP0-T-02 | `[ ]`  | `/dashboard/settings` bloquea no admin (1-16)          | [/dashboard/settings](http://localhost:3000/dashboard/settings)                                                                                   | Redirect a `/dashboard`                                                                              | Login con user **no admin**                                                                                                                                                                                        |       |
| SP0-T-03 | `[ ]`  | `/dashboard/settings` accesible admin (1-16)           | [/dashboard/settings](http://localhost:3000/dashboard/settings)                                                                                   | Renderiza sección Settings completa                                                                  | Login con user **admin** (tras script 1-16: `app_metadata.is_admin=true`)                                                                                                                                          |       |
| SP0-T-04 | `[ ]`  | Listado de tenants solo admin (1-17)                   | [/dashboard/admin](http://localhost:3000/dashboard/admin)                                                                                         | No admin → lista vacía; admin → todos los tenants                                                    | Dos sesiones (admin y no admin)                                                                                                                                                                                    |       |
| SP0-T-05 | `[ ]`  | Crear tenant solo admin (1-17)                         | Click "Nuevo cliente" en `/dashboard/admin`                                                                                                       | No admin → "Acción requiere rol admin"; admin → tenant creado                                        | Form del panel admin                                                                                                                                                                                               |       |
| SP0-T-06 | `[ ]`  | Borrar tenant solo admin (1-17)                        | Click delete en `/dashboard/admin`                                                                                                                | No admin → throw error; admin → eliminado                                                            | Idem                                                                                                                                                                                                               |       |
| SP0-T-07 | `[ ]`  | API orquestación rechaza anónimos (1-07)               | [/api/orchestration/workflows?tenantId=...](http://localhost:3000/api/orchestration/workflows?tenantId=00000000-0000-0000-0000-000000000000)      | `401 Unauthorized`                                                                                   | Borrar cookies de sesión antes                                                                                                                                                                                     |       |
| SP0-T-08 | `[ ]`  | API orquestación rechaza tenant ajeno (1-07)           | `GET /api/orchestration/workflows?tenantId=<tenant_B>`                                                                                            | `403 Forbidden`                                                                                      | Login user de tenant **A** + UUID real de tenant **B**                                                                                                                                                             |       |
| SP0-T-09 | `[ ]`  | Cron sweep exige secret (1-08)                         | [/api/orchestration/sweep](http://localhost:3000/api/orchestration/sweep)                                                                         | Sin header → `401/503`; con `-H "x-cron-secret: $CRON_SECRET"` → `200`                               | `CRON_SECRET` en `.env.local`                                                                                                                                                                                      |       |
| SP0-T-10 | `[ ]`  | Cron reminders exige secret (1-08)                     | [/api/cron/appointments/reminders](http://localhost:3000/api/cron/appointments/reminders)                                                         | Idem Q-04                                                                                            | Idem                                                                                                                                                                                                               |       |
| SP0-T-11 | `[ ]`  | Orchestration disabled por defecto (1-09)              | `POST /api/orchestration/publish` con body válido                                                                                                 | Sin flag → `403 Orchestration disabled`; con `tenants.config.test_orchestrator_enabled=true` → `200` | Editar JSONB en Supabase Studio: [http://localhost:54323](http://localhost:54323)                                                                                                                                  |       |
| SP0-T-12 | `[ ]`  | client-sql exige admin (1-10)                          | [/api/admin/tenants/<uuid>/client-sql](http://localhost:3000/api/admin/tenants/00000000-0000-0000-0000-000000000000/client-sql)                   | Anónimo/no admin → `401/403`; admin → `200` con SQL adjunto                                          | UUID real de un tenant existente                                                                                                                                                                                   |       |
| SP0-T-13 | `[ ]`  | `/api/tenant/migrate` GET exige admin (1-11)           | [/api/tenant/migrate](http://localhost:3000/api/tenant/migrate)                                                                                   | Anónimo → `401`; admin → `200` JSON `{sql:"..."}`                                                    | —                                                                                                                                                                                                                  |       |
| SP0-T-14 | `[ ]`  | Webhook Retell sin firma → 401 (1-12)                  | `curl -X POST /api/webhooks/retell` (ver Q-11)                                                                                                    | `401` o `503` (sin `RETELL_WEBHOOK_SECRET`)                                                          | —                                                                                                                                                                                                                  |       |
| SP0-T-15 | `[ ]`  | Webhook Retell tools sin firma → 401 (1-13)            | `curl -X POST /api/webhooks/retell/tools` (ver Q-12)                                                                                              | `401` o `503`                                                                                        | —                                                                                                                                                                                                                  |       |
| SP0-T-16 | `[ ]`  | WhatsApp sin `WHATSAPP_APP_SECRET` env → 503 (1-14)    | `curl -X POST /api/webhooks/whatsapp -d '{}'`                                                                                                     | `503 Service misconfigured`                                                                          | **Borrar temp** `WHATSAPP_APP_SECRET` de `.env.local` + reiniciar dev. Restaurar al terminar.                                                                                                                      |       |
| SP0-T-17 | `[ ]`  | WhatsApp sin header `x-hub-signature-256` → 401 (1-14) | `curl -X POST /api/webhooks/whatsapp -d '{}'`                                                                                                     | `401 Missing signature`                                                                              | `WHATSAPP_APP_SECRET` configurada                                                                                                                                                                                  |       |
| SP0-T-18 | `[ ]`  | CRM webhook sin `x-tenant-id` → 400 (1-15)             | `curl -X POST /api/webhooks/crm -d '{}'` (ver Q-14)                                                                                               | `400 Missing x-tenant-id header`                                                                     | —                                                                                                                                                                                                                  |       |
| SP0-T-19 | `[ ]`  | CRM con tenant pero sin firma → 401/403 (1-15)         | `curl -X POST /api/webhooks/crm -H "x-tenant-id: <uuid>"` (ver Q-15)                                                                              | `401`, `403` o `503`                                                                                 | —                                                                                                                                                                                                                  |       |
| SP0-T-20 | `[ ]`  | CRM con firma válida → 200 (1-15)                      | `curl -X POST /api/webhooks/crm -H "x-tenant-id: <uuid>" -H "x-webhook-signature: <hex>"`                                                         | `200 Lead ingested`                                                                                  | 1) UPDATE en Supabase Studio: `tenants.config = config \|\| '{"webhook_crm_secret":"test-secret"}'::jsonb WHERE id='<uuid>'`. 2) `echo -n '<body>' \| openssl dgst -sha256 -hmac 'test-secret'` para calcular HMAC |       |
| SP0-T-21 | `[ ]`  | RLS tenants — cliente solo ve su tenant (1-18)         | SQL en Studio: `SELECT * FROM tenants;` autenticado como user A                                                                                   | Solo fila del tenant del user                                                                        | En [Studio](http://localhost:54323) → SQL Editor → conexión con el JWT del user A                                                                                                                                  |       |
| SP0-T-22 | `[ ]`  | RLS tenants — admin ve todos (1-18)                    | Mismo SELECT con JWT de un admin                                                                                                                  | Todas las filas                                                                                      | Admin con `app_metadata.is_admin=true`                                                                                                                                                                             |       |
| SP0-T-23 | `[ ]`  | RLS tenants — no admin no puede INSERT (1-18)          | `INSERT INTO tenants (...)` como user no admin                                                                                                    | Policy bloquea (`row violates row-level security policy`)                                            | —                                                                                                                                                                                                                  |       |
| SP0-T-24 | `[ ]`  | RLS knowledge_base — owner-only (1-19)                 | `SELECT * FROM knowledge_base WHERE tenant_id='<tenant_B>'` como user A                                                                           | 0 filas devueltas (aunque existan en DB)                                                             | Insertar previamente un knowledge_base en tenant B como service_role                                                                                                                                               |       |
| SP0-T-25 | `[ ]`  | fetchCalls filtra por tenant activo (1-20)             | [/dashboard/historial](http://localhost:3000/dashboard/historial)                                                                                 | Solo leads del tenant activo; sin cookie `esden-tenant-id` → tabla vacía                             | Login como user de tenant A; borrar cookie en DevTools para 2º caso                                                                                                                                                |       |
| SP0-T-26 | `[ ]`  | IDOR inbox: editar lead ajeno falla silencioso (1-21)  | Manipular `leadId` en URL del inbox a un lead de tenant B                                                                                         | UI dice OK pero verificar en DB que el lead B NO cambió                                              | Login tenant A + UUID real de lead del tenant B                                                                                                                                                                    |       |
| SP0-T-27 | `[ ]`  | IDOR inbox: borrar lead ajeno no afecta (1-21)         | `deleteLead(leadId=<lead_B>)` desde DevTools/UI tenant A                                                                                          | UI OK, lead B sigue en DB                                                                            | Idem                                                                                                                                                                                                               |       |
| SP0-T-28 | `[ ]`  | SSRF migrate bloquea host privado (1-22)               | `POST /api/tenant/migrate` como admin                                                                                                             | `400 Supabase URL inválida (red privada bloqueada)`                                                  | UPDATE: `tenants.supabase_url='http://internal-admin.local'`. `ALLOW_INTERNAL_TENANT_URLS` **no** set.                                                                                                             |       |
| SP0-T-29 | `[ ]`  | SSRF migrate permite localhost en dev (1-22)           | `POST /api/tenant/migrate` como admin                                                                                                             | Sin env → `400`; con `ALLOW_INTERNAL_TENANT_URLS=true` → `200`                                       | `tenants.supabase_url='http://localhost:8200'`; toggle env y reiniciar dev                                                                                                                                         |       |
| SP0-T-30 | `[ ]`  | Widget XSS id malicioso → 400 (1-23)                   | [/api/widget/embed.js?id=hacker';alert(1);//](http://localhost:3000/api/widget/embed.js?id=hacker%27;alert%281%29;//)                             | `400 Invalid widget ID format`                                                                       | —                                                                                                                                                                                                                  |       |
| SP0-T-31 | `[ ]`  | Widget UUID válido → JS sanitizado (1-23)              | [/api/widget/embed.js?id=11111111-1111-1111-1111-111111111111](http://localhost:3000/api/widget/embed.js?id=11111111-1111-1111-1111-111111111111) | `200`; body contiene `"11111111-..."` y NO contiene `alert(`                                         | —                                                                                                                                                                                                                  |       |
| SP0-T-32 | `[ ]`  | axios bump no rompe download de media WhatsApp (1-24)  | Recibir webhook WhatsApp tipo `image`                                                                                                             | Log `[WHATSAPP PROCESSOR] Media uploaded to MinIO`, sin error de tipos `AxiosHeaderValue`            | WhatsApp real o mock del payload Meta                                                                                                                                                                              |       |
| SP0-T-33 | `[ ]`  | Paquete `crypto` deprecated removido (1-25)            | `npm ls crypto` en raíz del repo                                                                                                                  | `(empty)` — el paquete `crypto@1.0.1` ya no está. `npm run dev` arranca sin warning deprecation      | Tras `npm install` post-pull de `feature/sp-0`                                                                                                                                                                     |       |
| SP0-T-34 | `[ ]`  | Next.js 16.2.6 sin warnings CVE (1-26)                 | `npm run dev` + `npm run build`                                                                                                                   | Sin warnings de CVE en consola; rutas dinámicas funcionan                                            | —                                                                                                                                                                                                                  |       |

### Tests diferidos a sesión pre-deploy (VPS)

| #        | Estado | Test                                                  | Notas                                                                                                                    |
| -------- | :----: | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --- |
| SP0-T-35 | `[ ]`  | **Rotación JWT Supabase VPS (1-03)**                  | Solo aplicable en VPS Easypanel con acceso del cliente.                                                                  |     |
| SP0-T-36 | `[ ]`  | **Cambio password Postgres VPS (1-05)**               | Idem — Supabase local usa Postgres en localhost:8200, riesgo nulo en dev.                                                |     |
| SP0-T-37 | `[ ]`  | **Apply migrations 1-18 + 1-19 + script 1-16 en VPS** | Aplicar los 3 SQL contra Supabase del cliente antes de promover a staging.                                               |     |
| SP0-T-38 | `[ ]`  | **Apply rol `app_user` en VPS (1-06)**                | Aplicar `supabase/scripts/create-app-user.sql` contra Supabase del cliente, set `APP_USER_PASSWORD` en env de Easypanel. |     |

---

## Sprint 1 — Capa de datos

> Versión objetivo: `v0.2.0` · Rama: `feature/sprint-01-capa-datos` · Bloque cubierto: tareas 2-01..2-34.

### Tabla de tests manuales — Sprint 1

| #        | Estado | Test                                                          | Pasos / Resultado esperado                                                                                                                    | Notas |
| -------- | :----: | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| SP1-T-01 | `[ ]`  | **Cliente Supabase unificado (2-01, 2-02)**                   | No quedan imports directos de `pg`/`postgres` en `src/app/api`. Todas las queries pasan por `@supabase/ssr`.                                  |       |
| SP1-T-02 | `[ ]`  | **Validación Zod en POST de leads (2-04..2-11)**              | `POST /api/webhooks/crm` con body que viola schema → `400` con detalle del campo inválido.                                                    |       |
| SP1-T-03 | `[ ]`  | **Repository pattern leads CRUD (2-13)**                      | Las acciones de inbox usan el nuevo repository en vez de llamar `.from("lead")` directamente. Crear/editar/leer/soft-delete OK desde UI.      |       |
| SP1-T-04 | `[ ]`  | **Repository tenants (2-14)**                                 | UI admin de tenants funciona contra repository. Validar `findByTenant`, `create`, `update`, `softDelete`.                                     |       |
| SP1-T-05 | `[ ]`  | **Refactor server actions sin service_role (2-20)**           | Auditar manualmente que ninguna server action arranca con `getAdminSupabaseClient()` salvo justificación.                                     |       |
| SP1-T-06 | `[ ]`  | **0 ocurrencias `as any` / `as unknown` introducidas (2-22)** | `grep -rn "as any\|as unknown" src/` muestra reducción significativa vs baseline 426.                                                         |       |
| SP1-T-07 | `[ ]`  | **RLS ai_agents filtra por tenant (2-23)**                    | Como user A, `SELECT * FROM ai_agents WHERE tenant_id = <B>` → 0 filas.                                                                       |       |
| SP1-T-08 | `[ ]`  | **RLS web_widgets filtra por tenant (2-24)**                  | Idem para `web_widgets`.                                                                                                                      |       |
| SP1-T-09 | `[ ]`  | **getPrograms filtra por tenant (2-25)**                      | `/dashboard/campanas` solo lista programas del tenant activo.                                                                                 |       |
| SP1-T-10 | `[ ]`  | **OAuth tokens cifrados en JSONB (2-26)**                     | Inspeccionar la fila `tenants.config.google_oauth_tokens` en DB → debe estar cifrada (no JSON plano). Decifrar desde código → tokens válidos. |       |
| SP1-T-11 | `[ ]`  | **lucide-react v1.x — iconos renderizan (2-31)**              | Recorrer todas las páginas del dashboard, capturar screenshots y comparar — ningún icono roto.                                                |       |
| SP1-T-12 | `[ ]`  | **shadcn v4.x — componentes y theme OK (2-32)**               | Validar Button, Input, Dialog, Toast, Table, Form en light/dark mode.                                                                         |       |
| SP1-T-13 | `[ ]`  | **Hook `af-productivity-logger.cjs` registra tiempos (2-30)** | Hacer un cambio + commit → revisar log de productividad y verificar que aparece la duración real.                                             |       |

### Tests diferidos a sesión pre-deploy — Sprint 1

| #        | Estado | Test                                         | Notas                                                                 |
| -------- | :----: | -------------------------------------------- | --------------------------------------------------------------------- | --- |
| SP1-T-14 | `[ ]`  | **Migrations Sprint 1 RLS aplicadas en VPS** | Aplicar las migrations RLS de Bloque 2.6 contra Supabase del cliente. |     |

---

## Sprint 2 — Adapter HubSpot + Zoho

> Versión objetivo: `v0.3.0` · Rama: `feature/sprint-02-adapter-hubspot-zoho` · Tareas 3-01..3-07.

### Tabla de tests manuales — Sprint 2

| #        | Estado | Test                                                 | Pasos / Resultado esperado                                                                                                       | Notas |
| -------- | :----: | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| SP2-T-01 | `[ ]`  | **HubSpot OAuth flow (3-02)**                        | Click "Conectar HubSpot" → redirect a HubSpot → autorizar → callback OK → tokens guardados cifrados en `tenants.config.hubspot`. |       |
| SP2-T-02 | `[ ]`  | **HubSpot — sync de contacts bidireccional (3-02)**  | Crear contact en HubSpot → llega como lead en dashboard. Crear lead en dashboard → aparece en HubSpot.                           |       |
| SP2-T-03 | `[ ]`  | **HubSpot — refresh token automático (3-02)**        | Forzar expiración del access token → siguiente llamada debe refrescar automáticamente sin error en UI.                           |       |
| SP2-T-04 | `[ ]`  | **Zoho OAuth flow EU (3-03)**                        | Idem SP2-T-01 con region EU. Verificar `accounts.zoho.eu` como auth domain.                                                      |       |
| SP2-T-05 | `[ ]`  | **Zoho OAuth flow US (3-03)**                        | Repetir con region US (`accounts.zoho.com`).                                                                                     |       |
| SP2-T-06 | `[ ]`  | **Zoho — sync de leads (3-03)**                      | Crear lead en Zoho → llega como lead en dashboard con campos mapeados.                                                           |       |
| SP2-T-07 | `[ ]`  | **`crm_field_mapping` editable desde admin (3-04)**  | UI permite editar mapeo de campos por tenant. Cambios reflejados en próxima sync.                                                |       |
| SP2-T-08 | `[ ]`  | **`write_policy: append_only` por defecto (3-04)**   | Por defecto, las updates externas a un lead existente NO sobrescriben — crean entry nuevo o se ignoran.                          |       |
| SP2-T-09 | `[ ]`  | **`write_policy: overwrite_with_audit` (3-04)**      | Cambiar el flag de un tenant → updates SÍ sobrescriben, pero cada cambio se registra en `crm_write_audit`.                       |       |
| SP2-T-10 | `[ ]`  | **UI admin conexión CRM (3-05)**                     | Panel admin muestra estado de conexión por CRM. Botones connect/disconnect funcionan. Logs de error legibles.                    |       |
| SP2-T-11 | `[ ]`  | **`crm_write_audit` viewable en panel (3-06)**       | UI del panel muestra historial de escrituras CRM con timestamp, user, before/after.                                              |       |
| SP2-T-12 | `[ ]`  | **Webhook bidireccional anti spoofing (3-02, 3-03)** | Repetir SP0-T-19 con secret real del tenant — firma válida → 200; firma inválida → 401.                                          |       |

---

## Sprint 3 — Hardening

> Versión objetivo: `v0.4.0` (MVP) · Rama: `feature/sprint-03-hardening` · Tareas 4-01..4-07.

### Tabla de tests manuales — Sprint 3

| #        | Estado | Test                                                    | Pasos / Resultado esperado                                                                                                   | Notas |
| -------- | :----: | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| SP3-T-01 | `[ ]`  | **Suite E2E completa Playwright (4-01)**                | `npm run test:e2e` → 0 fallos, coverage `tests/e2e/sprint-*`.                                                                |       |
| SP3-T-02 | `[ ]`  | **Coverage ≥ 80% unit + integration (4-02)**            | Reporte de coverage muestra ≥ 80% en líneas y branches.                                                                      |       |
| SP3-T-03 | `[ ]`  | **Logging estructurado funciona (4-03)**                | Recorrer flujos golden path → cada step deja log JSON con `tenant_id`, `lead_id`, `request_id`.                              |       |
| SP3-T-04 | `[ ]`  | **Métricas BullMQ visibles (4-03)**                     | Dashboard de observabilidad muestra queue depth, throughput, jobs fallidos.                                                  |       |
| SP3-T-05 | `[ ]`  | **Tabla `llm_usage_logs` registra cada llamada (4-03)** | Tras ejecutar un workflow con LLM, verificar fila nueva con `provider`, `tokens_in`, `tokens_out`, `cost_eur`, `tenant_id`.  |       |
| SP3-T-06 | `[ ]`  | **Dashboard costes LLM (4-04)**                         | `/dashboard/costs` muestra agregados por proveedor, por tenant, por día/mes. Filtros funcionan.                              |       |
| SP3-T-07 | `[ ]`  | **WCAG 2.2 AA — admin panel completo (4-05)**           | Recorrer admin panel con lighthouse-a11y → score ≥ 90; navegación con teclado completa; contraste OK; aria-labels presentes. |       |
| SP3-T-08 | `[ ]`  | **Rate limits por endpoint (4-06)**                     | Hacer 100 requests/min a `/api/webhooks/crm` → eventualmente `429 Too Many Requests`.                                        |       |
| SP3-T-09 | `[ ]`  | **CSP headers presentes (4-06)**                        | `curl -I http://localhost:3000/` muestra `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`.          |       |
| SP3-T-10 | `[ ]`  | **CSRF tokens en server actions (4-06)**                | Inspeccionar POST de form admin → request incluye token CSRF; sin él la action falla.                                        |       |
| SP3-T-11 | `[ ]`  | **Eliminar guard `test_orchestrator_enabled`**          | El flag temporal de 1-09 ya no es necesario; las acciones orquestación funcionan sin él.                                     |       |
| SP3-T-12 | `[ ]`  | **Release notes v0.4.0 publicadas (4-07)**              | Documento `docs/releases/v0.4.0.md` existe, listado completo de cambios desde v0.0.0.                                        |       |

---

## Sprint 4 — Google Sheets bidireccional

> Versión objetivo: `v0.5.0` · Tareas 5-01-a..5-01-f.

### Tabla de tests manuales — Sprint 4

| #        | Estado | Test                                                                | Pasos / Resultado esperado                                                               | Notas |
| -------- | :----: | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| SP4-T-01 | `[ ]`  | **Columnas Sheets en crm_connections (5-01-a)**                     | DB tiene `spreadsheet_id`, `gsheet_channel_id`, `gsheet_channel_expiry`.                 |       |
| SP4-T-02 | `[ ]`  | **OAuth Google Sheets — connect (5-01-b)**                          | Click conectar → flujo OAuth Google → refresh token guardado cifrado.                    |       |
| SP4-T-03 | `[ ]`  | **Push job — lead nuevo aparece en hoja (5-01-c)**                  | Crear lead en dashboard → en ≤ 30s aparece nueva fila en la Google Sheet del tenant.     |       |
| SP4-T-04 | `[ ]`  | **Push idempotente — re-ejecución no duplica (5-01-c)**             | Forzar re-run del job → no se duplica la fila gracias a `_esden_updated_at`.             |       |
| SP4-T-05 | `[ ]`  | **Pull webhook — fila editada en hoja → lead actualizado (5-01-d)** | Editar una celda en la Sheet → en segundos el lead refleja el cambio en dashboard.       |       |
| SP4-T-06 | `[ ]`  | **Renovación canal Drive notifications (5-01-d)**                   | Esperar > 7 días o forzar expiración → cron renueva canal sin intervención.              |       |
| SP4-T-07 | `[ ]`  | **UI form conexión Sheets (5-01-e)**                                | Wizard pide spreadsheet ID, valida acceso, ofrece plantilla maestra.                     |       |
| SP4-T-08 | `[ ]`  | **Field mapper Sheets (5-01-e)**                                    | UI permite mapear columnas Sheet ↔ campos lead. Persistencia OK.                         |       |
| SP4-T-09 | `[ ]`  | **`crm_write_audit` registra cada push/pull (5-01-f)**              | Cada cambio bidireccional aparece en la tabla con `direction`, `source`, `before/after`. |       |

---

## Sprint 5 — Salesforce adapter

> Versión objetivo: `v0.6.0` · Tareas 6-01..6-06.

### Tabla de tests manuales — Sprint 5

| #        | Estado | Test                                              | Pasos / Resultado esperado                                                    | Notas |
| -------- | :----: | ------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| SP5-T-01 | `[ ]`  | **`jsforce` instalado y aprobado vía ADR (6-01)** | ADR aprobado, `jsforce@^3.10.15` en `package.json`.                           |       |
| SP5-T-02 | `[ ]`  | **Connected App OAuth — prod (6-02)**             | Flujo OAuth contra org Salesforce prod. Refresh token guardado.               |       |
| SP5-T-03 | `[ ]`  | **Connected App OAuth — sandbox (6-02)**          | Repetir con `instance=sandbox`.                                               |       |
| SP5-T-04 | `[ ]`  | **SalesforceAdapter — Leads CRUD (6-03)**         | Crear/leer/editar/borrar Leads desde dashboard → reflejado en Salesforce.     |       |
| SP5-T-05 | `[ ]`  | **SalesforceAdapter — Contacts CRUD (6-03)**      | Idem para Contacts.                                                           |       |
| SP5-T-06 | `[ ]`  | **SalesforceAdapter — Opportunities CRUD (6-03)** | Idem para Opportunities.                                                      |       |
| SP5-T-07 | `[ ]`  | **Platform Events bidireccional (6-04)**          | Crear Lead en Salesforce → llega evento Streaming API → dashboard sincroniza. |       |
| SP5-T-08 | `[ ]`  | **UI admin Salesforce field mapper (6-05)**       | Campos custom de Salesforce mapeables desde UI.                               |       |
| SP5-T-09 | `[ ]`  | **Tests integración contra sandbox (6-06)**       | Suite contra sandbox real pasa sin errores de auth.                           |       |

---

## Sprint 6 — GoHighLevel adapter

> Versión objetivo: `v0.7.0` · Tareas 7-01..7-05.

### Tabla de tests manuales — Sprint 6

| #        | Estado | Test                                     | Pasos / Resultado esperado                                               | Notas |
| -------- | :----: | ---------------------------------------- | ------------------------------------------------------------------------ | ----- |
| SP6-T-01 | `[ ]`  | **OAuth GoHighLevel (7-01)**             | Flujo OAuth GHL → tokens cifrados guardados.                             |       |
| SP6-T-02 | `[ ]`  | **GHL — sync contacts (7-02)**           | Bidireccional. Validar campos `firstName`, `lastName`, `email`, `phone`. |       |
| SP6-T-03 | `[ ]`  | **GHL — sync opportunities (7-03)**      | Pipelines de GHL importados; cambios bidireccionales.                    |       |
| SP6-T-04 | `[ ]`  | **UI admin GHL conexión (7-04)**         | Estado de conexión + reconnect + disconnect funcionan.                   |       |
| SP6-T-05 | `[ ]`  | **Tests integración sandbox GHL (7-05)** | Suite contra cuenta de prueba pasa.                                      |       |

---

## Sprint 7 — ActiveCampaign adapter

> Versión objetivo: `v0.8.0` · Tareas 8-01..8-05.

### Tabla de tests manuales — Sprint 7

| #        | Estado | Test                             | Pasos / Resultado esperado                                                     | Notas |
| -------- | :----: | -------------------------------- | ------------------------------------------------------------------------------ | ----- |
| SP7-T-01 | `[ ]`  | **API Key auth funciona (8-01)** | Guardar API Key + URL de cuenta AC desde admin. Test de conexión devuelve 200. |       |
| SP7-T-02 | `[ ]`  | **AC — sync contacts (8-02)**    | Bidireccional contacts. Tags y custom fields incluidos.                        |       |
| SP7-T-03 | `[ ]`  | **AC — sync deals (8-03)**       | Pipelines AC importados.                                                       |       |
| SP7-T-04 | `[ ]`  | **UI admin AC conexión (8-04)**  | Form sencillo (API Key + URL).                                                 |       |
| SP7-T-05 | `[ ]`  | **Tests integración AC (8-05)**  | Suite contra cuenta dev pasa.                                                  |       |

---

## Sprint 8 — Adapter pattern generalization

> Versión objetivo: `v0.9.0` · Tareas 9-01..9-04.

### Tabla de tests manuales — Sprint 8

| #        | Estado | Test                                               | Pasos / Resultado esperado                                                      | Notas |
| -------- | :----: | -------------------------------------------------- | ------------------------------------------------------------------------------- | ----- |
| SP8-T-01 | `[ ]`  | **Interface `IntegrationAdapter` extraída (9-01)** | Todos los adapters implementan la misma interface. Tests verifican el contrato. |       |
| SP8-T-02 | `[ ]`  | **Factory por tenant (9-02)**                      | Una sola función `getAdapterForTenant(tenantId, provider)` resuelve el adapter. |       |
| SP8-T-03 | `[ ]`  | **Field mapping unificado (9-03)**                 | `crm_field_mapping` cubre todos los providers con misma estructura.             |       |
| SP8-T-04 | `[ ]`  | **Docs adapter contract (9-04)**                   | `docs/architecture/adapters.md` documenta cómo añadir un nuevo CRM en < 1 día.  |       |

---

## Sprint 9 — CRMs Tier 2 on-demand

> Versión objetivo: `v0.10.x+` · Solo bajo pedido cliente — tabla por CRM activado.

### Plantilla por CRM Tier 2

> Copiar esta tabla cuando se active un nuevo Tier 2. Sustituir `<CRM>` por el nombre real (Clientify / Bitrix24 / Pipedrive / Monday / Holded).

| #                | Estado | Test                                  | Pasos / Resultado esperado                | Notas |
| ---------------- | :----: | ------------------------------------- | ----------------------------------------- | ----- |
| SP9-`<CRM>`-T-01 | `[ ]`  | **OAuth/API auth `<CRM>`**            | Conexión inicial OK.                      |       |
| SP9-`<CRM>`-T-02 | `[ ]`  | **Sync contacts/leads `<CRM>`**       | Bidireccional con campos básicos.         |       |
| SP9-`<CRM>`-T-03 | `[ ]`  | **UI admin conexión `<CRM>`**         | Form conexión + estado.                   |       |
| SP9-`<CRM>`-T-04 | `[ ]`  | **`crm_write_audit` log `<CRM>`**     | Cambios registrados.                      |       |
| SP9-`<CRM>`-T-05 | `[ ]`  | **Tests integración sandbox `<CRM>`** | Cuenta de prueba conectada y suite verde. |       |

---

## Cómo añadir un test nuevo

1. Localiza el sprint correcto (o crea una sección nueva si la tarea cruza sprints).
2. Genera el ID siguiendo el patrón `SP<n>-T-<NN>` (incremental dentro del sprint).
3. Rellena las columnas:
   - **Estado**: empieza en `[ ]`.
   - **Test**: título corto (≤ 80 caracteres).
   - **Pasos / Resultado esperado**: ≤ 2 frases. Incluir command CLI si aplica.
   - **Notas**: vacío hasta que el dev firme.
4. Si el test es **automatizable**, también añadirlo a `tests/e2e/sprint-<N>/` y marcarlo en este doc como `[x]` cubierto por suite — pero mantener la entrada para la revisión manual del cierre.

## Cuándo se ejecuta este checklist

- **Obligatorio**: en `SP-X-CLOSE-3 Test Manual del Dev` (penúltima tarea del cierre de cada sprint).
- **Opcional / mid-sprint**: cuando un bloque grande quede a 🔵 y se quiera verificar antes de seguir.

Los bugs detectados durante esta ronda van a `SP-X-CLOSE-4 Corrección de bugs detectados` como subtareas dinámicas del RoadMap.
