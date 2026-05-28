---
title: "Phase 01 — Tabla llm_usage_logs + LangChain CostTrackingCallback (C-01)"
sprint: SP-5B
phase: 1
tasks: [C-01]
effort: 5-7h
status: pending
agents: [af-agents:database, af-agents:code]
---

# Phase 01 — Tabla `llm_usage_logs` + LangChain CostTrackingCallback

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) §Fase 4.5 (C-01)
- **Origen del split (22-05-2026):** este contenido vivía dentro de Sprint 3 phase-02 (4-03). Se extrajo cuando la clienta confirmó que el centro de costes LLM no es necesario en MVP `v0.4.0`. La parte que SE QUEDA en MVP (Pino logger + métricas BullMQ + Sentry) sigue en Sprint 3 phase-02.
- Researcher: `plans/reports/researcher-observability-d-20260520.md` §3.4 (LangChain CallbackHandler)
- DA-4-005 audit: precios LLM hardcodeados obsoletos (GPT-4 2023) — se corrige en Ph2 (`llm-pricing.ts`)
- F-DA-4 audit: token_usage no persistido en `chat_messages` — se cierra en Ph3

## Overview

- **Priority:** P2
- **Status:** Pendiente
- **Descripción:** Crear la tabla `llm_usage_logs` con RLS multi-tenant y el LangChain `CostTrackingCallback` que captura tokens en cada llamada LLM (Anthropic, OpenAI, Google) y los persiste. Es la base de datos del dashboard de costes (Ph2). **Bedrock descartado del stack 26-05-2026** (orden usuario).

## Key Insights

- **Captura por LangChain CallbackHandler**: usa el patrón estándar de `BaseCallbackHandler` (parte de `@langchain/core`), no requiere dep nueva.
- **Llamadas OpenAI directas** (no a través de LangChain) **NO son capturadas por el callback**. Hoy en día tenemos: `WhatsAppAIProcessor`, `RescueWorker`, `widget.ts` (server action), `FactExtractor`, `AIAnalysis`. Estas siguen registrando en `chat_messages.metadata.token_usage` (Ph3) PERO conviene también persistirlas en `llm_usage_logs` para que el dashboard tenga datos unificados. Decisión: en esta fase añadimos un helper `recordLlmUsage()` que cada call site OpenAI directo invoca tras `chat.completions.create()`. Es +30min por call site, ~3h total para los 5 call sites.
- **Cálculo de costes**: se calcula en app al momento de persistir (no en BD) para facilitar actualización de precios. Tabla `src/lib/llm-pricing.ts` con precios mayo 2026 (DA-4-005 cerrado aquí).
- **LangSmith descartado**: PII en payloads → no enviar a SaaS externo.

## Requirements

### Funcionales

- Tabla `llm_usage_logs` con columnas: `id`, `tenant_id`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `session_id`, `lead_id`, `action`, `created_at`.
- RLS multi-tenant: SELECT solo para `tenant_id = jwt.tenant_id` o `is_admin=true`.
- `src/lib/llm-cost-tracker.ts`: LangChain `BaseCallbackHandler` que en `handleLLMEnd` extrae `usage` + `model` + calcula `cost_usd` y hace INSERT en `llm_usage_logs`.
- `src/lib/llm-pricing.ts`: constante con precios mayo 2026 por provider/model (input/output per 1M tokens).
- Helper `recordLlmUsage()` para call sites OpenAI directos.
- Aplicar el callback a la factory de LangChain (`src/lib/llm/agent-factory.ts` o equivalente).
- Aplicar `recordLlmUsage()` en los 5 call sites OpenAI directos identificados.

### No funcionales

- **Failure mode**: si el INSERT a `llm_usage_logs` falla (BD caída, etc.), log warning y NO romper el flujo del LLM. La métrica es defense-in-depth, no la única fuente de verdad (la fuente principal es `chat_messages.metadata.token_usage` de Ph3).
- Índices en `(tenant_id, created_at DESC)` y `(tenant_id, provider, created_at DESC)` para queries del dashboard.
- Migración idempotente: `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` antes de cada CREATE POLICY.

## Architecture

