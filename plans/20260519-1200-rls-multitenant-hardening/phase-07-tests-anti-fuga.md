# Fase 7 — Tests E2E anti-fuga + CI gate

**Prioridad:** 🔴 CRÍTICA (sin esto no se puede mergear a main)
**Tiempo estimado:** 4h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 3 — Políticas RLS](phase-03-politicas-rls-tablas-datos.md)
- [Fase 4 — Clientes Supabase](phase-04-refactor-clientes-supabase.md)

## Overview

Crear suite de tests E2E que **simula intentos de fuga cross-tenant** y verifica que las políticas RLS los bloquean. Integrar en CI para que ningún PR que rompa el aislamiento llegue a `main`.

## Key Insights

- Los tests deben usar usuarios reales de Supabase Auth con JWTs distintos, no mocks. Un mock del cliente no prueba la RLS real.
- Hay que cubrir las 11+ tablas tenant-scoped y los 4 verbos (SELECT, INSERT, UPDATE, DELETE).
- También probar el flujo system: webhook que no setea `tenant_id` → 0 filas o error explícito.
- Tests deben ser **deterministas** y limpiar tras sí (transacciones o teardown explícito).

## Requirements

### Funcionales
- Setup automatizado: crear 2 tenants + 2 usuarios + datos seed antes de tests.
- Test por tabla × verbo: 11 tablas × 4 verbos = 44 test cases mínimos (puede parametrizarse).
- Test sistema: invocar `createSystemClient` sin tenantId → error; con tenantId ajeno al dato → 0 filas.
- Test API end-to-end: POST a `/api/leads/ingest` con `tenant_id` X y JWT de usuario de tenant Y → 403 o 0 inserciones.
- CI gate: GitHub Action que falla si algún test anti-fuga falla.

### No funcionales
- Tests ejecutables en local con `npm run test:rls`.
- Tests ejecutables en CI sin dependencia de prod (Supabase local o staging dedicado).
- Tiempo total < 2 min para no ralentizar el pipeline.

## Architecture

```
Test setup (beforeAll):
    Supabase local stack (docker compose)
    → applyMigrations()
    → seedTenants([A, B])
    → seedUsers([userA→tenantA, userB→tenantB])
    → seedData([lead-A in tenantA, lead-B in tenantB])

Test cases (parameterized):
    forEach tabla:
        forEach verbo:
            assert userA cannot access tenantB row
            assert systemClient(tenantA) cannot access tenantB row

Test teardown (afterAll):
    truncate tables
    drop test users
```

## Related Code Files

**Crear:**
- `tests/rls/setup.ts` — fixtures, helpers
- `tests/rls/tenant-isolation.test.ts` — tests parametrizados
- `tests/rls/api-isolation.test.ts` — tests E2E sobre API routes
- `tests/rls/system-client.test.ts` — tests del cliente sistema
- `.github/workflows/rls-gate.yml` — CI workflow
- `package.json` — script `test:rls`

## Implementation Steps

### Paso 1 — Setup fixtures (1h 0min)

`tests/rls/setup.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export const TENANT_A = '11111111-1111-1111-1111-111111111111';
export const TENANT_B = '22222222-2222-2222-2222-222222222222';
export const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export async function seedTestData() {
    const admin = createClient(URL, SERVICE_KEY);
    // crear usuarios via auth admin API
    await admin.auth.admin.createUser({ id: USER_A, email: 'a@test.local' });
    await admin.auth.admin.createUser({ id: USER_B, email: 'b@test.local' });
    // tenants + memberships + datos seed (lead, llamada, etc.)
}

export async function tearDownTestData() { /* ... */ }

export function clientAs(userId: string) {
    // Genera JWT firmado para userId y crea cliente con ese token
}
```

### Paso 2 — Tests parametrizados de aislamiento (1h 30min)

