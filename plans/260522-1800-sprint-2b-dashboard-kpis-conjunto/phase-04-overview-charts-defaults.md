---
title: "Sprint 2B — Phase 04 — Overview Charts (4 default)"
status: pending
priority: P1
effort: 3h
sprint_id: SP-3B
task_ids: [SP-3B-04]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 04 — Overview Charts: 4 gráficos por defecto

## Context Links

- Research: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` §4
- ChartManager existente: `src/components/dashboard/ChartManager.tsx`
- Server action existente: `getDynamicChartSeries()` en `src/lib/actions/analytics.ts`
- Charts disponibles: area, bar, donut, funnel, vertical-bar, heatmap (en `ChartConfig.type`)

## Overview

**Priority:** P1 (parte visible del MVP overview).
**Brief:** Añadir 4 gráficos por defecto al `<OverviewSection>`: area (leads/día), funnel (cross-canal), donut (distribución canal), bar (leads por origen).

## Key Insights

- Gráficos 1 (area) y 4 (bar) usan `getDynamicChartSeries()` sin cambios — solo nueva configuración.
- Gráficos 2 (funnel) y 3 (donut) necesitan lógica computed que ya devuelve `getKpiGenerales()` (embudo y `por_origen`).
- `DEFAULT_CHARTS` ya existe en `kpi-defaults.ts` — el patrón es solo añadir `DEFAULT_OVERVIEW_CHARTS`.

## Requirements

**Funcionales:**

- 4 gráficos default en overview: area + funnel + donut + bar.
- Grid responsive: 1 col mobile, 2x2 desktop.
- Cada gráfico tiene título descriptivo accesible.
- Reusa filtros del `<FilterBar>` global.

**No-funcionales:**

- WCAG: cada chart wrapper con `role="img"` + `aria-label` descriptivo.
- Performance: paralelos via `Promise.all`, no waterfalls.

## Architecture

```
OverviewSection
  ├── SummaryManager (KPIs hero)  ←── phase-03
  └── ChartManager (4 charts)     ←── phase-04 NUEVO
        ├── Chart 1: Leads/día (area)
        ├── Chart 2: Embudo cross-canal (funnel)
        ├── Chart 3: Distribución canal (donut)
        └── Chart 4: Leads por origen (bar)
```

## Related Code Files

**Modificar:**

- `src/lib/constants/kpi-defaults.ts` (~50 líneas añadidas: `DEFAULT_OVERVIEW_CHARTS`)
- `src/components/dashboard/OverviewSection.tsx` (~20 líneas: integrar ChartManager)

**Leer (sin modificar):**

- `src/components/dashboard/ChartManager.tsx` (entender props)
- `src/lib/actions/analytics.ts:getDynamicChartSeries` (firma + retornos)
- `src/lib/constants/schema.ts` (SCHEMA_COLUMNS, tablas disponibles)

## Implementation Steps

1. **Añadir `DEFAULT_OVERVIEW_CHARTS`** en `kpi-defaults.ts`:

   ```typescript
   import type { ChartConfig } from "@/types/tenant";

   export const DEFAULT_OVERVIEW_CHARTS: ChartConfig[] = [
     {
       id: "ov-chart-1",
       title: "Leads por día (todos los canales)",
       type: "area",
       table: "lead",
       xKey: "fecha_ingreso_crm",
       yKey: "count",
       color: "blue",
       visible: true,
     },
     {
       id: "ov-chart-2",
       title: "Embudo de conversión cross-canal",
       type: "funnel",
       staticKey: "funnel_cross_channel",
       color: "purple",
       visible: true,
     },
     {
       id: "ov-chart-3",
       title: "Distribución por canal de interacción",
       type: "donut",
       staticKey: "distribution_by_channel",
       color: "emerald",
       centerLabel: "Canales",
       visible: true,
     },
     {
       id: "ov-chart-4",
       title: "Leads por origen",
       type: "bar",
       table: "lead",
       xKey: "origen",
       yKey: "count",
       color: "amber",
       visible: true,
     },
   ];
   ```

2. **Modificar `OverviewSection.tsx`** para incluir ChartManager:

   ```tsx
   import { ChartManager } from "@/components/dashboard/ChartManager";
   import { DEFAULT_OVERVIEW_CHARTS } from "@/lib/constants/kpi-defaults";
   import { getDynamicChartSeries } from "@/lib/actions/analytics";

   // dentro de OverviewSection:
   const tenantOverviewCharts =
     (tenantConfig.config as Record<string, unknown>)?.overview_charts as ChartConfig[] | undefined;
   const charts = tenantOverviewCharts?.length ? tenantOverviewCharts : DEFAULT_OVERVIEW_CHARTS;

   // Pre-fetch series in parallel
   const seriesPromises = charts
     .filter((c) => !c.staticKey) // solo dynamic charts
     .map((c) => getDynamicChartSeries(c, from, to, filters));
   const dynamicSeries = await Promise.all(seriesPromises);

   // Pasar al ChartManager
   return (
     <section ...>
       <SummaryManager .../>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
         <ChartManager charts={charts} dynamicSeries={dynamicSeries} staticData={{
           funnel_cross_channel: kpiData /* shape esperado */,
           distribution_by_channel: kpiData.canales,
         }} />
       </div>
     </section>
   );
   ```

3. **Verificar render en local**:

   ```powershell
   npm run dev
   # http://localhost:8500/dashboard
   # validar: 4 gráficos visibles bajo el bloque KPIs hero, sin errores consola
   ```

4. **Screenshot**:

   ```
   docs/screenshots/sprint-2b/overview-charts-4-defaults.png
   ```

5. **Build + typecheck**:

   ```powershell
   npm run typecheck
   npm run build
   ```

## Todo List

- [ ] Añadir `DEFAULT_OVERVIEW_CHARTS` (4 charts) en `kpi-defaults.ts`.
- [ ] Modificar `OverviewSection.tsx` para integrar ChartManager.
- [ ] Pre-fetch dynamic series con Promise.all.
- [ ] Validar render local en `localhost:8500/dashboard`.
- [ ] Capturar screenshot.
- [ ] `npm run typecheck` + `build` verdes.
- [ ] Commit: `feat(sprint-2b): add 4 default charts to <OverviewSection>`.

## Success Criteria

- 4 gráficos visibles en `<OverviewSection>` con grid responsive.
- Datos correctos según filtros del FilterBar.
- 0 console errors.
- Performance acceptable (<1s carga inicial overview completo en local).

## Risk Assessment

| Riesgo                                                                      | Prob  | Impacto | Mitigación                                                                                            |
| --------------------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------- |
| `ChartConfig.type === "funnel"` no existe en ChartManager actual            | Media | Medio   | Validar tipos disponibles en ChartManager.tsx; si falta funnel, reusar FunnelSection o degradar a bar |
| `getKpiGenerales` no devuelve `por_origen` con shape esperado por bar chart | Media | Bajo    | Mapping en OverviewSection antes de pasar a ChartManager                                              |
| Web widget canal vacío → donut muestra solo 2 valores                       | Alta  | Bajo    | Aceptable; tooltip "Web tracking en desarrollo"                                                       |

## Next Steps

→ Phase 05: KPI Builder para que admin pueda configurar overview KPIs/charts por tenant.
