# Phase 03 — Endpoints sin autenticación

## Context Links
- [plan.md](plan.md) — overview Sprint 0
- [RoadMap Bloque 1.3](../RoadMap.md) — tareas 1-07, 1-08, 1-09, 1-10, 1-11
- [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) — DA-2-001, DA-2-002, DA-2-003, DA-3-001, DA-3-003, DA-3-007
- [docs/audit/deep/DA-2-auth-rls-deep.md](../../docs/audit/deep/DA-2-auth-rls-deep.md)
- [docs/audit/deep/DA-3-security-deep.md](../../docs/audit/deep/DA-3-security-deep.md)

## Overview

**Prioridad:** P1 — Crítico. 7 endpoints de orquestación + 3 crons abiertos a internet sin ninguna auth.
**Estado:** 🔘 Pendiente
**Estimación:** 17h (1-07: 8h + 1-08: 4h + 1-09: 2h + 1-10: 2h + 1-11: 1h)
**Agentes:** `af-agents:code` (implementación) + `af-agents:api` (contratos y middleware)

> **Pre-requisito bloqueante: 1-26 (Ph6) DEBE completarse antes de iniciar esta fase.**
> El CVE GHSA-492v-c6pp-mqqv (middleware bypass CVSS 8.1) en `next@16.1.6` permite eludir cualquier middleware de auth de Next.js con peticiones crafteadas. Las protecciones de 1-07 y 1-08 son inefectivas si next no está actualizado a 16.2.6 primero.

Cualquier agente externo puede invocar los endpoints de orquestación, triggear crons manualmente, crear leads reales desde el endpoint de test, descargar la SQL de configuración de cualquier tenant, o acceder al MIGRATION_SQL completo. No se requieren credenciales.

## Key Insights

- **DA-2-001**: Las rutas `/api/orchestration/deploy`, `graph`, `publish`, `sweep`, `workflows`, `calls/manual`, `cron/appointments` no tienen ningún middleware de sesión. 1h por endpoint promedio incluyendo tests (1-07 = 8h total).
- **DA-3-001 / DA-3-007**: `/api/orchestration/sweep` y `/api/cron/appointments/reminders` son crons públicos. El endpoint de reminders expone además PII (nombres de leads) en la respuesta HTTP.
- **DA-3-003**: `/api/test/orchestrator` crea leads y workflows REALES en producción sin autenticación. Fix: guard condicional multi-tenant con columna `tenants.test_orchestrator_enabled` (deny by default). El endpoint permanece accesible sin autenticación de sesión — este guard es temporal hasta Fase 3. Deuda técnica registrada.
- **DA-2-002**: `/api/admin/tenants/[id]/client-sql` descarga la SQL de configuración del tenant sin ninguna auth. Requiere refactor mínimo + validación de rol admin.
- **DA-2-003**: `/api/tenant/migrate` GET sirve el `MIGRATION_SQL` completo a cualquier anónimo. Fix: añadir auth guard en el handler GET.

## Requirements

### Funcionales
- 1-07: Añadir middleware de sesión Supabase a los 7 endpoints de orquestación. Devolver 401 si no hay sesión válida.
- 1-08: Añadir auth a los 2 cron endpoints. Opciones: secret header cron (`CRON_SECRET`), o IP allowlist de Easypanel. Eliminar PII de las respuestas de reminders.
- 1-09: Añadir guard condicional en `/api/test/orchestrator`. El endpoint se activa solo si el tenant tiene `tenants.test_orchestrator_enabled = true` AND webhook config completa. Tenant nuevo arranca con el endpoint cerrado (deny by default).
  - Nueva columna: `tenants.test_orchestrator_enabled boolean DEFAULT false`.
  - UI admin: toggle para activar/desactivar por tenant.
  - **GUARD TEMPORAL** — el endpoint sigue sin autenticación de sesión. Deuda técnica → Fase 3: eliminar definitivamente o migrar a admin con auth.
  - Añadir ítem en backlog Fase 3: "Eliminar `/api/test/orchestrator` o migrar a admin con auth completa".
