# Research Report: Sprint 2B — Dashboard KPIs Overview

**Fecha:** 24-05-2026 | **Modelo:** Sonnet

---

## 1. Decisión arquitectónica: `/dashboard` vs `/dashboard/overview`

### Estado actual de `/dashboard/page.tsx`

La página actual **ya es** el dashboard de control general. Contiene:

- `SummarySection` → KPIs estáticos/dinámicos por canal (llamadas + whatsapp via `getKpiGenerales`)
- `FunnelSection` → Embudo de conversión
- `ChartsSection` → Gráficos dinámicos configurables

El problema de Bea no es que falte una ruta, sino que **los KPIs actuales están filtrados por canal individual** (llamadas, whatsapp, web) y **no hay vista "cross-canal" consolidada** con las métricas que ella pide (leads totales, contactados, cualificados, tiempo ahorrado en un solo panel).

### Recomendación: Extender `/dashboard` con una sección "overview" arriba

**No crear `/dashboard/overview`.** Razón: la página `/dashboard` **ya tiene el layout, los Suspense boundaries, el FilterBar y los defaults** (DEFAULT_SUMMARY_KPIS, DEFAULT_CHARTS). Crear una nueva ruta duplicaría toda esa infraestructura con cero beneficio para el usuario (tendría que navegar a otra URL para ver "lo más importante").

**Solución concreta:** Añadir un nuevo `configKey: "overview_kpis"` en `tenants.config` + un nuevo `<OverviewSection>` en `DashboardPage` que aparece **primero**, antes del `SummarySection` actual. El layout existente 12-col ya lo soporta. El admin puede show/hide o reordenar como hace hoy con el resto de secciones.

---

## 2. Server Action `getKpiOverview(tenantId, from, to, filters)`

### Contrato Zod

```typescript
// Input
const KpiOverviewInputSchema = z.object({
  tenantId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  filters: z
    .object({
      pais: z.string().optional(),
      origen: z.string().optional(),
      campana: z.string().optional(),
      tipoLead: z.string().optional(),
      cualificacion: z.string().optional(),
    })
    .optional()
    .default({}),
});

// Output
const KpiOverviewOutputSchema = z.object({
  total_leads: z.number(),
  leads_alcanzados: z.number(), // vía llamada O whatsapp
  leads_contactados: z.number(), // estado_llamada=CONTACTED
  leads_cualificados: z.number(), // lead_cualificacion.cualificacion != "NO"
  leads_agendados: z.number(),
  tasa_contacto: z.number(), // %
  tasa_cualificacion: z.number(), // %
  tasa_agendamiento: z.number(), // %
  tiempo_ahorrado_formateado: z.string(), // "Xh Ym"
  horas_ahorradas: z.number(),
  canales: z.object({
    llamadas: z.number(),
    whatsapp: z.number(),
    web: z.number(), // widget_sessions si existe
  }),
});
```

### Tablas cruzadas y estrategia anti-N+1

La función `getKpiGenerales` existente (líneas 139-213 de `analytics.ts`) **ya hace exactamente esto**: lanza 5 queries en paralelo via `Promise.all`:

```
lead + llamadas + lead_cualificacion + agendamientos + conversaciones_whatsapp
```

Y calcula `reachedSet` (leads alcanzados por cualquier canal). **Reusar `getKpiGenerales` directamente** — su `KpiGenerales` interface ya expone todos los campos que necesita el overview (ver líneas 24-52).

La action `getKpiOverview` puede ser un thin wrapper:

```typescript
export async function getKpiOverview(
  tenantId: string,
  from: string,
  to: string,
  filters: AnalyticsFilters = {}
): Promise<KpiOverviewOutput> {
  const kpi = await getKpiGenerales(from, to, filters);
  // map fields — no new queries
  return { ... };
}
```

Esto evita duplicar queries. El tenantId ya es manejado internamente por `getActiveTenantId()` con RLS.

### Vista materializada PostgreSQL

**No hace falta desde el inicio.** Razones:

