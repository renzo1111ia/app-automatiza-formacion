---
title: "Phase 02 — Observabilidad: Logging estructurado + Métricas BullMQ (4-03)"
sprint: 4
phase: 2
tasks: [4-03]
effort: 12-16h
status: pending
agents: [af-agents:code, af-agents:deployment]
---

# Phase 02 — Observabilidad: Logging + Métricas BullMQ

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) línea 330 (4-03)
- Researcher report: [researcher-observability-d-20260520.md](../reports/researcher-observability-d-20260520.md)
- ADR deps: [adr-auditoria-dependencias-20260520.md](../reports/adr-auditoria-dependencias-20260520.md) — línea 417 (Pino + OpenTelemetry recomendados)
- DA-1: `docs/audit/deep/DA-1-concurrency-orchestrator.md` — DA-1-005 silenciado Redis (logging fix)

## Overview

- **Priority:** P2
- **Status:** Pendiente
- **Descripción:** Implementar logging estructurado JSON con Pino en todos los puntos críticos (API Routes, Server Actions, BullMQ Workers), métricas de colas BullMQ vía bull-board y `getJobCounts()`, e integración con Easypanel para observabilidad básica.

## Key Insights

- **Pino v9** elegido sobre Winston: 5x más rápido, stdout nativo (Easypanel captura), campo `tenant_id` estructurado
- **bull-board** para UI de monitoreo de colas (devDep), ruta protegida con auth de admin
- DA-1-005 (enqueueLeadStep silencia errores Redis) se resuelve directamente añadiendo logging Pino en el catch handler
- OpenTelemetry completo (trazas distribuidas) aplazado a Sprint 4 — MVP usa Pino únicamente
- Sentry para error tracking: plan free, 5K errores/mes, suficiente para MVP
- Tabla `llm_usage_logs` se crea en ESTA fase (Ph2) para que Ph3 pueda usarla

## Requirements

### Funcionales
- Logging estructurado JSON en todos los API Routes críticos (`/api/webhooks/*`, `/api/orchestration/*`, `/api/auth/*`)
- Logging en BullMQ Workers: job started, job completed, job failed con `tenant_id`, `lead_id`, `duration_ms`
- Métricas BullMQ: `waiting`, `active`, `completed`, `failed` disponibles via bull-board UI
- Tabla `llm_usage_logs` en PostgreSQL con RLS multi-tenant (usada por Ph3)
- Sentry setup básico para captura de errores en Server Actions y API Routes

### No funcionales
- Logs en `stdout` únicamente (sin archivos de log en disco) — Easypanel los captura
- Nivel configurable via `LOG_LEVEL` env var (`info` prod, `debug` dev)
- Sin impacto en rendimiento: Pino es asíncrono, no bloquea el request

## Architecture

```
Flujo de logging:
  Request/Job → Pino logger (JSON stdout) → Easypanel log aggregation
                                          → Sentry (errores únicamente)

  Campos estándar por log entry:
  { level, time, service, tenant_id, user_id?, trace_id?, action, duration_ms, msg }

Métricas BullMQ:
  BullMQ Queue → getJobCounts() → PostgreSQL (cron cada 5min) → Ph3 dashboard

  bull-board UI:
  /admin/queues → bull-board → BullMQ Redis → UI visual
  (protegido por auth middleware — solo admin)

Tabla llm_usage_logs:
  LangChain CallbackHandler → INSERT llm_usage_logs → Ph3 dashboard Recharts
  RLS: tenant_id = jwt.tenant_id (mismo patrón Sprint 0)
```

## Related Code Files

### Crear
- `src/lib/logger.ts` — singleton Pino logger
- `src/lib/bullmq-metrics.ts` — helper getJobCounts + persistencia PostgreSQL
- `src/app/api/admin/queues/[[...slug]]/route.ts` — bull-board Next.js route
- `migrations/YYYYMMDD_llm_usage_logs.sql` — tabla + RLS + índices
- `src/lib/llm-cost-tracker.ts` — LangChain BaseCallbackHandler (preparación Ph3)

### Modificar
- `src/app/api/webhooks/retell/route.ts` — añadir logging structured
- `src/app/api/webhooks/crm/route.ts` — añadir logging structured
- `src/app/api/orchestration/*/route.ts` — añadir logging structured
- `src/workers/worker.js` (o equivalente) — logging en job lifecycle
- `src/lib/queue/lead-sequence-queue.ts` — fix DA-1-005: logging en catch handler Redis
- `package.json` — añadir pino, @bull-board/api, @bull-board/nextjs, @sentry/nextjs
- `.env.example` — añadir LOG_LEVEL, SENTRY_DSN

## Implementation Steps

### Paso 1: ADR + instalar Pino
```
ADR check: pino@^9.x no está en proyecto. Pasar por af-agents:adr.
```
```bash
npm install pino pino-http
npm install -D @types/pino
```

