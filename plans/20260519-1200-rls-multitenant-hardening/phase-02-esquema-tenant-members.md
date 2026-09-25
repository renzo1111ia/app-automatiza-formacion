# Fase 1 — Esquema tenant_members + helper functions RLS

**Prioridad:** 🟠 Alta (bloqueante para F3)
**Tiempo estimado:** 3h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 0 — Hotfix](phase-01-hotfix-vulnerabilidades.md) (prerequisito)
- [supabase/tenants.sql](../../supabase/tenants.sql)

## Overview

Introducir la tabla `tenant_members` como **única fuente de verdad** de qué usuarios pertenecen a qué tenants y con qué rol. Crear las funciones helper que las políticas RLS de F3 usarán de forma uniforme en las 11 tablas tenant-scoped.

## Cobertura de hallazgos en esta fase

| Hallazgo | Cierre en F2 | Paso |
|---|---|---|
| **H1** — `tenants` con política débil | ✅ Cierre estructural (reemplaza la política provisional de F1) | Paso 4 |
| **H4** — cookie cliente-controlada sin validación robusta | ✅ Base de datos lista para validación N:M con roles (consumida en F4) | Pasos 1-3 |

## Key Insights

- El modelo actual tiene `tenants.auth_user_id` (uno-a-uno user↔tenant). Esto **no escala** a usuarios que pertenecen a múltiples tenants (necesario para agencias, partners, admins multi-cliente).
- La función helper debe ser `SECURITY DEFINER` y `STABLE` para evitar recursión RLS (la política consulta una tabla que también tiene políticas) y permitir memoización por query del planner.
- Tener un campo `role` permite políticas más granulares en F3 (viewer no puede insertar, owner puede borrar, etc.).

## Requirements

### Funcionales
- Tabla `tenant_members(user_id, tenant_id, role, created_at)` con PK compuesta.
- Roles: `owner`, `admin`, `member`, `viewer`.
- Función `user_tenant_ids()` que devuelve tenants del usuario actual.
- Función `current_tenant_id()` que lee GUC `app.tenant_id` para procesos sistema.
- Función `user_has_tenant_role(tenant_id, roles[])` para chequeos granulares.
- Backfill: cada `tenants.auth_user_id` actual se convierte en `tenant_members` con role=`owner`.

### No funcionales
- Funciones marcadas `STABLE SECURITY DEFINER` con `search_path = public` fijo (protección frente a search_path injection).
- Índices que soporten lookup rápido en cada query (la función se llamará en cada SELECT con RLS).

## Architecture

```
auth.users (Supabase Auth)
    │
    │ N:M
    ▼
tenant_members ─── role: owner | admin | member | viewer
    │
    │ N:1
    ▼
tenants
    │
    │ 1:N (tenant_id en cada tabla)
    ▼
lead, llamadas, agendamientos, etc.
```

## Related Code Files

**Crear:**
- `supabase/migrations/20260519_create_tenant_members.sql`
- `supabase/migrations/20260519_helper_functions_rls.sql`
- `supabase/migrations/20260519_backfill_tenant_members.sql`

**Leer (contexto):**
- [supabase/tenants.sql](../../supabase/tenants.sql)
- [src/types/database.ts](../../src/types/database.ts) (regenerar al final)

## Implementation Steps

### Paso 1 — Tabla `tenant_members` (45 min)

```sql
CREATE TABLE public.tenant_members (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX idx_tenant_members_user   ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias membresías
CREATE POLICY "tenant_members_read_own" ON public.tenant_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Solo service_role gestiona membresías (admin UI usa server actions con service_role)
CREATE POLICY "service_role_all_tenant_members" ON public.tenant_members
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

### Paso 2 — Funciones helper (45 min)

```sql
-- Tenants a los que pertenece el usuario actual
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid();
$$;

-- Tenant activo para procesos sistema (vía SET LOCAL app.tenant_id)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Comprueba si el usuario actual tiene alguno de los roles indicados en un tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_role(
    p_tenant_id uuid,
    p_roles text[]
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM tenant_members
        WHERE user_id = auth.uid()
          AND tenant_id = p_tenant_id
          AND role = ANY(p_roles)
    );
$$;

