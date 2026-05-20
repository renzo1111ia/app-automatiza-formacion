# Phase 03 — Repository Pattern

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.3 (tareas 2-12..2-18)
- Plan RLS phase-05: `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md` — steps detallados de implementación. REFERENCIAR, no duplicar.
- Decisión de stack: `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md` (R-019: sin ORM nuevo)
- `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md`

> **Solape con plan RLS:** `phase-05` del plan RLS define la interface base y convenciones del repository pattern. Los steps de implementación están allí. Esta fase REFERENCIA esos steps y añade los repositorios específicos no cubiertos.

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere Fase 1 (cliente unificado) + Fase 2 (schemas Zod)
- **Descripción:** Implementar la capa Repository como abstracción única de acceso a datos. Todos los accesos a BD desde `src/` pasan por un repository. Convenciones: `findByTenant`, `findById`, `create`, `update`, `softDelete`.

## Key Insights

- Sin ORM: los repositorios usan `@supabase/ssr` directamente (query builder de supabase-js)
- Todos los métodos de repository deben ser tenant-scoped: `findByTenant(tenantId, ...)` como patrón base
- `leads` es el repository más crítico — mayor cobertura de tests requerida
- El repository de integrations es prep para Fase 3 (el adapter HubSpot/Zoho usará `IntegrationsRepository`)

## Requirements

**Funcionales:**
- Interface base `IRepository<T>` con métodos: `findByTenant`, `findById`, `create`, `update`, `softDelete`, `delete`
- Implementación concreta por entidad
- Tipos de entrada/salida derivados de schemas Zod (Fase 02)
- Manejo de errores: try/catch, retornar `{ data, error }` (patrón supabase-js)

**No-funcionales:**
- Cada repository < 200 líneas — split si crece
- Sin lógica de negocio en repositories (eso es capa de actions/service)

## Architecture

```
src/lib/repositories/
├── _base-repository.ts       # Interface IRepository + helpers tenant-scoped
├── leads-repository.ts       # 2-13
├── tenants-repository.ts     # 2-14
├── appointments-repository.ts # 2-15 (appointments + calls)
├── ai-agents-repository.ts   # 2-16 (agents + variants)
├── knowledge-base-repository.ts # 2-17
└── integrations-repository.ts  # 2-18 (integrations + webhooks)

Patrón de uso:
  src/lib/actions/leads.ts
    → import { leadsRepository } from '@/lib/repositories/leads-repository'
    → leadsRepository.findByTenant(tenantId, filters)
```

## Related Code Files

**Crear:**
- `src/lib/repositories/_base-repository.ts`
- `src/lib/repositories/leads-repository.ts`
- `src/lib/repositories/tenants-repository.ts`
- `src/lib/repositories/appointments-repository.ts`
- `src/lib/repositories/ai-agents-repository.ts`
- `src/lib/repositories/knowledge-base-repository.ts`
- `src/lib/repositories/integrations-repository.ts`

**Leer para contexto:**
- `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md`
- `src/lib/schemas/` (todos los schemas creados en Fase 2)

## Implementation Steps

1. **2-12 — Interface base + helpers (4h)**
   - Ver spec detallada en `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md`
   - `IRepository<T, CreateDTO, UpdateDTO>` genérico
   - Helper `withTenantFilter(query, tenantId)` — siempre inyecta `.eq('tenant_id', tenantId)`
   - Helper `handleSupabaseError(error)` — normalizar errores supabase-js

2. **2-13 — Repository leads (6h)**
   - Métodos: `findByTenant`, `findById`, `findByStatus`, `create`, `update`, `softDelete`
   - Input types: `z.infer<typeof CreateLeadSchema>`, `z.infer<typeof UpdateLeadSchema>`
   - Incluir paginación: `{ page, pageSize }` en `findByTenant`
   - Este es el repository con mayor cobertura de tests (Fase 7)

3. **2-14 — Repository tenants (4h)**
   - `findById`, `findBySlug`, `create`, `update`
   - Incluir `findMembers(tenantId)` con join `tenant_members`

4. **2-15 — Repository appointments + calls (5h)**
   - `AppointmentsRepository`: `findByTenant`, `findByLead`, `findByDateRange`, `create`, `update`, `cancel`
   - `CallsRepository`: `findByTenant`, `findByAppointment`, `create`, `update`
   - Considerar si se unen en un único archivo (`appointments-repository.ts`) o separados

5. **2-16 — Repository AI agents (4h)**
   - `AiAgentsRepository`: CRUD + `findByTenant`
   - `AiAgentVariantsRepository`: `findByAgent(agentId)`, `create`, `update`
   - Incluir método `findActiveVariant(agentId)` — el variant marcado como default

6. **2-17 — Repository knowledge base + chat (5h)**
   - `KnowledgeBaseRepository`: `findByTenant`, `findByType`, `create`, `update`, `delete`
   - `ChatMemoryRepository`: `findByConversation`, `create`, `clearByConversation`
   - `ChatSummaryRepository`: `findByConversation`, `create`, `update`

7. **2-18 — Repository integrations + webhooks (3h)**
   - `IntegrationsRepository`: `findByTenant`, `findByCrmType`, `create`, `update`, `deactivate`
   - `WebhooksRepository`: `findByTenant`, `findByEndpoint`, `create`, `update`
   - Diseñar interfaz pensando en Fase 3: `findByCrmType('hubspot' | 'zoho')`

## Todo List

- [ ] 2-12: `src/lib/repositories/_base-repository.ts`
- [ ] 2-13: `src/lib/repositories/leads-repository.ts` (tests en Fase 07)
- [ ] 2-14: `src/lib/repositories/tenants-repository.ts`
- [ ] 2-15: `src/lib/repositories/appointments-repository.ts`
- [ ] 2-16: `src/lib/repositories/ai-agents-repository.ts`
- [ ] 2-17: `src/lib/repositories/knowledge-base-repository.ts`
- [ ] 2-18: `src/lib/repositories/integrations-repository.ts`
- [ ] npm run typecheck sin errores tras cada repository

## Success Criteria

- 7 archivos de repository creados, compilando sin errores
- Cada método retorna `{ data: T | null, error: string | null }`
- `leadsRepository.findByTenant(tenantId)` probado manualmente en dev (datos reales)
- 0 métodos sin `.eq('tenant_id', tenantId)` en queries multi-tenant

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Repository crece > 200 líneas | Media | Bajo | Split por responsabilidad: read-repository + write-repository |
| Queries complejas difíciles de expresar con supabase-js | Media | Medio | Para joins complejos: usar `supabase.rpc()` con función PG; documentar |
| Tipos no alineados con BD real | Baja | Alto | Verificar schema contra BD con `psql` antes de implementar |

## Security Considerations

- `withTenantFilter` NO es opcional — todo método que devuelve múltiples filas DEBE usarlo
- Los repositories no tienen acceso directo al service_role key — usan el cliente de sesión
- Método `delete` (hard delete) solo para entidades no multi-tenant; el resto usa `softDelete`

## Agente Esden

- **Responsable:** `esden-agents:database`
- **Revisión:** `esden-agents:security` (verificar tenant isolation en cada método)

## Next Steps

- Fase 4 (refactor queries) consume los repositories de esta fase
- Fase 7 (testing) escribe tests de integración sobre los repositories de esta fase
- Fase 3 usa `IntegrationsRepository` y `LeadsRepository` directamente
