---
title: "Sprint 2B — Phase 02 — Backend getKpiOverview()"
status: pending
priority: P1
effort: 3h
sprint_id: SP-3B
task_ids: [SP-3B-02]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 02 — Backend: getKpiOverview() thin wrapper

## Context Links

- Research: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` §2
- Función a reusar: `src/lib/actions/analytics.ts:139` (`getKpiGenerales`)
- Interfaces: `KpiGenerales` (líneas 24-52 de analytics.ts)
- Schema Zod creado en phase-01: `src/lib/schemas/overview-kpi.ts`

## Overview

**Priority:** P1 (bloquea phases 03-04).
**Brief:** Server action `getKpiOverview()` que devuelve el shape exacto que necesita `<OverviewSection>`. Thin wrapper sobre `getKpiGenerales()` — cero queries nuevas, solo mapping + cálculo de tasas.

## Key Insights

- `getKpiGenerales()` ya hace 5 queries paralelas con `Promise.all` y calcula `reachedSet` (leads alcanzados cualquier canal). Cero work duplicado.
- Las tasas (contacto, cualificación, agendamiento) son cálculos triviales (división con guard /0).
- `tiempo_ahorrado_formateado` ya existe en `KpiGenerales` interface — solo mapear.

## Requirements

**Funcionales:**

- `getKpiOverview(from, to, filters)` retorna `KpiOverviewOutput` validado por Zod.
- Manejo de errores: si `getKpiGenerales` lanza, propagar pero con log estructurado (logger del Sprint 1).
- Soporte filtros opcionales: país, origen, campaña, tipoLead, cualificacion (igual que `AnalyticsFilters` existente).

**No-funcionales:**

- Performance: <500ms p95 con dataset actual de Bea (~500 leads). Si supera, evaluar vista materializada en Sprint 3 (NO ahora).
- Cero side effects (idempotente, server-only).

## Architecture

```
getKpiOverview(from, to, filters)
  ├── getActiveTenantId() ─── RLS automático
  ├── getKpiGenerales(from, to, filters) ─── 5 queries paralelas (existente)
  │     └── lead + llamadas + cualificacion + agendamientos + whatsapp
  └── mapToOverviewOutput(kpi) ─── puro, sin queries
        └── return { total_leads, leads_contactados, ... canales: {...} }
