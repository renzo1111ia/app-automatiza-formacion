---
title: "Sprint 3 — Phase 08 — Features Bloque 3.B (NEW-09..12 docs Bea+Renzo)"
status: pending
priority: P1
effort: 19-25h (refinado tras research R2)
sprint_id: SP-4
task_ids: [NEW-09, NEW-10, NEW-11, NEW-12]
created: 24-05-2026
last_updated: 24-05-2026
---

# Phase 08 — Features Bloque 3.B (NEW-09..12)

## Context Links

- Research base: `plans/reports/researcher-sprint-3-audit-coverage-260524.md`
- Origen requerimientos: `plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md` líneas 89-92 (NEW-09..12)
- RoadMap.md línea 208: bloque 3.B con 23h estimadas (corregido aquí a 19-25h tras desglose)
- Plan padre Sprint 3: [plan.md](plan.md)

## Overview

**Priority:** P1 (cierra requerimientos pendientes de Bea + Renzo dentro del MVP).
**Brief:** 4 features no-arquitectónicas pero visibles para el usuario final, agrupadas en una phase dedicada porque NO encajan en las phases 01-07 sin contaminar su scope.

## Las 4 features (overview)

| ID     | Feature                                                                                        | Estim  | Subcción phase | Bloqueante                                       |
| ------ | ---------------------------------------------------------------------------------------------- | ------ | -------------- | ------------------------------------------------ |
| NEW-09 | Campañas: importar Excel + filtros multi-variable + cola configurable                          | 12-18h | §1             | Decisión: ¿`campaigns` tabla existe? Si no, +6h. |
| NEW-10 | Calendario festivos manuales por país                                                          | 3h     | §2             | Tabla `tenant_holidays` nueva                    |
| NEW-11 | Renombrar UI Historial → Leads + consolidación                                                 | 2h     | §3             | **Hacer ANTES de phase-01 E2E specs** (R2)       |
| NEW-12 | Settings UX: buscador integraciones + probar conexión + confirmaciones + edición panel lateral | 6h     | §4             | Reusa Settings de Sprint 2                       |

## Dependencias

- **NEW-11 debe ejecutarse ANTES de phase-01 (E2E Playwright)** — específicamente antes de crear `tests/e2e/leads/historial-table.spec.ts` para evitar refactor doble.
- NEW-09, NEW-10, NEW-12 son independientes y paralelizables.

---

## §1 — NEW-09: Campañas Excel + filtros + cola configurable (12-18h)

### Pre-check obligatorio

```powershell
grep -rn "campaigns\|CREATE TABLE.*campaign" src/ supabase/migrations/
```

- Si tabla `campaigns` existe → 12h (foco en parser + filtros + cola).
- Si NO existe → 18h (añadir tabla + RLS + CRUD básico + lo demás).

### Sub-tareas

1. **Decisión XLSX parser** (15 min): `xlsx` (legacy, deprecated) vs `exceljs` (mantenido, mejor API). Recomendación: `exceljs` con ADR mínimo. Pasar por `af-agents:adr`.

2. **Schema Zod** `src/lib/schemas/campaign-import.ts` (30 min):

   ```typescript
   export const CampaignImportRowSchema = z.object({
     nombre: z.string().min(1).max(200),
     telefono: z.string().regex(/^\+?\d{6,15}$/),
     email: z.string().email().optional(),
     pais: z.string().length(2).optional(), // ISO-2
     tags: z.string().optional(), // CSV
   });
   export const CampaignImportSchema = z.array(CampaignImportRowSchema).max(10000);
   ```

3. **Server action** `importCampaignFromExcel(tenantId, fileBuffer)` (3-4h):
   - Parse con exceljs, validar con Zod row by row.
   - Reportar errores por fila (no abortar todo).
   - Insertar leads en batch con `INSERT ... ON CONFLICT` (dedup por teléfono).
   - Devolver resumen `{ inserted, skipped, errors: [{row, error}] }`.

4. **UI importar Excel** en `/dashboard/campanas/nuevo` (2-3h):
   - Dropzone con `react-dropzone` o input file nativo.
   - Preview de primeras 10 filas con validación visual.
   - Botón "Importar" → loading state → resultado.

