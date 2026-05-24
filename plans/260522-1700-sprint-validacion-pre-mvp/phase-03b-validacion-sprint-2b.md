# Fase 03b — Validación Sprint 2B (Dashboard KPIs Overview v0.2.8)

> **Plantilla skeleton creada 24-05-2026** tras research R3. Se rellena en SP-3B-CLOSE-5 (auto-fill por el agente que cierre Sprint 2B). Hasta entonces tiene estructura genérica para guiar el llenado correcto.

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 2B plan](../260522-1800-sprint-2b-dashboard-kpis-conjunto/plan.md)
- [Sprint 2B phase-07 Cierre](../260522-1800-sprint-2b-dashboard-kpis-conjunto/phase-07-cierre-sprint.md)
- [Research base Sprint 2B](../reports/researcher-sprint-2b-kpis-dashboard-260524.md)
- [RoadMap](../RoadMap.md)

## Overview

- **Sprint validado**: Sprint 2B — Dashboard KPIs Overview conjunto (SP-3B, **v0.2.8**).
- **Branch origen**: `feature/sprint-02b-dashboard-kpis-conjunto`.
- **Estado al crear skeleton**: 🔘 Pendiente (Sprint 2B aún no ejecutado, planificado Lun 27-07-2026).
- **Tester**: Renzo.

## Resumen del Sprint 2B a validar (auto-fill al cierre)

<!-- AUTOFILL-START: Resumen Sprint 2B -->

PENDIENTE — se rellena en SP-3B-CLOSE-5 con:

- Nuevas features: `<OverviewSection>` en `/dashboard`, 4 KPIs hero default, 4 charts default, KPI Builder Overview en `/dashboard/settings`.
- Server actions: `getKpiOverview()` + Zod schemas.
- Cambios en `tenants.config`: nuevos keys `overview_kpis`, `overview_charts`.
- WCAG preventivo: aria-labels trend, role="img" charts, headings semánticos.
- Tests añadidos: count, archivos, coverage.
<!-- AUTOFILL-END -->

## 1. Test automático (código)

```bash
npm install
npm run typecheck                 # exit 0
npm run lint                      # 0 errors, 0 warnings
npm run build                     # exit 0
npm run test                      # ~180-185 passed (170 Sprint 2 + ~10-15 Sprint 2B)
npm run test -- --coverage        # coverage report
```

**Resultados esperados:**

- typecheck: 0 errores.
- build: `✓ Compiled successfully` + nueva ruta `/dashboard` extendida visible.
- tests: 180+ pass.
- Coverage: ≥80% en `src/lib/actions/analytics.ts` (función `getKpiOverview` nueva).

## 2. Test E2C local (Playwright contra `localhost:8500`)

```bash
npm run dev
PLAYWRIGHT_BASE_URL=http://localhost:8500 npx playwright test tests/e2e/sprint-2b-close/
```

**Specs creados en Sprint 2B CLOSE-2** (`tests/e2e/sprint-2b-close/smoke-overview-local.spec.ts`):

- OVR-01: `/dashboard` renderiza `<OverviewSection>` con 4 KPIs hero.
- OVR-02: 4 gráficos overview visibles con `role="img"` + aria-label.
- OVR-03: KPI Builder en `/settings` persiste cambios y se reflejan al refrescar.

**Lighthouse a11y:**

- Score ≥ 90 en `/dashboard`.
- 0 critical issues en axe DevTools.

## 3. Specs listos para E2E VPS

Mismos specs con `PLAYWRIGHT_BASE_URL=https://dev.automatizaformacion.com`. Pre-requisitos:

- Sprint 2B mergeado a `developer`.
- Dokploy redeploy con Clean Cache (lección Sprint 2).
- Tenant Bea con al menos algunos leads/llamadas/whatsapp para que el overview muestre datos reales.

## 4. Checklist manual humano (40 min)

### Bloque A — Smoke /dashboard (10 min)

- [ ] **A.1** Login admin VPS → `/dashboard`.
- [ ] **A.2** **Sección Overview visible ARRIBA** del resto del dashboard, con 4 KPI cards hero.
- [ ] **A.3** Los 4 KPIs default muestran valores reales (no "0" si tenant tiene datos): Total Leads, Contactados, Cualificados, Tiempo Ahorrado.
- [ ] **A.4** Los 4 gráficos visibles en grid responsive (2x2 desktop, 1 col mobile).
- [ ] **A.5** FilterBar arriba afecta valores del overview (cambiar rango fechas).

