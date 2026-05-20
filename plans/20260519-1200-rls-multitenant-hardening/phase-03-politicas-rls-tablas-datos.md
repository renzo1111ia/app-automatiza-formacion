# Fase 3 — Políticas RLS en las 11 tablas tenant-scoped

**Prioridad:** 🟠 Alta (núcleo del aislamiento real)
**Tiempo estimado:** 4h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 2 — tenant_members](phase-02-esquema-tenant-members.md) (prerequisito)
- [supabase/migrations/20260404_create_multitenant_schema.sql](../../supabase/migrations/20260404_create_multitenant_schema.sql)

## Overview

Reemplazar las políticas `service_role_all_*` actuales (que conceden acceso total a todas las filas) por políticas que filtran por `tenant_id` usando `user_tenant_ids()` y `current_tenant_id()`. Aplicar de forma uniforme a las 11 tablas tenant-scoped.

## Key Insights

- Existen políticas `service_role_all_*` que conceden acceso total bypassing tenant filtering. Hay que eliminarlas y reemplazarlas por la combinación: política `authenticated` (basada en membresía) + política `service_role` (basada en GUC `app.tenant_id`).
- La política `authenticated` aplica al cliente request-scoped (`@supabase/ssr` con JWT del user).
- La política `service_role` aplica a workers, webhooks, cron — debe forzar el seteo de `app.tenant_id` antes de cualquier query.
- Granularidad: SELECT/INSERT/UPDATE/DELETE tienen políticas separadas para poder restringir mutaciones a roles concretos (ej. `viewer` solo lee).

## Requirements

### Funcionales
- Las 11 tablas con `tenant_id` reciben 4 políticas `authenticated` (SELECT/INSERT/UPDATE/DELETE) + 1 política `service_role` (FOR ALL).
- `viewer` solo puede SELECT (no INSERT/UPDATE/DELETE).
- `member` puede SELECT/INSERT/UPDATE pero no DELETE.
- `admin` y `owner` pueden todo.
- Service role debe setear `SET LOCAL app.tenant_id = '<uuid>'` antes de cada operación; si no, las queries devuelven 0 filas.

### No funcionales
- Las políticas deben usar `IN (SELECT user_tenant_ids())` para que el planner optimice (subquery materializada por STABLE).
- Los índices `idx_<tabla>_tenant` ya existen → no añadir nuevos.

## Architecture

```
Request usuario:
  Cliente request-scoped → JWT → auth.uid() → user_tenant_ids() → filtro por tenant_id

Request sistema (worker/webhook):
  Cliente service_role → SET LOCAL app.tenant_id = X → current_tenant_id() → filtro
```

## Related Code Files

**Crear:**
- `supabase/migrations/20260519_rls_policies_data_tables.sql`

**Tablas afectadas (11):**
- `lead`, `llamadas`, `agendamientos`, `lead_cualificacion`
- `conversaciones_whatsapp`, `intentos_llamadas`, `intentos`
- `notificaciones`, `programas`, `lead_programas`, `campanas`

**Tablas adicionales a auditar** (de las otras migrations en `supabase/migrations/`):
- `ai_agents`, `chat_messages`, `agent_variants`, `tracked_variables`
- `web_widgets`, `appointment_reminders`, `system_logs`
- Cualquier tabla con columna `tenant_id` requiere las mismas políticas

## Implementation Steps

### Paso 1 — Generar lista exhaustiva de tablas tenant-scoped (30 min)

```sql
-- Run en Supabase SQL editor
SELECT t.table_name
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND c.column_name = 'tenant_id'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
```

Documentar la lista resultante en este phase file antes de proceder.

### Paso 2 — Crear migration con políticas uniformes (2h 0min)

Patrón a aplicar a CADA tabla (ejemplo con `lead`):

```sql
-- 1. Drop política service_role permisiva actual
DROP POLICY IF EXISTS "service_role_all_lead" ON public.lead;

-- 2. SELECT: miembros del tenant
CREATE POLICY "lead_select_members" ON public.lead
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT user_tenant_ids()));

-- 3. INSERT: miembros con role member/admin/owner (no viewer)
CREATE POLICY "lead_insert_members" ON public.lead
    FOR INSERT TO authenticated
    WITH CHECK (user_has_tenant_role(tenant_id, ARRAY['member','admin','owner']));

-- 4. UPDATE: miembros con role member/admin/owner
CREATE POLICY "lead_update_members" ON public.lead
    FOR UPDATE TO authenticated
    USING (user_has_tenant_role(tenant_id, ARRAY['member','admin','owner']))
    WITH CHECK (user_has_tenant_role(tenant_id, ARRAY['member','admin','owner']));

-- 5. DELETE: solo admin/owner
CREATE POLICY "lead_delete_admins" ON public.lead
    FOR DELETE TO authenticated
    USING (user_has_tenant_role(tenant_id, ARRAY['admin','owner']));

-- 6. Service role: requiere SET LOCAL app.tenant_id
CREATE POLICY "lead_service_role_tenant_scoped" ON public.lead
    FOR ALL TO service_role
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
```