5. **Filtros multi-variable** en `/dashboard/campanas` listado (3-4h):
   - Multi-select por: estado, origen, país, fecha rango, tag.
   - Persistir filtros en URL query params (shareable).
   - Server action `searchCampaigns(filters)` con Zod.

6. **Cola configurable cadencia** (2-3h):
   - Setting por campaña: ritmo de envío (X leads/min, ventana horaria, días activos).
   - Persistir en `campaigns.config JSONB` (zero-migration si la tabla ya existe).
   - BullMQ scheduler respeta config: `queue.add(job, { delay, repeat: { tz, cron } })`.

7. **Tests** (1-2h):
   - Vitest: parser Excel + Zod validation + import action.
   - E2E (en phase-01): subir archivo + verificar leads creados + verificar filtros funcionan.

### Success criteria NEW-09

- Importar XLSX con 100 filas funciona end-to-end.
- Filtros multi-variable filtran correctamente con URL persistente.
- Cola configurable respeta cadencia configurada.
- Tests Vitest ≥85% coverage en `campaign-import.ts`.

---

## §2 — NEW-10: Calendario festivos manuales por país (3h)

### Sub-tareas

1. **Migración SQL** `supabase/migrations/YYYYMMDD_tenant_holidays.sql` (30 min):

   ```sql
   CREATE TABLE tenant_holidays (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     country_code CHAR(2) NOT NULL,
     date DATE NOT NULL,
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE (tenant_id, country_code, date)
   );
   ALTER TABLE tenant_holidays ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON tenant_holidays
     USING (tenant_id = (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() LIMIT 1));
   ```

2. **Server actions** (1h):
   - `getHolidays(tenantId, countryCode, year)` — lista festivos.
   - `addHoliday(tenantId, countryCode, date, name)` — añadir.
   - `removeHoliday(tenantId, holidayId)` — borrar.
   - Validación Zod en input.

3. **UI Calendar settings** `/dashboard/calendar/holidays` (1h):
   - Selector país (ES, MX, AR, US, etc.).
   - Calendario mensual con festivos marcados.
   - Click día → modal "Añadir festivo" con name input.
   - Click festivo existente → borrar.

4. **Integración con scheduler BullMQ** (30 min):
   - Helper `isBusinessDay(tenantId, date)` que respeta festivos.
   - Usar en `getNextRunDate()` de la cola de campañas (NEW-09).

### Success criteria NEW-10

- Admin puede gestionar festivos por país desde UI.
- Scheduler respeta festivos al programar envíos.
- Migración SQL aplicada local + VPS (via pg-meta REST si SSH denegada).

---

## §3 — NEW-11: Renombrar UI Historial → Leads (2h)

> ⚠️ **CRÍTICO**: Ejecutar ANTES de phase-01 (E2E) para evitar specs con nombres viejos (R2 §3).

### Sub-tareas

1. **Auditoría inicial** (15 min):

   ```powershell
   grep -rn "Historial\|historial" src/app/ src/components/ | head -30
   ```

2. **Decisión rutas** (10 min):
   - **Opción A**: cambiar URL `/dashboard/historial` → `/dashboard/leads` (afecta SEO/bookmarks, requiere redirect 301).
   - **Opción B**: mantener URL, cambiar solo labels/UI (más seguro).
   - **Recomendación**: B (mantener URL, cambiar UI). Si Bea pide URL, hacer 301 redirect en `proxy.ts`.

3. **Refactor labels** (30 min):
   - Sidebar: "Historial" → "Leads".
   - Page header: "Historial de Leads" → "Leads".
   - Breadcrumbs.
   - Page title metadata.

4. **Consolidación** (1h):
   - Revisar si hay vista "Leads" duplicada en otro sitio del menú.
   - Si existe `/dashboard/leads` separada, decidir merge.

5. **Verificación** (15 min):
   - `npm run dev` y revisar manualmente que UI es consistente.
   - Screenshot antes/después.

### Success criteria NEW-11

- Sidebar y headers dicen "Leads" en lugar de "Historial".
- URLs intactas (opción B) o redirect 301 funcional (opción A).
- Phase-01 E2E specs creadas con nombre nuevo `e2e/leads/leads-table.spec.ts`.

