# Security Delta OWASP 2021 — Sprint 4 (Google Sheets bidireccional)

- **Fecha**: 08-06-2026
- **Agente**: af-agents:security (modo delta)
- **Sprint**: 4 — Google Sheets bidireccional (cierre formal)
- **Alcance**: código `src/lib/integrations/sheets/*`, UI `src/app/dashboard/settings/integrations/google-sheets/*`, rutas API `src/app/api/{webhooks/google-sheets,internal/sheets/cron,integrations/google/{auth,callback}}/route.ts`, migraciones `20260527000000_sheet_connections.sql` + `20260527000002_sheets_writeback_trigger.sql`. Helpers compartidos auditados como contexto: `oauth-state.ts`, `token-crypto.ts`, `next.config.ts` (CSP), `integrations-repository.ts` (audit R-014).
- **Estándar**: OWASP Top 10 2021, mapeado al stack AF (RLS multi-tenant, OAuth tokens cifrados, webhooks, Server Actions LLM).

> **Actualización de cierre (08-06-2026, CLOSE-4)** — Fixes aplicados in-session durante el cierre formal de Sprint 4:
>
> - ✅ **SEC-S4-01 (ALTO) FIXED** — `src/app/api/internal/sheets/cron/route.ts`: `authorize()` ahora es **fail-closed en producción** (deniega si `NODE_ENV=production` y falta `CRON_SECRET`) + comparación con `timingSafeEqual`. `.env.example` documenta que la var es obligatoria en prod.
> - ✅ **SEC-S4-07 (MEDIO) FIXED** — `src/lib/integrations/sheets/adapter.ts:writeCells`: `valueInputOption` cambiado de `USER_ENTERED` a `RAW` (evita formula injection en la Sheet del cliente).
> - 🔵 Pendientes a backlog como BUG-4-XX (MEDIO, no bloquean): channel_token webhook no constant-time + PII de leads en `error.message` (UI / `last_sync_error` / warnings de coerción).

---

## 1. Resumen ejecutivo

El código de Sprint 4 está, en líneas generales, **bien construido en lo que respecta a los controles de seguridad de mayor riesgo del stack**: el aislamiento multi-tenant es sólido (toda Server Action resuelve el tenant del usuario autenticado vía `requireCurrentTenant()` y NUNCA acepta `tenant_id` del cliente; todos los queries filtran por `tenant_id`), los tokens OAuth y el Client ID/Secret de Google se persisten cifrados con AES-256-GCM, el flujo OAuth usa state HMAC-SHA256 verificado en tiempo constante, las tablas nuevas tienen RLS habilitado con policies por `tenant_id` + bypass `service_role`, el writeback registra audit R-014 append-only con `write_policy: overwrite_with_audit`, y los rangos a la Sheets API se construyen con escape de comillas (sin inyección de A1-notation). **No se han detectado findings CRÍTICOS.** Se detecta **1 finding ALTO** (auth fail-open del endpoint cron cuando `CRON_SECRET` no está configurado) y varios MEDIOS/BAJOS centrados en comparaciones de secretos no constant-time, RLS con `auth_user_id` directo (no cubre miembros no-dueños del tenant), y PII (email/teléfono) que puede acabar en logs vía mensajes de error de Postgres.

### Conteo por severidad

| Severidad | Nº     |
| --------- | ------ |
| CRÍTICO   | 0      |
| ALTO      | 1      |
| MEDIO     | 4      |
| BAJO      | 4      |
| INFO      | 3      |
| **Total** | **12** |

---

## 2. Findings

### SEC-S4-01 — Endpoint cron fail-open sin `CRON_SECRET` (ALTO)

- **Severidad**: ALTO
- **OWASP**: A07 Identification & Authentication Failures / A05 Security Misconfiguration
- **Archivo**: `src/app/api/internal/sheets/cron/route.ts:21-30`
- **Descripción**: La función `authorize()` devuelve `true` (acceso permitido) cuando `process.env.CRON_SECRET` no está definido. Es un patrón fail-open: si en producción la variable se omite por error de configuración, el endpoint queda completamente abierto a internet. Este endpoint dispara `runWritebackOutbox()` (escritura a Google Sheets de TODOS los tenants) y `renewExpiringWatchChannels()` (recreación de watch channels Drive de todos los tenants). Un atacante anónimo podría forzar drenaje de cuota de la API de Google y escritura masiva en hojas de clientes.
- **Evidencia**:
  ```ts
  function authorize(req: NextRequest): boolean {
    const headerSecret = req.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET;
    // En dev local sin CRON_SECRET, permitir si no esta seteado (warning).
    if (!expected) {
      log.warn("CRON_SECRET no configurado - endpoint sin auth (solo dev)");
      return true; // ← fail-open
    }
    return headerSecret === expected;
  }
  ```
