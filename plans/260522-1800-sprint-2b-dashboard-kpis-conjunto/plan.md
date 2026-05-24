---
title: "Sprint 2B — Dashboard KPIs conjunto (MVP)"
sprint_id: SP-3B
version_target: v0.2.7
branch: feature/sprint-02b-dashboard-kpis-conjunto
assigned_to: Javi HP
created: 22-05-2026 18:00 por Javi HP
status: 🔘 Pendiente (arranca tras Sprint 2 mergeado a developer)
position: entre Sprint 2 (HubSpot+Zoho v0.2.5) y Sprint 3 (Hardening v0.3.0-rc.1)
---

# Sprint 2B — Dashboard KPIs conjunto

Sprint corto, dedicado y bloqueante del MVP: implementa el **dashboard de KPIs agregado** que pidió explícitamente la clienta (Bea, doc Correcciones V1, punto 12):

> "Echo de menos un panel de métricas y KPIs conjunto (llamada, whatsapp, web), donde se vean número de leads, leads contactados, leads cualificados, tiempo ahorrado, etc etc (se deben poder definir los KPIs que se quieren visualizar). Pero es importante tener un Dashboard de control general."

## Asignación

- **Lead**: Javi HP.
- **Capacidad**: 10h productivas/día.
- **Duración estimada**: 2-3 días lab (16-24h dev + 4h 30min cierre).
- **Fechas**: Inicio Lun 27-07-2026, fin estim. Mié 29-07-2026.

## Tareas de desarrollo

| ID     | Tarea                                                                                                                                                                                                                                                                                                       | Estim  | Estado | Notas                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW-04 | **Dashboard KPIs conjunto** (`/dashboard` agregado o nueva ruta `/dashboard/overview`) con widget builder configurable que cruza datos de llamadas + whatsapp + web. Reusa `SummaryManager` + `ChartManager`. Server actions agregadas (cruzando `lead`, `llamadas`, `chat_messages`, `widget_*`). WCAG AA. | 16-24h | 🔘     | Requerimiento Bea. Foco: KPIs número leads / contactados / cualificados / tiempo ahorrado por IA / etc. Configurables por tenant. Filtros: rango fechas, campaña, origen, curso |

### Acciones concretas (sub-tareas)

1. Diseño UI: layout sección "overview" con hero metrics + 4 gráficos + tabla resumen (1h).
2. Backend: server action `getKpiOverview(tenant, from, to, filters)` que cruza 4 tablas en memoria (siguiendo el patrón Software Join del módulo WhatsApp) (4-6h).
3. Backend: `getDynamicChartSeriesOverview()` con 4 series por defecto (volumen leads diarios, conversión por canal, top campañas, embudo agregado) (3-4h).
4. UI: nuevo route `/dashboard/overview` (o reemplazar `/dashboard` actual de Resumen de Leads con esta vista — decisión arquitectónica al arrancar) (4h).
5. UI: widget builder de KPIs personalizables por tenant (similar a `KpiBuilder.tsx` ya existente — reusar) (3-4h).
6. Tests: smoke E2E + WCAG audit de la nueva ruta (2-3h).
7. Migración SQL: opcional, vista materializada si rendimiento lo requiere (1-2h).

## Tareas de cierre (SP-3B-CLOSE-1..5)

| Task                | Descripción                                                                        | Estim               | Estado      |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------- | ----------- |
| SP-3B-CLOSE-1       | Auto test (typecheck + lint + build + test)                                        | 1h 30min            | 🔘          |
| SP-3B-CLOSE-2       | Test E2C Local Playwright + WCAG sobre nuevo `/dashboard/overview`                 | 2h                  | 🔘          |
| ~~SP-3B-CLOSE-3~~   | ~~Test Manual~~ — **DIFERIDO a 👤 SP-4B phase-03 bloque 4** (Renzo)                | (0h)                | 🟢 Diferida |
| SP-3B-CLOSE-4       | Bugs detectados                                                                    | (variable)          | 🔘          |
| SP-3B-CLOSE-5       | PR a developer + bump v0.2.7 + crear rama Sprint 3 + **hand-off a SP-4B phase-03** | 1h                  | 🔘          |
| **Subtotal cierre** |                                                                                    | **4h 30min + bugs** |             |

## Dependencias

- **Bloqueante anterior**: Sprint 2 (HubSpot+Zoho) debe estar mergeado a `developer`. Las server actions agregadas dependen del modelo de `lead` que Sprint 1 estabiliza con Zod + Repository.
- **Bloqueante siguiente**: Sprint 3 (Hardening) no debe arrancar hasta SP-3B mergeado, porque Sprint 3 reusa parte del dashboard para tests E2E y observabilidad.

## Riesgos

| Riesgo                                                 | Mitigación                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Server actions agregadas escalan mal con muchos leads  | Vista materializada PostgreSQL si latencia >500ms p95                          |
| Widget builder duplica `KpiBuilder.tsx` existente      | Decisión arquitectónica al arrancar: extender el existente vs nuevo componente |
| Bea quiere KPIs "configurables" — alcance puede inflar | Si se pasa de 24h, congelar config en KPIs hardcoded MVP + builder en post-MVP |

## Output esperado al cierre

- Nueva ruta `/dashboard/overview` (o `/dashboard` consolidado) operativa con 4-6 KPIs hero + 4 gráficos + filtros.
- Test E2C pasa 100%.
- Bump SemVer `v0.2.7`.
- PR mergeado a `developer`.
- Hand-off a SP-4B phase-03 con instrucciones para Renzo.
