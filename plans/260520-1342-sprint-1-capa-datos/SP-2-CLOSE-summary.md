# Sprint 1 — Cierre (SP-2-CLOSE) · v0.2.0

- **Fecha cierre:** 22-05-2026
- **Branch:** `feature/sprint-01-capa-datos` (pendiente promoción a `developer` por orden explícita)
- **Devs activos:** Javi HP (orquestador AI)
- **Estim original:** ~179h con paralelismo. **Real efectivo:** ~12h (1 sesión intensiva de orquestación)

## Tareas cerradas (🟢)

### Bloque 2.1 — Unificación cliente Supabase

- **2-01** Audit pg/postgres/service_role — reporte `plans/reports/sp-2-01-audit-clients-supabase-20260522.md`
- **2-02.a** Upgrade `@supabase/ssr 0.10.3` + `@supabase/supabase-js 2.106.1` (ADR-016)
- **2-02.b** Refactor DI services parcial: `chat-memory.ts`, `appointment-service.ts`, `ai-analysis.ts` → `getAdminSupabaseClient()` centralizado
- **2-03** Cleanup service_role en services/ (3 cleanups). Resto en `cron/`, `webhooks/`, `processors/`, `whatsapp.ts` diferido a Bloque 2.4

### Bloque 2.2 — Schemas Zod

- **2-04..2-11** + **2-35**: 8 schemas + barrel index en `src/lib/schemas/`
- Cubre: leads, tenants, programs, appointments, ai-agents (con whitelist `ModelNameSchema`), knowledge-base, integrations, opportunities
- Nomenclatura validada contra VARIABLES DEFINIDAS (0 discrepancias)
- Whitelist modelos LLM enforced en `saveAgentVariant` Server Action
- Parche `gpt-4.1 → gpt-4o` eliminado de widget.ts (openai SDK 6.33 ya lo soporta)
- Migración SQL `20260522210000` normaliza valores legacy

### Bloque 2.3 — Repository pattern

- **2-12..2-18**: 7 repositorios + barrel en `src/lib/repositories/`
- Patrón `IRepository<T,Create,Update>` + `RepoResult<T>` + `withTenantFilter` + `paginate` + `handleSupabaseError`
- Repos: leads, tenants, appointments (+ calls + attempts), ai-agents (+ variants + voice), knowledge-base (+ embeddings + chat-messages), integrations (+ field-mapping + write-audit + webhooks), **lead-opportunities** (con `createWithDedup`)

### Bloque 2.6 — RLS hardening + cifrado AES-256

- **2-23** RLS hardening `ai_agents` + `ai_agent_variants` (F-04-005)
- **2-24** RLS hardening `web_widgets` (F-04-006)
- **2-25** RLS hardening `programas` (F-04-008)
- **2-26** Cifrado AES-256-GCM tokens OAuth (ADR-017) — `src/lib/crypto/token-crypto.ts` + tabla `integrations` con `credentials_cipher` + `ENCRYPTION_KEY` env

### Bloque 2.7 — Testing

- **2-28** parcial: Vitest configurado + 58 unit tests pasando + 4 integration skip-by-env
- Cobertura: schemas (35), crypto (8), logger (4), base-repository (11), lead-opportunities (4 integration)

### Bloque 2.8 — Hook automation + hardening deps

- **2-30** Hook `af-productivity-logger.cjs` (Path B híbrido) — emite `additionalContext` cuando se detectan cambios de estado en RoadMap.md. Spike: `plans/reports/spike-hook-postooluse-feasibility-20260522.md`
- **2-33** `@types/node@^20 → ^24.12.4` alineado con runtime Node 24
- **2-37** Logger estructurado `src/lib/utils/logger.ts` con scrubbing PII básico. Sustituye console.log en widget.ts

### Bloque 2.9 — Bugs Renzo V1 + Reqs Bea V1

- **NEW-01** paso 2: Fix `saveOrchestratorConfig` (commit `837e12f`)
- **NEW-02** Enum unificado `LeadStageEnum` con `UNREACHABLE` + refactor 6 ficheros literal → enum
- **NEW-06** Modelo oportunidades múltiples + dedup 48h (tabla `lead_opportunities`, repository, ingest integration)
- **NEW-13** Política unificada handoff humano (ADR-014, handoff.ts)

## Tareas diferidas (🟢 Diferida)

### A ADR-019 (migración incremental queries + as any)

- **2-19** Refactor queries `src/app/api/` → repos (10 queries)
- **2-20** Refactor queries `src/lib/actions/` → repos (57 queries, incluye 2 service_role en `tenant.ts`)
- **2-21** Refactor `worker.js` + processors → repos
- **2-22** Limpieza 426 `as any` → `z.infer` (lint baseline 120 errores documentado)

### A ADR-018 (hardening deps post-MVP)

- **2-31** lucide-react 0.x → 1.x (riesgo regresión visual 80+ iconos)
- **2-32** shadcn 3.x → 4.x (requiere Tailwind 4, sprint propio v0.6.x)
- **2-34** eslint 9 → 10 (bloqueado por peer dep eslint-config-next)

### A Sprint Costes-LLM (decisión clienta 22-05-2026)

