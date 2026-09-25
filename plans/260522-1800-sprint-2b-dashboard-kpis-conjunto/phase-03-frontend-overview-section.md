---
title: "Sprint 2B — Phase 03 — Frontend OverviewSection"
status: pending
priority: P1
effort: 4h
sprint_id: SP-3B
task_ids: [SP-3B-03]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 03 — Frontend: <OverviewSection> en /dashboard

## Context Links

- Research: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` §1
- Página a modificar: `src/app/dashboard/page.tsx`
- Componente a reusar: `src/components/dashboard/SummaryManager.tsx` (con configKey="overview_kpis")
- Server action de Phase 02: `getKpiOverview()`

## Overview

**Priority:** P1 (visible en MVP, requerimiento Bea directo).
**Brief:** Añadir `<OverviewSection>` ENCIMA del `<SummarySection>` actual en `/dashboard/page.tsx`. Sin nueva ruta, sin nuevo layout.

## Key Insights

- `<OverviewSection>` es 90% paralelo a `<SummarySection>`: mismo patrón Suspense, mismas props base (from, to, filters, isAdmin), distinto configKey y distinta server action.
- Reusar `<SummaryManager>` con `configKey="overview_kpis"` permite que el KPI Builder (phase-05) funcione automáticamente sin tocar UI nueva.
- Skeleton de carga: reusar `<KpiSkeleton>` ya existente.

## Requirements

**Funcionales:**

- `<OverviewSection>` renderiza 4 KPI cards hero (DEFAULT_OVERVIEW_KPIS de phase-01).
- Si tenant tiene `overview_kpis` en config, usar esos en vez del default.
- Filtros del `<FilterBar>` actual se aplican al overview (rango fechas, campaña, origen, etc.).
- Suspense boundary independiente: el overview carga en paralelo al summary, no bloquea uno al otro.

**No-funcionales:**

- Mobile-first responsive (grid de 1 col mobile, 2 cols tablet, 4 cols desktop).
- Soporta dark mode (clases tailwind ya existentes en SummaryCard).

## Architecture

```
DashboardPage
  ├── <FilterBar />                     (existente)
  ├── <Suspense fallback={<KpiSkeleton/>}>
  │     └── <OverviewSection ... />     (NUEVO)
  ├── <Suspense fallback={<KpiSkeleton/>}>
  │     └── <SummarySection ... />      (existente)
  ├── <Suspense fallback={<ChartSkeleton/>}>
  │     └── <FunnelSection ... />       (existente)
  └── <Suspense fallback={<ChartSkeleton/>}>
        └── <ChartsSection ... />       (existente)
