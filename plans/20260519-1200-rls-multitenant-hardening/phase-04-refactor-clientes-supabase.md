# Fase 4 — Refactor capa cliente Supabase

**Prioridad:** 🟠 Alta (hace que las políticas de F3 sean efectivas)
**Tiempo estimado:** 6h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 3 — Políticas RLS](phase-03-politicas-rls-tablas-datos.md) (prerequisito)
- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts)
- [src/lib/supabase/client.ts](../../src/lib/supabase/client.ts)

## Overview

Reorganizar los clientes Supabase en tres variantes con responsabilidades claras y forzar su uso correcto. Eliminar el uso de `service_role` desde rutas API y server actions; restringirlo a workers, webhooks y cron jobs (con `SET LOCAL app.tenant_id`).

## Key Insights

- Hoy `getSupabaseServerClient()` y `getAdminSupabaseClient()` ambos terminan usando `service_role` → bypassan RLS.
- `@supabase/ssr` está instalado pero no se está usando con su patrón completo (request-scoped con cookie de sesión).
- Cualquier "fuga" futura nace de importar el cliente equivocado → la solución es hacer **imposible** o **ruidoso** importar el incorrecto.

## Requirements

### Funcionales
Tres clientes con nombres claros y APIs distintas:

1. **`createUserClient()`** — request-scoped, lleva JWT del usuario (de cookies). Usar en: server actions, route handlers de UI, server components.
2. **`createSystemClient({ tenantId })`** — service_role + `SET LOCAL app.tenant_id`. Usar en: webhooks, workers BullMQ, cron jobs.
3. **`createProvisioningClient()`** — service_role puro, sin tenant scoping. **Excepcional**, solo para: creación de tenants, gestión de `tenant_members`. ESLint rule bloquea su import fuera de directorios permitidos.

### No funcionales
- Validación TypeScript estricta: `createSystemClient` requiere `tenantId` no-null.
- Lint rule: prohibido importar `createProvisioningClient` desde `src/app/api/**`, `src/components/**`, `src/lib/actions/**`.
- Cliente system valida que `tenantId` es UUID antes de SET LOCAL.

## Architecture

```
src/lib/supabase/
├── client.ts           ← Browser client (anon key, RLS via JWT)
├── user-client.ts      ← Server: request-scoped con cookies (auth.uid)
├── system-client.ts    ← Webhooks/workers: service_role + SET LOCAL app.tenant_id
├── provisioning.ts     ← Solo para crear tenants / gestionar membresías
└── tenant-router.ts    ← Validar cookie esden-tenant-id vs tenant_members
```

## Related Code Files

**Crear:**
- `src/lib/supabase/user-client.ts`
- `src/lib/supabase/system-client.ts`
- `src/lib/supabase/provisioning.ts`
- `eslint-rules/no-provisioning-import.js` o config en `eslint.config.mjs`

**Modificar:**
- `src/lib/supabase/server.ts` → marcado @deprecated, re-exporta de los nuevos
- `src/lib/supabase/tenant-router.ts` → usar `tenant_members` en vez de `auth_user_id`
- Todas las llamadas en `src/lib/actions/**` → usar `createUserClient()`
- `src/app/api/webhooks/**` → usar `createSystemClient({ tenantId })`
- `src/app/api/cron/**` → usar `createSystemClient({ tenantId })`

## Implementation Steps

### Paso 1 — Diseñar y crear los 3 clientes (2h 0min)

**`src/lib/supabase/user-client.ts`:**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function createUserClient() {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('Missing Supabase env vars');

    return createServerClient<Database>(url, anonKey, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
            ),
        },
    });
}
```

**`src/lib/supabase/system-client.ts`:**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSystemClient({ tenantId }: { tenantId: string }) {
    if (!UUID_RE.test(tenantId)) {
        throw new Error(`createSystemClient: invalid tenantId "${tenantId}"`);
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');

    const client = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-tenant-id': tenantId } },
    });

    // Setea GUC en cada query mediante un wrapper RPC
    return wrapWithTenantContext(client, tenantId);
}

function wrapWithTenantContext(client: SupabaseClient<Database>, tenantId: string) {
    // Llama rpc('set_tenant_context', { p_tenant_id: tenantId }) antes de cada query
    // Implementación: proxy que intercepta .from() y prefija SET LOCAL
    // Detalle de implementación: ver research/system-client-pattern.md
    return client;
}
```

**`src/lib/supabase/provisioning.ts`:**

```ts
/**
 * ⚠️ PROVISIONING CLIENT — USE ONLY FOR:
 * - Creating new tenants
 * - Managing tenant_members
 * - System-wide migrations
 *
 * NEVER import this from API routes, components or server actions.
 * Lint rule blocks unauthorized imports.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function createProvisioningClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
```