- **2-36** Persist `token_usage` en `chat_messages.metadata` — movida a `260522-1430-sprint-costes-llm-post-mvp`

### A Sprint v0.5.3 post-MVP

- **NEW-01 paso 3** Consolidación tablas orquestador (ADR-015)

### A SP-4B phase-02 (Renzo + tester)

- **SP-2-CLOSE-3** Test manual del dev (política sprint 22-05-2026)

## ADRs creados (Sprint 1)

| ADR | Tema                                                    |
| --- | ------------------------------------------------------- |
| 014 | Política unificada handoff humano (NEW-13)              |
| 015 | Orquestador doble personalidad + consolidación diferida |
| 016 | Upgrade Supabase ssr 0.10.3 + supabase-js 2.106.1       |
| 017 | Cifrado AES-256-GCM tokens OAuth                        |
| 018 | Hardening deps deferred post-MVP                        |
| 019 | Refactor queries + as any migración incremental         |

## Migraciones SQL aplicadas (local)

| Migración                                                 | Propósito                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `20260522200000_lead_unreachable_handoff_policy.sql`      | NEW-13 columnas unreachable_reason + contact_attempts (commit anterior) |
| `20260522210000_ai_agent_variants_model_name_cleanup.sql` | 2-35 normaliza model_name legacy                                        |
| `20260522220000_rls_ai_agents_hardening.sql`              | 2-23                                                                    |
| `20260522220001_rls_web_widgets_hardening.sql`            | 2-24                                                                    |
| `20260522220002_rls_programas_hardening.sql`              | 2-25                                                                    |
| `20260522220003_integrations_table.sql`                   | 2-26 tabla integrations + credentials_cipher + RLS + trigger updated_at |
| `20260522230000_lead_opportunities.sql`                   | NEW-06 tabla lead_opportunities + dedup 48h + backfill legacy           |

**A aplicar en VPS pre-deploy (SP-4B):** las 6 últimas (la primera ya aplicada en commit `d9545d9`).

## Validaciones SP-2-CLOSE-1

- ✅ `npm run typecheck` — OK, 0 errores
- ✅ `npm run lint` — 120 errores `no-explicit-any` preexistentes (baseline ADR-019), 0 nuevos
- ✅ `npm run build` — Compiled successfully 41 rutas
- ✅ `npm test` — 58/58 unit tests passing (+ 4 integration skipped sin env)
- ✅ Migraciones SQL aplicadas local OK
- ✅ Smoke test crypto: `scripts/test-crypto.ts` OK
- ✅ Smoke test hook: `af-productivity-logger.cjs` regex valida OK

## Commits del sprint (developer..HEAD)

```text
226be31 test(unit): Bloque 2.7 - Vitest setup + 58 unit tests + 4 integration skip-by-env
f490945 feat(logger): Bloque 2.4-2.5 partial - logger 2-37 + ADR-019 migración incremental
ccd6a50 refactor(services): 2-02.b + 2-03 DI cleanup
4c58c5b feat(opportunities): NEW-06 modelo oportunidades múltiples + dedup 48h
8c800fc feat(hooks): Bloque 2.8 - hook productivity-logger + types-node@24 + ADR-018
f11bebf feat(security): Bloque 2.6 RLS hardening + 2-26 cifrado AES-256-GCM
(commit Bloque 2.3 Repository pattern)
7b6d7af feat(enums): NEW-02 enum unificado estados lead/cualificacion + UNREACHABLE
9f1fbca fix(lint): destructured vars _ en saveAgentVariant
588a5e3 feat(schemas): Bloque 2.2 capa Zod + 2-35 whitelist modelos LLM
3c2dd77 feat(deps): 2-02.a upgrade Supabase ssr 0.10.3 + supabase-js 2.106.1
d9545d9 feat(handoff): NEW-13 política unificada handoff humano (Bea V1)
98b2c70 fix(lint): reposicionar eslint-disable en deepMerge tras reformat prettier
837e12f fix(orchestrator): NEW-01 fix saveOrchestratorConfig + audit 2-01
4b43b78 chore(sprint-1): kickoff Sprint 1
```

## Próximos pasos

1. **Usuario revisa** este resumen + `phase-02-validacion-sprint-1.md` cuando vuelva.
2. **Si OK:** abrir PR `feature/sprint-01-capa-datos → developer` (orden explícita del usuario).
3. **Tras merge developer:** bump SemVer a `v0.2.0`, crear rama `feature/sprint-02-adapter-hubspot-zoho`.
4. **SP-4B phase-02** ejecutable por Renzo + tester con todo el material listo en `phase-02-validacion-sprint-1.md`.

## Hand-off a SP-4B

✅ `plans/260522-1700-sprint-validacion-pre-mvp/phase-02-validacion-sprint-1.md` rellenado:

- Comandos exactos de test automático
- Specs Playwright (vacío — E2E es alcance SP-4B)
- Migraciones SQL nuevas (6) a aplicar en VPS
- Checklist manual (9 puntos)
- BUG-XXX placeholder
- Variables de entorno nuevas: **`ENCRYPTION_KEY`** (CRÍTICA — generar y guardar en gestor de secretos)
- Notas de despliegue documentadas