- **Recomendación**:
  1. Fail-closed en producción: `if (!expected) return process.env.NODE_ENV !== "production";` o mejor, retornar `false` siempre que falte el secreto y exigir su presencia.
  2. Añadir `CRON_SECRET` a `.env.example` y al hand-off pre-deploy VPS como variable obligatoria (gate de arranque o test de smoke).
  3. Usar comparación constant-time (`crypto.timingSafeEqual`) en lugar de `===` (ver SEC-S4-03).

---

### SEC-S4-02 — `channel_token` del webhook Drive comparado con `!==` (no constant-time) (MEDIO)

- **Severidad**: MEDIO
- **OWASP**: A02 Cryptographic Failures (timing side-channel) / A07
- **Archivo**: `src/app/api/webhooks/google-sheets/route.ts:63`
- **Descripción**: El token del canal Drive (secreto de 36 chars que autentica el webhook como legítimo) se compara con `!==`, susceptible en teoría a un timing attack para inferir el token byte a byte. El riesgo real es bajo (el token es un UUIDv4 de alta entropía, la query previa por `drive_channel_id` ya acota la fila, y la latencia de red de un webhook público diluye la señal), pero es un secreto y debería compararse en tiempo constante por consistencia con el resto del código (el OAuth state SÍ lo hace).
- **Evidencia**:
  ```ts
  if (r.drive_channel_token !== channelToken) {
    log.error("channel_token MISMATCH - posible spoof", { channelId });
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }
  ```
- **Recomendación**: Comparar con `crypto.timingSafeEqual(Buffer.from(r.drive_channel_token), Buffer.from(channelToken))`, controlando longitudes desiguales (devolver 403 si difieren).

---

### SEC-S4-03 — `CRON_SECRET` comparado con `===` (no constant-time) (BAJO)

- **Severidad**: BAJO
- **OWASP**: A02 Cryptographic Failures (timing side-channel)
- **Archivo**: `src/app/api/internal/sheets/cron/route.ts:29`
- **Descripción**: `return headerSecret === expected;` — misma observación que SEC-S4-02 para el secreto del cron. Riesgo bajo pero trivial de endurecer.
- **Recomendación**: `timingSafeEqual` con manejo de longitudes y de `headerSecret` nulo.

---

### SEC-S4-04 — RLS basado en `tenants.auth_user_id = auth.uid()` no cubre miembros no-dueños del tenant (MEDIO)

- **Severidad**: MEDIO
- **OWASP**: A01 Broken Access Control
- **Archivo**: `supabase/migrations/20260527000000_sheet_connections.sql:109-143` y `:208-218`; `20260527000002_sheets_writeback_trigger.sql:53-60`
- **Descripción**: Las policies SELECT/INSERT/UPDATE/DELETE conceden acceso solo a `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())` o a admins globales. El modelo asume "1 tenant = 1 usuario dueño". Si el modelo de negocio evoluciona a varios usuarios por tenant (membership), estas policies dejarían fuera a los miembros legítimos no-dueños (over-restrictive, no over-permissive — no es una fuga, es una negación de acceso). El acceso operativo real lo da `service_role` desde los processors (que sí filtran por `tenant_id` en código), por lo que la app funciona; el riesgo es de diseño/consistencia con el resto del esquema multi-tenant. **No es una vulnerabilidad de fuga cross-tenant** — el sentido de la condición es correcto (restrictivo).
- **Evidencia**:
  ```sql
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );
  ```
- **Recomendación**: Si/cuando se introduzca membership multi-usuario por tenant, sustituir el subselect por una función `current_user_tenant_ids()` reutilizable (tabla `tenant_members`). Documentar la asunción "dueño único" hasta entonces. Mantener consistencia con las policies del resto de tablas multi-tenant del proyecto.

---