### Paso 2 — Función SQL `set_tenant_context` (30 min)

Para que el wrapper del system client pueda setear el GUC vía RPC (las queries de Supabase no soportan `SET LOCAL` directamente):

```sql
CREATE OR REPLACE FUNCTION public.set_tenant_context(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO service_role;
```

Investigar en `research/system-client-pattern.md` la mejor forma de garantizar que `set_tenant_context` se llama ANTES de cada query (¿transacción explícita? ¿middleware en cada llamada?).

### Paso 3 — Lint rule contra import accidental (1h 0min)

En `eslint.config.mjs` añadir regla `no-restricted-imports`:

```js
{
    files: ['src/app/api/**', 'src/components/**', 'src/lib/actions/**'],
    rules: {
        'no-restricted-imports': ['error', {
            patterns: [{
                group: ['**/supabase/provisioning'],
                message: 'Use createUserClient() or createSystemClient({tenantId}) instead.',
            }],
        }],
    },
}
```

### Paso 4 — Refactor `src/lib/actions/**` (1h 30min)

Auditoría con grep:

```bash
grep -rn "getAdminSupabaseClient\|getSupabaseServerClient" src/lib/actions/
```

Para cada hit:
- Si la action es invocada desde UI con usuario logueado → reemplazar por `createUserClient()`.
- Si la action es invocada desde un proceso sistema → reemplazar por `createSystemClient({ tenantId })` (el tenantId debe venir del input de la action, no de cookie).

Marcar `src/lib/supabase/server.ts` como `@deprecated` y hacer que re-exporte:
```ts
/** @deprecated Use createUserClient() or createSystemClient() */
export const getSupabaseServerClient = createUserClient;
```

### Paso 5 — Tenant router con validación real (45 min)

`src/lib/supabase/tenant-router.ts`:

```ts
import { cookies } from 'next/headers';
import { createUserClient } from './user-client';

export async function getActiveTenantId(): Promise<string | null> {
    const supabase = await createUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Tenants del usuario (vía RLS, solo ve los suyos)
    const { data: members } = await supabase
        .from('tenant_members')
        .select('tenant_id, role');

    if (!members || members.length === 0) return null;

    const requested = (await cookies()).get('esden-tenant-id')?.value;
    const valid = requested && members.some(m => m.tenant_id === requested);

    // Si la cookie no apunta a un tenant permitido, caer al primero
    return valid ? requested! : members[0].tenant_id;
}
```

### Paso 6 — Smoke tests manual (15 min)

- Login como usuario X → ver dashboard → solo aparecen leads/calls del tenant X.
- Cambiar cookie `esden-tenant-id` a tenant ajeno → al refresh, vuelve al tenant original.
- Llamar a server action → succeed con datos del tenant.

## Todo List

- [ ] Crear `user-client.ts`, `system-client.ts`, `provisioning.ts`
- [ ] Función SQL `set_tenant_context()` + grant
- [ ] Investigar pattern wrapper system-client (research/ folder)
- [ ] Configurar lint rule `no-restricted-imports`
- [ ] Auditar y refactorizar `src/lib/actions/**` (≈20 archivos)
- [ ] Actualizar `tenant-router.ts` con validación contra `tenant_members`
- [ ] Marcar `server.ts` deprecated + re-export
- [ ] Smoke test manual completo
- [ ] Code review focalizado en imports

## Success Criteria

- ✅ `grep -rn "createProvisioningClient" src/app/api/` devuelve solo paths permitidos.
- ✅ `grep -rn "service_role" src/lib/actions/` devuelve 0 resultados.
- ✅ ESLint falla si alguien intenta importar provisioning desde un componente.
- ✅ Server actions funcionan con usuario logueado.
- ✅ Tenant router rechaza cookies de tenants no-miembros.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Algún action queda con cliente equivocado y se descubre en prod | Tests E2E de F7 cubren el aislamiento |
| Wrapper system-client tiene overhead | Benchmark en F8; alternativa: pool de conexiones con pgBouncer en transaction mode |
| Server actions que mutan datos cross-tenant (legítimo) se rompen | Estos casos usan `createSystemClient({tenantId})` con el ID validado server-side |

## Security Considerations

- El cliente browser sigue usando anon_key → RLS le aplica con `auth.uid()`. No requiere cambios.
- `createSystemClient` valida el UUID del tenant antes de hacer set_config → previene inyección.
- Lint rule es defensa en profundidad, no reemplaza code review.

## Next Steps

→ [Fase 5 — Repository pattern + Zod en boundaries](phase-05-repository-pattern-zod.md)
