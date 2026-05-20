---
title: "Phase 03 — Dashboard de costes LLM por tenant/proveedor (4-04)"
sprint: 4
phase: 3
tasks: [4-04]
effort: 16-22h
status: pending
agents: [esden-agents:code, esden-agents:uxui]
---

# Phase 03 — Dashboard de Costes LLM

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) línea 331 (4-04)
- Researcher report: [researcher-observability-d-20260520.md](../reports/researcher-observability-d-20260520.md) — sección 4
- Phase 02: crea tabla `llm_usage_logs` y `llm-cost-tracker.ts` — **PREREQUISITO**
- DA-4-005: precios LLM hardcodeados obsoletos (GPT-4 de 2023) — se corrigen aquí
- DA-4-010: API keys OpenAI visibles en UI dashboard — NO exponer en este dashboard

## Overview

- **Priority:** P2
- **Status:** Pendiente (bloqueado por Ph2 — tabla llm_usage_logs)
- **Descripción:** Implementar el sistema completo de tracking de tokens LLM por tenant/proveedor/modelo usando LangChain CallbackHandler, y un dashboard de costes en el admin panel con Recharts.

## Key Insights

- Recharts ya está en el stack (`recharts@^3.7.0`) — sin nuevas deps para UI
- LangChain ya tiene `BaseCallbackHandler` — el callback tracker es código, no dependencia nueva
- Precios actualizados (mayo 2026) documentados en researcher report — DA-4-005 requería esta corrección
- **Dos vistas:** Admin global (todos los tenants) + Vista tenant (solo sus propios datos)
- Los costes se calculan en app al momento de persistir (no en BD) para facilitar actualización de precios
- LangSmith descartado: los datos de leads son PII sensible, no deben ir a SaaS externo

## Requirements

### Funcionales
- LangChain `CostTrackingCallback` captura tokens en CADA llamada LLM (Anthropic, OpenAI, Google, Bedrock)
- Tabla `llm_usage_logs` (creada en Ph2) recibe INSERT por cada LLM call con tenant_id, proveedor, modelo, tokens, cost_usd
- Dashboard admin: gráfica de costes por proveedor por mes (BarChart)
- Dashboard admin: evolución costes totales por tenant por semana (LineChart)
- Dashboard tenant: solo sus propios costes, desglose por acción (qualification, chat, analysis)
- Corregir precios hardcodeados desactualizados (DA-4-005): tabla de precios en constante, no en BD

### No funcionales
- Cálculo de costes: `cost_usd = (prompt_tokens * input_price_per_1m / 1_000_000) + (completion_tokens * output_price_per_1m / 1_000_000)`
- Actualizaciones de precios: editar constante en `src/lib/llm-pricing.ts`, no requiere migración BD
- Dashboard no carga datos en tiempo real — refresh manual o cada 30min (no websockets)

## Architecture

```
Data flow costes LLM:
  LangChain LLM call
      │
      ├─ CostTrackingCallback.handleLLMEnd()
      │       │
      │       ├─ Calcular cost_usd (tabla precios local)
      │       └─ INSERT llm_usage_logs (Supabase, RLS multi-tenant)
      │
  PostgreSQL llm_usage_logs
      │
      ├─ API Route /api/admin/llm-costs (admin global)
      │       └─ GROUP BY tenant, provider, month → Recharts data
      │
      └─ API Route /api/llm-costs (tenant view, RLS filtra)
              └─ GROUP BY provider, action, month → Recharts data

Dashboard UI:
  /dashboard/admin/costs → Admin: todos los tenants
  /dashboard/costs       → Tenant: solo mis costes
```

## Related Code Files

### Crear
- `src/lib/llm-pricing.ts` — constante con precios actualizados por proveedor/modelo
- `src/lib/llm-cost-tracker.ts` — LangChain BaseCallbackHandler (iniciado en Ph2)
- `src/app/api/admin/llm-costs/route.ts` — endpoint admin costes agregados
- `src/app/api/llm-costs/route.ts` — endpoint tenant costes propios
- `src/app/dashboard/admin/costs/page.tsx` — admin dashboard UI
- `src/components/costs/CostsByProviderChart.tsx` — BarChart proveedor/mes
- `src/components/costs/CostsByTenantChart.tsx` — LineChart tenant evolution
- `src/components/costs/CostsSummaryCard.tsx` — tarjeta resumen coste total mes

### Modificar
- `src/lib/llm-factory.ts` (o equivalente) — inyectar `CostTrackingCallback` en cada chain LLM
- `src/app/dashboard/settings/page.tsx` — añadir link a dashboard de costes tenant
- `src/app/layout.tsx` — ruta `/dashboard/admin/costs` solo para admin

## Implementation Steps

### Paso 1: Tabla de precios actualizada (fix DA-4-005)
```typescript
// src/lib/llm-pricing.ts
// Precios en USD por 1M tokens — actualizado Mayo 2026
export const LLM_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'anthropic/claude-3-opus': { input: 15.00, output: 75.00 },
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4-turbo': { input: 10.00, output: 30.00 },
  'google/gemini-1-5-pro': { input: 1.25, output: 5.00 },
  'google/gemini-1-5-flash': { input: 0.075, output: 0.30 },
  'bedrock/claude-3-5-sonnet': { input: 3.00, output: 15.00 },
};

export function calculateCostUSD(
  provider: string, model: string,
  promptTokens: number, completionTokens: number
): number {
  const key = `${provider}/${model}`;
  const pricing = LLM_PRICING[key];
  if (!pricing) return 0; // modelo desconocido — log warning
  return (promptTokens * pricing.input / 1_000_000) + (completionTokens * pricing.output / 1_000_000);
}
```

