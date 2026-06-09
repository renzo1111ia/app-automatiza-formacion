# Security Delta — Sprint 5 (Zoho CRM entrada de leads, event-driven)

- **Sprint:** Sprint 5 — `feature/sprint-05-zoho-entrada-leads`
- **Tipo:** CLOSE-1.5 Security Delta (OWASP Top 10 2021), modo `delta`
- **Fecha:** 2026-06-08
- **Alcance:** `git diff --cached developer` — 16 archivos de producción nuevos + 3 migraciones SQL + change de scope en `crm/providers/zoho.ts`. Tests excluidos del análisis de superficie de ataque (solo lectura de soporte).
- **Ejecutor:** af-agents:security (delta)
- **Stack AF:** RLS multi-tenant Supabase self-hosted · OAuth tokens cifrados (Sprint 2) · webhooks token-auth · BullMQ workers · Server Actions Next 16

---

## 1. Resumen ejecutivo

| Severidad | Nº  | Bloquea cierre |
| --------- | --- | -------------- |
| CRÍTICO   | 0   | —              |
| ALTO      | 0   | —              |
| MEDIO     | 3   | No             |
| BAJO      | 4   | No             |

**Veredicto: NO hay findings críticos ni altos. El cierre del Sprint 5 NO está bloqueado por seguridad.**

El diseño event-driven está bien endurecido en los puntos de mayor riesgo:

- Webhook con validación de token en **tiempo constante** (`crypto.timingSafeEqual`) e `integration_id` resuelto del registro de BD (nunca del body).
- Cron **fail-closed en producción** (sin `CRON_SECRET` → 401), idéntico al patrón ya endurecido SEC-S4-01.
- RLS habilitado con policies SELECT/INSERT/UPDATE/DELETE por tenant + bypass `service_role` correcto en las **3 tablas nuevas**.
- Server Actions resuelven el tenant del usuario autenticado (`requireCurrentTenant`) y **nunca aceptan `tenant_id`/`integration_id` del cliente**.
- Guard anti-bucle pull↔writeback sólido en 3 capas (flag transaccional `SET LOCAL` + RPC whitelisted + comparación `Modified_Time`).
- Tokens generados con `crypto.randomBytes(32)` (no `Math.random`).
- PII (email/teléfono) **no se loguea en claro** en ninguno de los archivos del sprint.

Los 3 MEDIOS y 4 BAJOS son endurecimientos recomendables (backlog), ninguno explotable de forma directa en el modelo de amenazas actual.

---

## 2. Tabla de findings

| ID        | Sev   | OWASP | Archivo:línea                                                          | Resumen                                                                                                                                               |
| --------- | ----- | ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| S5-SEC-01 | MEDIO | A09   | `webhook/route.ts:67-69`, `cron/route.ts:70-73`                        | Mensajes de error de BD/excepción devueltos al cliente en el body de respuesta (fuga de detalle interno)                                              |
| S5-SEC-02 | MEDIO | A04   | `event-processor.ts:148-153`                                           | Guard anti-bucle por `Modified_Time` falla-abierto si Zoho NO devuelve `Modified_Time` (campo null) → posible re-escritura redundante                 |
| S5-SEC-03 | MEDIO | A01   | `subscription.ts`, `event-processor.ts`, `writeback.ts`                | RPCs y queries `service_role` por `integration_id` sin re-validar el `tenant_id` del job/registro (defensa en profundidad ausente, no explotable hoy) |
| S5-SEC-04 | BAJO  | A07   | `webhook/route.ts:62-65`                                               | Lookup de token con `.eq(subscription_token, token)` previo al compare constant-time → ventana teórica de timing en el índice de BD                   |
| S5-SEC-05 | BAJO  | A02   | `subscription.ts:49-52`                                                | `channel_id` generado con `crypto.randomInt` (OK) pero solo 15 dígitos — colisión teórica improbable, no es secreto de seguridad                      |
| S5-SEC-06 | BAJO  | A05   | migración `..._writeback_trigger.sql:120`, `..._guarded_update.sql:42` | `SECURITY DEFINER` sin `SET search_path` fijado en 2 funciones plpgsql                                                                                |
| S5-SEC-07 | BAJO  | A09   | `actions.ts:356`, `subscription.ts:87`                                 | Mensajes de error de Zoho/upstream propagados a la UI / logs con hasta 200 chars de payload del proveedor                                             |