```
Flujo LangChain:
  AgentFactory.create(... { callbacks: [costTracker] })
    → cada llamada LLM dispara handleLLMEnd(output)
    → costTracker extrae usage.{prompt,completion}_tokens + model
    → calcula cost_usd con llm-pricing.ts
    → INSERT llm_usage_logs (tenant_id, provider, model, tokens, cost_usd, action, lead_id)

Flujo OpenAI directo (widget, WhatsApp, etc.):
  const completion = await openai.chat.completions.create(...);
  await recordLlmUsage({
    tenantId, provider: 'openai', model: completion.model,
    usage: completion.usage, action: 'widget.chat', leadId,
  });
```

## Related Code Files

### Crear

- `supabase/migrations/YYYYMMDD_llm_usage_logs.sql` — tabla + RLS + índices
- `src/lib/llm-pricing.ts` — constante de precios mayo 2026
- `src/lib/llm-cost-tracker.ts` — LangChain CallbackHandler + helper `recordLlmUsage()`

### Modificar

- `src/lib/llm/agent-factory.ts` (o equivalente que crea `ChatOpenAI`/`ChatAnthropic` LangChain) — inyectar `costTracker` como callback.
- 5 call sites OpenAI directos: `WhatsAppAIProcessor.ts`, `AIRescueService.ts`, `src/lib/actions/widget.ts`, `FactExtractor.ts`, `AIAnalysis.ts` (o sus equivalentes) — invocar `recordLlmUsage()` tras `chat.completions.create()`.

## Implementation Steps

1. **Migración SQL** (`af-agents:database`):

   ```sql
   CREATE TABLE IF NOT EXISTS llm_usage_logs (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     provider TEXT NOT NULL,
     model TEXT NOT NULL,
     prompt_tokens INTEGER NOT NULL DEFAULT 0,
     completion_tokens INTEGER NOT NULL DEFAULT 0,
     cost_usd NUMERIC(10,6),
     session_id UUID,
     lead_id UUID REFERENCES lead(id) ON DELETE SET NULL,
     action TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;

   DROP POLICY IF EXISTS "tenant_isolation_select" ON llm_usage_logs;
   CREATE POLICY "tenant_isolation_select" ON llm_usage_logs
     FOR SELECT
     USING (
       tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
       OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
     );

   -- INSERT solo desde service_role (callbacks + helpers internos)
   DROP POLICY IF EXISTS "service_role_insert" ON llm_usage_logs;
   CREATE POLICY "service_role_insert" ON llm_usage_logs
     FOR INSERT
     TO service_role
     WITH CHECK (true);

   CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_created
     ON llm_usage_logs(tenant_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_provider_created
     ON llm_usage_logs(tenant_id, provider, created_at DESC);
   ```

   Aplicar contra Supabase local (`docker exec ... psql ...`). Apply VPS diferido a pre-deploy.

2. **`src/lib/llm-pricing.ts`** (~30min):

   ```ts
   export const LLM_PRICING_PER_1M_TOKENS = {
     openai: {
       "gpt-4o": { input: 2.5, output: 10.0 },
       "gpt-4o-mini": { input: 0.15, output: 0.6 },
       "gpt-4-turbo": { input: 10.0, output: 30.0 },
       "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
     },
     anthropic: {
       "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
       "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
       "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
     },
     google: {
       "gemini-1.5-pro": { input: 1.25, output: 5.0 },
       "gemini-1.5-flash": { input: 0.075, output: 0.3 },
     },
   } as const;

   export function calculateCostUsd(
     provider: string,
     model: string,
     promptTokens: number,
     completionTokens: number
   ): number | null {
     // ...lookup + cálculo
   }
   ```

   **NOTA importante**: actualizar precios consultando docs oficiales OpenAI/Anthropic/Google en el momento de implementar (los precios cambian — los de aquí son aproximados mayo 2026).

3. **`src/lib/llm-cost-tracker.ts`** (~2h):

   ```ts
   import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
   import { logger } from "@/lib/logger";
   import { getAdminSupabaseClient } from "@/lib/supabase/server";
   import { calculateCostUsd } from "./llm-pricing";

   export class CostTrackingCallback extends BaseCallbackHandler {
     name = "CostTrackingCallback";
     constructor(private ctx: { tenantId: string; leadId?: string; action: string }) {
       super();
     }

     async handleLLMEnd(output: unknown): Promise<void> {
       // Extraer usage + model (forma exacta depende de la versión LangChain — verificar)
       // INSERT llm_usage_logs
       // Fallback log + return en caso de error
     }
   }

   export async function recordLlmUsage(params: {
     tenantId: string;
     provider: "openai" | "anthropic" | "google";
     model: string;
     usage: { prompt_tokens?: number; completion_tokens?: number };
     action: string;
     leadId?: string;
     sessionId?: string;
   }): Promise<void> {
     try {
       const supabase = await getAdminSupabaseClient();
       const cost = calculateCostUsd(
         params.provider,
         params.model,
         params.usage.prompt_tokens ?? 0,
         params.usage.completion_tokens ?? 0
       );
       await supabase.from("llm_usage_logs").insert({
         /* ... */
       });
     } catch (err) {
       logger.warn({ err }, "[llm-cost-tracker] insert failed — non-fatal");
     }
   }
   ```