---

## §4 — NEW-12: Settings UX (6h)

### Sub-tareas

1. **Buscador integraciones** (1h):
   - Input en `/dashboard/settings` que filtra cards de integraciones por nombre.
   - Cliente-side (cards ya en DOM).

2. **"Probar conexión"** (2h):
   - Botón en cada integration card que llama `POST /api/integrations/manage/[id]/healthcheck` (ya existe del Sprint 2).
   - Mostrar resultado: ✅ verde "Conectado" / ❌ rojo "Error: X" con detail.
   - Loading state durante request.

3. **Confirmación robusta antes de borrar** (1h):
   - Modal con doble confirmación: input "Escribe el nombre para confirmar".
   - Reusar componente shadcn `AlertDialog` ya en el proyecto.
   - Aplicar a: disconnect integration, delete tenant, delete agent.

4. **Edición en panel lateral** (2h):
   - Cuando admin clica "Editar" en una integration, abrir Sheet/Drawer lateral en lugar de modal centrado (mejor para forms largos).
   - Reusar componente shadcn `Sheet`.

### Success criteria NEW-12

- Buscador filtra integraciones instantáneamente.
- Healthcheck devuelve status visible al admin.
- Borrar requiere confirmación con texto.
- Edición usa panel lateral, no modal.

---

## Todo List global

### Bloque NEW-11 (PRIMERO)

- [ ] Auditar uso "Historial" en código.
- [ ] Decidir opción A/B URLs.
- [ ] Refactor labels.
- [ ] Validación local.

### Bloque NEW-09

- [ ] Pre-check tabla `campaigns` existe.
- [ ] ADR para exceljs dependency.
- [ ] Zod schema CampaignImportRow.
- [ ] Server action import.
- [ ] UI dropzone + preview.
- [ ] Filtros multi-variable.
- [ ] Cola configurable.
- [ ] Tests Vitest.

### Bloque NEW-10

- [ ] Migración SQL `tenant_holidays`.
- [ ] Server actions get/add/remove.
- [ ] UI calendar holidays.
- [ ] Integración scheduler BullMQ.

### Bloque NEW-12

- [ ] Buscador integraciones.
- [ ] Probar conexión.
- [ ] Confirmación robusta delete.
- [ ] Edición panel lateral.

### Cierre phase

- [ ] `npm run typecheck` + `lint` + `build` + `test` verdes.
- [ ] Smoke E2E en phase-01 cubre NEW-09 import + NEW-11 leads + NEW-12 settings.
- [ ] Update RoadMap con tracking real ⏱.
- [ ] Commit unificado: `feat(sprint-3): phase-08 NEW-09..12 (Excel + holidays + leads rename + settings UX)`.

## Success Criteria

- 4 features visibles para Bea funcionando end-to-end.
- 0 specs E2E afectadas por refactor Historial→Leads (NEW-11 PRIMERO).
- Migración tenant_holidays aplicada local + VPS.
- Tests Vitest cubren parser + actions + Zod schemas.

## Risk Assessment

| Riesgo                                               | Prob  | Impacto | Mitigación                                                         |
| ---------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------ |
| Tabla `campaigns` no existe → NEW-09 +6h             | Media | Alto    | Pre-check primero; si no existe, considerar split en sub-phase 08a |
| `exceljs` tiene vulns o tamaño excesivo              | Baja  | Bajo    | Pasar por `af-agents:adr` antes; alternativa: `xlsx` puro          |
| URL change /historial → /leads rompe bookmarks Bea   | Media | Bajo    | Opción B (mantener URL) por defecto                                |
| Refactor "Historial" rompe i18n si existe            | Baja  | Bajo    | Cambiar también keys de translation si aplica                      |
| Healthcheck endpoint Sprint 2 no responde 200 en VPS | Baja  | Medio   | Smoke check primero; si falla, BUG-2-02                            |

## Next Steps

→ Tras NEW-11, ejecutar phase-01 (E2E) con nombres correctos.
→ NEW-09 + NEW-10 + NEW-12 paralelizables si hay tiempo.
→ Cierre integrado en SP-4-CLOSE-5 de phase-07.