---

## 3. Detalle por finding

### S5-SEC-01 — MEDIO — A09 (Security Logging & error disclosure)

**Archivos:** `src/app/api/webhooks/zoho/route.ts:67-69`, `:117-119`; `src/app/api/internal/zoho-pull/cron/route.ts:68-74`.

El webhook devuelve `{ ok:false, error:"db_error" }` (genérico, bien) pero el cron devuelve el mensaje de excepción crudo al cliente:

```ts
return NextResponse.json(
  { ok: false, error: err instanceof Error ? err.message : String(err) },
  { status: 500 }
);
```

Un mensaje de error de Postgres/Supabase puede revelar nombres de tablas, columnas o estructura interna. El cron está autenticado (fail-closed), así que el riesgo es bajo, pero el patrón de propagar `err.message` al body es una fuga de detalle innecesaria.

**Fix recomendado:** devolver un error genérico al cliente (`{ ok:false, error:"internal_error" }`) y dejar el detalle solo en `log.error`. Aplica también a `actions.ts` (`errMsg` se devuelve a la UI — aceptable para el usuario autenticado dueño del tenant, pero conviene no incluir mensajes crudos de Supabase/Zoho).

---

### S5-SEC-02 — MEDIO — A04 (Insecure Design — anti-bucle)

**Archivo:** `src/lib/integrations/zoho-pull/event-processor.ts:148-153`.

El guard primario de aplicación contra el bucle pull→writeback compara `Modified_Time`:

```ts
if (zohoModified && prev && new Date(zohoModified).getTime() === new Date(prev).getTime()) {
  result.skipped++;
  return;
}
```

Si `zohoModified` es `null` (Zoho no incluye `Modified_Time` en la carga de `getLead`, o el lead se mapeó sin ese campo), la condición es falsa → **se procede al UPDATE igualmente**. No hay bucle infinito real porque la **segunda barrera (la dura)** sí funciona: el UPDATE va por la RPC `zoho_pull_update_lead`, que setea `app.zoho_pull_in_progress=true` en la misma transacción y el trigger SQL hace `RETURN NEW` sin encolar writeback. Por eso es MEDIO y no ALTO: el bucle está cortado por la capa SQL, pero el guard de aplicación deja pasar trabajo redundante (UPDATEs innecesarios cuando `Modified_Time` es null).

**Fix recomendado:** cuando `zohoModified` sea null, comparar un hash del payload mapeado contra el último visto (o al menos loguear `zoho_modified_time_missing`) para no re-escribir leads sin cambios. No bloquea; abrir BUG para Sprint 6.

---

### S5-SEC-03 — MEDIO — A01 (Broken Access Control — defensa en profundidad)

**Archivos:** `subscription.ts:122-129`, `:168-174`, `:218-220`; `event-processor.ts:70-73`, `:125-130`; `maintenance.ts:59-64`, `:121-124`.

Las operaciones `service_role` (bypass RLS, correcto para workers) filtran por `integration_id` sin re-afirmar el `tenant_id`:

```ts
await supabase.from("zoho_sync_connections").update({...}).eq("integration_id", integrationId);
```

`integration_id` es una FK con `UNIQUE(tenant_id, integration_id)`, y el origen del `integration_id` es siempre confiable (resuelto vía `requireCurrentTenant` → `getIntegrationByProvider(tenantId,...)` en las Server Actions, o del registro de BD en el webhook). Por tanto **no hay IDOR cross-tenant explotable hoy**. El riesgo es de defensa en profundidad: si en el futuro un `integration_id` llegara desde una fuente no validada, estas escrituras `service_role` no tienen segunda barrera de tenant.

`event-processor.ts` sí pasa `p_tenant_id` a la RPC (que filtra `WHERE tenant_id = p_tenant_id` — bien), pero el `tenant_id` viene del job y no se re-valida contra la connection cargada por `integration_id`. El `writeback.ts` SÍ valida explícitamente (`conn.tenant_id !== tenantId → return` en `:137`) — buen patrón, replicarlo.

