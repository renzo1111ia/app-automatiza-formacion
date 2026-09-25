# Fase 4 — Repository pattern + Zod en boundaries

**Prioridad:** 🟡 Media (calidad, no seguridad crítica)
**Tiempo estimado:** 5h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 3 — Clientes Supabase](phase-04-refactor-clientes-supabase.md) (prerequisito)
- [src/lib/validations/lead.ts](../../src/lib/validations/lead.ts) — esquema Zod existente

## Overview

Introducir capa Repository (`src/lib/repositories/`) como **única vía** legítima de acceso a tablas de la DB desde la lógica de negocio. Aplicar Zod v4 sistemáticamente en boundaries: API routes, webhooks (Retell, WhatsApp, CRM), respuestas de integraciones externas (HubSpot/Zoho/Sheets).

## Key Insights

- Zod ya existe parcialmente en `src/lib/validations/lead.ts`. Hay que expandirlo a TODAS las entradas/salidas externas.
- Repository **no es un ORM**: es un wrapper fino sobre el cliente Supabase que (1) impide importar el cliente raw desde rutas, (2) centraliza filtros comunes, (3) facilita testing.
- Zod no protege multi-tenant: la protección la da RLS. Zod protege **integridad de datos** (tipos correctos, formatos válidos, enums).

## Requirements

### Funcionales
- `src/lib/repositories/<entidad>.ts` por cada tabla principal (`lead`, `llamadas`, `agendamientos`, `campanas`, `programas`, `tenants`, `tenant_members`).
- Cada repository expone funciones nombradas: `findById`, `findByTenant`, `create`, `update`, `delete`, etc.
- Cada función recibe el cliente Supabase como parámetro (inyección de dependencia → testeable).
- Cada API route y webhook valida input con Zod ANTES de llamar al repository.
- Outputs de integraciones externas (HubSpot, Zoho, Sheets) se validan con Zod antes de persistir.

### No funcionales
- ESLint regla: prohibido importar `@supabase/supabase-js` o `@supabase/ssr` fuera de `src/lib/supabase/` y `src/lib/repositories/`.
- Cobertura de tests unitarios de repositories ≥ 70%.

## Architecture

```
HTTP Request / Webhook
       ↓
   Zod.parse()  ← boundary validation
       ↓
Repository function  ← única API a la DB
       ↓
Supabase client (user/system)  ← inyectado
       ↓
PostgreSQL + RLS
```

## Related Code Files

**Crear:**
- `src/lib/repositories/index.ts` — exports
- `src/lib/repositories/lead.ts`
- `src/lib/repositories/llamadas.ts`
- `src/lib/repositories/agendamientos.ts`
- `src/lib/repositories/campanas.ts`
- `src/lib/repositories/programas.ts`
- `src/lib/repositories/tenant-members.ts`
- `src/lib/schemas/` — esquemas Zod por dominio (lead, llamada, webhook-payloads, etc.)

**Modificar:**
- `eslint.config.mjs` — añadir restricción de import
- Todos los archivos en `src/app/api/**` que tocan la DB
- Todas las server actions en `src/lib/actions/**`

## Implementation Steps

### Paso 1 — Esquemas Zod base por dominio (1h 30min)

`src/lib/schemas/lead.ts`:

```ts
import { z } from 'zod';

export const LeadCreateInput = z.object({
    nombre: z.string().min(1).max(200),
    apellido: z.string().max(200).optional(),
    telefono: z.string().regex(/^\+?\d{9,15}$/),
    email: z.email().optional(),
    pais: z.string().length(2).optional(),  // ISO 3166-1 alpha-2
    tipo_lead: z.enum(['MQL', 'SQL', 'CUSTOMER', 'NURTURING']).optional(),
    origen: z.string().max(100).optional(),
    campana: z.string().max(200).optional(),
});
export type LeadCreateInput = z.infer<typeof LeadCreateInput>;

export const LeadUpdateInput = LeadCreateInput.partial();
export type LeadUpdateInput = z.infer<typeof LeadUpdateInput>;
```

Crear esquemas para:
- `lead` (create/update)
- `llamada` (payload de webhook Retell)
- `agendamiento`
- `webhook-payloads/retell.ts`
- `webhook-payloads/whatsapp.ts`
- `webhook-payloads/crm.ts`
- `integrations/hubspot-contact.ts`
- `integrations/zoho-lead.ts`
- `integrations/google-sheets-row.ts`

### Paso 2 — Repositories básicos (1h 30min)

