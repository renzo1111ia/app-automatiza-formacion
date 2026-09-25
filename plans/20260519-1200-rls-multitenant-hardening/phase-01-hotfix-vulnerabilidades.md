# Fase 0 — Hotfix de los 4 hallazgos críticos

**Prioridad:** 🔴 CRÍTICA (puede aplicarse independiente del resto del plan)
**Tiempo estimado:** 2h 30min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md) — tabla de hallazgos H1-H4
- [supabase/tenants.sql](../../supabase/tenants.sql) — política vulnerable (H1)
- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) — credenciales hardcoded (H3) + service_role global (H2) + cookie sin validar (H4)

## Overview

Aplicar **todas las mitigaciones inmediatas posibles** a los 4 hallazgos críticos de la auditoría sin necesidad de refactor mayor. Esta fase es de bajo riesgo: arregla vulnerabilidades concretas sin alterar la lógica de la aplicación. Lo que no puede cerrarse del todo aquí queda mitigado provisionalmente y marcado para cierre estructural en F2-F4.

## Cobertura de hallazgos en esta fase

| Hallazgo | Cierre en F1 | Paso | Cierre final |
|---|---|---|---|
| **H1** — `tenants` con `USING(true)` | ✅ Política provisional restrictiva | Paso 1 | F2 paso 4 (versión con `tenant_members`) |
| **H2** — service_role global bypassa RLS | 🟡 Audit logging + feature flag | Paso 5 | F3 (policies) + F4 (refactor clientes) |
| **H3** — credenciales JWT hardcoded en código | ✅ Eliminar + rotar keys | Pasos 2-3 | — |
| **H4** — cookie `af-tenant-id` cliente-controlada | 🟡 Validar contra `auth_user_id` | Paso 4 | F2 + F4 (validar contra `tenant_members`) |

## Key Insights

- La política RLS de `tenants` con `USING (true)` para `authenticated` es equivalente a no tener RLS — cualquier usuario logueado ve y modifica TODOS los tenants. **Fix inmediato posible** porque `tenants.auth_user_id` ya existe como columna.
- Las claves JWT hardcoded en `server.ts` (líneas 7-8) están commiteadas a git history público: rotar es obligatorio aunque se quiten del código.
- H2 (service_role global) no puede cerrarse del todo en F1 porque requiere F3 (policies tenant-scoped) + F4 (clientes segregados). Lo que SÍ podemos hacer ya: **audit logging** de cada uso de service_role + flag de configuración que registra quién/dónde para visibilizar el blast radius antes del refactor.
- La cookie `af-tenant-id` es modificable por el cliente; cualquier usuario puede pretender pertenecer a otro tenant cambiando su valor. Mitigación parcial aquí (validar contra `auth_user_id`), completa en F2 (validar contra `tenant_members`).

## Requirements

### Funcionales
- **H1**: Bloquear acceso a `tenants` para usuarios que no son `auth_user_id` propietarios.
- **H3**: Eliminar credenciales hardcoded del código fuente + rotar service_role y anon keys en Supabase.
- **H4**: Verificar la cookie `af-tenant-id` contra `tenants.auth_user_id` (validación mínima provisional).
- **H2**: Instrumentar cada llamada a `getAdminSupabaseClient()` con audit log estructurado (caller, tenant_id intencionado si lo hay, timestamp). Esto NO cierra la vulnerabilidad pero genera la telemetría para validar el refactor de F3-F4.

### No funcionales
- Cero downtime: las políticas nuevas conviven con la lógica actual gracias a `service_role`.
- Rotación de claves JWT después del cleanup (acción manual en Supabase dashboard).
- Audit logs accesibles vía consola del logger existente (`src/lib/core/logger.ts`).

## Architecture

```
ANTES (vulnerable)                     DESPUÉS de F1 (hotfix)
─────────────────────                  ───────────────────────
authenticated → tenants (TODOS)        authenticated → tenants (solo auth_user_id propio)
Code: const KEY = "eyJ..."             Code: process.env.SUPABASE_* (sin fallback, throw si falta)
Cookie → confianza ciega               Cookie → validada contra tenants.auth_user_id
service_role uso global silente        service_role uso global + audit log estructurado
```

## Related Code Files

**Modificar:**
- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) — eliminar `FALLBACK_*`, añadir audit log en `getAdminSupabaseClient`
- [src/lib/supabase/tenant-router.ts](../../src/lib/supabase/tenant-router.ts) — validar cookie contra `auth_user_id`
- [src/lib/core/logger.ts](../../src/lib/core/logger.ts) — añadir helper `auditServiceRoleUsage()` si no existe