Generar el bloque para las 11 tablas (y las adicionales detectadas en Paso 1).

**Excepción:** la tabla `programas` y `campanas` pueden necesitar lectura más amplia (catálogo compartido). Decidir caso por caso. Por defecto, aplicar el patrón estricto.

### Paso 3 — Validar políticas con tests SQL (1h 0min)

Crear `supabase/tests/rls_tenant_isolation.test.sql`:

```sql
BEGIN;

-- Setup: dos tenants y dos usuarios
INSERT INTO auth.users (id) VALUES ('aaaa...001'), ('bbbb...002');
INSERT INTO tenants (id, name, supabase_url, supabase_anon_key)
VALUES ('11111...', 'Tenant A', '', ''), ('22222...', 'Tenant B', '', '');
INSERT INTO tenant_members VALUES
    ('aaaa...001', '11111...', 'owner'),
    ('bbbb...002', '22222...', 'owner');

INSERT INTO lead (tenant_id, nombre) VALUES
    ('11111...', 'Lead-A'), ('22222...', 'Lead-B');

-- Test 1: Usuario A solo ve su lead
SET request.jwt.claim.sub = 'aaaa...001';
SET ROLE authenticated;
SELECT count(*) FROM lead;  -- esperado: 1

-- Test 2: Usuario B solo ve el suyo
SET request.jwt.claim.sub = 'bbbb...002';
SELECT count(*) FROM lead;  -- esperado: 1

-- Test 3: Service role sin SET LOCAL → 0 filas
RESET ROLE;
SET ROLE service_role;
SELECT count(*) FROM lead;  -- esperado: 0

-- Test 4: Service role CON SET LOCAL → filas del tenant
SET LOCAL app.tenant_id = '11111...';
SELECT count(*) FROM lead;  -- esperado: 1

ROLLBACK;
```

### Paso 4 — Performance: EXPLAIN ANALYZE (30 min)

Sobre staging con datos reales:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM lead WHERE fecha_ingreso_crm > now() - interval '7 days';
```

Verificar que el plan usa `idx_lead_tenant` y que `user_tenant_ids()` aparece como InitPlan (materializado una vez). Si hay seq scan, revisar políticas.

## Todo List

- [ ] Listar exhaustivamente tablas con `tenant_id`
- [ ] Generar migration `20260519_rls_policies_data_tables.sql` con las 11+ tablas
- [ ] Aplicar en staging
- [ ] Tests SQL de aislamiento por tabla
- [ ] EXPLAIN ANALYZE en top-5 queries más frecuentes
- [ ] Documentar excepciones (catálogos compartidos si aplica)
- [ ] Code review SQL completo antes de prod
- [ ] Aplicar en producción (en ventana de mantenimiento)

## Success Criteria

- ✅ `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (...)` devuelve ≥5 políticas por tabla.
- ✅ Tests SQL de aislamiento pasan en CI.
- ✅ EXPLAIN muestra uso de índices `idx_*_tenant` en queries comunes.
- ✅ Service role sin `SET LOCAL` devuelve 0 filas en cualquier tabla tenant-scoped.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Workers/webhooks rompen porque no setean `app.tenant_id` | Esto se arregla en F6; mientras tanto, mantener el cliente `getAdminSupabaseClient()` con role bypass temporal usando `SET request.jwt.claims.role = 'service_role'` y bypass policy |
| Catálogo `programas` se rompe si era compartido | Pre-auditar: ¿hay programas con tenant_id NULL? Si sí, política especial |
| Performance degradada en queries con muchos joins | EXPLAIN antes de mergear; si hay regresión, marcar funciones helper como PARALLEL SAFE |

## Security Considerations

- La política `lead_service_role_tenant_scoped` con `USING (tenant_id = current_tenant_id())` es **defensa en profundidad**: si el código olvida setear el GUC, devuelve 0 filas → falla visible, no fuga silenciosa.
- `viewer` excluido de mutaciones a nivel DB (no depende del frontend ocultar botones).

## Next Steps

→ [Fase 4 — Refactor capa cliente Supabase](phase-04-refactor-clientes-supabase.md)
