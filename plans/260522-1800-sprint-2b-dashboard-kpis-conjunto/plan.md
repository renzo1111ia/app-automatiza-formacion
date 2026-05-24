---
title: "Sprint 2B — Dashboard KPIs conjunto (MVP)"
sprint_id: SP-3B
version_target: v0.2.8
branch: feature/sprint-02b-dashboard-kpis-conjunto
assigned_to: Javi HP
created: 22-05-2026 18:00 por Javi HP
last_updated: 24-05-2026 21:30 (replanteo fechas -7sem + decisiones cerradas: KPI Builder=C, Web widget=2 valores+tooltip, funnel YA EXISTE en ChartManager.tsx:108)
status: 🔘 Pendiente (arranca tras Sprint 2 mergeado a developer)
position: entre Sprint 2 (HubSpot+Zoho v0.2.7) y Sprint 3 (Hardening v0.3.0-rc.1)
effort: 16-24h dev + 4h 30min cierre = 21-29h totales
---

# Sprint 2B — Dashboard KPIs conjunto

Sprint corto y bloqueante del MVP: implementa la sección **Overview** del dashboard pidiendo Bea (clienta), **extendiendo el `/dashboard` existente** (no creando ruta nueva). Cero migraciones SQL nuevas.

> "Echo de menos un panel de métricas y KPIs conjunto (llamada, whatsapp, web), donde se vean número de leads, leads contactados, leads cualificados, tiempo ahorrado, etc etc (se deben poder definir los KPIs que se quieren visualizar). Pero es importante tener un Dashboard de control general." — Bea, doc Correcciones V1 punto 12

## Key insight tras research R1

El `/dashboard` actual **ya implementa** SummaryManager + ChartManager + KPIs configurables por tenant (via `tenants.config JSONB`). Sprint 2B **NO construye dashboard nuevo** — añade una sección `<OverviewSection>` arriba del `<SummarySection>` actual con cross-canal KPIs (llamada + whatsapp + web consolidados).

**Decisiones arquitectónicas confirmadas (R1):**

- **Ruta**: extender `/dashboard` con `<OverviewSection>` ENCIMA del `<SummarySection>` actual. NO crear `/dashboard/overview`.
- **Persistencia**: `configKey: "overview_kpis"` en `tenants.config` JSONB. **Zero-migration.** Reusa patrón existente (`kpis`, `funnel`, `charts`).
- **Backend**: `getKpiOverview()` = thin wrapper sobre `getKpiGenerales()` (ya hace exactamente esto: lanza 5 queries paralelas con `Promise.all`). Cero queries nuevas.
- **NO vista materializada PostgreSQL** en MVP (diferida a Sprint 3 hardening si métricas lo justifican).
- **4 gráficos por defecto**: area (leads/día) + funnel (cross-canal) + donut (distribución canal) + bar (leads por origen).
- **WCAG desde inicio**: 3 pitfalls preventivos (trend badges sin texto, charts sin `role="img"`, headings semánticos).

## Fases

| #   | Archivo                                                                                      | Tareas                                                                            | Est.     | Estado    |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- | --------- |
| 1   | [phase-01-decision-arquitectura-y-defaults.md](phase-01-decision-arquitectura-y-defaults.md) | Validar decisión `/dashboard` extend, definir `DEFAULT_OVERVIEW_KPIS`, schema Zod | 1h 30min | Pendiente |
| 2   | [phase-02-backend-getkpioverview.md](phase-02-backend-getkpioverview.md)                     | `getKpiOverview()` thin wrapper + Zod schemas + tests Vitest                      | 3h       | Pendiente |
| 3   | [phase-03-frontend-overview-section.md](phase-03-frontend-overview-section.md)               | `<OverviewSection>` integrado en `/dashboard/page.tsx` con Suspense + skeletons   | 4h       | Pendiente |
| 4   | [phase-04-overview-charts-defaults.md](phase-04-overview-charts-defaults.md)                 | 4 gráficos por defecto (area, funnel, donut, bar) integrados via ChartManager     | 3h       | Pendiente |
| 5   | [phase-05-kpi-builder-overview.md](phase-05-kpi-builder-overview.md)                         | KPI Builder extendido con configKey `overview_kpis` (reusa SummaryManager)        | 3h       | Pendiente |
| 6   | [phase-06-wcag-accesibilidad-preventiva.md](phase-06-wcag-accesibilidad-preventiva.md)       | 3 pitfalls WCAG preventivos: aria-labels trend badges + charts + headings         | 2h       | Pendiente |
| 7   | [phase-07-cierre-sprint.md](phase-07-cierre-sprint.md)                                       | SP-3B-CLOSE-1..5 + hand-off SP-4B phase-03b                                       | 4h 30min | Pendiente |

**Total desarrollo:** ~16-19h (rango bajo del estim 16-24h por simplificación R1 = no greenfield) · **Total con cierre:** ~21-24h.

## Dependencias