`src/lib/repositories/lead.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { LeadCreateInput, LeadUpdateInput } from '@/lib/schemas/lead';

type DB = SupabaseClient<Database>;
type Lead = Database['public']['Tables']['lead']['Row'];

export const leadRepo = {
    async findById(db: DB, id: string): Promise<Lead | null> {
        const { data, error } = await db.from('lead').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    },

    async findByTenant(db: DB, opts?: { limit?: number; offset?: number }): Promise<Lead[]> {
        // RLS filtra por tenant automáticamente; no hace falta .eq('tenant_id', ...)
        const { data, error } = await db
            .from('lead')
            .select('*')
            .order('fecha_ingreso_crm', { ascending: false })
            .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);
        if (error) throw error;
        return data ?? [];
    },

    async create(db: DB, tenantId: string, input: unknown): Promise<Lead> {
        const parsed = LeadCreateInput.parse(input);
        const { data, error } = await db
            .from('lead')
            .insert({ ...parsed, tenant_id: tenantId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(db: DB, id: string, input: unknown): Promise<Lead> {
        const parsed = LeadUpdateInput.parse(input);
        const { data, error } = await db
            .from('lead')
            .update(parsed)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(db: DB, id: string): Promise<void> {
        const { error } = await db.from('lead').delete().eq('id', id);
        if (error) throw error;
    },
};
```

Replicar patrón para las demás entidades.

### Paso 3 — Refactorizar API routes para usar repos (1h 0min)

Ejemplo `src/app/api/leads/ingest/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSystemClient } from '@/lib/supabase/system-client';
import { leadRepo } from '@/lib/repositories/lead';
import { LeadCreateInput } from '@/lib/schemas/lead';

const IngestPayload = z.object({
    tenant_id: z.uuid(),
    leads: z.array(LeadCreateInput),
});

export async function POST(req: Request) {
    const body = await req.json();
    const { tenant_id, leads } = IngestPayload.parse(body);

    const db = createSystemClient({ tenantId: tenant_id });
    const results = await Promise.all(
        leads.map(input => leadRepo.create(db, tenant_id, input))
    );
    return NextResponse.json({ created: results.length });
}
```

Hacer lo mismo en:
- `/api/webhooks/retell/route.ts`
- `/api/webhooks/whatsapp/route.ts`
- `/api/webhooks/crm/route.ts`
- `/api/calls/manual/route.ts`

### Paso 4 — Lint rule contra import directo del cliente (30 min)

```js
// eslint.config.mjs
{
    files: ['src/app/**', 'src/components/**'],
    ignores: ['src/lib/supabase/**', 'src/lib/repositories/**'],
    rules: {
        'no-restricted-imports': ['error', {
            paths: [
                { name: '@supabase/supabase-js', message: 'Import from @/lib/repositories instead.' },
                { name: '@supabase/ssr', message: 'Import from @/lib/repositories instead.' },
            ],
        }],
    },
}
```

### Paso 5 — Tests unitarios de repositorios (30 min)

Stub del client con vitest/jest. Verificar que:
- `findById` con id inválido devuelve null.
- `create` rechaza payload que no pasa Zod.
- `update` preserva tenant_id (no lo puede sobrescribir).

## Todo List

- [ ] Crear esquemas Zod base por dominio
- [ ] Crear repositories para 6 tablas principales
- [ ] Refactor API routes (5 endpoints críticos)
- [ ] Refactor server actions (auditoría con grep)
- [ ] Configurar lint rule `no-restricted-imports`
- [ ] Tests unitarios de repos (coverage ≥70%)
- [ ] Documentar patrón en `docs/code-standards.md`

## Success Criteria

- ✅ `grep -rn "from '@supabase" src/app/api/` → solo en archivos permitidos.
- ✅ Cada API route que recibe input externo lo valida con Zod.
- ✅ Tests unitarios de repos pasan en CI.
- ✅ Documentación del patrón disponible en `docs/`.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Refactor incompleto deja paths sin repository | Lint rule fuerza la migración; CI bloquea PRs |
| Zod schemas demasiado estrictos rompen webhooks reales | Usar `.passthrough()` para campos desconocidos al inicio; endurecer iterativamente |
| Overhead de Zod en hot paths | Benchmark: Zod v4 es ~3x más rápido que v3; aceptable |

## Security Considerations

- Zod en boundaries previene **prototype pollution** y **mass assignment** (un actor malicioso enviando `{is_admin: true, tenant_id: 'otro'}`).
- Repositories que aceptan `tenantId` como argumento explícito tras validar JWT → previenen IDOR (Insecure Direct Object Reference).

## Next Steps

→ [Fase 6 — Webhooks y workers con tenant_id explícito](phase-06-webhooks-workers.md)