4. **Inyectar callback en LangChain factory** (~30min): localizar `AgentFactory.create` (o el wrapper que crea `ChatOpenAI`/`ChatAnthropic`) y añadir `callbacks: [new CostTrackingCallback({ tenantId, leadId, action })]` al constructor.

5. **Wire OpenAI directos** (~3h, 5 call sites × 30min):
   - `WhatsAppAIProcessor.ts` → `recordLlmUsage({ action: 'whatsapp.chat', ... })`
   - `AIRescueService.ts` → `recordLlmUsage({ action: 'whatsapp.rescue', ... })`
   - `src/lib/actions/widget.ts` → `recordLlmUsage({ action: 'widget.chat', ... })`
   - `FactExtractor.ts` → `recordLlmUsage({ action: 'fact.extract', ... })`
   - `AIAnalysis.ts` → `recordLlmUsage({ action: 'analysis.qualify', ... })`

6. **Test mínimo**: provocar una llamada al widget (modo legacy del Sprint 0 1-27), confirmar que aparece una fila en `llm_usage_logs` con `cost_usd` calculado y `tenant_id` correcto.

## Todo List

- [ ] C-01: Crear migración SQL `llm_usage_logs` + RLS + índices
- [ ] C-01: Aplicar migración contra Supabase local
- [ ] C-01: Crear `src/lib/llm-pricing.ts` con precios mayo 2026 (verificar docs oficiales)
- [ ] C-01: Crear `src/lib/llm-cost-tracker.ts` con `CostTrackingCallback` + `recordLlmUsage()`
- [ ] C-01: Inyectar callback en `AgentFactory` (o equivalente)
- [ ] C-01: Wire 5 call sites OpenAI directos (`recordLlmUsage()` tras `chat.completions.create()`)
- [ ] C-01: Test smoke — request al widget genera fila en `llm_usage_logs`
- [ ] C-01: Typecheck + lint + build limpios

## Success Criteria

- `SELECT COUNT(*) FROM llm_usage_logs WHERE tenant_id = $JWT_TENANT` desde cliente autenticado → solo cuenta propias filas (RLS funcional).
- Tras 1 chat de widget completo → 1 fila nueva en `llm_usage_logs` con `cost_usd > 0`.
- Tras 1 conversación WhatsApp → 1 fila por cada llamada LLM (varias en flujos con tool calls).
- `llm-pricing.ts` cubre OpenAI (4 modelos), Anthropic (3 modelos), Google (2 modelos) — sin gaps.

## Risk Assessment

| Riesgo                                                                                    | Prob  | Impacto | Mitigación                                                                                          |
| ----------------------------------------------------------------------------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------- |
| LangChain version API cambió (`handleLLMEnd` signature) entre `@langchain/core` versiones | Media | Bajo    | Verificar al implementar; ajustar firma según versión exacta del package.json                       |
| Llamadas OpenAI directas olvidadas (call site nuevo añadido después)                      | Media | Medio   | Documentar en `docs/architecture/llm-cost-tracking.md` el patrón obligatorio + check en code review |
| INSERT a `llm_usage_logs` añade latencia perceptible al chat                              | Baja  | Bajo    | Fire-and-forget pattern: `void recordLlmUsage(...)` sin `await` en hot path, o usar `setImmediate`  |

## Security Considerations

- `llm_usage_logs` no contiene el contenido de los prompts/responses — solo metadatos (tokens, model, cost, action). PII mínima (`lead_id` referencia FK, sin denormalizar email/teléfono).
- RLS multi-tenant verificado: tests INSERT como tenant A → SELECT como tenant B = 0 filas.
- El campo `action` puede contener strings descriptivos pero NO datos de usuario.

## Next Steps

- → [Phase 02 — Dashboard costes LLM](phase-02-dashboard-costes-llm.md)
- → [Phase 03 — token_usage en chat_messages](phase-03-token-usage-chat-messages.md) (paralelo a esta fase)