**Crear:**
- `supabase/migrations/20260519_hotfix_tenants_rls.sql` — políticas restrictivas (H1)

**Leer (contexto):**
- [supabase/tenants.sql](../../supabase/tenants.sql)
- [src/lib/actions/tenant.ts](../../src/lib/actions/tenant.ts) — flujo actual de selección de tenant

## Implementation Steps

### Paso 1 — Migración SQL hotfix de `tenants` [H1] (30 min)

Crear `supabase/migrations/20260519_hotfix_tenants_rls.sql`:

```sql
-- HOTFIX H1: Reemplazar políticas permisivas de la tabla tenants
-- Las políticas actuales (USING true) permiten a CUALQUIER usuario autenticado
-- leer y modificar TODOS los tenants.

BEGIN;

-- 1. Drop políticas vulnerables
DROP POLICY IF EXISTS "Allow authenticated read"   ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.tenants;

-- 2. Política provisional: solo el tenant vinculado a auth_user_id puede leer
--    (versión temporal hasta que F2 introduzca tenant_members)
CREATE POLICY "tenants_read_own_provisional" ON public.tenants
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());

-- 3. Update solo permitido a auth_user_id propietario
CREATE POLICY "tenants_update_own_provisional" ON public.tenants
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- 4. INSERT y DELETE de tenants quedan EXCLUSIVAMENTE para service_role
--    (no cambia: las políticas service_role_* siguen permitiéndolo)

-- 5. Service role conserva acceso total (provisioning de tenants nuevos)
CREATE POLICY "service_role_all_tenants" ON public.tenants
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMIT;
```

**Pre-check obligatorio antes de aplicar:**

```sql
SELECT count(*) FROM tenants WHERE auth_user_id IS NULL;
-- Debe ser 0. Si > 0, hacer backfill manual antes de aplicar la migration.
```

### Paso 2 — Eliminar credenciales hardcoded [H3] (30 min)

En [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts):

- Eliminar líneas 6-8 (`FALLBACK_URL`, `FALLBACK_SERVICE_KEY`, `FALLBACK_ANON_KEY`).
- En `getSupabaseServerClient()` y `getAdminSupabaseClient()`: si falta `SUPABASE_URL` o la key, lanzar `Error` explícito en lugar de usar fallback.
- Verificar que `.env.local`, `.env.production`, y secrets de despliegue (Vercel/Docker) tienen las variables.

```ts
// Patrón a aplicar
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("Missing SUPABASE_URL env var");

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
```

### Paso 3 — Rotar claves JWT en Supabase [H3] (15 min, acción manual)

- Acceder al dashboard de Supabase (proyecto producción).
- Settings → API → "Reset service_role key" y "Reset anon key".
- Actualizar variables de entorno en Vercel/Docker/servidores.
- Reiniciar servicios.
- Verificar que las keys viejas dan 401 al intentar usarlas (curl test).

### Paso 4 — Validar cookie af-tenant-id [H4] (30 min — provisional)

En [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) (función `getActiveTenantId`) o el módulo donde se lea la cookie:

```ts
export async function getActiveTenantId(): Promise<string | null> {
    const cookieStore = await cookies();
    const requested = cookieStore.get("af-tenant-id")?.value;
    if (!requested) return null;

    // Validación provisional: la cookie debe apuntar a un tenant cuyo
    // auth_user_id coincide con el usuario actual.
    const supabase = await getSupabaseUserClient();  // cliente request-scoped con JWT
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', requested)
        .eq('auth_user_id', user.id)
        .maybeSingle();

    return data?.id ?? null;
}
```

**Nota:** este es el patrón provisional. F2 introduce `tenant_members` y F4 reemplaza por validación N:M completa con roles.

### Paso 5 — Audit logging de uso de service_role [H2 — mitigación] (45 min)

En `src/lib/supabase/server.ts`:

```ts
import { logger } from '@/lib/core/logger';

export async function getAdminSupabaseClient(opts?: { reason?: string; tenantId?: string }) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) throw new Error("Missing SUPABASE_URL env var");
    if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");

    // Audit: cada uso de service_role queda registrado
    const stack = new Error().stack?.split('\n').slice(2, 5).join(' | ');
    logger.warn('[SERVICE_ROLE_USAGE]', {
        reason: opts?.reason ?? 'unspecified',
        tenantId: opts?.tenantId ?? 'none',
        caller: stack,
        timestamp: new Date().toISOString(),
    });

    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
```

Después del deploy:

