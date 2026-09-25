---
title: "Auditoría cobertura Sprint 3 — NEW-09..12 + gaps phases existentes"
type: researcher
date: 2026-05-24
sprint: SP-4 (Sprint 3 Hardening)
---

# Auditoría Sprint 3 — Cobertura NEW-09..12 y gaps phases

## 1. NEW-09..12 en los phase files existentes

**Veredicto: NINGUNA de las 4 tareas tiene desglose de implementación en ningún phase file.**

Búsqueda exhaustiva en los 7 phase files (`phase-01` a `phase-07`) y `plan.md`:

| Tarea  | Evidencia encontrada en phases                                                                                                                                                                                            | Conclusión        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| NEW-09 | Zero menciones. `phase-01` lista `e2e/leads/historial-table.spec.ts` pero no importar Excel ni filtros multi-variable                                                                                                     | **No desglosada** |
| NEW-10 | Zero menciones de `tenant_holidays`, festivos ni holidays                                                                                                                                                                 | **No desglosada** |
| NEW-11 | `phase-07` línea 72 usa "Leads / Historial" como heading de checklist E2E pero NO como tarea de renombrado. `phase-01` línea 88 crea `e2e/leads/historial-table.spec.ts` — spec sobre módulo que aún se llamará Historial | **No desglosada** |
| NEW-12 | Zero menciones de Settings UX, buscador integraciones, "probar conexión" ni edición panel lateral en ningún phase                                                                                                         | **No desglosada** |

Las 4 tareas existen en `RoadMap.md` línea 208 como bloque `3.B` con 23h asignadas y en `sp-1-close-3-analisis-docs-clienta-renzo-20260522.md` líneas 89-92 con origen claro (informe Renzo). La instrucción explícita del analista (línea 132 del mismo informe) era "Actualizar planes Sprint 1, 2, 3 con las nuevas tareas" — eso **nunca se ejecutó para Sprint 3**.

---

## 2. Dónde deberían entrar las NEW-09..12

### NEW-11 — Renombrar UI Historial → Leads (2h)

**→ Phase-01 existente** (E2E + cobertura). Motivo: es un refactor de rutas/nombres de componentes y sus specs Playwright deben actualizarse en el mismo paso. No requiere phase nueva. Riesgo de hacerlo en phase separada: los E2E se crean con el nombre viejo y hay que rehacer specs.

Impacto: renombrar `e2e/leads/historial-table.spec.ts` tiene sentido ANTES de escribirla, no después.

### NEW-12 — Settings UX (6h)

**→ Phase-05 existente** (Hardening + rate limits). Justificación: Settings es la UI del panel de integraciones (HubSpot/Zoho). El buscador, "probar conexión" y confirmación de borrado son UX improvements sobre el módulo que phase-05 ya toca al verificar que el rate limit no rompe el flujo de settings. La edición en panel lateral es scope más amplio pero comparte archivos con `src/app/dashboard/settings/IntegrationsManager.tsx` que phase-04 ya referencia (línea 131 DA-5-020). Alternativa aceptable: phase nueva `phase-08-features-bea-renzo-new12.md` si se quiere separar concerns claramente.

### NEW-10 — Calendario festivos manuales (3h)

**→ Phase nueva `phase-08` o bloque dentro de phase-01.** El módulo de calendario ya tiene spec en phase-01 (`e2e/calendar/appointments.spec.ts`, línea 91). La tabla `tenant_holidays` y su server action `getHolidays` no tienen ningún archivo relacionado en las phases existentes. Crear `phase-08-features-new09-10.md` es la opción limpia.

### NEW-09 — Campañas: importar Excel + filtros multi-variable + cola configurable (12h)

**→ Phase nueva dedicada (`phase-08`).** Esta es la tarea más compleja: XLSX parser, schema BullMQ configurable, server actions de filtros multi-variable, probablemente tabla `campaigns` nueva. No encaja en ninguna phase existente sin contaminar su scope. Requiere diseño propio y ADR para la dependencia XLSX (`xlsx` o `exceljs`). Meter esto en phase-01 o phase-05 diluiría el foco de cada phase y haría sus Todo Lists inmanejables.