### Paso 2: Logger singleton
```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
  base: { service: 'dashboard-af', env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// Helper para logs con contexto de tenant
export function tenantLogger(tenantId: string, context: Record<string, unknown> = {}) {
  return logger.child({ tenant_id: tenantId, ...context });
}
```

### Paso 3: Fix DA-1-005 — logging en enqueueLeadStep
En `src/lib/queue/lead-sequence-queue.ts`, el catch silencioso:
```typescript
// ANTES (DA-1-005):
} catch (err) {
  return { id: 'fictional-id' }; // job perdido sin notificación
}

// DESPUÉS:
} catch (err) {
  logger.error({ err, leadId, step, tenantId }, 'Failed to enqueue lead step — job LOST');
  throw err; // propagar para que el caller sepa
}
```

### Paso 4: Logging en API Routes críticos
Añadir al inicio de cada handler:
```typescript
const log = logger.child({ tenant_id: tenantId, action: 'webhook.retell', trace_id: crypto.randomUUID() });
log.info({ leadId }, 'Webhook received');
// ...
log.info({ duration_ms: Date.now() - start }, 'Webhook processed');
```

### Paso 5: Logging en Workers BullMQ
```typescript
worker.on('completed', (job) => {
  logger.info({ jobId: job.id, tenant_id: job.data.tenantId, duration_ms: job.processedOn! - job.timestamp }, 'Job completed');
});
worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, tenant_id: job?.data.tenantId, err }, 'Job failed');
});
```

### Paso 6: bull-board UI
```bash
npm install @bull-board/api@^6.x @bull-board/nextjs@^6.x
```
Crear `/admin/queues` route protegida con verificación de rol admin.

### Paso 7: Migración SQL llm_usage_logs
```sql
CREATE TABLE llm_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6),
  session_id UUID,
  lead_id UUID REFERENCES leads(id),
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON llm_usage_logs
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE INDEX ON llm_usage_logs(tenant_id, created_at DESC);
CREATE INDEX ON llm_usage_logs(tenant_id, provider, created_at DESC);
```

### Paso 8: Sentry setup básico
```bash
npm install @sentry/nextjs@^8.x  # Pasar por ADR
npx @sentry/wizard@latest -i nextjs
```
Configurar SENTRY_DSN en .env. Captura de errores en API Routes y Server Actions.

## Todo List

- [ ] ADR para pino, @bull-board/*, @sentry/nextjs
- [ ] Instalar pino + pino-http
- [ ] `src/lib/logger.ts` — singleton + tenantLogger helper
- [ ] Fix DA-1-005 en `lead-sequence-queue.ts`
- [ ] Logging structured en webhooks/retell, webhooks/crm, orchestration/*
- [ ] Logging en BullMQ Worker (completed, failed, stalled)
- [ ] Instalar bull-board + crear ruta /admin/queues protegida
- [ ] Migración SQL `llm_usage_logs` + RLS
- [ ] `src/lib/llm-cost-tracker.ts` — LangChain callback (usada en Ph3)
- [ ] Sentry setup básico (errors only)
- [ ] .env.example actualizado con LOG_LEVEL, SENTRY_DSN
- [ ] Verificar logs en stdout con `npm run dev` + Easypanel docs
- [ ] Test: provocar fallo Redis → log visible sin silencio

## Success Criteria

- `logger.info()` visible en stdout de `npm run dev` con campos `tenant_id`, `action`, `duration_ms`
- DA-1-005 resuelto: error Redis en enqueueLeadStep lanza excepción + log error visible
- `/admin/queues` accesible solo para admin, muestra estado de colas BullMQ
- Tabla `llm_usage_logs` creada con RLS funcional (test: INSERT como tenant A no visible por tenant B)
- Sentry captura primer error de prueba

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Pino incompatible con Edge Runtime de Next.js | Media | Bajo | Logging solo en Server (Node runtime) — sin logging en Edge middleware |
| bull-board expuesto sin auth | Alta | Alto | Auth check OBLIGATORIO en route handler antes de servir UI |
| Migración SQL rompe datos existentes | Baja | Medio | Nueva tabla, no modifica existentes; backup antes |

## Security Considerations

- `/admin/queues` (bull-board) protegido con verificación `is_admin` en session
- Logs NO deben incluir datos sensibles: no tokens LLM, no contraseñas, no PII de leads en nivel INFO
- `tenant_id` en todos los logs — permite filtrar por tenant en incident response
- SENTRY_DSN en variables de entorno, nunca hardcodeado (lección Sprint 0)

## Next Steps

- Ph3 (Dashboard costes LLM) consume `llm_usage_logs` creada en este phase
- Ph5 (Hardening) puede añadir logging de rate limit events (`logger.warn({ ip, endpoint }, 'Rate limit exceeded')`)