`tests/rls/tenant-isolation.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestData, tearDownTestData, clientAs, TENANT_A, TENANT_B, USER_A } from './setup';

const TABLES = [
    'lead', 'llamadas', 'agendamientos', 'lead_cualificacion',
    'conversaciones_whatsapp', 'intentos_llamadas', 'intentos',
    'notificaciones', 'programas', 'lead_programas', 'campanas',
] as const;

beforeAll(seedTestData);
afterAll(tearDownTestData);

describe.each(TABLES)('Tenant isolation: %s', (table) => {
    it('userA SELECT solo ve filas de tenantA', async () => {
        const db = clientAs(USER_A);
        const { data, error } = await db.from(table).select('tenant_id');
        expect(error).toBeNull();
        expect(data?.every(row => row.tenant_id === TENANT_A)).toBe(true);
    });

    it('userA INSERT con tenant_id=B falla o se rechaza', async () => {
        const db = clientAs(USER_A);
        const { error } = await db.from(table).insert({ tenant_id: TENANT_B } as any);
        expect(error).not.toBeNull();
    });

    it('userA UPDATE fila de tenantB no afecta nada', async () => {
        const db = clientAs(USER_A);
        const { data } = await db.from(table).update({}).eq('tenant_id', TENANT_B).select();
        expect(data?.length ?? 0).toBe(0);
    });

    it('userA DELETE fila de tenantB no afecta nada', async () => {
        const db = clientAs(USER_A);
        const { data } = await db.from(table).delete().eq('tenant_id', TENANT_B).select();
        expect(data?.length ?? 0).toBe(0);
    });
});
```

### Paso 3 — Tests del system client (45 min)

`tests/rls/system-client.test.ts`:

```ts
import { createSystemClient } from '@/lib/supabase/system-client';

describe('System client', () => {
    it('createSystemClient sin tenantId lanza error', () => {
        expect(() => createSystemClient({ tenantId: '' as any })).toThrow();
    });

    it('SET LOCAL app.tenant_id=A no devuelve filas de B', async () => {
        const db = createSystemClient({ tenantId: TENANT_A });
        const { data } = await db.from('lead').select('tenant_id').eq('tenant_id', TENANT_B);
        expect(data).toEqual([]);
    });

    it('Sin SET LOCAL las policies devuelven 0 filas', async () => {
        // Acceder con service_role pero sin setear GUC
        const db = createClient(URL, SERVICE_KEY);
        const { data } = await db.from('lead').select('*');
        expect(data).toEqual([]);
    });
});
```

### Paso 4 — Tests E2E sobre API routes (30 min)

`tests/rls/api-isolation.test.ts`:

```ts
describe('API anti-fuga', () => {
    it('POST /api/leads/ingest con tenant_id ajeno → 403', async () => {
        const res = await fetch('/api/leads/ingest', {
            method: 'POST',
            headers: { cookie: cookieFor(USER_A) },
            body: JSON.stringify({ tenant_id: TENANT_B, leads: [{ nombre: 'X', telefono: '+34600000000' }] }),
        });
        expect(res.status).toBe(403);
    });
});
```

### Paso 5 — CI workflow (15 min)

`.github/workflows/rls-gate.yml`:

```yaml
name: RLS Anti-Fuga Gate
on: [pull_request]
jobs:
  rls-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx supabase db push --linked
      - run: npm run test:rls
```

## Todo List

- [ ] Setup helpers (`setup.ts`)
- [ ] Tests parametrizados (44+ cases)
- [ ] Tests del system client
- [ ] Tests E2E sobre API
- [ ] Script `test:rls` en package.json
- [ ] CI workflow + branch protection rule
- [ ] Documentar cómo añadir tests cuando se cree nueva tabla tenant-scoped

## Success Criteria

- ✅ 44+ test cases pasan en local.
- ✅ CI bloquea PRs con tests rotos.
- ✅ Branch protection en `main` requiere el check `RLS Anti-Fuga Gate`.
- ✅ Tiempo total de la suite < 2 min.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Tests flakey por race conditions en seed | Usar transacciones aisladas o IDs únicos por test |
| Supabase local en CI consume recursos | Cachear imágenes Docker, usar matrix solo cuando cambien schemas |
| Falsos positivos al añadir tabla nueva sin tests | Lint rule: archivo nuevo en migrations → tests requeridos |

## Security Considerations

- Los tests son la **última línea de defensa** ante un dev que escriba código incorrecto. Si esta fase se omite, todo el plan pierde su garantía operativa.
- Los datos de seed NUNCA deben llegar a prod (entornos separados).

## Next Steps

→ [Fase 8 — Performance, docs y rollout](phase-08-performance-docs-rollout.md)