- 1-10: Añadir verificación de rol admin en `/api/admin/tenants/[id]/client-sql`. Devolver 403 si usuario no es admin del tenant.
- 1-11: Añadir auth guard en `/api/tenant/migrate` handler GET. No servir `MIGRATION_SQL` sin autenticación.

### No funcionales
- El middleware de sesión en 1-07 debe ser consistente con el patrón de auth existente en el proyecto (no inventar uno nuevo).
- Para 1-08 (crons): usar `CRON_SECRET` como header `Authorization: Bearer <secret>` — compatible con Easypanel cron jobs y simple de implementar.
- Los 401/403 deben devolver JSON estructurado `{ error: "Unauthorized" }`, no páginas HTML.
- Añadir tests de integración: `GET /api/orchestration/deploy` sin auth → 401.

## Architecture

```
ANTES (vulnerable):
  /api/orchestration/* → handler() [sin middleware de sesión]
  /api/cron/*          → handler() [sin auth, expone PII]
  /api/test/orchestrator → crea leads reales [en producción]
  /api/admin/tenants/[id]/client-sql → devuelve SQL [sin auth]
  /api/tenant/migrate GET → devuelve MIGRATION_SQL [sin auth]

DESPUÉS (Ph3 aplicada):
  /api/orchestration/* → requireSession() → handler()
  /api/cron/*          → verifyCronSecret() → handler() [sin PII en respuesta]
  /api/test/orchestrator → checkTenantGuard(test_orchestrator_enabled + webhook completo) → handler()
                        [AVISO: sin auth de sesión — guard temporal hasta Fase 3]
  /api/admin/tenants/[id]/client-sql → requireAdminRole() → handler()
  /api/tenant/migrate GET → requireSession() → handler()
```

**Helper de auth a reutilizar/crear:**
```ts
// src/lib/api/require-session.ts (crear si no existe)
export async function requireSession(request: NextRequest): Promise<{ user, supabase } | Response>
// Devuelve { user, supabase } si ok, o Response(401) si no hay sesión

// src/lib/api/require-admin.ts (crear si no existe)
export async function requireAdmin(request: NextRequest, tenantId: string): Promise<boolean | Response>
```

## Related Code Files

**Modificar (1-07):**
- `src/app/api/orchestration/deploy/route.ts`
- `src/app/api/orchestration/graph/route.ts`
- `src/app/api/orchestration/publish/route.ts`
- `src/app/api/orchestration/sweep/route.ts`
- `src/app/api/orchestration/workflows/route.ts`
- `src/app/api/orchestration/calls/manual/route.ts`
- `src/app/api/cron/appointments/route.ts`

**Modificar (1-08):**
- `src/app/api/orchestration/sweep/route.ts` (también en 1-07)
- `src/app/api/cron/appointments/reminders/route.ts`

**Modificar (1-09):**
- `src/app/api/test/orchestrator/route.ts` — añadir guard condicional

**Crear (1-09):**
- Migración SQL: `supabase/migrations/YYYYMMDD_add_test_orchestrator_enabled_to_tenants.sql`
- UI admin toggle en panel de administración de tenants

**Modificar (1-10):**
- `src/app/api/admin/tenants/[id]/client-sql/route.ts`

**Modificar (1-11):**
- `src/app/api/tenant/migrate/route.ts` (sólo el handler GET — no el handler POST/PUT)

**Crear:**
- `src/lib/api/require-session.ts` (si no existe)
- `src/lib/api/require-admin.ts` (si no existe)

## Implementation Steps

### 1-07 — Auth en 7 endpoints de orquestación (8h, ~1h por endpoint)

1. Verificar si existe ya un helper `requireSession` o middleware de auth en el proyecto. Si no, crear `src/lib/api/require-session.ts` usando el patrón `@supabase/ssr` (leer session desde cookies de la request).
2. Para cada uno de los 7 endpoints:
   a. Añadir llamada a `requireSession(request)` al inicio del handler.
   b. Si devuelve `Response(401)`, retornar inmediatamente.
   c. Usar el `supabase` devuelto por `requireSession` para las queries (no crear uno nuevo).
3. Verificar que los endpoints que también gestionan tenant verifican que la sesión corresponde al tenant correcto (cruzar con 1-20/1-21 de Ph5 si hay IDOR).
4. Tests: para cada endpoint, un test que llama sin cookies de sesión → espera 401.