**Fix recomendado:** en las escrituras de `subscription.ts`/`maintenance.ts` añadir `.eq("tenant_id", tenantId)` cuando el tenant esté disponible; y en `event-processor.handleExisting/handleNew` verificar que la connection cargada (`connRow`) tiene `tenant_id === job.tenant_id` antes de escribir. Backlog, no bloquea.

---

### S5-SEC-04 — BAJO — A07 (Auth — timing)

**Archivo:** `src/app/api/webhooks/zoho/route.ts:62-65`.

El token entrante se busca con `.eq("subscription_token", token).maybeSingle()` ANTES del compare `timingSafeEqual`. La query indexada introduce una diferencia de tiempo medible entre "token existe" y "token no existe". La verificación criptográfica final SÍ es constant-time, así que un atacante no puede extraer el token byte a byte; como mucho podría distinguir tokens válidos de inválidos por tiempo de respuesta — irrelevante porque ya recibe un 403 explícito en ambos casos. Es el mismo trade-off aceptado en el webhook de Sheets.

**Fix recomendado:** aceptable como está. Si se quiere endurecer, normalizar el tiempo de respuesta del path de rechazo (delay fijo). Backlog opcional.

---

### S5-SEC-05 — BAJO — A02 (Cryptographic)

**Archivo:** `src/lib/integrations/zoho-pull/subscription.ts:49-52`.

`channel_id` se genera con `crypto.randomInt` (CSPRNG, correcto) pero como `Math.floor(1e14 + crypto.randomInt(0, 9e14))` → 15 dígitos. No es un secreto de seguridad (es un identificador de canal que Zoho exige numérico), así que la entropía limitada no es un problema de confidencialidad; solo una colisión teórica con otra suscripción del mismo tenant (probabilidad ~despreciable). El `subscription_token` (el secreto real) sí usa `crypto.randomBytes(32)` → correcto.

**Fix recomendado:** ninguno necesario. Documentado para audit trail.

---

### S5-SEC-06 — BAJO — A05 (Security Misconfiguration — search_path)

**Archivos:** `supabase/migrations/20260608153100_zoho_writeback_trigger.sql:120`; `20260608153200_zoho_pull_guarded_update.sql:42`.

Ambas funciones son `SECURITY DEFINER` sin `SET search_path = public, pg_temp`. En un Postgres compartido, un `search_path` no fijado en una función `SECURITY DEFINER` es un vector clásico de escalada (un objeto malicioso en un esquema anterior en el path podría secuestrar una referencia sin cualificar). En la práctica el riesgo es bajo porque: todas las referencias dentro de las funciones están cualificadas con `public.` (`public.zoho_lead_synced`, `public.zoho_writeback_outbox`, `public.lead`) y solo `service_role`/`authenticated` ejecutan; aun así es la recomendación estándar de Supabase.

**Fix recomendado:** añadir `SET search_path = public, pg_temp` a la definición de `tr_lead_changes_to_zoho_writeback()` y `zoho_pull_update_lead()`. Cambio de 1 línea por función, aplicar en migración de seguimiento.

---

### S5-SEC-07 — BAJO — A09 (Logging — upstream payload echo)

**Archivos:** `subscription.ts:87` (`JSON.stringify(json)?.slice(0,200)` en el mensaje de error de Zoho); `actions.ts:356` (`warnMsg.slice(0,120)` a la UI).

Los errores de la API de Zoho se incrustan (truncados) en mensajes de excepción que terminan en logs y, en el caso de `actions.ts`, en un toast de la UI. La respuesta de error de Zoho no debería contener PII de leads (es un error de la operación watch/search), pero echar payload de un proveedor externo a logs/UI es una práctica a vigilar.

**Fix recomendado:** loguear el status code + un código de error de Zoho en vez del JSON crudo. Backlog.

---

## 4. Verificaciones que PASARON (audit trail)

**A01 — Broken Access Control / IDOR cross-tenant**