**Recomendación: crear `phase-08-features-bloque-3b-new09-10-11-12.md`** con 4 secciones internas (una por NEW). Consolidar en un solo file evita añadir 4 files al plan y mantiene la plantilla de sprint bajo 10 phases.

---

## 3. Auditoría rápida phases existentes

### Phase-01 (E2E + Coverage) — BIEN detallada

- Implementation Steps: 9 pasos con código concreto. ✅
- Todo List: 23 items. ✅
- Success Criteria: métricas concretas (0 failed, ≥6 specs, lines ≥80%). ✅
- Tests definidos: es LA phase de tests. ✅
- **Gap menor**: `phase-01` línea 97 `e2e/settings/crm-connection.spec.ts` — este spec testea la UI de Settings pero NEW-12 aún no está implementada. Si los specs se escriben antes que la feature existe, pasarán o fallarán dependiendo del estado actual de la UI. El spec debería crearse junto con NEW-12, no antes.
- **Gap menor**: `tests/unit/zod-schemas.test.ts` (línea 101) — ¿qué schemas cubre? No especifica. Si Zod schemas de Sprint 1 tienen bugs, este test los detectará, pero "zod-schemas" genérico no es un nombre suficientemente orientado.

### Phase-02 (Observabilidad) — BIEN detallada

- Implementation Steps: 7 pasos con snippets completos. ✅
- Todo List: 12 items. ✅
- Success Criteria: concretos y verificables. ✅
- **Gap:** la eliminación de `llm_usage_logs` está correctamente tachada pero `phase-06` línea 116-122 del CHANGELOG draft aún incluye "Dashboard de costes LLM por tenant" y "Tabla llm_usage_logs" como items del `## Added` de v0.3.0. Esto es inconsistente — si se mergeara el CHANGELOG con ese borrador, la release notes v0.3.0 afirmaría features que no están en este sprint.

### Phase-03 (Node 22) — BIEN detallada

- Implementation Steps: 12 pasos, incluyendo validación de native bindings. ✅
- Todo List: 16 items. ✅
- **Gap:** el paso 6 línea 127 referencia `npx playwright test tests/e2e/sprint-2-close/smoke-crm-vps.spec.ts` — ese spec path no está creado en fase-01 ni existe en ningún plan. Es una referencia huérfana a un archivo que no está en la lista de archivos a crear de este sprint.

### Phase-04 (WCAG) — BIEN detallada, es la más extensa

- Implementation Steps: 6 grupos de trabajo con snippets completos. ✅
- Todo List: 29 items organizados por severidad. ✅
- Success Criteria: concretos (0 alert(), Lighthouse ≥90, contraste ≥4.5:1). ✅
- **Gap:** DA-5-012 (responsive AIAgentInbox) está marcado P2/opcional en líneas 113, 395, 421. Correcto. Pero phase-07 línea 203 dice que si DA-5-012 no se resuelve el Lighthouse score puede quedar entre 85-89. Si la clienta o Renzo prueba accesibilidad con score < 90, el criterio de éxito del MVP falla. Falta una regla explícita de qué pasa: ¿se acepta 85 como mínimo si DA-5-012 se difiere? Ausencia de decisión documentada.

### Phase-05 (Hardening) — BIEN detallada

- Implementation Steps: 6 pasos con código completo. ✅
- Todo List: 13 items. ✅
- **Gap crítico (Risk):** línea 331 identifica "Rate limiting en Edge Runtime — ioredis no compatible" como riesgo **Alta probabilidad / Alto impacto**, pero la mitigación ("mover check a API Route si es Edge") es vaga — no hay un paso explícito de "verificar si middleware.ts usa Edge o Node runtime en este proyecto". Si no se verifica antes de implementar, la feature puede no funcionar en producción sin que los tests lo detecten (los tests E2E se ejecutarían en local con Node runtime, no Edge).

