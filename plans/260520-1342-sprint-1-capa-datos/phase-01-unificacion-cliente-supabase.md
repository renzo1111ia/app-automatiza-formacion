# Phase 01 — Unificación cliente Supabase

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.1 (tareas 2-01..2-03)
- Plan RLS phase-04: `plans/20260519-1200-rls-multitenant-hardening/phase-04-refactor-clientes-supabase.md` (solapado — ver abajo)
- ADR: `plans/reports/adr-auditoria-dependencias-20260520.md` §Sprint 1 (supabase/ssr upgrade)
- Stack doc: `docs/audit/STACK-TECNOLOGICO.md`

> **Solape con plan RLS:** `phase-04-refactor-clientes-supabase.md` del plan RLS cubre el mismo refactor. Los steps de implementación están allí. Esta fase los REFERENCIA y añade el upgrade de versión, NO los duplica.

## Overview

- **Prioridad:** P1 — bloqueante para 2.3 (Repository pattern)
- **Estado:** Pendiente
- **Descripción:** Inventariar y eliminar todos los clientes directos `pg`/`postgres` de `src/` (excepto scripts admin/seed). Migrar a `@supabase/ssr` como cliente único. Eliminar JWTs `service_role` residuales. Upgrade conjunto `@supabase/ssr@0.10.3` + `@supabase/supabase-js@2.106.1`.

## Key Insights

- El audit detectó 9 fallbacks `service_role` en `src/lib/actions/` — origen de 4 vulnerabilidades RLS activas
- `@supabase/ssr` debe subir de `0.8.0` → `0.10.3` junto con `supabase-js` `2.97.0` → `2.106.1` (peer dep strict — NO hacer uno sin el otro)
- `pg`/`postgres` deben quedar SOLO en scripts admin (`scripts/`, `supabase/seed*`, `worker.js` server-side donde aplique)
- Cambios en cookie storage API entre `@supabase/ssr` 0.8 → 0.10: revisar `createServerClient` y helpers de cookie

## Requirements

**Funcionales:**
- Inventario completo de imports `pg`/`postgres`/`postgres-js` en `src/`
- 0 usos directos de cliente `pg`/`postgres` en `src/app/api/**` y `src/lib/actions/**`
- 0 JWTs `service_role` fuera de scripts admin

**No-funcionales:**
- Auth flows (login, session refresh, middleware) deben seguir funcionando tras upgrade
- Sin regresiones en queries existentes

## Architecture

```
Antes:
  src/lib/actions/*.ts → pg/postgres directo → PostgreSQL
  src/app/api/**/*.ts  → pg/postgres directo → PostgreSQL
  worker.js            → pg/postgres directo → PostgreSQL

Después:
  src/lib/actions/*.ts → @supabase/ssr (createServerClient) → PostgreSQL/RLS
  src/app/api/**/*.ts  → @supabase/ssr (createServerClient) → PostgreSQL/RLS
  worker.js            → @supabase/ssr (createServerClient, server-side) → PostgreSQL/RLS
  scripts/admin/*.ts   → pg/postgres (permitido, sin RLS)
```

## Related Code Files

**Modificar:**
- `package.json` — upgrade `@supabase/ssr` + `@supabase/supabase-js`
- `src/lib/supabase/` — revisar helpers `createServerClient`, cookie adapters
- `src/lib/actions/*.ts` — eliminar imports directos pg/postgres
- `src/app/api/**/*.ts` — eliminar imports directos pg/postgres

**Leer para contexto:**
- `plans/20260519-1200-rls-multitenant-hardening/phase-04-refactor-clientes-supabase.md`

## Implementation Steps

1. **2-01 — Auditoría de clientes directos (4h)**
   - `grep -r "from 'pg'" src/ --include="*.ts"` + `from 'postgres'`
   - Inventariar: archivo, línea, tipo de query, si tiene tenant filter
   - Clasificar: migrar → supabase-ssr / mantener → admin script
   - Entregable: lista en comentario de tarea

2. **Upgrade conjunto supabase (incluido en 2-02, ~2h)**
   - `npm install @supabase/ssr@0.10.3 @supabase/supabase-js@2.106.1`
   - Pasar por ADR (es minor, no breaking, pero requiere registro)
   - Revisar changelog ssr 0.8→0.10: cambios en `CookieOptions` y `createServerClient`
   - Actualizar helpers en `src/lib/supabase/` si la API de cookies cambió
   - `npm run typecheck` — verificar sin errores de tipos

3. **2-02 — Refactor queries a supabase-ssr (12h)**
   - Ver steps detallados en `plans/20260519-1200-rls-multitenant-hardening/phase-04-refactor-clientes-supabase.md`
   - Orden: primero `src/lib/actions/` (alto riesgo) → luego `src/app/api/`
   - Cada migración: test manual del endpoint afectado antes de continuar

4. **2-03 — Eliminar service_role residuales (3h)**
   - `grep -r "service_role" src/ --include="*.ts"`
   - Para cada uso: ¿es necesario? Si sí → mover a admin script / Si no → eliminar
   - Verificar que NO queda ningún `supabase.auth.admin` o `createClient(url, SERVICE_KEY)` en `src/`
   - Continuación directa de 1-04 (Sprint 0)

## Todo List

- [ ] 2-01: Inventario completo pg/postgres en src/ — lista de archivos afectados
- [ ] Upgrade @supabase/ssr@0.10.3 + supabase-js@2.106.1 (ADR previo)
- [ ] Verificar cambios API cookie en ssr 0.8→0.10, actualizar helpers
- [ ] 2-02: Refactor queries src/lib/actions/ → supabase-ssr
- [ ] 2-02: Refactor queries src/app/api/ → supabase-ssr
- [ ] 2-03: Eliminar todos los JWT service_role de src/
- [ ] npm run typecheck sin errores tras cada cambio
- [ ] Test auth flow completo (login → session → refresh → logout)

## Success Criteria

- `grep -r "from 'pg'" src/` retorna 0 resultados en `src/app/api/` y `src/lib/actions/`
- `grep -r "service_role" src/` retorna 0 resultados fuera de `scripts/` y `supabase/`
- `npm run typecheck` y `npm run build` sin errores
- Login y session refresh funcionan en navegador local

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Upgrade ssr rompe cookie middleware | Media | Alto | Test auth flows en preview antes de merge; leer changelog detallado |
| Query migrada pierde tenant filter | Alta | Crítico | Revisar cada query: debe tener `.eq('tenant_id', tenantId)` o RLS activa |
| worker.js usa pg para features específicas | Baja | Medio | Mantener pg en worker solo si hay razón técnica; documentar excepción |

## Security Considerations

- Toda query en `src/` debe usar `createServerClient` con cookies de sesión (no service_role)
- RLS de Supabase filtra por tenant automáticamente si el JWT del usuario está en la sesión
- Eliminar service_role de src/ cierra las 4 vulnerabilidades detectadas en audit

## Agente Esden

- **Responsable:** `af-agents:database`
- **Revisión:** `af-agents:security` (verificar 0 service_role residuales)

## Next Steps

- Fase 1 (Zod) puede empezar en paralelo desde día 1
- Fase 2 (Repository pattern) requiere esta fase completa
- Fase 6 (RLS hardening) puede empezar en paralelo (tablas diferentes)