- **Bloqueante anterior**: Sprint 2 (HubSpot+Zoho) mergeado en `developer` con `a826fd6` + hotfix v0.2.7 ✅ (cumplido 24-05-2026).
- **Bloqueante siguiente**: Sprint 3 (Hardening) no arranca hasta Sprint 2B mergeado, porque Sprint 3 phase-01 E2E reusa `/dashboard` extendido para tests.

## Asignación

- **Lead**: Javi HP. Capacidad 10h productivas/día L-V.
- **Duración estimada**: 3 días lab.
- **Fechas previstas (actualizadas 24-05-2026)**: Inicio **Mar 26-05-2026 09:00**, fin **Jue 28-05-2026 19:00**.

> ✅ **Replanteo aplicado 24-05-2026 21:30**: gap original de 2 meses eliminado. Sprint 2B arranca al día siguiente del cierre Sprint 2, aplicando el ratio real Sprints 0/1/2 (−91% a −94% vs estim). MVP v0.3.0 GA replanteado a Lun 22-06-2026.

## Riesgos top-5

| Riesgo                                                                                               | Prob  | Impacto | Mitigación                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------ |
| Web widget (`web_widgets`) no trackea sesiones todavía → gráfico "distribución por canal" incompleto | Media | Bajo    | ✅ DECIDIDO 24-05: 2 valores + tooltip "Web tracking en desarrollo"                        |
| `tiempo_respuesta_promedio_minutos` devuelve null → KPI card vacío                                   | Alta  | Bajo    | Ocultar condicionalmente si valor es null; mostrar tooltip "Datos insuficientes"           |
| KPI Builder en `/settings/KpiBuilder.tsx` es ligero, no soporta drag-and-drop                        | Media | Medio   | ✅ DECIDIDO 24-05: opción C = reusar SummaryManager (DnD) + pestaña KPIs dedicada          |
| Sobre-ingeniería con vista materializada PostgreSQL desde el inicio                                  | Baja  | Bajo    | YAGNI confirmado en R1. Diferir a Sprint 3 si performance >500ms p95.                      |
| WCAG findings detectados en E2C bloquean cierre                                                      | Media | Medio   | Phase-06 cubre 3 pitfalls preventivos. Restantes findings se difieren a Sprint 3 phase-04. |

## Solapes con sprints anteriores

| Sprint anterior       | Componente reutilizado                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| Sprint 1 (Bloque 2.5) | SummaryManager + ChartManager + FilterBar + tenants.config JSONB pattern  |
| Sprint 1 (Bloque 2.8) | Logger estructurado (Pino) para errores en `getKpiOverview`               |
| Sprint 2              | `getKpiGenerales()` ya en analytics.ts:139 — reuso directo, zero rewrites |

## Criterios de éxito del Sprint 2B

- [ ] `<OverviewSection>` visible en `/dashboard` arriba de `<SummarySection>` con 4 KPIs hero por defecto.
- [ ] 4 gráficos overview funcionando (area + funnel + donut + bar).
- [ ] KPI Builder permite añadir/quitar/reordenar KPIs del overview por tenant.
- [ ] Datos cross-canal (llamada + whatsapp + web cuando aplique) consolidados en una sola vista.
- [ ] `npm run typecheck` + `lint` + `build` + Vitest → 0 errores.
- [ ] 3 pitfalls WCAG preventivos resueltos (aria-labels, role="img", headings semánticos).
- [ ] PR a `developer` con bump v0.2.8.
- [ ] Hand-off rellenado en SP-4B phase-03b.

## Output esperado al cierre

- Nueva sección `<OverviewSection>` en `/dashboard` operativa con 4 KPIs hero + 4 gráficos + filtros (reusa `FilterBar`).
- `getKpiOverview()` documentado en `docs/architecture/dashboard-kpis.md` (nuevo).
- Test Vitest smoke + E2C local pasa 100%.
- Bump SemVer `v0.2.8` (corregido de v0.2.7 → v0.2.8 por colisión con Sprint 2 hotfix).
- PR mergeado a `developer`.
- Hand-off a SP-4B phase-03b con instrucciones para Renzo.

## Tracking de tiempos

Logs en `plans/logs/sprint-3b/3b-XX.log.md` (siguiendo política Sprint 2+ de granularidad fina por bloque).

## Referencias

- Research R1 base: `plans/reports/researcher-sprint-2b-kpis-dashboard-260524.md` (201 líneas, modelo Sonnet)
- Requerimiento Bea: doc Correcciones V1 punto 12 (`docs/Docs-entrega-clienta/`)
- Código existente clave:
  - `src/app/dashboard/page.tsx` — estructura completa actual
  - `src/lib/actions/analytics.ts:139` — `getKpiGenerales()` a reusar
  - `src/components/dashboard/SummaryManager.tsx` — KPI manager con DnD
  - `src/components/dashboard/ChartManager.tsx` — chart manager
  - `src/lib/constants/kpi-defaults.ts` — patrón DEFAULT_SUMMARY_KPIS
  - `src/types/tenant.ts` — interfaces KpiConfig, ChartConfig
