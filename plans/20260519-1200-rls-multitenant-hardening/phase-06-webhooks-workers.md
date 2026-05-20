# Fase 6 — Webhooks y workers con tenant_id explícito

**Prioridad:** 🟠 Alta (integraciones externas son superficie de ataque grande)
**Tiempo estimado:** 5h 0min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- [Fase 4 — Clientes Supabase](phase-04-refactor-clientes-supabase.md) (prerequisito)
- [Fase 5 — Repositories + Zod](phase-05-repository-pattern-zod.md) (prerequisito)
- `src/app/api/webhooks/**`
- `src/lib/core/processors/**` y `src/lib/core/workers/**`

## Overview

Adaptar todos los puntos de entrada de procesos sistema (webhooks de Retell, WhatsApp, CRM; workers de BullMQ; cron jobs) para que reciban `tenant_id` de forma verificada y lo pasen al `createSystemClient`. Garantizar que ningún proceso sistema toca la DB sin contexto de tenant.

## Key Insights

- Webhooks externos pueden ser invocados por actores no autenticados. El `tenant_id` no puede venir solo del payload — debe verificarse contra un secreto o identificador externo que mapee 1:1 a un tenant.
- Workers BullMQ procesan jobs encolados. El job debe llevar el `tenantId` y el worker debe usarlo sin trust en variables globales.
- Cron jobs (`appointments/reminders`, etc.) que afectan a múltiples tenants deben **iterar tenant por tenant**, no hacer una query global.

## Requirements

### Funcionales
- Cada webhook valida origen (firma HMAC o secret en header) **antes** de extraer tenant_id.
- Cada webhook resuelve `tenantId` desde un identificador externo (ej. `retell_workspace_id` → `tenants.retell_workspace_id`) en lugar de confiar en el payload.
- Cada job de BullMQ tiene `tenantId` en su payload, marcado como required en el schema Zod del job.
- Cron jobs que afectan a varios tenants: SELECT tenant_id FROM tenants → for each → createSystemClient({tenantId}).

### No funcionales
- Logging estructurado con `tenant_id` en cada evento para auditoría.
- Métricas Prometheus/OpenTelemetry: `webhook_invocations{webhook, tenant_id, status}`.

## Architecture

```
Retell webhook → verify HMAC → lookup tenant by workspace_id → createSystemClient(tenantId) → repo
WhatsApp webhook → verify Meta signature → lookup tenant by waba_id → ...
CRM webhook → verify HubSpot/Zoho signature → lookup tenant by app_id → ...

BullMQ job { tenantId } → worker pulls → createSystemClient(tenantId) → repo
Cron → SELECT tenants → forEach(tenant) → createSystemClient(tenant.id) → repo
```

## Related Code Files

**Modificar:**
- `src/app/api/webhooks/retell/route.ts`
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/app/api/webhooks/crm/route.ts`
- `src/app/api/cron/appointments/reminders/route.ts`
- `src/lib/core/processors/AppointmentWatchdog.ts`
- `src/lib/core/processors/CRMExportProcessor.ts`
- `src/lib/core/processors/CRMPollingProcessor.ts`
- `src/lib/core/processors/QualificationProcessor.ts`
- `src/lib/core/processors/WhatsAppAIProcessor.ts`
- `src/lib/core/processors/WhatsAppWebhookProcessor.ts`
- `src/lib/core/processors/ZohoPollingProcessor.ts`
- `src/lib/core/workers/RescueWorker.ts`
- `worker.js`

**Crear:**
- `src/lib/schemas/webhook-payloads/` (Zod schemas por webhook)
- `src/lib/integrations/tenant-resolver.ts` (lookup externo → tenant_id)

## Implementation Steps

### Paso 1 — Schema columnas externas en `tenants` (30 min)

Migration `20260519_tenant_external_ids.sql`:

```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS retell_workspace_id  text UNIQUE,
    ADD COLUMN IF NOT EXISTS whatsapp_waba_id     text UNIQUE,
    ADD COLUMN IF NOT EXISTS hubspot_portal_id    text UNIQUE,
    ADD COLUMN IF NOT EXISTS zoho_org_id          text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_tenants_retell_workspace ON public.tenants(retell_workspace_id);
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_waba    ON public.tenants(whatsapp_waba_id);
CREATE INDEX IF NOT EXISTS idx_tenants_hubspot_portal   ON public.tenants(hubspot_portal_id);
CREATE INDEX IF NOT EXISTS idx_tenants_zoho_org         ON public.tenants(zoho_org_id);
```

### Paso 2 — Tenant resolver helper (30 min)

`src/lib/integrations/tenant-resolver.ts`:

```ts
import { createProvisioningClient } from '@/lib/supabase/provisioning';

type ExternalKey =
    | { source: 'retell',   workspaceId: string }
    | { source: 'whatsapp', wabaId: string }
    | { source: 'hubspot',  portalId: string }
    | { source: 'zoho',     orgId: string };