-- Permisos: solo PostgREST internal puede invocarlas
GRANT EXECUTE ON FUNCTION public.user_tenant_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_role(uuid, text[]) TO authenticated, service_role;
```

### Paso 3 — Backfill de tenants existentes (45 min)

```sql
-- Convertir cada tenants.auth_user_id existente en tenant_members con role=owner
INSERT INTO public.tenant_members (user_id, tenant_id, role, created_at)
SELECT auth_user_id, id, 'owner', created_at
FROM public.tenants
WHERE auth_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verificar
SELECT
    (SELECT count(*) FROM tenants WHERE auth_user_id IS NOT NULL) AS tenants_con_user,
    (SELECT count(*) FROM tenant_members WHERE role = 'owner')   AS owners_creados;
-- Ambos números deben coincidir
```

### Paso 4 — Actualizar política provisional de `tenants` (15 min)

Reemplazar la política `tenants_read_own_provisional` de F1 por la versión final basada en membresía:

```sql
DROP POLICY "tenants_read_own_provisional"   ON public.tenants;
DROP POLICY "tenants_update_own_provisional" ON public.tenants;

CREATE POLICY "tenants_read_members" ON public.tenants
    FOR SELECT TO authenticated
    USING (id IN (SELECT user_tenant_ids()));

CREATE POLICY "tenants_update_admins" ON public.tenants
    FOR UPDATE TO authenticated
    USING (user_has_tenant_role(id, ARRAY['owner','admin']))
    WITH CHECK (user_has_tenant_role(id, ARRAY['owner','admin']));
```

### Paso 5 — Regenerar tipos TypeScript (15 min)

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Verificar que `Database['public']['Tables']['tenant_members']` aparece.

### Paso 6 — Tests unitarios SQL (15 min)

Crear `supabase/tests/tenant_members_rls.test.sql`:

```sql
-- Test: usuario solo ve sus tenants
SET request.jwt.claim.sub = 'user-A-uuid';
SELECT count(*) FROM user_tenant_ids();  -- esperado: N tenants de A

SET request.jwt.claim.sub = 'user-B-uuid';
SELECT count(*) FROM user_tenant_ids();  -- esperado: M tenants de B (distintos)
```

## Todo List

- [ ] Crear migration `20260519_create_tenant_members.sql`
- [ ] Crear migration `20260519_helper_functions_rls.sql`
- [ ] Crear migration `20260519_backfill_tenant_members.sql`
- [ ] Aplicar migrations en staging
- [ ] Verificar backfill: conteo de owners = tenants con auth_user_id
- [ ] Actualizar políticas de `tenants` a versión final
- [ ] Regenerar `src/types/database.ts`
- [ ] Tests SQL básicos de funciones helper
- [ ] Documentar en `docs/system-architecture.md` la nueva tabla
- [ ] Aplicar en producción tras validar staging 24h

## Success Criteria

- ✅ Tabla `tenant_members` existe con PK compuesta e índices.
- ✅ Funciones `user_tenant_ids`, `current_tenant_id`, `user_has_tenant_role` operativas.
- ✅ Cada tenant con `auth_user_id` tiene su membership con role=`owner`.
- ✅ Política `tenants` ahora usa `user_tenant_ids()`.
- ✅ `database.ts` regenerado incluye `tenant_members`.
- ✅ Sin regresiones: login y acceso a dashboard siguen funcionando.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Backfill incompleto (tenants sin auth_user_id) | Pre-check antes de migrar; crear script manual para esos casos huérfanos |
| Función SECURITY DEFINER mal configurada → escalada de privilegios | `search_path = public` fijo, GRANTs explícitos, code review de cada función |
| Recursión RLS al consultar tenant_members en políticas | Función SECURITY DEFINER bypassa RLS dentro de su ejecución |

## Security Considerations

- Funciones `SECURITY DEFINER`: el `search_path = public` es **obligatorio** para evitar que un atacante con privilegios de creación de schemas pueda hijackear las funciones.
- Política `tenant_members_read_own`: usuarios NO pueden ver con qué otros usuarios comparten tenant (info sensible).
- INSERT/UPDATE/DELETE de `tenant_members` **solo via service_role**: la UI de admin debe usar server actions, nunca cliente directo.

## Next Steps

→ [Fase 2 — Políticas RLS en las 11 tablas tenant-scoped](phase-03-politicas-rls-tablas-datos.md)