### Paso 2: LangChain CostTrackingCallback
```typescript
// src/lib/llm-cost-tracker.ts
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { calculateCostUSD } from './llm-pricing';
import { createAdminClient } from './supabase/admin';

export class CostTrackingCallback extends BaseCallbackHandler {
  name = 'esden-cost-tracker';
  private tenantId: string;
  private leadId?: string;
  private action?: string;
  private provider: string;
  private model: string;

  constructor(opts: { tenantId: string; leadId?: string; action?: string; provider: string; model: string }) {
    super();
    Object.assign(this, opts);
  }

  async handleLLMEnd(output: LLMResult): Promise<void> {
    const usage = output.llmOutput?.tokenUsage || output.llmOutput?.usage;
    const promptTokens = usage?.promptTokens ?? usage?.input_tokens ?? 0;
    const completionTokens = usage?.completionTokens ?? usage?.output_tokens ?? 0;
    const costUsd = calculateCostUSD(this.provider, this.model, promptTokens, completionTokens);

    const supabase = createAdminClient();
    await supabase.from('llm_usage_logs').insert({
      tenant_id: this.tenantId,
      provider: this.provider,
      model: this.model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: costUsd,
      lead_id: this.leadId,
      action: this.action,
    });
  }
}
```

### Paso 3: Inyectar callback en LLM factory
En el factory de LLM (donde se instancia ChatOpenAI, ChatAnthropic, etc.), añadir:
```typescript
const callbacks = [new CostTrackingCallback({ tenantId, leadId, action, provider: 'anthropic', model: 'claude-3-5-sonnet' })];
const llm = new ChatAnthropic({ callbacks, /* ...existing config */ });
```

### Paso 4: API Routes de costes
`/api/admin/llm-costs` — GROUP BY provider, DATE_TRUNC('month', created_at), solo admin.
`/api/llm-costs` — GROUP BY provider, action, mes — filtrado por RLS (tenant actual).

### Paso 5: Dashboard UI (Recharts)
Tres componentes:
1. `CostsByProviderChart` — BarChart stacked: eje X = mes, eje Y = cost_usd, series = providers
2. `CostsByTenantChart` — LineChart: eje X = semana, líneas por tenant (solo admin global)
3. `CostsSummaryCard` — tarjeta con coste total mes actual, delta vs mes anterior

### Paso 6: Páginas
- `/dashboard/admin/costs` — solo accesible a superadmin
- Link desde `/dashboard/settings` para que el tenant vea sus propios costes

## Todo List

- [ ] `src/lib/llm-pricing.ts` con precios actualizados (fix DA-4-005)
- [ ] `src/lib/llm-cost-tracker.ts` — CostTrackingCallback completo
- [ ] Verificar que Ph2 creó `llm_usage_logs` con RLS correcta
- [ ] Inyectar CostTrackingCallback en LLM factory (todos los providers)
- [ ] Test: llamada LLM real → INSERT en llm_usage_logs → verificar tokens y cost_usd
- [ ] API Route `/api/admin/llm-costs` con agregaciones SQL
- [ ] API Route `/api/llm-costs` (tenant, RLS)
- [ ] Componente `CostsByProviderChart` (BarChart Recharts)
- [ ] Componente `CostsSummaryCard`
- [ ] Página `/dashboard/admin/costs`
- [ ] Link en settings para tenants
- [ ] Verificar que DA-4-010 no se viola: API keys NO visibles en dashboard costes
- [ ] Typecheck + build sin errores

## Success Criteria

- Llamada LLM real genera INSERT en `llm_usage_logs` con `cost_usd > 0`
- Dashboard admin muestra gráfica de costes por proveedor por mes
- Vista tenant muestra solo sus propios costes (RLS verificado)
- Precios obsoletos de DA-4-005 corregidos (GPT-4 precio actual, no 2023)
- `npm run typecheck` sin errores en componentes nuevos

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| LangChain output format diferente por proveedor (tokenUsage path distinto) | Alta | Medio | Testear con CADA proveedor; múltiples paths en handler |
| Precios LLM cambian frecuentemente | Alta | Bajo | Tabla de precios en constante TypeScript (fácil editar), no en BD |
| Coste 0 en llamadas con streaming (no reportan tokens al final) | Media | Medio | Verificar si streaming llega a `handleLLMEnd` o requiere `handleLLMStreamEvent` |

## Security Considerations

- `llm_usage_logs` tiene RLS: tenant solo ve sus datos (confirmado en migración Ph2)
- Admin view (`/api/admin/llm-costs`) solo accesible con `is_admin = true` en session
- Los costes son información financiera sensible: no exponer en endpoints públicos
- `cost_usd` calculado en app, no en BD — evita SQL injection en cálculos financieros
- DA-4-010: las API keys de LLM NO deben aparecer en ningún response del dashboard de costes

## Next Steps

- Los datos de `llm_usage_logs` pueden usarse en Sprint 5 para alertas de coste (budget alerts por tenant)
- Sprint 5 puede migrar a LangSmith si el equipo escala y necesita debugging LLM avanzado