- RLS `ENABLE ROW LEVEL SECURITY` en las 3 tablas nuevas: `zoho_sync_connections`, `zoho_lead_synced`, `zoho_writeback_outbox`.
- Policies SELECT/INSERT/UPDATE/DELETE en `zoho_sync_connections` y `zoho_lead_synced` filtran por `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())` OR `is_admin` desde `app_metadata` (server-controlled, no manipulable por el cliente). `WITH CHECK` presente en INSERT/UPDATE.
- `zoho_writeback_outbox` solo expone SELECT a `authenticated` (los authenticated no escriben en la outbox — solo el trigger SQL y el worker). Diseño correcto: menor superficie.
- Policy `service_role ... FOR ALL USING(true) WITH CHECK(true)` en las 3 tablas → bypass correcto para workers/webhooks.
- Server Actions (`actions.ts`): TODAS resuelven `const { tenantId } = await requireCurrentTenant()` y derivan `integration` vía `getIntegrationByProvider(tenantId,"zoho")`. **Ninguna acción acepta `tenant_id` ni `integration_id` como parámetro del cliente.** Inputs validados con Zod (`SaveZohoSyncConfigSchema`).
- `requireCurrentTenant` re-valida la cookie `esden-tenant-id`: un no-admin solo puede operar su tenant propio (la cookie manipulada cae al fallback del tenant dueño).
- Página `/dashboard/settings/integrations/zoho-pull`: la protección de datos efectiva está en `getZohoSyncStatusAction` → `requireCurrentTenant()` lanza "No autenticado" sin sesión, devolviendo `NotConnectedCard` sin fuga. Consistente con el patrón de la página de Sheets ya en `developer`.
- `writeback.ts:137` valida explícitamente `conn.tenant_id !== tenantId → return` (defensa en profundidad ejemplar).

**A07 — Auth failures (webhook + cron)**

- Webhook: token obligatorio (`!token → 403`), comparación **constant-time** con `crypto.timingSafeEqual` (`tokensMatch`), con guarda de longitud previa. `integration_id`/`tenant_id` se toman del registro `zoho_sync_connections` resuelto por el token, **NUNCA del body** (`extractLeadIds` solo extrae `zoho_lead_id`s, no identidades). Token inválido → 403 sin encolar. Connection inactiva → 200 ignorado sin procesar.
- Cron: **fail-closed en producción** — `CRON_SECRET` ausente + `NODE_ENV==="production"` → `return false` (401). En dev se permite con warning. Comparación `timingSafeEqual` con guarda de longitud. Idéntico al patrón endurecido SEC-S4-01 de `sheets/cron/route.ts` (verificado lado a lado).

**A03 — Injection**

- `searchLeads(criteria, page, perPage)` del provider construye la query con `URLSearchParams` (URL-encoding automático) → sin inyección en la URL de Zoho.
- El `criteria` de `maintenance.ts` se construye solo a partir de timestamps internos (`toZohoCriteriaTime(cursorDate)`), nunca de input de usuario. El de `actions.ts:335` es una constante literal. Sin superficie de inyección de criteria.
- Todos los inserts/updates a Supabase usan el query builder parametrizado (`.insert()`, `.update()`, `.upsert()`, `.rpc()`) — **cero concatenación de SQL**.
- La RPC `zoho_pull_update_lead` usa **whitelist de columnas** (`current_stage, status, email, telefono, pais, nombre, apellido` con `COALESCE((p_changes->>'col')::text, col)`) → claves arbitrarias del JSONB se ignoran, no se puede inyectar columnas.

**A02 — Cryptographic / secrets**

- `subscription_token` generado con `crypto.randomBytes(32).toString("base64url")` (~43 chars) en `subscription.ts:56` y `actions.ts:208`. **No se usa `Math.random` para secretos.**
- No hay secretos hardcodeados. Los tokens OAuth viven cifrados AES-256 en `integrations` (Sprint 2), referenciados por `integration_id` — las tablas nuevas NO duplican credenciales.
- El `subscription_token` se transporta en `?token=` de la `notify_url` (necesario, es como Zoho lo reenvía) y se valida constant-time al recibirlo.

**A04 — Insecure Design (anti-bucle pull↔writeback)**

- Guard en 3 capas: (1) `event-processor` compara `Modified_Time` y hace skip si no cambió; (2) el UPDATE va por RPC `zoho_pull_update_lead` que ejecuta `set_config('app.zoho_pull_in_progress','true',true)` (LOCAL, transaccional) en la **misma transacción** que el UPDATE; (3) el trigger `tr_lead_changes_to_zoho_writeback` lee `current_setting('app.zoho_pull_in_progress', true)='true'` y hace `RETURN NEW` sin encolar. UPDATEs de UI/agentes (sin el flag) SÍ encolan writeback. **El bucle infinito está cortado por la capa SQL** (ver S5-SEC-02 para el caso `Modified_Time` null, que solo causa trabajo redundante, no bucle).
- Outbox pattern durable: writeback sobrevive caídas del worker; `MAX_ATTEMPTS=5` con backoff evita retry infinito.