- `getKpiGenerales` ya funciona en producción con la carga actual de Bea (single tenant, ~100-500 leads/mes en MVP)
- El patrón `Promise.all` en el server evita waterfalls
- El cuello de botella real aparece solo con 10k+ leads o >50 requests/min concurrentes — nada del MVP

Decisión: diferir vista materializada a Sprint 3 hardening, solo si métricas de performance lo justifican. No YAGNI.

---

## 3. Schema de KPIs configurables por tenant

### Opción A — tabla nueva `tenant_kpi_config`

- Pro: normalizado, queryable individualmente, fácil auditoria
- Con: nueva migración, nueva RLS policy, nueva action, nueva join en `getActiveTenantConfig`

### Opción B — JSON en `tenants.config` (campo ya existente)

- Pro: **ya existe**, `getActiveTenantConfig` ya lo lee, `updateTenant` ya lo escribe, `SummaryManager` + `ChartManager` ya lo consumen bajo `configKey`
- Con: sin schema enforcement en DB (mitigado con Zod en capa app)

### Opción C — campo separado `tenants.kpi_overview_config JSONB`

- Pro: separación explícita
- Con: nueva migración sin ganancia real — `config` JSONB ya soporta subkeys arbitrarias

**Recomendación: Opción B.** El patrón ya está probado en producción con `configKey: "kpis"`, `configKey: "funnel"`, `configKey: "charts"`. Añadir `configKey: "overview_kpis"` es zero-migration, zero-refactor. El KPI Builder en `/settings` ya edita y persiste estos arrays.

Estructura concreta en `tenants.config`:

```json
{
  "kpis": [...],
  "funnel": [...],
  "charts": [...],
  "overview_kpis": [
    { "id": "ov-1", "label": "Total Leads", "staticKey": "total_leads", ... },
    { "id": "ov-2", "label": "Leads Contactados", "staticKey": "total_contactados", ... }
  ]
}
```

Default fallback: `DEFAULT_OVERVIEW_KPIS` en `kpi-defaults.ts` (nuevo export, mismo patrón que `DEFAULT_SUMMARY_KPIS`).

---

## 4. Los 4 gráficos por defecto del Overview

Coherentes con los tipos de gráfico ya disponibles en `ChartConfig.type` (area, bar, donut, vertical-bar, heatmap, funnel) y las tablas en `SCHEMA_COLUMNS`.

| #   | Título                            | Tipo     | Tabla(s) base                                                | Descripción                                                                                                                          |
| --- | --------------------------------- | -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Leads por día (todos los canales) | `area`   | `lead` (fecha_ingreso_crm)                                   | Evolución temporal de entradas. xKey=fecha_ingreso_crm, yKey=count. Muestra tendencia de volumen — clave para Bea                    |
| 2   | Embudo cross-canal                | `funnel` | `lead` + `llamadas` + `lead_cualificacion` + `agendamientos` | Leads → Contactados → Cualificados → Agendados. Reutiliza DEFAULT_FUNNEL pero en overview siempre visible                            |
| 3   | Distribución por canal            | `donut`  | `llamadas` + `conversaciones_whatsapp`                       | % de interacciones por canal (llamada vs whatsapp vs web). xKey=canal (computed), centerLabel="Canales"                              |
| 4   | Leads por origen                  | `bar`    | `lead` (origen)                                              | Top orígenes de leads (campañas, web, manual). xKey=origen, yKey=count. Ya existe en DEFAULT_CHARTS pero aquí va al overview siempre |

Estos 4 cubren exactamente el requerimiento de Bea: volumen, contacto, cualificación, tiempo ahorrado (el último aparece como KPI card, no como gráfico — es más legible como número grande).

Los gráficos 1 y 4 tienen `dataKey` dinámico → usan `getDynamicChartSeries` ya existente sin cambios.
Los gráficos 2 y 3 necesitan lógica computed (multi-tabla join) → candidatos a `staticKey` pre-computado en `getKpiGenerales`, que ya devuelve `por_origen` y datos de embudo.

---

## 5. WCAG 2.2 AA — 3 pitfalls críticos a evitar desde el inicio

### Pitfall 1: Color como único indicador de valor (Criterion 1.4.1)

