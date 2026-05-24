---
title: "Sprint 2B — Phase 05 — KPI Builder Overview"
status: pending
priority: P1
effort: 3h
sprint_id: SP-3B
task_ids: [SP-3B-05]
created: 24-05-2026
last_updated: 24-05-2026 21:30 (decisión cerrada: opción C reusar SummaryManager + pestaña KPIs dedicada en /dashboard)
---

# Phase 05 — KPI Builder Overview (configurable por tenant)

## Context Links

- Research: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` §3
- Builder existente ligero: `src/app/dashboard/settings/KpiBuilder.tsx`
- Manager existente con DnD: `src/components/dashboard/SummaryManager.tsx`
- Pregunta R1 #3 RESUELTA: opción **C — reusar SummaryManager + pestaña dedicada** (decisión Javi HP 24-05-2026 21:30).

## Decisión cerrada 24-05-2026 21:30

- **Enfoque KPI Builder = opción C**: aprovecha la lógica DnD existente de `SummaryManager.tsx` (verificada). Añade pestaña "KPIs" en `/dashboard` con UI ad-hoc para configurar `overview_kpis` y `overview_charts`. Bea ve sección diferenciada con DnD ya funcionando. Estim ~6-8h (mismo rango que opción B sin perder reuso).
- Descartadas: A (sin pestaña, menos visible para Bea) y B (KpiBuilder simple aislado, más código nuevo + tests).

## Overview

**Priority:** P1 (cumple requerimiento Bea "se deben poder definir los KPIs que se quieren visualizar").
**Brief:** Permitir al admin de cada tenant editar `overview_kpis` y `overview_charts` desde una pestaña "KPIs" dedicada en `/dashboard` (no en `/settings`). Reusa SummaryManager con DnD para reordenar, añadir/quitar KPIs y charts. Patrón persistencia: `tenants.config.overview_kpis` JSONB (mismo que `kpis`, `funnel`, `charts`).

## Decisión arquitectónica (resolver al arrancar phase)

**Pregunta abierta R1 #3:**

| Opción                                                                                   | Pros                                             | Contras                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A — Reusar `SummaryManager` con `configKey="overview_kpis"` directamente                 | Cero nuevo código, DnD funciona, consistencia UI | Admin tiene 4 secciones casi idénticas (kpis, funnel, charts, overview) — UX abarrotada |
| B — Crear pestaña "Overview" en settings con `KpiBuilder` simple + `ChartBuilder` simple | UX dedicada, más limpio                          | Duplica código, no soporta DnD                                                          |
| C — Reusar `SummaryManager` pero agrupar en pestaña "Overview" colapsable en settings    | Mejor UX + reuso                                 | 1h extra por agrupar                                                                    |

**Recomendación al arrancar:** Opción C (reuso + pestaña dedicada). Pero validar con Bea en daily review antes de ejecutar.

## Requirements

**Funcionales:**

- Admin puede añadir/quitar KPIs del overview desde `/dashboard/settings`.
- Admin puede reordenar (drag & drop si Opción A/C).
- Admin puede toggle visibility por KPI sin borrarlo.
- Cambios persistidos en `tenants.config.overview_kpis` (JSONB).
- Mismo flujo para `overview_charts`.

**No-funcionales:**

- No requiere nueva action de persistencia (reusa `updateTenant` existente).
- Validación Zod en el server antes de persistir (schema phase-01).

## Architecture

```
/dashboard/settings (pestaña "KPIs Overview")
  ├── <SummaryManager configKey="overview_kpis" defaults={DEFAULT_OVERVIEW_KPIS} editable />
  └── <ChartManagerEditor configKey="overview_charts" defaults={DEFAULT_OVERVIEW_CHARTS} />