```

## Related Code Files

**Modificar:**

- `src/app/dashboard/page.tsx` (~30 líneas añadidas: import + Suspense + Section)

**Crear:**

- `src/components/dashboard/OverviewSection.tsx` (~120 líneas)

**Leer (sin modificar):**

- `src/components/dashboard/SummaryManager.tsx` (entender props y patrón)
- `src/components/charts/DashboardCharts.tsx` (KpiSkeleton)
- `src/lib/actions/tenant.ts` (`getActiveTenantConfig`)

## Implementation Steps

1. **Crear `src/components/dashboard/OverviewSection.tsx`**:

   ```tsx
   import { getKpiOverview } from "@/lib/actions/analytics";
   import { getActiveTenantConfig } from "@/lib/actions/tenant";
   import { getAdminStatus } from "@/lib/actions/auth";
   import { SummaryManager } from "@/components/dashboard/SummaryManager";
   import { DEFAULT_OVERVIEW_KPIS } from "@/lib/constants/kpi-defaults";
   import type { KpiConfig } from "@/types/tenant";
   import type { AnalyticsFilters } from "@/lib/actions/analytics";

   interface OverviewSectionProps {
     from: string;
     to: string;
     filters: AnalyticsFilters;
   }

   export async function OverviewSection({ from, to, filters }: OverviewSectionProps) {
     const [tenantConfig, isAdmin, kpiData] = await Promise.all([
       getActiveTenantConfig(),
       getAdminStatus(),
       getKpiOverview(from, to, filters),
     ]);

     if (!tenantConfig) return null;

     const tenantOverviewKpis = (tenantConfig.config as Record<string, unknown>)?.overview_kpis as
       | KpiConfig[]
       | undefined;
     const kpis = tenantOverviewKpis?.length ? tenantOverviewKpis : DEFAULT_OVERVIEW_KPIS;

     // Map kpiData to dynamic values map for SummaryManager
     const staticValues: Record<string, string | number> = {
       total_leads: kpiData.total_leads,
       total_contactados: kpiData.leads_contactados,
       total_cualificados: kpiData.leads_cualificados,
       tiempo_ahorrado_formateado: kpiData.tiempo_ahorrado_formateado,
     };

     return (
       <section aria-labelledby="overview-heading" className="mb-8">
         <h2 id="overview-heading" className="sr-only">
           Resumen general del dashboard
         </h2>
         <SummaryManager
           kpis={kpis}
           staticValues={staticValues}
           configKey="overview_kpis"
           isAdmin={isAdmin}
         />
       </section>
     );
   }
   ```

2. **Modificar `src/app/dashboard/page.tsx`**:

   ```tsx
   import { OverviewSection } from "@/components/dashboard/OverviewSection";
   // ... resto de imports

   export default async function DashboardPage(...) {
     // ... parseFilters, etc.

     return (
       <div className="...">
         <FilterBar ... />
         {/* NUEVO: Overview section */}
         <Suspense fallback={<KpiSkeleton count={4} />}>
           <OverviewSection from={from} to={to} filters={filters} />
         </Suspense>

         {/* Existente */}
         <Suspense fallback={<KpiSkeleton />}>
           <SummarySection from={from} to={to} isAdmin={isAdmin} filters={filters} />
         </Suspense>
         {/* ... resto sin cambios */}
       </div>
     );
   }
   ```

3. **Smoke local**:

   ```powershell
   npm run dev
   # abrir http://localhost:8500/dashboard
   # validar: <OverviewSection> visible arriba, 4 KPIs hero, sin errores consola
   ```

4. **Tomar screenshot** para hand-off SP-4B:

   ```
   docs/screenshots/sprint-2b/overview-section-default.png
   ```

5. **Build y typecheck**:

   ```powershell
   npm run typecheck
   npm run build
   ```

## Todo List

- [ ] Crear `src/components/dashboard/OverviewSection.tsx`.
- [ ] Modificar `src/app/dashboard/page.tsx` para integrar Suspense + OverviewSection.
- [ ] `npm run dev` y verificar render en `localhost:8500/dashboard`.
- [ ] Capturar screenshot `docs/screenshots/sprint-2b/overview-section-default.png`.
- [ ] `npm run typecheck` → 0 errores.
- [ ] `npm run build` → ✓ Compiled.
- [ ] Commit: `feat(sprint-2b): add <OverviewSection> with 4 default KPIs to /dashboard`.

## Success Criteria

- `<OverviewSection>` visible en `/dashboard` con 4 KPIs hero por defecto.
- Si tenant tiene `overview_kpis` en config, override funciona.
- Filtros (rango fechas, campaña, origen) afectan los valores del overview.
- Skeleton de carga visible durante Suspense.
- 0 console errors en navegador.
- Screenshot guardado en `docs/screenshots/sprint-2b/`.

## Risk Assessment

| Riesgo                                                            | Prob  | Impacto | Mitigación                                                                      |
| ----------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------- |
| `SummaryManager` props no encajan exactamente con OverviewSection | Media | Bajo    | Adaptar OverviewSection a los props que SummaryManager espera (revisar primero) |
| Renderizado en server pierde estilos hidratación inicial          | Baja  | Bajo    | SummaryManager ya es server-component-friendly, debería funcionar               |
| Suspense en paralelo desordena el render visual                   | Baja  | Bajo    | Cada Section tiene su propio Suspense, React batchea correctamente              |

## Next Steps

→ Phase 04: añadir 4 gráficos default del overview.
