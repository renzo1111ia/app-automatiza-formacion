# Fase 04 — Dashboard Llamadas + Lista de Leads (columnas Whats/Voz)

## Context Links

- Plan: [plan.md](plan.md) · Depende de [phase-01-datos-flags-canal.md](phase-01-datos-flags-canal.md)
- Dashboard Llamadas: `src/app/dashboard/minutos/page.tsx`
- KPIs: `src/lib/constants/kpi-defaults.ts` (`LLAMADAS_KPIS`, `DEFAULT_CHARTS_LLAMADAS`)
- Analytics actions: `src/lib/actions/analytics` (`getKpiMinutos`, `getDynamicKpis`, `getDynamicChartSeries`)
- Lista de Leads: `src/app/dashboard/historial/page.tsx`
- Tabla fuente: `llamadas`; campo de origen en `lead.origen`

## Overview

- **Prioridad**: Alta.
- **Status**: 🔘 Pendiente.
- **Descripción**: (A) Verificar/cerrar que **toda** llamada se refleja en Métricas > Llamadas.
  (B) Asegurar que leads de voz aparecen en Lista de Leads con `origen='llamada_voz'`.
  (C) Añadir **2 columnas** a Lista de Leads: "Whats" y "Voz" (verde=usó canal / rojo=no).

## Key Insights

- El dashboard de Llamadas ya existe y consume `llamadas` vía analytics. El trabajo es **verificación**
  (que no haya llamadas que no lleguen a la tabla por falta de metadata) + cierre de gaps detectados.
- Los flags Whats/Voz se calculan **on-read** (EXISTS), no se persisten (fase 01 dejó la query lista).
- ⚠️ **CORRECCIÓN tras review (PHASE04-004)**: la lista de leads la renderiza `HistorialTable` (`use client`)
  alimentada por la server action **`fetchCalls`** (`src/lib/actions/calls.ts`). Los flags deben calcularse en
  **`fetchCalls` (server)** y viajar en `HistorialRow` — NO en cliente. `fetchCalls` hoy NO trae
  `conversaciones_whatsapp` ni los flags; hay que extender su SELECT/joins.
- ⚠️ **CORRECCIÓN tras review (PHASE04-002)**: el dashboard de Llamadas cuenta TODAS las filas de `llamadas`
  sin discriminar canal/origen — incluye datos de demo/seed (`tipo_agente=NULL`). La "verificación de cobertura"
  debe auditar qué `tipo_agente` existen y si hay que filtrar seed antes de dar los KPIs por buenos.

## Requirements

**Funcionales**

- KPIs de Llamadas (total llamadas, contactadas, minutos, duración media, tasa agenda/conversión)
  cuadran con los datos reales de `llamadas` para el tenant.
- Lista de Leads incluye los leads entrados por voz (`origen='llamada_voz'`).
- Lista de Leads muestra columna **"Whats"**: badge verde si `tiene_whatsapp`, rojo si no.
- Lista de Leads muestra columna **"Voz"**: badge verde si `tiene_voz`, rojo si no.

**No funcionales**

- Las 2 columnas no degradan el rendimiento de la lista (consulta de flags en bloque, no N+1).
- RLS por tenant en todas las consultas.

## Architecture

```
Métricas > Llamadas (minutos/page.tsx)
  └─ analytics(getKpiMinutos/getDynamicKpis) ← tabla `llamadas` (verificar cobertura)

Lista de Leads (historial/page.tsx)
  ├─ leads del tenant (incluye origen='llamada_voz')
  └─ flags por lead (1 query agregada):
       tiene_whatsapp = EXISTS(chat_messages whatsapp del lead)
       tiene_voz       = EXISTS(llamadas del lead)
     → columnas "Whats" (🟢/🔴) y "Voz" (🟢/🔴)
```

## Related Code Files

**Modificar**

- `src/components/historial/HistorialTable.tsx` (`use client`) — añadir columnas "Whats" y "Voz" con badge verde/rojo.
- `src/lib/actions/calls.ts` (`fetchCalls`) — extender `HistorialRow` con `tiene_whatsapp`/`tiene_voz` (boolean)
  vía EXISTS/joins agregados (server-side, evitar N+1). `src/types/database.ts` — extender el tipo `HistorialRow`.
- `src/lib/actions/analytics/*` — solo si la verificación detecta gaps (p.ej. estados de llamada no contados,
  o filtrar `tipo_agente` seed para no inflar KPIs — ver PHASE04-002).
- (opción) `src/lib/constants/kpi-defaults.ts` — solo si falta algún KPI de cobertura.

**Crear (si aplica)**

- `src/components/leads/channel-badge.tsx` — badge reutilizable verde/rojo (true/false), <60 líneas.

## Implementation Steps

1. **Verificación dashboard Llamadas**: comparar conteos de `minutos/page.tsx` con `SELECT count(*) FROM llamadas`
   por tenant. Detectar si hay estados/llamadas no reflejados. Cerrar gaps mínimos en analytics si los hay.
2. **Origen voz en Lista de Leads**: confirmar que leads con `origen='llamada_voz'` (normalizados en fase 01)
   aparecen en `historial`. Ajustar filtro/orden si los excluye.
3. **Query de flags**: en la action de la lista, añadir por cada lead `tiene_whatsapp`/`tiene_voz`
   con una sola consulta agregada (evitar N+1).
4. **Columnas UI**: crear `channel-badge.tsx` (verde=true, rojo=false) y añadir columnas "Whats" y "Voz"
   a la tabla de `historial/page.tsx`.
5. Probar con datos reales (leads con solo whatsapp, solo voz, ambos, ninguno).

## Todo List

- [ ] Verificar cobertura de `llamadas` en dashboard Llamadas; cerrar gaps.
- [ ] Confirmar leads `origen='llamada_voz'` visibles en Lista de Leads.
- [ ] Query agregada de flags `tiene_whatsapp`/`tiene_voz`.
- [ ] `channel-badge.tsx` (verde/rojo).
- [ ] Columnas "Whats" y "Voz" en `historial/page.tsx`.
- [ ] Test con los 4 casos (whats/voz/ambos/ninguno).

## Success Criteria

- KPIs de Llamadas cuadran con `llamadas` reales del tenant.
- Lista de Leads muestra leads de voz y las 2 columnas con color correcto en los 4 casos.
- Sin N+1 ni degradación perceptible de la lista.

## Risk Assessment

- **Discriminación whatsapp vs voz en `chat_messages`**: heredada de fase 01. Para "Voz" usar `llamadas`
  (verdad inequívoca); para "Whats" usar mensajes no-voz. Validar con datos reales.
- **Rendimiento**: con 50+ leads, la query de flags debe ser agregada. Mitigación: `left join lateral`/`EXISTS` en una query.

## Security Considerations

- Todas las consultas filtran por `tenant_id` (RLS + filtro explícito).

## Next Steps

- Fase 05 cubre E2C de estas pantallas + cierre del sprint.