**Problema común en KPI dashboards:** usar rojo/verde para indicar "malo/bueno" sin etiqueta de texto. Los SummaryCards actuales usan `bg-blue-600`, `bg-emerald-600` etc. como decoración, lo cual está bien. El problema surge cuando se añaden "trend indicators" (+12%, -3%) con color verde/rojo sin icono ni texto accesible.

**Fix preventivo:** cualquier trend badge debe incluir `aria-label="Incremento del 12%"` o `aria-label="Descenso del 3%"` + icono TrendingUp/TrendingDown de Lucide (que ya está en el codebase) junto al número. No solo color.

### Pitfall 2: Gráficos sin alternativa textual (Criterion 1.1.1 + 4.1.2)

**Problema:** los componentes Recharts/chart library existentes (AreaChartComponent, DonutChart) no exponen `role="img"` ni `aria-label` por defecto. Screen readers los ignoran o leen noise.

**Fix preventivo:** en cada chart wrapper añadir:

```tsx
<div role="img" aria-label={`Gráfico: ${title}. ${summarizeData(data)}`}>
  <AreaChartComponent ... />
</div>
```

Donde `summarizeData` genera algo como "12 puntos de datos, máximo 45 el 15 de mayo". Esto es 5 líneas por componente, no un refactor.

### Pitfall 3: KPI cards sin jerarquía de headings (Criterion 1.3.1)

**Problema:** los SummaryCards actuales renderizan el valor (ej. "1,247") como `<div>` sin estructura semántica. Si hay múltiples grupos ("Informes", "Performance y Conversión") sin `<h2>/<h3>` reales, los usuarios de screen reader no pueden navegar por secciones.

**Fix preventivo:** el `SectionHeader` en `SummaryManager.tsx` (línea 63) ya renderiza un div con título de grupo. Cambiar la etiqueta contenedora a `<h2>` o añadir `role="heading" aria-level="2"`. El valor numérico del KPI card debe estar en un `<p>` o `<span>` con `aria-label` completo (ej. `aria-label="Total leads: 1247"`).

---

## Archivos del proyecto leídos

- `src/app/dashboard/page.tsx` — estructura completa, secciones Suspense, imports
- `src/lib/actions/analytics.ts` (líneas 1-300) — `KpiGenerales` interface, `getKpiGenerales`, `getDynamicKpis`, `getDynamicChartSeries`, `getKpiWhatsapp`
- `src/types/tenant.ts` — `KpiConfig`, `ChartConfig`, `Tenant`
- `src/components/dashboard/SummaryManager.tsx` (cabecera) — props, DND, configKey pattern
- `src/components/dashboard/ChartManager.tsx` (cabecera) — props, chart types
- `src/app/dashboard/settings/KpiBuilder.tsx` — builder ligero en settings
- `src/lib/constants/kpi-defaults.ts` — DEFAULT_SUMMARY_KPIS, DEFAULT_FUNNEL, estructura actual
- `src/lib/constants/schema.ts` — SCHEMA_COLUMNS, AVAILABLE_COLORS, ICON_MAP
- `supabase/MASTER_RESTORE.sql` — estructura `tenants.config JSONB`
- `supabase/migrations/20260101000000_initial_tenants.sql` — confirmación schema

---

## Preguntas sin resolver

1. ¿La web widget (`web_widgets` table) ya registra sesiones/leads captados por widget? No hay `SCHEMA_COLUMNS.web_widgets` en `schema.ts` — el gráfico "Distribución por canal" puede necesitar ajuste si el canal web no está trackeado aún.
2. ¿El campo `tiempo_respuesta_promedio_minutos` en `KpiGenerales` devuelve `null` actualmente (línea 38 del interface)? Si es null en la mayoría de tenants, el KPI card de "T. Respuesta" en el overview mostraría vacío — considerar ocultarlo condicionalmente.
3. El `KpiBuilder` en `/settings/KpiBuilder.tsx` es una versión simplificada (sin modo avanzado). ¿El overview KPI builder debe reutilizar el `SummaryManager` full (con drag-and-drop y modo advanced) o es suficiente con un subset simpler para el overview? Impacta el tamaño de la tarea.