**A05 — Security Misconfiguration**

- Webhook responde errores genéricos (`missing_token`, `invalid_token`, `db_error`, `enqueue_failed`) sin stack traces. (Excepción menor en cron → S5-SEC-01.)
- CHECK constraints en BD: `subscription_method IN (...)`, `status IN ('pending','processing','done','failed')`.
- Índices parciales correctos (`WHERE is_active=true`), FKs con `ON DELETE CASCADE`/`SET NULL` coherentes.

**A09 — Logging (PII)**

- **PII NO se loguea en claro.** Los `log.info/warn/error` de los archivos del sprint registran `tenant_id`, `integration_id`, `lead_id`, `zoho_lead_id`, `connection_id`, `field_name`, conteos y `error.message` — **nunca el valor de `email`, `telefono` ni `nombre` del lead**.
- `lead-mapper.ts:74` loguea `zoho_status` truncado a 40 chars con comentario explícito de que es texto de configuración de pipeline, no PII.
- El proyecto tiene helpers `maskEmail`/`maskPhone` en `src/lib/security/pii-mask.ts` (Sprint 3, BUG-SEC-03). No se invocan en zoho-pull porque **no se loguea PII que enmascarar** — correcto por construcción.
- El audit R-014 (`recordWritebackAudit`) almacena `new_value` en `crm_write_audit` por diseño funcional (trazabilidad de escrituras), no en logs de aplicación — comportamiento esperado y protegido por RLS de esa tabla.

**BullMQ / queue**

- Dedup por `jobId` determinista + `removeOnComplete:true` (lección BUG-4-09). Payload validado con `ZohoPullJobSchema.parse` antes de encolar. Sin ejecución de código dinámico.

---

## 5. Pendiente de validación E2E contra cuenta Zoho real (NO es finding)

Conocido y aceptado — el Sprint 2 implementó el adapter Zoho contra mocks; la cuenta OAuth real (DC `.eu`, Org 20115313796) aún no tiene la app OAuth registrada. Por tanto las siguientes verificaciones quedan diferidas a la sesión de validación E2E con cuenta real (no afectan al veredicto de seguridad estático):

- Formato exacto del `criteria` v8 (`Modified_Time:greater_than:<ISO+offset>`) contra el endpoint real de `searchLeads`.
- Forma real del body de la Notifications API v8 y del Workflow Webhook (el `extractLeadIds` cubre defensivamente `ids` / `data` / `id|entity_id|record_id|lead_id`, pero solo la cuenta real confirma la clave efectiva).
- Que `/crm/v8/actions/watch` acepte el `channel_id` numérico de 15 dígitos y el `channel_expiry` de 7 días con el scope `ZohoCRM.notifications.ALL` recién añadido.
- Presencia de `Modified_Time` en la respuesta de `getLead` (relevante para S5-SEC-02).

Estas validaciones son funcionales/de integración, no de seguridad; el endurecimiento de seguridad analizado aquí es independiente del backend Zoho real.

---

## 6. Acciones recomendadas

| ID              | Acción                                                                                                       | Cuándo                         |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| S5-SEC-01       | Errores genéricos al cliente en cron/webhook, detalle solo en logs                                           | BUG Sprint 6                   |
| S5-SEC-02       | Fallback de comparación cuando `Modified_Time` es null                                                       | BUG Sprint 6                   |
| S5-SEC-03       | Añadir `.eq(tenant_id)` defensivo en escrituras service_role + verificar `connRow.tenant_id===job.tenant_id` | Backlog                        |
| S5-SEC-06       | `SET search_path = public, pg_temp` en las 2 funciones SECURITY DEFINER                                      | Migración seguimiento (rápida) |
| S5-SEC-04/05/07 | Endurecimientos opcionales                                                                                   | Backlog                        |

**Ninguna acción bloquea el cierre de Sprint 5.** Se recomienda priorizar S5-SEC-06 (1 línea/función, buena práctica Supabase) en una migración de seguimiento antes de promoción a staging.