### Bloque B — Personalización por tenant (15 min)

- [ ] **B.1** Ir a `/dashboard/settings` → sección "KPIs Overview" visible.
- [ ] **B.2** Añadir un KPI nuevo al overview (ej. "Leads Web").
- [ ] **B.3** Reordenar KPIs (drag & drop si Opción A/C de phase-05).
- [ ] **B.4** Toggle visibility de un KPI → debe ocultarse sin borrarse.
- [ ] **B.5** Guardar config → volver a `/dashboard` → cambios visibles.
- [ ] **B.6** Persistencia: refresh page → cambios persisten (no se pierden).
- [ ] **B.7** Multi-tenant: cambiar a tenant secundario → config independiente.

### Bloque C — WCAG manual (10 min)

- [ ] **C.1** Navegación por teclado: Tab recorre todos los KPI cards y charts en orden.
- [ ] **C.2** Screen reader (NVDA/VoiceOver) lee títulos de sección como headings.
- [ ] **C.3** Screen reader lee charts con descripción textual ("Gráfico: Leads por día. 12 puntos de datos...").
- [ ] **C.4** Trend badges (si existen) tienen aria-label descriptivo, no solo color.
- [ ] **C.5** Contraste ≥ 4.5:1 en todos los KPI values (medir con axe DevTools).

### Bloque D — Performance (5 min)

- [ ] **D.1** Tiempo carga `/dashboard` < 3s (con datos reales tenant Bea).
- [ ] **D.2** No bloquea otras secciones del dashboard (Suspense independiente).

## 5. BUG-2B-XXX detectados y corregidos durante el cierre Sprint 2B (REGRESSION BASELINE)

<!-- AUTOFILL-START: Bugs Sprint 2B -->

PENDIENTE — se rellena en SP-3B-CLOSE-5. Formato esperado:

| BUG ID    | Severidad          | Descripción | Fix commit | Regression check |
| --------- | ------------------ | ----------- | ---------- | ---------------- |
| BUG-2B-XX | P0/HIGH/MEDIUM/LOW | ...         | hash       | Bloque X.Y       |

Si no hubo bugs: documentar explícitamente "0 bugs con BUG-ID en Sprint 2B — intencional, sprint corto sin findings críticos."

<!-- AUTOFILL-END -->

## 6. Env vars NUEVAS que necesita el VPS

<!-- AUTOFILL-START: Env vars Sprint 2B -->

PENDIENTE — Sprint 2B es zero-migration y zero-env-vars-nuevas (research R1). Probable que esta sección quede:

| Var | Propósito                                                                                 | Dónde obtener |
| --- | ----------------------------------------------------------------------------------------- | ------------- |
| —   | Sprint 2B no requiere env vars nuevas (todo persiste en `tenants.config` JSONB existente) | —             |

Si phase-05 (KPI Builder) introduce alguna var nueva no anticipada en R1, documentarla aquí.

<!-- AUTOFILL-END -->

## 7. Notas de despliegue

<!-- AUTOFILL-START: Notas despliegue Sprint 2B -->

1. Sprint 2B NO requiere migraciones SQL (zero-migration confirmado por R1).
2. Sprint 2B NO requiere env vars nuevas en Dokploy.
3. Dokploy Clean Cache obligatorio en redeploy (lección Sprint 2).
4. Verificar que `tenants.config` JSONB persiste correctamente nuevos keys `overview_kpis` y `overview_charts` (puede requerir update mediante UI tras deploy si admin quiere config custom).
<!-- AUTOFILL-END -->

## 8. Status final SP-4B phase-03b

<!-- AUTOFILL-START: Status final -->

PENDIENTE de auto-fill al cierre Sprint 2B. Esperado:

- ⏳ Pendiente de Renzo: ejecutar checklist manual cuando VPS pre-MVP esté listo + Sprint 2B desplegado.
- 🟢 Auto-tests verdes: 180+ pass.
- 🟢 Build verde.
- 🟢 3/3 E2E VPS smoke verdes (OVR-01/02/03).
- 🟢 Lighthouse a11y ≥ 90.
- 🟢/🟡 X bugs cerrados con regression checks documentados (o 0 si no hubo).
<!-- AUTOFILL-END -->

## 9. Hand-off a phase-04 (Sprint 3 Hardening)

Tras completar phase-03a + phase-03b, Renzo continúa con **[phase-04-validacion-sprint-3.md](phase-04-validacion-sprint-3.md)** que valida Sprint 3 Hardening (release candidate v0.3.0-rc.1).
