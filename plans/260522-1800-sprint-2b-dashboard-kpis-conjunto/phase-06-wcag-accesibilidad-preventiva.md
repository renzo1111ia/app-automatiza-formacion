---
title: "Sprint 2B — Phase 06 — WCAG preventivo (3 pitfalls)"
status: pending
priority: P1
effort: 2h
sprint_id: SP-3B
task_ids: [SP-3B-06]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 06 — WCAG 2.2 AA preventivo (3 pitfalls críticos)

## Context Links

- Research: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` §5
- Audit deep WCAG: `docs/audit/deep/DA-5-accessibility.md` (referencia general)
- Sprint 3 phase-04 WCAG completo (hardening) — esta phase es solo lo preventivo
- Lucide icons ya disponibles: `TrendingUp`, `TrendingDown`

## Overview

**Priority:** P1 (evita findings post-hoc en Sprint 3 hardening).
**Brief:** Fijar 3 pitfalls WCAG ANTES de mergear Sprint 2B. No es WCAG completo (eso es Sprint 3 phase-04) — solo lo que afecta directamente al overview nuevo.

## Los 3 pitfalls (research R1)

| #   | Pitfall                                         | Criterion                      | Ubicación                                     |
| --- | ----------------------------------------------- | ------------------------------ | --------------------------------------------- |
| 1   | Color como único indicador de trend (+12%, -3%) | 1.4.1 (Use of Color)           | Trend badges en KPI cards del overview        |
| 2   | Charts sin alternativa textual                  | 1.1.1 + 4.1.2                  | 4 charts del overview (area/funnel/donut/bar) |
| 3   | KPI cards sin jerarquía heading semántica       | 1.3.1 (Info and Relationships) | SummaryManager línea 63 (SectionHeader)       |

## Requirements

**Funcionales:**

- Trend badges con `aria-label` descriptivo + icono direccional (no solo color).
- Cada chart wrapper expone `role="img"` + `aria-label` con resumen textual.
- Headings semánticos reales (`<h2>`/`<h3>`) en lugar de `<div>` decorativos.

**No-funcionales:**

- Cero impacto en estilos visuales (todo es semántico/aria).
- Compatible con axe-core (passes en specs del Sprint 3).

## Architecture

3 cambios atómicos, no relacionados entre sí. Pueden hacerse en cualquier orden.

## Related Code Files

**Modificar:**

- `src/components/dashboard/SummaryManager.tsx` (SectionHeader línea 63: `<div>` → `<h2>`)
- `src/components/dashboard/SummaryCard.tsx` (añadir trend badge con aria-label, si existe component)
- `src/components/dashboard/ChartManager.tsx` (wrap charts con `role="img"`)
- Cualquier wrapper de chart específico: `AreaChart.tsx`, `DonutChart.tsx`, etc. en `src/components/charts/`

**Crear:**

- `src/lib/utils/chart-summary.ts` (~30 líneas: `summarizeChartData(data)` que genera texto para aria-label)

**Leer (sin modificar):**

- `src/components/charts/DashboardCharts.tsx` (entender componentes existentes)

## Implementation Steps

### Pitfall 1 — Trend badges

1. **Buscar trend badges existentes**:

   ```powershell
   grep -rn "TrendingUp\|TrendingDown\|trend" src/components/dashboard/
   ```

2. **Si existen, añadir aria-label + icono**:

   ```tsx
   {
     trend > 0 ? (
       <span
         className="inline-flex items-center gap-1 text-emerald-600"
         aria-label={`Incremento del ${trend}%`}
       >
         <TrendingUp className="h-3 w-3" aria-hidden="true" />+{trend}%
       </span>
     ) : (
       <span
         className="inline-flex items-center gap-1 text-rose-600"
         aria-label={`Descenso del ${Math.abs(trend)}%`}
       >
         <TrendingDown className="h-3 w-3" aria-hidden="true" />
         {trend}%
       </span>
     );
   }
   ```

3. **Si NO existen aún** (el overview no tiene trend yet), añadir comentario en el componente: `// TODO Sprint 3 hardening: trend badges deben incluir aria-label + icono (no solo color) — ver phase-06 Sprint 2B`.