### SEC-S4-05 — Mensajes de error de Postgres (con posible PII) propagados a la UI y a logs (MEDIO)

- **Severidad**: MEDIO
- **OWASP**: A09 Security Logging & Monitoring Failures / A04 Insecure Design (information disclosure)
- **Archivos**:
  - `src/lib/integrations/sheets/actions.ts:145` (`Error creando connection: ${insertErr?.message}`) y `errMsg()` :524-530, devuelto al cliente en cada acción.
  - `src/lib/integrations/sheets/pull-processor.ts:260,342` (`result.errors.push(\`row ${i}: ${leadErr.message}\`)`), luego persistido en `sheet_connections.last_sync_error` (:422) y visible en UI.
- **Descripción**: Los `error.message` crudos de PostgREST/Postgres se concatenan y se devuelven al cliente (Server Actions) y se guardan en `last_sync_error`. En errores de constraint (p.ej. unique violation, check violation) Postgres puede incluir el valor del campo conflictivo — que en este flujo es PII de leads (email, teléfono): `duplicate key value violates unique constraint ... (email)=(juan@x.com)`. Esto expone PII en logs y en la UI a usuarios del tenant. Aunque el tenant ve datos de su propio tenant (no cross-tenant), agravar la superficie de PII en logs estructurados es indeseable bajo GDPR para el sector formación.
- **Evidencia**:
  ```ts
  result.errors.push(`row ${i}: ${leadErr.message}`);
  // ...
  last_sync_error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
  ```
- **Recomendación**: Sanitizar / mapear errores de BD a mensajes genéricos antes de exponerlos (`"fila N: error al guardar el lead (ver logs)"`), guardando el detalle crudo solo en el logger de servidor con nivel adecuado y, si es posible, con redacción de PII. No persistir `error.message` crudo en columnas legibles desde la UI.

---

### SEC-S4-06 — PII de leads (email/teléfono) en payload de logs estructurados (MEDIO)

- **Severidad**: MEDIO
- **OWASP**: A09 Security Logging & Monitoring Failures
- **Archivos**: `src/lib/integrations/sheets/pull-processor.ts` (objetos de log con `tenant_id`, `lead_id`, `row_index`), `row-mapper.ts:217` (`reason: \`No se pudo convertir "${raw}" a tipo ${col.type}\``—`raw`puede ser un email/teléfono mal formateado),`writeback.ts` logs.
- **Descripción**: Los logs no vuelcan email/teléfono directamente en la mayoría de casos (se loguea `lead_id`/`row_index`, lo cual es bueno), PERO el warning de coerción en `mapRowToLead` incluye el valor crudo `raw` de la celda, que para columnas `email`/`phone` es PII directa. Ese warning se cuenta en `result.warnings` y los mensajes se construyen con el valor.
- **Evidencia**:
  ```ts
  out.warnings.push({
    letter: col.letter,
    target: col.target,
    reason: `No se pudo convertir "${raw}" a tipo ${col.type}`, // raw = PII si col.type es email/phone
  });
  ```
- **Recomendación**: No incluir el valor crudo en warnings de columnas de tipo `email`/`phone`; sustituir por longitud o máscara (`"valor de 12 chars"` / `j***@***.com`). Confirmar que el logger Pino tiene redaction configurada para campos sensibles.

---

### SEC-S4-07 — `valueInputOption: "USER_ENTERED"` en writeback permite que valores controlados se interpreten como fórmulas (BAJO)

- **Severidad**: BAJO
- **OWASP**: A03 Injection (formula/CSV injection en destino)
- **Archivo**: `src/lib/integrations/sheets/adapter.ts:156`
- **Descripción**: El writeback escribe celdas con `valueInputOption: "USER_ENTERED"`, lo que hace que Google interprete strings que empiezan por `=`, `+`, `-`, `@` como fórmulas. Los valores que escribimos provienen de cambios de estado del lead (`current_stage`, `cualificacion`, etc.) que hoy son enums controlados, por lo que el riesgo práctico es muy bajo. No obstante, si en el futuro se permite writeback de campos de texto libre (notas, motivos editados por el advisor), un valor como `=IMPORTXML(...)` se ejecutaría en la hoja del cliente (formula injection / exfiltración a un endpoint del atacante).
- **Evidencia**:
  ```ts
  requestBody: { valueInputOption: "USER_ENTERED", data },
  ```