### Phase-06 (Documentación) — Incompleta

- **Gap importante:** el borrador del CHANGELOG en líneas 116-136 incluye items que ya NO están en Sprint 3:
  - "Dashboard de costes LLM por tenant/proveedor/mes" (movido a Sprint Costes-LLM)
  - "Tabla llm_usage_logs con RLS multi-tenant" (movido a Sprint Costes-LLM)
  - "Migración Node 20 → Node 22" no está en el borrador (sí está en Sprint 3 como phase-03)
  - NEW-09..12 no están en el borrador (23h de trabajo ausentes)
- Implementation Steps: 6 pasos. ✅ estructura correcta.
- Success Criteria: 5 criterios, pero genéricos ("entrada v0.3.0 completa con todos los cambios"). ✅
- **El borrador del CHANGELOG debe reescribirse cuando phase-08 esté creada y phase-03 consolidada.**

### Phase-07 (Cierre) — BIEN detallada

- Todo List + Success Criteria + checklists por CLOSE. ✅
- **Gap:** CLOSE-5 línea 165 dice `package.json version = "1.0.0"`. El Sprint 3 target según `plan.md` frontmatter es `v0.4.0` (no v1.0.0 ni v0.3.0). RoadMap línea 206 dice `v0.3.0-rc.1`. Hay **tres versiones distintas** mencionadas para el mismo artefacto:
  - `plan.md` frontmatter: `version_target: v0.4.0`
  - Phase-07 CLOSE-5: `version = "1.0.0"` (línea 165) y tag `v0.3.0` (línea 154)
  - RoadMap línea 206: `v0.3.0-rc.1`
  - Phase-06 línea 28: "v0.3.0 = MVP completo"
    Inconsistencia que causará confusión al implementar el bump de versión.

---

## 4. Estimación realista — ¿112-140h cubren todo?

### Desglose actual confirmado:

| Componente                | Estimación plan                                          | Notas                                                                                               |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Phase-01 E2E + coverage   | 28-32h                                                   | Razonable para suite desde cero                                                                     |
| Phase-02 Observabilidad   | 7-9h                                                     | Reducida; razonable                                                                                 |
| Phase-03 Node 22          | 4-6h                                                     | Razonable si no hay native binding issues                                                           |
| Phase-04 WCAG 24 findings | 28-40h                                                   | Rango amplio; DA-5-012 puede estirar al límite                                                      |
| Phase-05 Hardening        | 10-14h (plan dice 16-20h en plan.md, 10-14h en la phase) | **Inconsistencia**: plan.md línea 30 dice "16-20h", phase-05 frontmatter dice "10-14h". Delta de 6h |
| Phase-06 Docs             | 6-8h                                                     | OK                                                                                                  |
| Phase-07 Cierre           | 8h + bugs                                                | OK                                                                                                  |
| **Subtotal base**         | **91-119h**                                              |                                                                                                     |
| NEW-09..12 (Bloque 3.B)   | 23h                                                      | **No desglosadas, sin phase file**                                                                  |
| **Total teórico**         | **114-142h**                                             | Alineado con RoadMap ~112-140h                                                                      |

### Riesgos de subestimación:

1. **NEW-09 (12h) es la más arriesgada.** XLSX parse + nueva tabla `campaigns` + BullMQ queue configurable + filtros multi-variable es work para un sprint propio. 12h es posible si la tabla BullMQ ya existe y solo se añade configurabilidad, pero si hay que diseñar el schema + RLS + UI completa, se puede ir a 18-20h. Sin phase file detallada no es posible afinar.

2. **Phase-04 WCAG rango 28-40h.** Delta de 12h en una sola phase. DA-5-010 (25+ ubicaciones contraste) y DA-5-012 (responsive) son los drivers de ese rango. Si se implementa DA-5-012 el sprint puede llegar a 155h.