### 1-08 — Auth en 2 cron endpoints + eliminar PII de reminders (4h)

1. Añadir variable `CRON_SECRET` a `.env.example` (sin valor).
2. Crear helper `verifyCronSecret(request: NextRequest): boolean`.
3. Aplicar el helper en `sweep/route.ts` y `cron/appointments/reminders/route.ts`.
4. Para `reminders`: auditar la respuesta JSON actual — eliminar cualquier campo de PII (nombre, teléfono, email del lead) de la respuesta. Loguear internamente pero no devolver al caller.
5. Configurar en Easypanel el header `Authorization: Bearer <CRON_SECRET>` en los jobs cron.

### 1-09 — Guard condicional en endpoint de test (2h)

> **Decisión del usuario**: guard temporal multi-tenant. No eliminar todavía. El endpoint debe estar cerrado por defecto para cualquier tenant nuevo.
>
> **Deuda técnica (Fase 3)**: este endpoint sigue siendo accesible sin autenticación de sesión — solo gateado por configuración del tenant. Crear ítem en backlog Fase 3: _"Eliminar definitivamente `/api/test/orchestrator` o migrar a admin con auth completa"_.

1. Crear migración SQL: añadir columna `test_orchestrator_enabled boolean DEFAULT false` a tabla `tenants`.
   - `supabase/migrations/YYYYMMDD_add_test_orchestrator_enabled_to_tenants.sql`
   - `DEFAULT false` garantiza que todos los tenants existentes arrancan con el endpoint cerrado.

2. En `src/app/api/test/orchestrator/route.ts`, añadir al inicio del handler:
   ```ts
   // Guard condicional — TEMPORAL hasta Fase 3
   // Lee tenant_id del contexto actual (cookie, header, o parámetro según patrón existente del proyecto)
   const tenant = await getTenantConfig(tenantId); // helper existente o equivalente
   if (!tenant.test_orchestrator_enabled) {
     return Response.json({ error: 'Not available' }, { status: 403 });
   }
   // Verificar que la config de webhook del tenant está completa
   if (!isTenantWebhookConfigComplete(tenant)) {
     return Response.json({ error: 'Tenant webhook config incomplete' }, { status: 403 });
   }
   ```

3. Crear helper `isTenantWebhookConfigComplete(tenant)` — retorna `true` si el tenant tiene todos los campos de webhook requeridos configurados (webhook_url, webhook_secret_hash, etc.). Definir qué campos son "completos" al ejecutar la tarea (depende del estado del tenant en ese momento).

4. UI admin: añadir toggle en la pantalla de administración de tenants para activar/desactivar `test_orchestrator_enabled` por tenant. Agente: `af-agents:uxui`.

5. Verificar que ningún test o script importa este endpoint como dependencia y espera que no tenga guard.

### 1-10 — Cerrar `/api/admin/tenants/[id]/client-sql` (2h)

1. Añadir `requireSession(request)` al inicio del handler.
2. Añadir verificación de rol admin: el usuario autenticado debe ser admin del tenant `[id]`. Usar la tabla `tenants` (auth_user_id) provisionalmente hasta que F2 del plan RLS introduzca `tenant_members`.
3. Si el usuario no es admin del tenant → devolver 403.
4. Test: llamar sin auth → 401; llamar con usuario no-admin del tenant → 403; llamar con admin → 200.

### 1-11 — Cerrar `/api/tenant/migrate` GET (1h)

1. En `src/app/api/tenant/migrate/route.ts`, localizar el handler `GET`.
2. Añadir `requireSession(request)` al inicio.
3. Añadir verificación: solo admins pueden llamar a este endpoint.
4. Devolver 401/403 si no cumple condiciones.
5. Nota: el handler POST/PUT/otros de este mismo archivo también tiene el bug SSRF (1-22) — ese se trata en Ph6. Aquí solo se toca el GET.

## Todo List