export async function resolveTenantId(key: ExternalKey): Promise<string> {
    const db = createProvisioningClient();
    const column = {
        retell:   'retell_workspace_id',
        whatsapp: 'whatsapp_waba_id',
        hubspot:  'hubspot_portal_id',
        zoho:     'zoho_org_id',
    }[key.source];
    const value = 'workspaceId' in key ? key.workspaceId
                : 'wabaId' in key ? key.wabaId
                : 'portalId' in key ? key.portalId
                : key.orgId;

    const { data, error } = await db
        .from('tenants')
        .select('id')
        .eq(column, value)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`No tenant found for ${key.source}:${value}`);
    return data.id;
}
```

### Paso 3 — Refactor webhook Retell (1h 0min)

`src/app/api/webhooks/retell/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { verifyRetellSignature } from '@/lib/integrations/retell';
import { resolveTenantId } from '@/lib/integrations/tenant-resolver';
import { createSystemClient } from '@/lib/supabase/system-client';
import { llamadaRepo } from '@/lib/repositories/llamadas';
import { RetellCallEnded } from '@/lib/schemas/webhook-payloads/retell';

export async function POST(req: Request) {
    const raw = await req.text();
    const sig = req.headers.get('x-retell-signature');
    if (!sig || !verifyRetellSignature(raw, sig)) {
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const payload = RetellCallEnded.parse(JSON.parse(raw));
    const tenantId = await resolveTenantId({
        source: 'retell',
        workspaceId: payload.workspace_id,
    });

    const db = createSystemClient({ tenantId });
    await llamadaRepo.upsertFromRetell(db, tenantId, payload);

    return NextResponse.json({ ok: true });
}
```

### Paso 4 — Refactor webhooks WhatsApp y CRM (1h 30min)

Aplicar el mismo patrón a:
- `whatsapp/route.ts` — usar `waba_id` de Meta
- `crm/route.ts` — distinguir HubSpot vs Zoho según signature, usar `portalId`/`orgId`

### Paso 5 — Refactor workers BullMQ (1h 0min)

Cada job schema con Zod:

```ts
export const QualificationJob = z.object({
    tenantId: z.uuid(),
    leadId: z.uuid(),
    callId: z.uuid(),
});

// En el worker
worker.on('completed', async (job) => {
    const { tenantId, leadId, callId } = QualificationJob.parse(job.data);
    const db = createSystemClient({ tenantId });
    // ...
});
```

Procesar:
- `QualificationProcessor.ts`
- `CRMExportProcessor.ts` / `CRMPollingProcessor.ts` / `ZohoPollingProcessor.ts`
- `WhatsAppAIProcessor.ts` / `WhatsAppWebhookProcessor.ts`
- `AppointmentWatchdog.ts`
- `RescueWorker.ts`

### Paso 6 — Cron jobs multi-tenant (30 min)

`src/app/api/cron/appointments/reminders/route.ts`:

```ts
export async function GET() {
    const admin = createProvisioningClient();
    const { data: tenants } = await admin.from('tenants').select('id');

    const results = await Promise.allSettled(
        (tenants ?? []).map(async ({ id: tenantId }) => {
            const db = createSystemClient({ tenantId });
            return appointmentService.sendReminders(db, tenantId);
        })
    );
    return NextResponse.json({
        total: tenants?.length ?? 0,
        success: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
    });
}
```

## Todo List

- [ ] Migration `tenant_external_ids.sql`
- [ ] Helper `tenant-resolver.ts`
- [ ] Refactor webhook Retell + Zod schema
- [ ] Refactor webhook WhatsApp + Zod schema
- [ ] Refactor webhook CRM + Zod schema (HubSpot + Zoho)
- [ ] Refactor 8 processors BullMQ
- [ ] Refactor 1 worker (`RescueWorker.ts`)
- [ ] Refactor cron `appointments/reminders`
- [ ] Backfill: poblar columnas `retell_workspace_id`, etc. de tenants existentes
- [ ] Logging estructurado con tenant_id en cada job/webhook
- [ ] Smoke tests con webhooks reales (sandbox)

## Success Criteria

- ✅ Cada webhook verifica firma ANTES de procesar.
- ✅ Cada webhook resuelve tenant desde ID externo, no del payload directo.
- ✅ Cada job BullMQ tiene `tenantId` en payload, validado con Zod.
- ✅ Cron multi-tenant itera correctamente sin queries globales.
- ✅ Logs muestran `tenant_id` en cada evento.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Webhooks legacy sin `retell_workspace_id` mapeado fallan | Backfill antes del rollout; fallback a tenant_id en payload con alerta de deprecación durante 30 días |
| Workers viejos en cola con jobs sin tenantId | Drenar cola antes de desplegar nuevos workers; o validación lax con default tenant para periodo de gracia |
| Performance del cron al iterar todos los tenants | Batching + `Promise.allSettled` + alertas si supera N segundos |

## Security Considerations

- Verificación de firma HMAC obligatoria en TODOS los webhooks. Sin firma → 401.
- Lookup de tenant desde ID externo, no desde payload, previene que un atacante envíe payload falso con `tenant_id` arbitrario.
- Jobs de BullMQ deben ir por una cola privada (Redis con auth) para evitar inyección externa.

## Next Steps

→ [Fase 7 — Tests E2E anti-fuga](phase-07-tests-anti-fuga.md)