```

## Related Code Files

**Modificar:**

- `src/lib/actions/analytics.ts` (~80 líneas añadidas: nueva función + interface)

**Crear:**

- `src/lib/schemas/kpi-overview-io.ts` (~50 líneas: Input + Output Zod)
- `tests/unit/actions/get-kpi-overview.test.ts` (~120 líneas, Vitest, 6 tests)

**Leer (sin modificar):**

- `src/lib/actions/analytics.ts:24-213` (KpiGenerales interface + getKpiGenerales impl)
- `src/lib/actions/tenant.ts` (getActiveTenantId)

## Implementation Steps

1. **Leer `analytics.ts:24-213`** y entender el shape exacto de `KpiGenerales`.

2. **Crear Zod schemas** `src/lib/schemas/kpi-overview-io.ts`:

   ```typescript
   import { z } from "zod";

   export const KpiOverviewInputSchema = z.object({
     from: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
     to: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
     filters: z
       .object({
         pais: z.string().optional(),
         origen: z.string().optional(),
         campana: z.string().optional(),
         tipoLead: z.string().optional(),
         cualificacion: z.string().optional(),
       })
       .optional()
       .default({}),
   });

   export const KpiOverviewOutputSchema = z.object({
     total_leads: z.number().int().nonnegative(),
     leads_alcanzados: z.number().int().nonnegative(),
     leads_contactados: z.number().int().nonnegative(),
     leads_cualificados: z.number().int().nonnegative(),
     leads_agendados: z.number().int().nonnegative(),
     tasa_contacto: z.number().min(0).max(100),
     tasa_cualificacion: z.number().min(0).max(100),
     tasa_agendamiento: z.number().min(0).max(100),
     tiempo_ahorrado_formateado: z.string(),
     horas_ahorradas: z.number().nonnegative(),
     canales: z.object({
       llamadas: z.number().int().nonnegative(),
       whatsapp: z.number().int().nonnegative(),
       web: z.number().int().nonnegative(),
     }),
   });

   export type KpiOverviewInput = z.infer<typeof KpiOverviewInputSchema>;
   export type KpiOverviewOutput = z.infer<typeof KpiOverviewOutputSchema>;
   ```

3. **Implementar `getKpiOverview()`** en `src/lib/actions/analytics.ts`:

   ```typescript
   export async function getKpiOverview(
     from: string,
     to: string,
     filters: AnalyticsFilters = {}
   ): Promise<KpiOverviewOutput> {
     const input = KpiOverviewInputSchema.parse({ from, to, filters });
     const kpi = await getKpiGenerales(input.from, input.to, input.filters);

     const safeDiv = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

     return KpiOverviewOutputSchema.parse({
       total_leads: kpi.total_leads ?? 0,
       leads_alcanzados: kpi.leads_alcanzados ?? 0,
       leads_contactados: kpi.total_contactados ?? 0,
       leads_cualificados: kpi.total_cualificados ?? 0,
       leads_agendados: kpi.total_agendados ?? 0,
       tasa_contacto: safeDiv(kpi.total_contactados ?? 0, kpi.total_leads ?? 0),
       tasa_cualificacion: safeDiv(kpi.total_cualificados ?? 0, kpi.total_leads ?? 0),
       tasa_agendamiento: safeDiv(kpi.total_agendados ?? 0, kpi.total_leads ?? 0),
       tiempo_ahorrado_formateado: kpi.tiempo_ahorrado_formateado ?? "0h 0m",
       horas_ahorradas: kpi.horas_ahorradas ?? 0,
       canales: {
         llamadas: kpi.total_llamadas ?? 0,
         whatsapp: kpi.total_whatsapp ?? 0,
         web: kpi.total_web ?? 0,
       },
     });
   }
   ```

4. **Tests Vitest** `tests/unit/actions/get-kpi-overview.test.ts` (6 mínimos):
   - Output schema valida correctamente con datos reales mock.
   - `tasa_contacto` correcta cuando hay contactados.
   - `tasa_contacto` = 0 cuando `total_leads` = 0 (guard /0).
   - Filtros opcionales: llamada sin filtros funciona.
   - Si `getKpiGenerales` lanza, `getKpiOverview` propaga el error.
   - Output validation falla si mocked `getKpiGenerales` devuelve estructura inválida.

5. **Verificar build + tests**:

   ```powershell
   npm run typecheck
   npx vitest run tests/unit/actions/get-kpi-overview.test.ts
   npm run build
   ```

## Todo List

- [ ] Crear `src/lib/schemas/kpi-overview-io.ts` con Zod schemas.
- [ ] Añadir `getKpiOverview()` en `src/lib/actions/analytics.ts`.
- [ ] Implementar mapping con safeDiv guard.
- [ ] Crear `tests/unit/actions/get-kpi-overview.test.ts` (6 tests).
- [ ] `npm run typecheck` → 0 errores.
- [ ] `npx vitest run` → 100% verdes.
- [ ] `npm run build` → ✓ Compiled.
- [ ] Commit: `feat(sprint-2b): add getKpiOverview() server action with Zod IO validation`.

## Success Criteria

- `getKpiOverview()` exportada desde `analytics.ts`.
- Output validado por Zod en cada llamada (fail-fast si shape inesperado).
- 6 tests Vitest verdes.
- Cero queries SQL nuevas (reuso 100% de `getKpiGenerales`).
- Performance acceptable (<500ms p95 con dataset Bea).

## Risk Assessment

| Riesgo                                                  | Prob  | Impacto | Mitigación                                                                       |
| ------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------- |
| `getKpiGenerales` no expone campo `total_web` o similar | Media | Bajo    | Defaultear a 0; añadir TODO post-MVP para enriquecer cuando web widget trackee   |
| Performance >500ms p95 con datasets grandes (>5k leads) | Baja  | Medio   | YAGNI: medir en E2C, no preoptimizar. Si supera, vista materializada en Sprint 3 |
| Schema Zod demasiado estricto bloquea casos edge        | Baja  | Medio   | `.optional()` y defaults; tests cubren null/undefined                            |

## Next Steps

→ Phase 03: consumir `getKpiOverview()` desde `<OverviewSection>` con Suspense + skeletons.
