# Phase 07 — Testing y Documentación

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.7 (tareas 2-28, 2-29)
- Plan RLS phase-07: `plans/20260519-1200-rls-multitenant-hardening/phase-07-tests-anti-fuga.md` — tests anti-fuga RLS. COMPLEMENTAR, no duplicar.
- Plan RLS phase-08: `plans/20260519-1200-rls-multitenant-hardening/phase-08-performance-docs-rollout.md` — docs y rollout.
- Cierre sprint: `plans/RoadMap.md` §SP-2-CLOSE-1..5

> **Solape con plan RLS:** `phase-07` del plan RLS define los tests anti-fuga de RLS (tenant isolation). Esta fase los INCORPORA como parte de la suite de integración y añade los tests de repositorios. `phase-08` del plan RLS cubre la documentación de arquitectura — coordinar con 2-29.

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere Fases 1-6 completadas (al menos Fases 1-4 para tests de repositorios)
- **Descripción:** Tests de integración con BD real para los repositorios principales. Documentación de la capa de datos. Cierre del sprint con autotest completo. NO usar mocks de Supabase ni de la cadena RLS (regla CLAUDE.md).

## Key Insights

- Tests con BD REAL: las reglas del proyecto prohíben mocks de Supabase o RLS — los tests deben conectar a una BD de test real
- **BD de tests: Supabase CLI + Docker local** — cada dev levanta su propia instancia aislada con `supabase start`. NO se usan instancias compartidas (Easypanel test, staging) para tests de integración. BD completamente reproducible y sin interferencia entre devs.
- `leadsRepository` es el más crítico — mayor cobertura requerida
- Los tests anti-fuga de RLS están spec en `phase-07-tests-anti-fuga.md` del plan RLS — ejecutarlos aquí, no reimplementarlos
- 2-29 (docs) debe coordinarse con `phase-08` del plan RLS para evitar duplicación en `docs/architecture/data-layer.md`
- La configuración de Supabase local (supabase/config.toml, variables de entorno) se documenta en `docs/architecture/data-layer.md` (2-29) para que nuevos devs puedan onboardear sin fricción

## Requirements

**Funcionales (2-28):**
- Tests de integración para: `leadsRepository`, `tenantsRepository`, `appointmentsRepository`
- Tests anti-fuga: query con JWT tenant B → 0 filas de tenant A (todos los repositorios)
- Suite ejecutable con `npm test` o script dedicado

**Funcionales (2-29):**
- `docs/architecture/data-layer.md` actualizado con: stack decisión, estructura de repositories, schemas Zod, convenciones de naming, ejemplos de uso

**No-funcionales:**
- Tests sin mocks de BD — conexión real a instancia Supabase local (Docker)
- Stack test: **Supabase CLI (`supabase start`)** + Docker Desktop — cada dev corre su BD local aislada
- Documentación < 200 líneas (si crece, split en subsecciones)

## Architecture

```
Tests (2-28):
  src/__tests__/integration/
  ├── repositories/
  │   ├── leads-repository.test.ts    ← mayor cobertura
  │   ├── tenants-repository.test.ts
  │   └── appointments-repository.test.ts
  └── rls/
      ├── tenant-isolation.test.ts    ← anti-fuga (spec en plan RLS phase-07)
      └── rls-policies.test.ts        ← verifica políticas 2-23..2-25

Docs (2-29):
  docs/architecture/data-layer.md    ← refresh completo
```

## Related Code Files

**Crear:**
- `src/__tests__/integration/repositories/leads-repository.test.ts`
- `src/__tests__/integration/repositories/tenants-repository.test.ts`
- `src/__tests__/integration/repositories/appointments-repository.test.ts`
- `src/__tests__/integration/rls/tenant-isolation.test.ts`

**Modificar:**
- `docs/architecture/data-layer.md` — refresh completo

**Leer para contexto:**
- `plans/20260519-1200-rls-multitenant-hardening/phase-07-tests-anti-fuga.md`
- `plans/20260519-1200-rls-multitenant-hardening/phase-08-performance-docs-rollout.md`

## Implementation Steps

1. **Setup test environment (1h) — incluye kickoff 2-28**
   - Instalar prerrequisitos si no presentes: **Supabase CLI** (`npm install -g supabase` o binario oficial) + **Docker Desktop**
   - Levantar instancia local: `supabase start` desde la raíz del proyecto (usa `supabase/config.toml`)
   - Verificar que el dashboard local responde en `http://localhost:54323`
   - Configurar `.env.test` con `SUPABASE_TEST_URL=http://localhost:54321` y las keys locales que imprime `supabase start`
   - Test de conexión básico antes de implementar tests reales
   - Seed mínimo: 2 tenants, 5 leads por tenant, 1 admin por tenant
   - **Cada dev tiene su propia BD aislada** — `supabase start` es idempotente y no afecta a otros devs ni a producción