1. Tras 48h, exportar los logs `[SERVICE_ROLE_USAGE]` agrupados por `caller`.
2. Esa lista = mapa exhaustivo de **todos los puntos del código que bypassan RLS hoy**.
3. Esta lista alimenta directamente la auditoría de F4 (saber qué refactorizar).

**Razón:** no podemos eliminar `service_role` global en F1 sin romper la app. Pero podemos medirlo para tomar decisiones informadas en F4. Defensa en profundidad: visibilidad antes que cierre.

### Paso 6 — Smoke test manual post-deploy (10 min)

- Login con usuario X → ver dashboard → datos del tenant X visibles.
- Abrir DevTools → cambiar cookie `af-tenant-id` a un UUID ajeno → recargar → `getActiveTenantId()` debe devolver null o caer al tenant propio.
- Intentar `SELECT * FROM tenants` desde SQL editor con un JWT de usuario normal → solo debe devolver 1 fila.
- Buscar `grep -rn "FALLBACK_\|eyJhbGci" src/` → 0 resultados.

## Todo List

- [ ] **H1** Pre-check: `SELECT count(*) FROM tenants WHERE auth_user_id IS NULL` debe ser 0
- [ ] **H1** Crear migration `20260519_hotfix_tenants_rls.sql`
- [ ] **H1** Aplicar migration en staging
- [ ] **H1** Verificar manualmente que un usuario no puede ver tenants ajenos
- [ ] **H3** Refactor `server.ts` para eliminar fallbacks hardcoded
- [ ] **H3** Verificar env vars en staging y prod
- [ ] **H3** Rotar service_role key en Supabase dashboard
- [ ] **H3** Rotar anon key en Supabase dashboard
- [ ] **H3** Actualizar env vars en Vercel y entornos de despliegue
- [ ] **H3** Reiniciar servicios y verificar que apps funcionan
- [ ] **H3** Confirmar que las keys viejas dan 401 (curl test)
- [ ] **H4** Aplicar validación provisional de cookie en `getActiveTenantId`
- [ ] **H2** Instrumentar audit log en `getAdminSupabaseClient`
- [ ] **H2** Configurar query/alert en logger para extraer agregados `[SERVICE_ROLE_USAGE]`
- [ ] Aplicar todo en producción (orden: env vars → rotación → deploy código → migration SQL)
- [ ] Smoke test post-deploy completo
- [ ] Esperar 48h y exportar agregado de uso de service_role como input para F4

## Success Criteria

- ✅ **H1**: Usuario A con `auth.uid() = X` solo ve `tenants` donde `auth_user_id = X`. Verificado vía SQL editor con JWT de prueba.
- ✅ **H3**: `grep -rE "(eyJhbGci|FALLBACK_)" src/` no devuelve resultados.
- ✅ **H3**: Keys JWT antiguas dejan de funcionar tras rotación (curl con key vieja → 401).
- ✅ **H4**: Modificar la cookie `af-tenant-id` a un UUID ajeno NO da acceso al tenant ajeno.
- 🟡 **H2**: Cada llamada a `getAdminSupabaseClient` genera log estructurado. (Cierre completo en F3-F4.)
- ✅ Login y navegación dashboard funcionan sin regresión.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Romper login al quitar fallback keys | Validar env vars ANTES de eliminar fallbacks; deploy en ventana baja |
| Rotación de keys deja servicios sin acceso | Coordinar despliegue de env vars + restart en ventana baja; tener old key disponible 24h por si rollback |
| Política provisional H1 bloquea usuarios actuales sin `auth_user_id` linkeado | Pre-check obligatorio (paso 1); si > 0, script de backfill antes de aplicar |
| Audit log de H2 genera volumen alto en logger | Rate limit o sampling 1:10 si supera 1000 evt/min; suficiente para mapeo |
| Cookie validation H4 rompe flujo "cambiar de tenant" en UI multi-tenant | Verificar: hoy ningún usuario pertenece a múltiples tenants en producción (modelo `auth_user_id` 1:1). Si lo hubiera, F2 lo arregla |

## Security Considerations

- Esta fase **NO completa** el aislamiento multi-tenant; solo cierra las fugas más graves y visibiliza el alcance del problema H2. Las tablas de datos (`lead`, `llamadas`, etc.) siguen accesibles vía service_role sin scope. F2-F4 completan la protección.
- Rotación de keys obligatoria: las viejas están en git history de la rama actual y posiblemente en backups de CI.
- El audit log de service_role contiene metadatos pero NO valores de queries → no hay PII en los logs.

## Next Steps

→ [Fase 1 — Esquema tenant_members + helper functions RLS](phase-02-esquema-tenant-members.md) (cierre estructural de H1 y H4)
