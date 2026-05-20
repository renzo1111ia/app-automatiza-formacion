# Phase 04 — Refactor Queries Existentes

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.4 (tareas 2-19..2-21)
- Plan RLS phase-06: `plans/20260519-1200-rls-multitenant-hardening/phase-06-webhooks-workers.md` — cubre 2-21 (worker/webhooks). REFERENCIAR steps de allí.
- Plan RLS phase-04: `plans/20260519-1200-rls-multitenant-hardening/phase-04-refactor-clientes-supabase.md` — contexto queries API routes

> **Solape con plan RLS:** `phase-06` del plan RLS cubre el refactor de workers y webhooks (2-21). Esta fase referencia esos steps y añade el refactor de API routes (2-19) y server actions (2-20).

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere Fase 2 (repositorios) completa
- **Descripción:** Mover todas las queries inline de API routes y server actions a sus repositorios correspondientes. Los API routes y actions deben ser thin: validar input con Zod → llamar repository → retornar response. Paralelizable con Fase 05 (archivos distintos).

## Key Insights

- Sprint 0 identificó 9 fallbacks `service_role` en `src/lib/actions/` — 2-20 debe eliminarlos todos
- 2-21 es continuación de 1-01 (refactor worker queries) — verificar qué quedó pendiente de Sprint 0
- El patrón objetivo: API route / server action NO contiene SQL ni lógica de supabase — solo llama al repository
- 2-19, 2-20, 2-21 son paralelizables entre sí (tocan archivos distintos)

## Requirements

**Funcionales:**
- 0 queries `supabase.from('...')` inline en `src/app/api/**/*.ts`
- 0 queries inline en `src/lib/actions/**/*.ts`
- 0 queries inline en `worker.js` o procesadores BullMQ (excepto donde técnicamente necesario)

**No-funcionales:**
- Cada API route / action: máx 30 líneas de lógica (el resto es validación + repository call)
- Preservar contratos de API existentes (no cambiar response shape)

## Architecture

```
Antes (inline queries):
  src/app/api/leads/route.ts
    → supabase.from('leads').select('*').eq('tenant_id', tid)

Después (repository):
  src/app/api/leads/route.ts
    → validate input (Zod)
    → leadsRepository.findByTenant(tenantId, filters)
    → return NextResponse.json(data)

Mismo patrón para server actions y workers.
```

## Related Code Files

**Modificar:**
- `src/app/api/**/*.ts` — 2-19: extraer queries a repositories
- `src/lib/actions/**/*.ts` — 2-20: extraer queries a repositories, eliminar service_role
- `worker.js` y `src/lib/processors/**/*.ts` — 2-21: ver phase-06 del plan RLS

**Leer para contexto:**
- `plans/20260519-1200-rls-multitenant-hardening/phase-06-webhooks-workers.md`
- Repositorios creados en Fase 03

## Implementation Steps

1. **2-19 — Refactor src/app/api/ (8h)**
   - Inventariar todos los archivos `route.ts` con queries inline
   - Para cada route: identificar repository correspondiente → extraer query → usar repository
   - Verificar que cada route sigue validando tenant_id del JWT (no confiar en body/query param)
   - `npm run typecheck` tras cada archivo

2. **2-20 — Refactor src/lib/actions/ (6h)**
   - Prioridad: actions con `service_role` hardcodeado — eliminar primero
   - Patrón: `export async function createLead(data) { validate(data, CreateLeadSchema); return leadsRepository.create(data); }`
   - Los 9 fallbacks service_role identificados deben quedar en 0
   - Test manual de cada action migrada (probar desde UI si aplica)

3. **2-21 — Refactor worker.js + processors (4h)**
   - Ver steps en `plans/20260519-1200-rls-multitenant-hardening/phase-06-webhooks-workers.md`
   - Verificar qué quedó pendiente de 1-01 (Sprint 0)
   - Workers BullMQ deben usar supabase-ssr con service client server-side (tienen acceso legítimo a service_role en contexto de background job — documentar excepción si aplica)

## Todo List

- [ ] 2-19: Inventario de API routes con queries inline
- [ ] 2-19: Refactor src/app/api/ → repositories
- [ ] 2-20: Identificar y eliminar los 9 service_role fallbacks en actions/
- [ ] 2-20: Refactor src/lib/actions/ → repositories
- [ ] 2-21: Revisar pendientes de 1-01 en worker.js
- [ ] 2-21: Refactor worker.js + processors → repositories
- [ ] npm run typecheck sin errores
- [ ] Test manual de endpoints principales post-refactor

## Success Criteria

- `grep -r "supabase.from(" src/app/api/ src/lib/actions/` retorna 0 resultados
- `grep -r "service_role" src/lib/actions/` retorna 0 resultados
- Build success sin errores
- Endpoints principales responden correctamente en dev (verificar con curl o UI)

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Action migrada pierde validación previa | Media | Alto | Revisar cada action: ¿había validación inline? Si sí → mover validación Zod explícita |
| Worker BullMQ necesita service_role para ops admin | Media | Medio | Documentar excepción en comentario; no es un finding si el contexto es background job legítimo |
| Response shape cambia y rompe frontend | Baja | Alto | Comparar response antes/después; usar `JSON.stringify` para diff en test |

## Security Considerations

- Los API routes deben extraer `tenant_id` del JWT (sesión), no del request body
- Si un action necesita service_role es señal de que falta RLS en la tabla — reportar como finding
- Workers: si usan service_role, deben ser llamados por job scheduler interno, no por endpoint público

## Agente Esden

- **Responsable:** `af-agents:code` (2-19 y 2-20) + `af-agents:database` (2-21)
- **Revisión:** `af-agents:security`

## Next Steps

- Paralelizable con Fase 4 (type safety) — tocan archivos distintos
- Fase 7 (testing) verifica los endpoints refactorizados