2. **2-28 — Tests repositorios (11h)**
   - `leadsRepository.test.ts` (4h):
     - `findByTenant`: retorna solo leads del tenant correcto
     - `findById`: retorna null si lead es de otro tenant
     - `create`: crea lead con tenant_id correcto
     - `update`: no puede actualizar lead de otro tenant
     - `softDelete`: marca como deleted, no devuelve en findByTenant
   - `tenantsRepository.test.ts` (3h):
     - CRUD básico
     - `findMembers`: retorna solo miembros del tenant
   - `appointmentsRepository.test.ts` (4h):
     - `findByLead`: solo appointments del lead correcto
     - `cancel`: cambia estado correctamente

3. **Tests anti-fuga RLS (ver plan RLS phase-07) (incluido en 2-28)**
   - Implementar tests del spec `plans/20260519-1200-rls-multitenant-hardening/phase-07-tests-anti-fuga.md`
   - `tenant-isolation.test.ts`: con JWT de tenant B, ningún repository retorna datos de tenant A
   - `rls-policies.test.ts`: verificar fixes 2-23 (ai_agents), 2-24 (web_widgets), 2-25 (programs)
   - **Importante:** estos tests se ejecutan contra la instancia Supabase local (`supabase start`), NO contra producción ni staging

4. **SP-2-CLOSE-1 — Autotest completo (1h 30min)**
   - `npm run typecheck` — 0 errores
   - `npm run lint` — 0 errores
   - `npm run build` — success
   - Tests de integración — todos pass

5. **SP-2-CLOSE-2 — E2E local + WCAG (2h 30min)**
   - Playwright: flujos principales (login → leads → crear lead → ver detalle)
   - WCAG 2.2 AA: revisar accesibilidad de páginas afectadas por Sprint 1
   - Solo si hay cambios UI visible (refactors del backend no requieren tests visuales pesados)

6. **2-29 — Documentación data layer (4h)**
   - `docs/architecture/data-layer.md` refresh:
     - Stack y decisión (sin ORM, @supabase/ssr + Zod + Repository)
     - Diagrama de capas (texto ASCII)
     - Estructura de directorios con descripción
     - Convenciones: naming, tenant isolation, error handling
     - Ejemplos de uso: cómo crear un lead desde un server action
     - **Sección "Entorno de tests local":** instrucciones para nuevos devs — instalar Supabase CLI + Docker Desktop, `supabase start`, configurar `.env.test`, ejecutar tests con `npm test`
   - Coordinar con `phase-08` del plan RLS para no duplicar sección RLS
   - Delegado a `af-agents:documentation`

7. **SP-2-CLOSE-3..5 — Cierre sprint**
   - SP-2-CLOSE-3: Test manual dev — verificar en navegador
   - SP-2-CLOSE-4: Corrección bugs detectados
   - SP-2-CLOSE-5: PR a `developer` + bump `v0.2.0` + crear rama Sprint 2

## Todo List

- [ ] Setup BD test + .env.test + seed mínimo
- [ ] leads-repository.test.ts (findByTenant, findById, create, update, softDelete)
- [ ] tenants-repository.test.ts (CRUD, findMembers)
- [ ] appointments-repository.test.ts (findByLead, cancel)
- [ ] tenant-isolation.test.ts (anti-fuga todos los repositorios)
- [ ] rls-policies.test.ts (verifica 2-23, 2-24, 2-25)
- [ ] SP-2-CLOSE-1: typecheck + lint + build + tests — todos pass
- [ ] SP-2-CLOSE-2: Playwright E2E + WCAG
- [ ] 2-29: docs/architecture/data-layer.md refresh
- [ ] SP-2-CLOSE-3: test manual dev
- [ ] SP-2-CLOSE-4: corrección bugs
- [ ] SP-2-CLOSE-5: PR developer + v0.2.0

## Success Criteria

- Todos los tests de integración pass con BD real (0 mocks)
- `tenant-isolation.test.ts` pass: 0 fugas entre tenants
- `npm run typecheck` + `npm run lint` + `npm run build` sin errores
- `docs/architecture/data-layer.md` actualizado y revisado
- PR a `developer` creada y aprobada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Docker Desktop no instalado en la máquina del dev | Baja | Bloqueante | Documentar en 2-29 como prerrequisito; incluir en onboarding `docs/architecture/data-layer.md` |
| `supabase start` falla por conflicto de puertos | Baja | Medio | Supabase CLI permite cambiar puertos en `supabase/config.toml`; documentar override |
| Seed de datos insuficiente para cubrir casos edge | Media | Medio | Diseñar seed con casos: lead sin tenant, tenant sin members, appointment cancelada |
| Test de fuga detecta vuln no corregida | Media | Alto | Prioridad inmediata — no mergear Sprint 1 hasta que todos los tests anti-fuga pasen |

## Security Considerations

- `.env.test` NUNCA en git — solo `.env.test.example` con placeholders
- La BD de test debe tener datos ficticios, nunca datos reales de clientes
- Tests deben limpiar sus datos creados (teardown) para no contaminar entre runs

## Agente Esden

- **Responsable:** `af-agents:testing` (2-28) + `af-agents:documentation` (2-29)
- **Revisión:** `af-agents:security` (tenant isolation tests)

## Next Steps

- Tests pass → PR a `developer`
- Bump a `v0.2.0`
- Crear rama `feature/sp-3-crm-adapters` para Sprint 2
- Notificar al manager: Sprint 1 cerrado