Persistencia → tenants.config = {
  kpis: [...],
  funnel: [...],
  charts: [...],
  overview_kpis: [...],    ←── NUEVO
  overview_charts: [...]   ←── NUEVO
}
```

## Related Code Files

**Modificar:**

- `src/app/dashboard/settings/page.tsx` (~30 líneas: añadir pestaña/sección Overview)
- `src/components/dashboard/SummaryManager.tsx` (verificar que acepta `configKey` parametrizable — debería)

**Leer (sin modificar):**

- `src/app/dashboard/settings/KpiBuilder.tsx` (entender flujo existente)
- `src/lib/actions/tenant.ts` (`updateTenant`)

## Implementation Steps

1. **Validar decisión arquitectónica** con Bea (5 min consulta o ejecutar Opción C por defecto si no hay respuesta).

2. **Verificar que `SummaryManager` acepta `configKey` parametrizable**:

   ```powershell
   grep -n "configKey" src/components/dashboard/SummaryManager.tsx
   ```

   Si no lo soporta, añadir prop `configKey: string` y propagar a la action de persistencia.

3. **Modificar `/dashboard/settings/page.tsx`** para añadir sección "KPIs Overview":

   ```tsx
   import { DEFAULT_OVERVIEW_KPIS, DEFAULT_OVERVIEW_CHARTS } from "@/lib/constants/kpi-defaults";
   import { SummaryManager } from "@/components/dashboard/SummaryManager";

   // dentro del componente settings, junto a otras secciones KPI:
   <section aria-labelledby="overview-kpis-settings-heading" className="mb-8">
     <h3 id="overview-kpis-settings-heading">KPIs del Overview (panel general)</h3>
     <SummaryManager
       configKey="overview_kpis"
       defaults={DEFAULT_OVERVIEW_KPIS}
       editable={true}
     />
   </section>

   <section aria-labelledby="overview-charts-settings-heading" className="mb-8">
     <h3 id="overview-charts-settings-heading">Gráficos del Overview</h3>
     {/* ChartManager o equivalente con configKey="overview_charts" */}
   </section>
   ```

4. **Validación Zod en `updateTenant`**: si la action ya valida el config JSONB con un schema permisivo, añadir validación específica de `overview_kpis` y `overview_charts` usando los schemas de phase-01/04.

5. **E2E manual**:
   - Loguearse como admin.
   - Ir a `/dashboard/settings`.
   - Añadir un KPI al overview.
   - Reordenar (si DnD activo).
   - Toggle visibility.
   - Volver a `/dashboard` y verificar que el overview refleja los cambios.

6. **Screenshot del flujo**:

   ```
   docs/screenshots/sprint-2b/kpi-builder-overview-settings.png
   docs/screenshots/sprint-2b/overview-section-after-edit.png
   ```

## Todo List

- [ ] Validar decisión Opción A/B/C con Bea o asumir C.
- [ ] Verificar `SummaryManager` acepta `configKey` parametrizable (añadir si falta).
- [ ] Modificar `/dashboard/settings/page.tsx` con sección Overview.
- [ ] Validación Zod en `updateTenant` para overview_kpis + overview_charts.
- [ ] E2E manual completo (añadir + reordenar + toggle + verificar render).
- [ ] Capturar 2 screenshots.
- [ ] `npm run typecheck` + `build` verdes.
- [ ] Commit: `feat(sprint-2b): add Overview KPIs/Charts config in /dashboard/settings`.

## Success Criteria

- Admin puede personalizar overview_kpis + overview_charts desde settings.
- Cambios persisten en `tenants.config` y se reflejan al refrescar `/dashboard`.
- DnD funcional (si Opción A/C).
- 0 console errors.
- Validación Zod rechaza configs inválidas.

## Risk Assessment

| Riesgo                                                 | Prob  | Impacto | Mitigación                                         |
| ------------------------------------------------------ | ----- | ------- | -------------------------------------------------- |
| `SummaryManager` no soporta `configKey` parametrizable | Media | Medio   | Refactor mínimo (15-30 min) para aceptar prop      |
| `updateTenant` no valida el shape del config JSONB     | Alta  | Bajo    | Añadir validación Zod en server action (10-20 min) |
| UX confusa con 4+ secciones de KPIs en settings        | Media | Medio   | Opción C agrupa en pestaña dedicada                |

## Next Steps

→ Phase 06: pitfalls WCAG preventivos (aria-labels, role="img", headings semánticos).
