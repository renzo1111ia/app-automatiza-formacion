---
title: "Sprint 2B — Phase 01 — Decisión arquitectura + DEFAULT_OVERVIEW_KPIS"
status: pending
priority: P1
effort: 1h 30min
sprint_id: SP-3B
task_ids: [SP-3B-01]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 01 — Decisión arquitectura + DEFAULT_OVERVIEW_KPIS

## Context Links

- Research base: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md`
- Plan padre: [plan.md](plan.md)
- Patrón existente a copiar: `src/lib/constants/kpi-defaults.ts` (DEFAULT_SUMMARY_KPIS)
- Interfaces: `src/types/tenant.ts` (KpiConfig)

## Overview

**Priority:** P1 (bloquea phases 02-06).
**Brief:** Confirmar decisión arquitectónica + crear `DEFAULT_OVERVIEW_KPIS` + definir schema Zod `OverviewKpiConfig`.

## Key Insights

- `getKpiGenerales()` (analytics.ts:139) ya cruza llamadas + whatsapp + lead + cualificacion + agendamientos → reuso directo (zero queries nuevas).
- `configKey` pattern probado en prod con `kpis`, `funnel`, `charts` — añadir `overview_kpis` es zero-migration.
- 4 KPIs hero por defecto suficientes para satisfacer requerimiento Bea (total leads, contactados, cualificados, tiempo ahorrado).

## Requirements

**Funcionales:**

- `DEFAULT_OVERVIEW_KPIS` exportado desde `src/lib/constants/kpi-defaults.ts`.
- Schema Zod `OverviewKpiConfigSchema` que valida items del array `tenants.config.overview_kpis`.
- Compatible con `SummaryManager.tsx` existente (reuso garantizado).

**No-funcionales:**

- Cero migraciones SQL en esta phase (todo va en `tenants.config` JSONB).
- Zero breaking changes: si un tenant NO tiene `overview_kpis` en su config, debe caer al default sin error.

## Architecture

Cambios en 3 archivos:

1. `src/lib/constants/kpi-defaults.ts` — añadir `DEFAULT_OVERVIEW_KPIS` (array de 4 items).
2. `src/types/tenant.ts` — añadir interface `OverviewKpiConfig` extends `KpiConfig` (si necesario).
3. `src/lib/schemas/overview-kpi.ts` (nuevo) — Zod schema para validación runtime.

## Related Code Files

**Modificar:**

- `src/lib/constants/kpi-defaults.ts` (~30 líneas añadidas)
- `src/types/tenant.ts` (~10 líneas si requiere extend interface)

**Crear:**

- `src/lib/schemas/overview-kpi.ts` (~25 líneas)
- `tests/unit/schemas/overview-kpi.test.ts` (~40 líneas, Vitest)

**Leer (sin modificar):**

- `src/components/dashboard/SummaryManager.tsx` (entender props que va a recibir el OverviewSection)
- `src/lib/constants/kpi-defaults.ts` actual (copiar estructura DEFAULT_SUMMARY_KPIS)

## Implementation Steps

1. **Leer `kpi-defaults.ts` actual** y copiar estructura de `DEFAULT_SUMMARY_KPIS` para entender el formato.

2. **Crear `DEFAULT_OVERVIEW_KPIS`** en `kpi-defaults.ts`:

   ```typescript
   export const DEFAULT_OVERVIEW_KPIS: KpiConfig[] = [
     {
       id: "ov-total-leads",
       label: "Total Leads",
       staticKey: "total_leads",
       icon: "Users",
       color: "blue",
       visible: true,
     },
     {
       id: "ov-contactados",
       label: "Leads Contactados",
       staticKey: "total_contactados",
       icon: "Phone",
       color: "emerald",
       visible: true,
     },
     {
       id: "ov-cualificados",
       label: "Leads Cualificados",
       staticKey: "total_cualificados",
       icon: "CheckCircle",
       color: "purple",
       visible: true,
     },
     {
       id: "ov-tiempo-ahorrado",
       label: "Tiempo Ahorrado",
       staticKey: "tiempo_ahorrado_formateado",
       icon: "Clock",
       color: "amber",
       visible: true,
     },
   ];
   ```

3. **Crear Zod schema** `src/lib/schemas/overview-kpi.ts`:

   ```typescript
   import { z } from "zod";

   export const OverviewKpiConfigSchema = z.object({
     id: z.string().min(1),
     label: z.string().min(1).max(60),
     staticKey: z.string().optional(),
     dynamicQuery: z.string().optional(),
     icon: z.string(),
     color: z.enum(["blue", "emerald", "purple", "amber", "rose", "slate"]),
     visible: z.boolean().default(true),
   });

   export const OverviewKpisArraySchema = z.array(OverviewKpiConfigSchema).max(8);
   ```

4. **Tests unitarios** `tests/unit/schemas/overview-kpi.test.ts`:
   - Valida un item correcto pasa.
   - Valida que `label` >60 chars falla.
   - Valida que array >8 items falla.
   - Valida que color no permitido falla.
   - Valida que `staticKey` y `dynamicQuery` ambos vacíos NO falla (será error en runtime al renderizar).

5. **Verificar typecheck + tests**:

   ```powershell
   npm run typecheck
   npx vitest run tests/unit/schemas/overview-kpi.test.ts
   ```

## Todo List

- [ ] Leer y entender `src/lib/constants/kpi-defaults.ts` actual.
- [ ] Añadir `DEFAULT_OVERVIEW_KPIS` (4 items).
- [ ] Crear `src/lib/schemas/overview-kpi.ts` con Zod.
- [ ] Crear `tests/unit/schemas/overview-kpi.test.ts` (4 tests mínimos).
- [ ] `npm run typecheck` → 0 errores.
- [ ] `npx vitest run tests/unit/schemas/overview-kpi.test.ts` → 4/4 verdes.
- [ ] Commit: `feat(sprint-2b): add DEFAULT_OVERVIEW_KPIS + Zod schema for /dashboard overview section`.

## Success Criteria

- `DEFAULT_OVERVIEW_KPIS` exportado y tipado.
- Zod schema valida correctamente input/error cases.
- 4 tests Vitest verdes.
- Zero impacto en el dashboard actual (los cambios son aditivos).

## Risk Assessment

| Riesgo                                                               | Prob | Impacto | Mitigación                                                            |
| -------------------------------------------------------------------- | ---- | ------- | --------------------------------------------------------------------- |
| `KpiConfig` actual no soporta todos los campos que necesita Overview | Baja | Bajo    | Extender interface en `tenant.ts` si necesario (5 min)                |
| Zod schema demasiado estricto bloquea tenants con configs legacy     | Baja | Medio   | Usar `.optional()` + defaults generosos; tests cubren backward compat |

## Next Steps

→ Phase 02: usar `DEFAULT_OVERVIEW_KPIS` como fallback en `getKpiOverview()`.