### Pitfall 2 — Charts con role="img"

4. **Crear `src/lib/utils/chart-summary.ts`**:

   ```typescript
   export function summarizeChartData(
     data: Array<Record<string, unknown>>,
     valueKey: string = "value",
     labelKey: string = "label"
   ): string {
     if (!data || data.length === 0) return "Gráfico sin datos disponibles";
     const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
     const max = data.reduce(
       (m, d) => (Number(d[valueKey]) > Number(m[valueKey]) ? d : m),
       data[0]
     );
     return `${data.length} puntos de datos. Total: ${total}. Máximo: ${max[labelKey]} con ${max[valueKey]}`;
   }
   ```

5. **Modificar `ChartManager.tsx`** para envolver cada chart con role="img":

   ```tsx
   import { summarizeChartData } from "@/lib/utils/chart-summary";

   {charts.map((chart) => (
     <div
       key={chart.id}
       role="img"
       aria-label={`Gráfico: ${chart.title}. ${summarizeChartData(getDataForChart(chart))}`}
     >
       <ChartComponent ... />
     </div>
   ))}
   ```

### Pitfall 3 — Headings semánticos

6. **Buscar SectionHeader actual**:

   ```powershell
   grep -n "SectionHeader\|className.*section-header" src/components/dashboard/SummaryManager.tsx
   ```

7. **Cambiar `<div>` decorativo a `<h2>` o `<h3>` real**:

   ```diff
   - <div className="text-xs uppercase font-semibold text-slate-500">
   -   {sectionTitle}
   - </div>
   + <h3 className="text-xs uppercase font-semibold text-slate-500">
   +   {sectionTitle}
   + </h3>
   ```

   O añadir `role="heading" aria-level="2"` si el cambio de tag rompe estilos.

8. **Verificar overview-section-heading** (creado en phase-03):

   ```tsx
   // OverviewSection.tsx ya tiene:
   <h2 id="overview-heading" className="sr-only">
     Resumen general del dashboard
   </h2>
   ```

   Confirmar que está bien y screen readers lo detectan.

### Validación

9. **Lighthouse a11y check en local**:

   ```powershell
   npm run dev
   # abrir Chrome DevTools → Lighthouse → Accessibility → Run
   # esperado: score ≥ 90 en /dashboard
   ```

10. **axe DevTools check** (extensión Chrome) → 0 critical issues.

## Todo List

- [ ] Pitfall 1: buscar y arreglar trend badges (o TODO si no existen aún).
- [ ] Pitfall 2a: crear `chart-summary.ts`.
- [ ] Pitfall 2b: envolver charts con `role="img"` + `aria-label`.
- [ ] Pitfall 3: cambiar headings semánticos en SummaryManager.
- [ ] Lighthouse a11y en `/dashboard` ≥ 90.
- [ ] axe DevTools 0 critical issues.
- [ ] `npm run typecheck` + `build` verdes.
- [ ] Commit: `fix(sprint-2b): WCAG preventivo — trend aria-labels + role=img charts + semantic headings`.

## Success Criteria

- Lighthouse a11y ≥ 90 en `/dashboard`.
- axe DevTools 0 critical issues.
- Screen reader (NVDA / VoiceOver) puede navegar overview por secciones.
- Color no es único indicador en trend badges.

## Risk Assessment

| Riesgo                                                     | Prob  | Impacto | Mitigación                                                                 |
| ---------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------- |
| Cambio de `<div>` a `<h2>` rompe estilos                   | Media | Bajo    | Mantener className idéntico; usar role+aria-level si rompe                 |
| Charts library no acepta wrapper externo bien              | Baja  | Bajo    | Probar antes; si rompe, aria-label en el propio componente                 |
| Lighthouse < 90 por findings preexistentes no relacionados | Media | Bajo    | Documentar findings preexistentes; el sprint solo asegura no añadir nuevos |

## Next Steps

→ Phase 07: cierre Sprint 2B (CLOSE-1..5 + hand-off SP-4B phase-03b).