- **Recomendación**: Usar `valueInputOption: "RAW"` para el writeback (no necesitamos que Google interprete fórmulas para reflejar estados), o prefijar con `'` los valores de texto libre. RAW es la opción segura por defecto para datos que no son fórmulas legítimas del usuario.

---

### SEC-S4-08 — Server Actions destructivas/de pull sin re-validación de pertenencia previa por `tenant_id` antes de operación remota (BAJO)

- **Severidad**: BAJO
- **OWASP**: A01 Broken Access Control (defensa en profundidad)
- **Archivo**: `src/lib/integrations/sheets/actions.ts:312-327` (`triggerManualPullAction`), `:249-267` (`toggleSheetActiveAction`)
- **Descripción**: `triggerManualPullAction(sheetConnectionId)` encola un pull con el `tenantId` del usuario autenticado SIN verificar antes que ese `sheetConnectionId` pertenezca a ese tenant. La verificación efectiva ocurre downstream en `processSheetPullJob`, que hace `.eq("id", job.sheet_connection_id).eq("tenant_id", job.tenant_id)` — por lo que un `sheetConnectionId` de otro tenant simplemente no devolverá fila y el job fallará sin efecto cross-tenant. `toggleSheetActiveAction` y `updateSheetMappingAction`/`disconnectSheetAction` SÍ acotan con `.eq("tenant_id", tenantId)` en el propio UPDATE/DELETE (correcto). El finding es que `triggerManualPull` confía en la validación diferida; es seguro hoy pero frágil si el processor cambia. No hay IDOR explotable.
- **Evidencia**:
  ```ts
  export async function triggerManualPullAction(sheetConnectionId: string) {
    const { tenantId } = await requireCurrentTenant();
    const jobId = await enqueueSheetPull({ sheet_connection_id: sheetConnectionId, tenant_id: tenantId, ... });
  ```
- **Recomendación**: Verificar pertenencia (`select id where id=? and tenant_id=?`) antes de encolar, devolviendo error si no pertenece. Defensa en profundidad barata.

---

### SEC-S4-09 — `setAppCredentials` (UPDATE) no acota por `tenant_id` en el WHERE (BAJO)

- **Severidad**: BAJO
- **OWASP**: A01 Broken Access Control (defensa en profundidad)
- **Archivo**: `src/lib/integrations/sheets/credentials.ts:99-104`
- **Descripción**: Al actualizar credenciales, el UPDATE filtra solo por `.eq("id", existing.id)`. `existing` proviene de `getSheetsIntegration(tenantId)` que SÍ filtró por `tenant_id`, así que `existing.id` ya es del tenant correcto y no hay fuga. No obstante, por consistencia con el patrón del resto del código (todos los UPDATE/DELETE de sheets añaden `.eq("tenant_id", tenantId)`), conviene añadir el filtro redundante para que el control sea local a la sentencia y resista refactors.
- **Recomendación**: Añadir `.eq("tenant_id", tenantId)` al UPDATE.

---

### SEC-S4-10 — Scopes OAuth mínimos y correctos (INFO — verificación positiva)

- **Severidad**: INFO
- **OWASP**: A05 Security Misconfiguration (verificación OK)
- **Archivo**: `src/app/api/integrations/google/auth/route.ts:31-34`
- **Descripción**: Verificado que los scopes solicitados son `drive.file` (acceso solo a archivos que el usuario abre/crea explícitamente vía Picker — NO `drive` completo) + `userinfo.email`. Es el principio de mínimo privilegio bien aplicado: la app no puede ver toda la Drive del cliente, solo las hojas que él selecciona en el Picker. `access_type: "offline"` + `prompt: "consent"` correctos para obtener refresh_token. **Sin acción.**

---

### SEC-S4-11 — CSP de Google Picker razonablemente acotada; `'unsafe-inline'` script-src persiste (INFO)