- [ ] 1-07: Verificar/crear `src/lib/api/require-session.ts`
- [ ] 1-07: Fix `/api/orchestration/deploy/route.ts`
- [ ] 1-07: Fix `/api/orchestration/graph/route.ts`
- [ ] 1-07: Fix `/api/orchestration/publish/route.ts`
- [ ] 1-07: Fix `/api/orchestration/sweep/route.ts`
- [ ] 1-07: Fix `/api/orchestration/workflows/route.ts`
- [ ] 1-07: Fix `/api/orchestration/calls/manual/route.ts`
- [ ] 1-07: Fix `/api/cron/appointments/route.ts`
- [ ] 1-07: Tests 401 sin auth para cada endpoint
- [ ] 1-08: Añadir `CRON_SECRET` a `.env.example`
- [ ] 1-08: Crear helper `verifyCronSecret`
- [ ] 1-08: Aplicar en `sweep` y `reminders`
- [ ] 1-08: Eliminar PII de respuesta de `reminders`
- [ ] 1-08: Documentar configuración del header en Easypanel
- [ ] 1-09: Crear migración SQL `tenants.test_orchestrator_enabled boolean DEFAULT false`
- [ ] 1-09: Añadir guard condicional en `src/app/api/test/orchestrator/route.ts`
- [ ] 1-09: Implementar helper `isTenantWebhookConfigComplete`
- [ ] 1-09: UI admin — toggle activar/desactivar por tenant (`af-agents:uxui`)
- [ ] 1-09: Verificar que no hay tests que esperen el endpoint sin guard
- [ ] 1-09: Documentar deuda técnica Fase 3 en backlog
- [ ] 1-10: Añadir require-session + require-admin en `client-sql/route.ts`
- [ ] 1-10: Tests 401/403/200
- [ ] 1-11: Añadir require-session en `migrate/route.ts` handler GET
- [ ] 1-11: Test 401 sin auth
- [ ] Typecheck: `npm run typecheck` → 0 errores nuevos

## Success Criteria

- `curl <URL>/api/orchestration/deploy` sin auth → 401 JSON.
- `curl <URL>/api/cron/appointments/reminders` sin `CRON_SECRET` → 401.
- `GET /api/test/orchestrator` para tenant con `test_orchestrator_enabled = false` → 403.
- `GET /api/test/orchestrator` para tenant con `test_orchestrator_enabled = true` pero webhook config incompleta → 403.
- `GET /api/test/orchestrator` para tenant con `test_orchestrator_enabled = true` y webhook completo → comportamiento esperado del endpoint.
- Tenant nuevo sin configurar → 403 por defecto (DEFAULT false).
- `GET /api/admin/tenants/XXXX/client-sql` sin auth → 401; con usuario no-admin → 403.
- `GET /api/tenant/migrate` sin auth → 401.
- Respuesta de reminders no contiene nombres ni teléfonos de leads.

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| El sistema interno llama a estos endpoints sin auth (background jobs, crons propios) | Media | Alto | Grep callers internos antes de aplicar; añadir `CRON_SECRET` a todos los callers internos |
| `require-session` helper duplica lógica existente | Baja | Bajo | Buscar primero middleware/helper existente; solo crear si no existe |
| Guard 1-09 no captura todos los paths de acceso al endpoint (e.g., llamada directa sin tenant_id) | Media | Medio | Verificar exhaustivamente cómo se extrae el tenant_id en el handler; asegurar que si falta → 403 |
| Endpoint 1-09 sigue sin auth de sesión — guard solo por config de tenant | Alta | Medio | **Riesgo residual aceptado temporalmente**. Crear ítem en backlog Fase 3 para eliminación definitiva. No promover a producción sin documentar este riesgo. |

## Security Considerations

- Los cron jobs ahora requieren `CRON_SECRET` — este secret debe almacenarse solo en Easypanel, no en código.
- PII eliminada de respuestas en 1-08: los logs internos pueden seguir teniendo el detalle, pero la respuesta HTTP expuesta no debe contener datos personales.
- 1-10 implementa verificación provisional con `auth_user_id`. Cuando Fase 1 introduzca `tenant_members`, actualizar a verificación por roles.

## Next Steps

→ [Phase 04 — Webhooks y firmas](phase-04-webhooks-y-firmas.md)
→ [Phase 05 — Privilege escalation y RLS](phase-05-privilege-escalation-rls.md) (paralelo con Ph3 si hay 2 devs)