3. **Phase-05 inconsistencia 10-14h vs 16-20h** (6h de diferencia entre plan.md y phase-05 frontmatter). Con la tarea 4-08 (`withRateLimit` HOF, 6h estimadas — incluida según phase-05 línea 385), el rango real es 16-20h, no 10-14h.

4. **Phase-01**: si la BD de test (Supabase local + Redis) no está configurada para CI, setup puede consumir 4-6h extra. Risk identificado en phase-01 línea 267.

**Estimación ajustada realista:** 120-165h (vs 112-140h del plan). El riesgo principal de desbordamiento es la combinación de DA-5-012 (si se mantiene en scope) + NEW-09 subestimada + setup CI para Playwright.

---

## Resumen ejecutivo

| Punto                                                               | Estado                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| NEW-09..12 desglosadas en algún phase                               | ❌ Ninguna                                            |
| Phases con Implementation Steps completos                           | ✅ Ph-01, 02, 03, 04, 05, 07                          |
| Phases con secciones TBD/vacías                                     | ⚠️ Ph-06 (CHANGELOG borrador obsoleto)                |
| Inconsistencia de versión (v0.3.0 vs v0.4.0 vs v1.0.0)              | ❌ Phase-07 CLOSE-5 debe corregirse                   |
| Gap Edge Runtime rate limiter (riesgo alto sin mitigación concreta) | ⚠️ Phase-05                                           |
| Estimación total cuadra con 112-140h incluyendo 3.B                 | ✅ Sí (rango 114-142h teórico)                        |
| Riesgo real de desbordamiento                                       | ⚠️ 120-165h si DA-5-012 in-scope + NEW-09 subestimada |

---

## Acciones concretas recomendadas (ordenadas por impacto)

1. **Crear `phase-08-features-bloque-3b.md`** con desglose completo de NEW-09, NEW-10, NEW-11, NEW-12. Sin este archivo, el planner/implementor no tiene instrucciones y las 23h son un número vacío.
2. **Corregir phase-07 CLOSE-5**: la versión target debe ser un único valor — `v0.4.0` (frontmatter del plan) o `v0.3.0-rc.1` (RoadMap). Elegir y unificar.
3. **Reescribir borrador CHANGELOG en phase-06**: eliminar las líneas de LLM costs (movidas), añadir Node 22 migration, añadir NEW-09..12.
4. **Resolver ambigüedad DA-5-012**: decidir explícitamente si entra en v0.4.0 o se difiere como tech debt. Sin decisión documentada, el criterio de Lighthouse ≥90 queda en el aire.
5. **Verificar runtime de middleware.ts antes de implementar rate limiter** (phase-05): añadir paso 0 "confirmar Edge vs Node runtime" al inicio de Implementation Steps.
6. **Alinear estimación phase-05**: frontmatter dice 10-14h, plan.md dice 16-20h. Usar 16-20h (incluye 4-08).

---

## Preguntas sin resolver

- ¿NEW-09 asume que ya existe tabla `campaigns` del Sprint anterior o hay que crearla desde cero? La respuesta cambia la estimación de 12h a ~18-22h.
- ¿NEW-11 (renombrar Historial→Leads) afecta las rutas de la app (`/dashboard/historial`) o solo la UI label? Si afecta rutas, hay implicaciones SEO/bookmarks y la estimación de 2h puede ser corta.
- ¿La versión del tag del Sprint 3 es `v0.3.0-rc.1` (RoadMap) o `v0.4.0` (plan.md frontmatter)? Hay que decidir antes de CLOSE-5.
- ¿Phase-03 (Node 22) debe ejecutarse en su propia rama (`feature/sprint-03-node-22-upgrade`) o dentro de `feature/sprint-03-hardening`? El Implementation Steps paso 1 abre rama separada, lo que implica 2 PRs y coordinación de merge.