- **Severidad**: INFO
- **OWASP**: A05 Security Misconfiguration
- **Archivo**: `next.config.ts:36-74`
- **Descripción**: La CSP para soportar el Picker añade `https://apis.google.com` a `script-src`, `frame-src https://docs.google.com https://accounts.google.com` y los `connect-src` de las APIs de Google — todo acotado a dominios concretos de Google (correcto, no comodines amplios). `'unsafe-eval'` queda restringido a dev. Persiste `'unsafe-inline'` en `script-src` (necesario hoy por la hidratación de Next.js); es deuda preexistente del proyecto, no introducida por Sprint 4. El comentario del código menciona "strict-dynamic en Sprint 4" pero no está aplicado. **Observacional**, no bloqueante.
- **Recomendación**: Backlog: migrar a `script-src` basado en nonce/`strict-dynamic` para eliminar `'unsafe-inline'` (mejora global, no específica de Sheets).

---

### SEC-S4-12 — Trigger SQL `SECURITY DEFINER` correcto y acotado (INFO — verificación positiva)

- **Severidad**: INFO
- **OWASP**: A04 Insecure Design (verificación OK)
- **Archivo**: `supabase/migrations/20260527000002_sheets_writeback_trigger.sql:71-120`
- **Descripción**: La función `tr_lead_changes_to_sheets_writeback()` es `SECURITY DEFINER` (necesario para insertar en `sheets_writeback_outbox` desde el contexto del UPDATE de `lead`). El payload `changes` se arma exclusivamente con valores `NEW.*` de columnas conocidas (`current_stage`, `status`, `email`, `telefono`) vía `jsonb_build_object` — no hay SQL dinámico ni concatenación de strings, por lo que no hay vector de inyección. El `tenant_id` insertado es `NEW.tenant_id` (del propio lead), coherente. `pg_notify` es best-effort. **Diseño correcto.** Nota menor: `SECURITY DEFINER` sin `SET search_path = public` fijo podría, en un esquema comprometido, resolver objetos por search_path del invocador; recomendable añadir `SET search_path = public, pg_temp` a la función por hardening estándar de funciones DEFINER.

---

## 3. Veredicto

**¿Hay findings CRÍTICOS o ALTOS que BLOQUEEN el cierre del sprint?**

- **CRÍTICOS: 0** → no bloquean.
- **ALTOS: 1** (SEC-S4-01, cron fail-open). Según el protocolo de cierre del proyecto, los **altos generan BUG-X para el próximo sprint pero NO bloquean** el cierre. No obstante, **SEC-S4-01 es de fix trivial (3-5 líneas) y de impacto real en producción VPS** (escritura masiva a Sheets de clientes + drenaje de cuota Google si la env var se omite). **Recomendación firme: corregir SEC-S4-01 dentro de este cierre (CLOSE-4) antes del push**, ya que el coste es mínimo y el endpoint cron se activará en el deploy VPS. Si se decide diferir, debe quedar como BUG-4-XX con `CRON_SECRET` marcado obligatorio en el hand-off pre-deploy.

**Conclusión**: El sprint puede cerrarse. No hay bloqueo CRÍTICO. Se recomienda fix in-session de SEC-S4-01 (ALTO) + idealmente SEC-S4-07 (`USER_ENTERED`→`RAW`, también trivial). Los MEDIOS (constant-time webhook token, PII en errores/logs) deberían convertirse en BUG-4-XX para el siguiente sprint. Los BAJOS/INFO al backlog.

### Tabla de acciones sugeridas

| ID              | Sev   | Acción                                               | Cuándo                               |
| --------------- | ----- | ---------------------------------------------------- | ------------------------------------ |
| SEC-S4-01       | ALTO  | Fail-closed cron + `CRON_SECRET` obligatorio         | Fix in-session (CLOSE-4) recomendado |
| SEC-S4-07       | BAJO  | `USER_ENTERED` → `RAW` en writeback                  | Fix in-session (trivial) recomendado |
| SEC-S4-02       | MEDIO | `timingSafeEqual` para channel_token webhook         | BUG-4-XX próximo sprint              |
| SEC-S4-05       | MEDIO | Sanitizar errores BD antes de UI/`last_sync_error`   | BUG-4-XX próximo sprint              |
| SEC-S4-06       | MEDIO | Mascarar PII en warnings de coerción                 | BUG-4-XX próximo sprint              |
| SEC-S4-04       | MEDIO | Función RLS reutilizable cuando haya membership      | Backlog (diseño)                     |
| SEC-S4-03/08/09 | BAJO  | Endurecimientos de consistencia                      | Backlog                              |
| SEC-S4-10/11/12 | INFO  | Verificaciones positivas / backlog CSP + search_path | Informativo                          |
