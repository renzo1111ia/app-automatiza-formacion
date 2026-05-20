---
title: "RoadMap dashboard-af"
audience: equipo de desarrollo
status: LIVING_DOCUMENT
maintained_by: agente `roadmap-keeper` (proactivo) — orquestado por `af-agents:manager`
last_updated: 20-05-2026 14:00
last_updated_by: roadmap-keeper (Sprint 0: añadidas 1-25 1-26 desde ADR audit + Sprint 1: añadido bloque 2.8 hardening deps) + renombrado a sprints numéricos 20-05-2026
project_version: v0.0.0
excluded_from: [staging, main]
---

# RoadMap — dashboard-af

> ⚠️ **Documento vivo**. Mantenido proactivamente por el agente [`af-agents:roadmap-keeper`](../.claude/agents/roadmap-keeper.md). NO editar directamente sin orden del lead — pide al agente que lo haga.
>
> Cada tarea/fase/sprint tiene **estimación de tiempo** y **estado**. El agente actualiza el estado automáticamente cuando arranca o termina trabajo. Cualquier dev puede consultar aquí en qué fase va el proyecto.

---

## Leyenda de estados

| Icono | Estado                     | Significado                                                                           |
| ----- | -------------------------- | ------------------------------------------------------------------------------------- |
| 🔘     | **Pendiente**              | Aún no se ha empezado                                                                 |
| 🟡     | **En Desarrollo**          | Trabajo activo en curso (alguien está dándole, aunque sea en paralelo a otras tareas) |
| 🟠     | **P. Subir GH**            | Trabajo terminado localmente, falta hacer commit/push a su rama                       |
| 🔵     | **Subida rama `<nombre>`** | Ya pusheada a su `feature/*`, esperando PR / review / merge                           |
| 🟢     | **COMPLETADA**             | Mergeada a `developer`. Cierre de la tarea.                                           |

**Reglas operativas**:

1. Una tarea **NUNCA** pasa directamente de 🔘 Pendiente a 🟢 COMPLETADA. El agente fuerza la secuencia: 🔘 → 🟡 → 🟠 → 🔵 → 🟢.
2. **Antes de empezar** cualquier tarea (aunque vaya paralela a otras), el agente cambia su estado a 🟡 En Desarrollo y deja constancia con timestamp + dev asignado.
3. **Antes de cualquier commit/push**, el agente `git` verifica el estado de la tarea actual. Si no está en 🟡 o no existe en el roadmap, **se detiene** y reporta.
4. **Antes de cualquier deploy/PR**, el agente `deployment` verifica que las tareas asociadas están en 🔵 o 🟢. Si no, **se detiene** y reporta.
5. **Tras merge a `developer`**, el agente `roadmap-keeper` pasa a 🟢 COMPLETADA automáticamente (escucha del PostToolUse del git merge / hook al cerrar PR).

## Formato de estimaciones

- Duración: `2h 30min`, `45min`. Nunca decimales. Nunca fechas en celda de duración.
- Sumas: cada fase muestra su sumatorio, cada sprint el suyo, y el roadmap el total.
- Fechas (Inicio, Fin Est., Fin Real): formato `DD-MM-YYYY HH:MM`.

---

## Total del proyecto (estimado)

| Métrica                                  | Valor             |
| ---------------------------------------- | ----------------- |
| Fases                                    | 5 (1, 2, 3, 4, 5) |
| Sprints planificados                     | 5 (uno por fase)  |
| Tareas de cierre obligatorias por sprint | 5                 |
| **Estimación total MVP (Fases 1+2+3+4)** | ~9-12 semanas     |
| **Fase 4 (post-MVP)**                    | ~4-7 semanas      |
| **Versión objetivo MVP**                 | `v0.4.0`          |

---

## Fase 0 — Sprint 0: Hotfixes de seguridad

| Campo                          | Valor                             |
| ------------------------------ | --------------------------------- |
| **Sprint ID**                  | `SP-1`                            |
| **Versión objetivo al cierre** | `v0.1.0`                          |
| **Estado del sprint**          | 🔘 Pendiente                       |
| **Estimación total**           | 1-2 sem (40h–80h)                 |
| **Rama de trabajo sugerida**   | `feature/sp-0-sprint-0-hotfixes`  |
| **Inicio**                     | —                                 |
| **Fin Est.**                   | —                                 |
| **Fin Real**                   | —                                 |

### Tareas de desarrollo (Fase 0) — DETALLADAS

Origen: Top 25 Critical de [docs/audit/deep/DEEP-FINDINGS-SUMMARY.md](../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) + audit RLS multi-tenant. 22 tareas distribuidas en 4 bloques temáticos. Paralelismo posible entre bloques.

#### Bloque 1.1 — Orquestador BullMQ (bloqueante de cadencia)

| ID   | Tarea                                                                                  | Estimación | Estado      | Refs audit      | Notas                                                                |
| ---- | -------------------------------------------------------------------------------------- | ---------- | ----------- | --------------- | -------------------------------------------------------------------- |
| 1-01 | Fix `worker.js:58` firma incorrecta `executeSequenceStep` — desbloquea flujo multi-día | 4h         | 🔘 Pendiente | F-02-001 / DA-1 | **Crítico #1** — sin esto, el sistema entero está roto en producción |
| 1-02 | Fix `enqueueLeadStep` — quitar silenciado errores Redis (jobs perdidos sin log)        | 3h         | 🔘 Pendiente | DA-1-005        | Jobs desaparecen sin rastro                                          |

#### Bloque 1.2 — Secretos y credenciales

| ID   | Tarea                                                                   | Estimación | Estado      | Refs audit      | Notas                                                                                                                            |
| ---- | ----------------------------------------------------------------------- | ---------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1-03 | Rotar JWTs comprometidos en Supabase (anon + service_role)              | 2h         | 🔘 Pendiente | F-05-SEC-001    | Tras rotación, actualizar `.env` por canal seguro                                                                                |
| 1-04 | Quitar JWTs hardcodeados de 9 puntos del código fuente                  | 6h         | 🔘 Pendiente | F-04-002 / DA-2 | `auth-config.ts:19`, `supabase/server.ts:7`, `actions/tenant.ts:52,76`, +5                                                       |
| 1-05 | Cambio password Postgres default `postgres:postgres`                    | 1h         | 🔘 Pendiente | R-023.a         | Cerrar puerto 5432 a internet además                                                                                             |
| 1-06 | Crear usuario Postgres `app_user` con permisos limitados (no superuser) | 3h         | 🔘 Pendiente | R-023.a         | SQL script reusable luego en Fase 1. Verificar en kickoff si worker.js usa pg directo. Si sí: +1h por cadena de conexión worker. |

#### Bloque 1.3 — Endpoints sin autenticación

| ID   | Tarea                                                                                                                                         | Estimación | Estado      | Refs audit          | Notas                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------- | ---------------------------------- |
| 1-07 | Auth en 7 endpoints orquestación (`/api/orchestration/deploy`, `graph`, `publish`, `sweep`, `workflows`, `calls/manual`, `cron/appointments`) | 8h         | 🔘 Pendiente | DA-2-001            | 1h por endpoint promedio + tests   |
| 1-08 | Auth en 3 cron endpoints públicos (`/api/orchestration/sweep`, `/api/cron/appointments/reminders`)                                            | 4h         | 🔘 Pendiente | DA-3-001 / DA-3-007 | Reminders expone PII además        |
| 1-09 | Guard condicional `tenants.test_orchestrator_enabled` (deny by default)                                                                       | 2h         | 🔘 Pendiente | DA-3-003            | TEMPORAL — eliminar en Fase 3      |
| 1-10 | Cerrar `/api/admin/tenants/[id]/client-sql` (descarga SQL config sin auth)                                                                    | 2h         | 🔘 Pendiente | DA-2-002            | Requiere refactor mínimo           |
| 1-11 | Cerrar `/api/tenant/migrate` GET (sirve MIGRATION_SQL completo)                                                                               | 1h         | 🔘 Pendiente | DA-2-003            | Anónimo accesible                  |

#### Bloque 1.4 — Webhooks y firmas

| ID   | Tarea                                                      | Estimación | Estado      | Refs audit | Notas                                                            |
| ---- | ---------------------------------------------------------- | ---------- | ----------- | ---------- | ---------------------------------------------------------------- |
| 1-12 | Validación firma webhook Retell                            | 4h         | 🔘 Pendiente | DA-4-001   | HMAC obligatorio                                                 |
| 1-13 | Validación firma Retell **tools** (cancelar/agendar citas) | 6h         | 🔘 Pendiente | DA-2-007   | El endpoint más peligroso                                        |
| 1-14 | Validación HMAC WhatsApp obligatoria (no condicional)      | 2h         | 🔘 Pendiente | DA-2-006   | Quitar fallback "si env var ausente"                             |
| 1-15 | Validación firma webhook CRM (anti tenant_id spoofing)     | 6h         | 🔘 Pendiente | DA-2-009   | Cualquiera puede inyectar leads ahora. +2h por secret por tenant |

#### Bloque 1.5 — Privilege escalation y RLS

| ID   | Tarea                                                                                 | Estimación | Estado      | Refs audit       | Notas                                                 |
| ---- | ------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------- | ----------------------------------------------------- |
| 1-16 | Fix privilege escalation via `user_metadata.is_admin` editable por usuario            | 4h         | 🔘 Pendiente | DA-2-005         | Mover `is_admin` a `app_metadata` (server-controlled) |
| 1-17 | Verificación rol admin en `createTenant`/`deleteTenant`/`updateTenant` server actions | 3h         | 🔘 Pendiente | DA-2-004         | `src/lib/actions/tenant.ts:140-197`                   |
| 1-18 | Fix RLS tabla `tenants` (quitar policy tautológica `USING(true)`)                     | 3h         | 🔘 Pendiente | DA-2-010         | RLS hardening multi-tenant #1                         |
| 1-19 | Fix RLS `knowledge_base` (quitar `app.current_tenant` dead letter — nunca se setea)   | 2h         | 🔘 Pendiente | F-04-004         | Migration nueva con policy correcta                   |
| 1-20 | Fix `fetchCalls` — añadir filtro `tenant_id` en 4 funciones                           | 4h         | 🔘 Pendiente | F-04-001 / DA-2  | `src/lib/actions/calls.ts:56-371`                     |
| 1-21 | Fix IDOR `inbox.ts` 9 funciones — verificar ownership tenant                          | 8h         | 🔘 Pendiente | DA-2 inbox sweep | `inbox.ts:448-501`                                    |

#### Bloque 1.6 — Otros críticos

| ID                                 | Tarea                                                                         | Estimación      | Estado      | Refs audit                            | Notas                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------- | --------------- | ----------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1-22                               | Fix SSRF `/api/tenant/migrate` cookie `af-tenant-url` (añadir allowlist)   | 8h              | 🔘 Pendiente | DA-3-002                              | Cookie editable por JS = vector activo. +2h por allowlist dinámica por tenant                                                     |
| 1-23                               | Sanitización XSS widget embed (interpolación `id` en JS servido a terceros)   | 4h              | 🔘 Pendiente | DA-3-004                              | URL pública vulnerable                                                                                                            |
| 1-24                               | Update `axios@1.14.0` (15 CVEs: SSRF + Prototype Pollution)                   | 4h              | 🔘 Pendiente | DA-3-CVE-001                          | Pasar por `af-agents:adr` antes                                                                                                |
| 1-25                               | Reemplazar paquete `crypto@1.0.1` DEPRECATED por built-in `node:crypto`       | 3h              | 🔘 Pendiente | ADR-2026-05-20                        | Imports en todo el src/ y worker.js. Vía af-agents:adr                                                                         |
| 1-26                               | Update `next@16.1.6` → `next@16.2.6` (cierre 19 CVEs incl. middleware bypass) | 4h              | 🔘 Pendiente | DA-3-CVE-002                          | **MOVIDA DESDE 2-27.** Pre-requisito de 1-07, 1-08, 1-16, 1-17 (sin esto el middleware sigue bypassable). Vía af-agents:adr   |
| **Subtotal Fase 0 — Desarrollo**   |                                                                               | **~100h 30min** |             | (con paralelismo 2 devs: ~50h reales) |                                                                                                                                   |

> Aplazados a Fase 1: cifrar Google OAuth tokens (DA-3-006, L).
> **Nota:** 2-27 (update Next.js, DA-3-CVE-002) MOVIDA a Sprint 0 como **1-26** tras hallazgo en auditoría ADR del 20-05-2026 (el middleware bypass anula efectivamente los hotfixes de auth 1-07, 1-08, 1-16).

### Tareas de cierre obligatorias (Sprint 0)

> Estas 5 tareas SE EJECUTAN AL FINAL DE CADA SPRINT. Plantilla copiada para todos los sprints.

| ID                            | Tarea                                                                                                                                                                                                    | Estimación                     | Estado      | Notas                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP-1-CLOSE-1                  | **Auto test** — `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` (unit + integration). Reporte de coverage.                                                                           | 1h 30min                       | 🔘 Pendiente | Delegado a `af-agents:testing`                                                                                                                           |
| SP-1-CLOSE-2                  | **Test E2C Local** — Abrir browser con Playwright, recorrer flujos implementados, validar visual + diseño + **WCAG 2.2 AA**. Generar reporte con screenshots de pasos clave + findings de accesibilidad. | 2h 30min                       | 🔘 Pendiente | Delegado a `af-agents:testing` + `af-agents:uxui`                                                                                                     |
| SP-1-CLOSE-3                  | **Test Manual del Dev** — Abrir browser para el dev. Proveer credenciales de prueba si aplica. Entregar guía paso-a-paso: qué probar, cómo, qué esperar. Esperar feedback.                               | 1h                             | 🔘 Pendiente | Delegado al manager (interacción con humano)                                                                                                                |
| SP-1-CLOSE-4                  | **Corrección de Bugs y cambios detectados** — Subtareas dinámicas: una por cada bug/cambio que reporte el dev. Cada subtarea con su propio estado. Esta tarea queda 🟡 mientras haya subtareas abiertas.  | (variable)                     | 🔘 Pendiente | Delegado a `af-agents:code` + `af-agents:debugger`                                                                                                    |
| SP-1-CLOSE-5                  | **Cierre de Sprint** — PR `feature/sp-0-sprint-0-hotfixes` → `developer`. Tras merge: bump SemVer a `v0.1.0`, invitar al dev a tomar siguiente sprint, crear rama `feature/sp-2-capa-datos`.             | 30min                          | 🔘 Pendiente | Delegado a `af-agents:git` (verifica estados previos) + `af-agents:deployment` (gatekeeper changelog) + `af-agents:productivity` (cierre tracking) |
| **Subtotal cierre Sprint 0**  |                                                                                                                                                                                                          | **5h 30min + Corrección bugs** |             |                                                                                                                                                             |

### Pre-requisitos del cierre (gates obligatorios)

Para que `SP-1-CLOSE-5` pueda arrancar, **TODAS** estas condiciones deben estar a 🟢:

- [ ] Todas las tareas de desarrollo del sprint en estado 🟢 o 🔵.
- [ ] `SP-1-CLOSE-1` Auto test 🟢 con 0 errores.
- [ ] `SP-1-CLOSE-2` E2C Local 🟢 sin findings WCAG críticos.
- [ ] `SP-1-CLOSE-3` Test Manual del Dev 🟢 (dev firma OK).
- [ ] `SP-1-CLOSE-4` Bugs detectados 🟢 (sin subtareas abiertas).
- [ ] `CHANGELOG.md` con entrada `## [v0.1.0]` completa (gatekeeper `af-agents:deployment`).
- [ ] `help-docs-keeper` actualizó secciones de ayuda afectadas, todas en 🟢 Completada.

---

## Fase 1 — Sprint 1: Capa de datos (sin ORM nuevo)

| Campo                          | Valor                     |
| ------------------------------ | ------------------------- |
| **Sprint ID**                  | `SP-2`                    |
| **Versión objetivo al cierre** | `v0.2.0`                  |
| **Estado del sprint**          | 🔘 Pendiente               |
| **Estimación total**           | 3-4 sem (120h–160h)       |
| **Rama de trabajo sugerida**   | `feature/sp-2-capa-datos` |
| **Inicio**                     | —                         |
| **Fin Est.**                   | —                         |
| **Fin Real**                   | —                         |

### Tareas de desarrollo (Fase 1) — DETALLADAS

> Capa de datos consolidada con `@supabase/ssr` + Zod + Repository pattern + RLS hardening. **SIN ORM nuevo**. Origen: decisión `project_stack_data_layer.md` + plan `plans/20260519-1200-rls-multitenant-hardening/`.

#### Bloque 2.1 — Unificación cliente Supabase

| ID   | Tarea                                                                                  | Estimación | Estado      | Notas                                               |
| ---- | -------------------------------------------------------------------------------------- | ---------- | ----------- | --------------------------------------------------- |
| 2-01 | Auditar TODOS los usos directos `pg` / `postgres` / `postgres-js` en `src/`            | 4h         | 🔘 Pendiente | Inventario antes de refactor                        |
| 2-02 | Refactor: mover queries directas `pg`/`postgres` a `@supabase/ssr` (cliente unificado) | 12h        | 🔘 Pendiente | Mantener `pg`/`postgres` SÓLO en scripts admin/seed |
| 2-03 | Eliminar JWTs `service_role` residuales (los que sobrevivieron Sprint 0)               | 3h         | 🔘 Pendiente | Continuación de 1-04                                |

#### Bloque 2.2 — Schemas Zod

| ID   | Tarea                                                                              | Estimación | Estado      | Notas                                            |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------ |
| 2-04 | Estructura `src/lib/schemas/` + base helpers Zod (uuid, timestamps, enums comunes) | 4h         | 🔘 Pendiente | Convenciones de naming + ejemplos                |
| 2-05 | Zod schemas: `leads` (cruzar con `VARIABLES DEFINIDAS` cliente)                    | 4h         | 🔘 Pendiente | Nomenclatura oficial obligatoria                 |
| 2-06 | Zod schemas: `tenants` + `tenant_members`                                          | 2h         | 🔘 Pendiente |                                                  |
| 2-07 | Zod schemas: `programs` / `courses`                                                | 2h         | 🔘 Pendiente |                                                  |
| 2-08 | Zod schemas: `appointments` + `calls`                                              | 3h         | 🔘 Pendiente | Estados: agendada/realizada/cancelada/reagendada |
| 2-09 | Zod schemas: `ai_agents` / `ai_agent_variants` / `prompts`                         | 3h         | 🔘 Pendiente |                                                  |
| 2-10 | Zod schemas: `knowledge_base` / `chat_memory` / `chat_summary`                     | 2h         | 🔘 Pendiente |                                                  |
| 2-11 | Zod schemas: `integrations` / `webhooks` / `crm_field_mapping` / `crm_write_audit` | 3h         | 🔘 Pendiente | Prep para Fase 2                                 |

#### Bloque 2.3 — Repository pattern

| ID   | Tarea                                                                       | Estimación | Estado      | Notas                                                       |
| ---- | --------------------------------------------------------------------------- | ---------- | ----------- | ----------------------------------------------------------- |
| 2-12 | Estructura `src/lib/repositories/` + interface base + helpers tenant-scoped | 4h         | 🔘 Pendiente | Convención `findByTenant`, `create`, `update`, `softDelete` |
| 2-13 | Repository: `leads`                                                         | 6h         | 🔘 Pendiente | El de más uso, hacer bien                                   |
| 2-14 | Repository: `tenants`                                                       | 4h         | 🔘 Pendiente |                                                             |
| 2-15 | Repository: `appointments` + `calls`                                        | 5h         | 🔘 Pendiente |                                                             |
| 2-16 | Repository: `ai_agents` (+ variants)                                        | 4h         | 🔘 Pendiente |                                                             |
| 2-17 | Repository: `knowledge_base` + `chat_memory`                                | 5h         | 🔘 Pendiente |                                                             |
| 2-18 | Repository: `integrations` + webhooks                                       | 3h         | 🔘 Pendiente |                                                             |

#### Bloque 2.4 — Refactor queries existentes (paralelizable)

| ID   | Tarea                                                                       | Estimación | Estado      | Notas                                               |
| ---- | --------------------------------------------------------------------------- | ---------- | ----------- | --------------------------------------------------- |
| 2-19 | Refactor: mover queries de `src/app/api/**/*.ts` a repositorios             | 8h         | 🔘 Pendiente | Paralelo con 2-20 y 2-21                            |
| 2-20 | Refactor: mover queries de server actions `src/lib/actions/` a repositorios | 6h         | 🔘 Pendiente | Crítico — aquí estaban los 9 fallbacks service_role |
| 2-21 | Refactor: mover queries de `worker.js` + processors a repositorios          | 4h         | 🔘 Pendiente | Continuación de 1-01                                |

#### Bloque 2.5 — Type safety y limpieza

| ID   | Tarea                                                                     | Estimación | Estado      | Notas                                                                                               |
| ---- | ------------------------------------------------------------------------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------- |
| 2-22 | Limpieza `as any` / `as unknown` — usar tipos derivados Zod via `z.infer` | 16h        | 🔘 Pendiente | 426 ocurrencias en audit. Paralelizable. Sprint completo en sí, hacer junto con refactor de queries |

#### Bloque 2.6 — RLS hardening complementario

| ID   | Tarea                                                                              | Estimación | Estado       | Notas                              |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ------------ | ---------------------------------- |
| 2-23 | Fix RLS `ai_agents` / `ai_agent_variants` tautológica (no filtra por tenant)       | 3h         | 🔘 Pendiente  | F-04-005 / DA-2                    |
| 2-24 | Fix RLS `web_widgets` (devuelve todos los tenants)                                 | 2h         | 🔘 Pendiente  | F-04-006                           |
| 2-25 | Fix `getPrograms` — añadir filtro tenant (expone programas de todos los clientes)  | 2h         | 🔘 Pendiente  | F-04-008                           |
| 2-26 | Cifrar Google OAuth tokens en JSONB (no plano)                                     | 12h        | 🔘 Pendiente  | DA-3-006. Aplazado desde Sprint 0  |
| 2-27 | ~~Update next@16.1.6~~ **MOVIDA a Sprint 0 como 1-26 (tras audit ADR 20-05-2026)** | ~~6h~~ —   | ✅ Reasignada | Ver fila 1-26                      |

#### Bloque 2.7 — Testing y documentación

| ID   | Tarea                                                                            | Estimación | Estado      | Notas                                   |
| ---- | -------------------------------------------------------------------------------- | ---------- | ----------- | --------------------------------------- |
| 2-28 | Tests de integración con BD real (NO mocks) para repositorios principales        | 12h        | 🔘 Pendiente | Suite mínima — más en Fase 3            |
| 2-29 | Documentar capa de datos en `docs/architecture/data-layer.md` (refresh completo) | 4h         | 🔘 Pendiente | Delegado a `af-agents:documentation` |

#### Bloque 2.8 — Hardening de dependencias (hallazgos ADR audit 2026-05-20)

| ID                                | Tarea                                                                                  | Estimación | Estado      | Notas                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------- | ---------- | ----------- | -------------------------------------------------------------------------------- |
| 2-30                              | Crear hook `af-productivity-logger.cjs` para automatizar tracking de tiempos        | 6h         | 🔘 Pendiente | Ver `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` |
| 2-31                              | Update `lucide-react@0.575` → `lucide-react@1.x` (major — testing visual iconos)       | 4h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-32                              | Update `shadcn@3.x` → `shadcn@4.x` (major — revisar componentes y theme)               | 6h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-33                              | Alinear `@types/node@^20` con runtime Node 24                                          | 2h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-34                              | Investigar update `eslint@9` → `eslint@10` (bloqueado por eslint-config-next peer dep) | 2h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| **Subtotal Fase 1 — Desarrollo**  |                                                                                        | **~172h**  |             | (con paralelismo 2-3 devs: ~75-95h reales = 3-4 sem)                             |

### Tareas de cierre obligatorias (Sprint 1)

| ID                            | Tarea                                                                        | Estimación          | Estado      | Notas                            |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------- | ----------- | -------------------------------- |
| SP-2-CLOSE-1                  | Auto test                                                                    | 1h 30min            | 🔘 Pendiente | typecheck + lint + build + tests |
| SP-2-CLOSE-2                  | Test E2C Local + WCAG 2.2 AA                                                 | 2h 30min            | 🔘 Pendiente | Playwright + visual review       |
| SP-2-CLOSE-3                  | Test Manual del Dev                                                          | 1h                  | 🔘 Pendiente | Browser + guía paso-a-paso       |
| SP-2-CLOSE-4                  | Corrección de Bugs detectados                                                | (variable)          | 🔘 Pendiente | Subtareas dinámicas              |
| SP-2-CLOSE-5                  | Cierre de Sprint → PR a `developer` + bump a `v0.2.0` + crear rama Sprint 2  | 30min               | 🔘 Pendiente |                                  |
| **Subtotal cierre Sprint 1**  |                                                                              | **5h 30min + bugs** |             |                                  |

---

## Fase 2 — Sprint 2: Adapter layer + 2 CRMs (MVP)

| Campo                          | Valor                               |
| ------------------------------ | ----------------------------------- |
| **Sprint ID**                  | `SP-3`                              |
| **Versión objetivo al cierre** | `v0.3.0`                            |
| **Estado del sprint**          | 🔘 Pendiente                         |
| **Estimación total**           | 2-3 sem (80h–120h)                  |
| **Rama de trabajo sugerida**   | `feature/sp-3-adapter-hubspot-zoho` |
| **Inicio**                     | —                                   |
| **Fin Est.**                   | —                                   |
| **Fin Real**                   | —                                   |

### Tareas de desarrollo (Fase 2)

> MVP de integraciones: HubSpot + Zoho. **Sheets queda fuera del MVP** (aplazado a Fase 4).

| ID                                | Tarea                                                                               | Estimación              | Estado      | Notas   |
| --------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- | ----------- | ------- |
| 3-01                              | Diseñar `IntegrationAdapter` interface + factory por tenant                         | (pendiente estimar)     | 🔘 Pendiente |         |
| 3-02                              | Adapter HubSpot (OAuth2, contacts, deals, webhooks bidireccionales)                 | (pendiente estimar)     | 🔘 Pendiente |         |
| 3-03                              | Adapter Zoho CRM (OAuth2 / API Key, leads, deals, multi-región es/es-mx)            | (pendiente estimar)     | 🔘 Pendiente |         |
| 3-04                              | Tabla `crm_field_mapping` editable + `write_policy` (R-014 append-only por defecto) | (pendiente estimar)     | 🔘 Pendiente | Crítico |
| 3-05                              | UI admin para conectar CRM del tenant (panel)                                       | (pendiente estimar)     | 🔘 Pendiente |         |
| 3-06                              | `crm_write_audit` log + visualización en panel admin                                | (pendiente estimar)     | 🔘 Pendiente |         |
| 3-07                              | Tests de integración contra cuentas sandbox HubSpot + Zoho                          | (pendiente estimar)     | 🔘 Pendiente |         |
| **Subtotal Fase 2 — Desarrollo**  |                                                                                     | **(pendiente estimar)** |             |         |

### Tareas de cierre obligatorias (Sprint 2)

| ID                            | Tarea                                                                        | Estimación          | Estado      | Notas                               |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------- | ----------- | ----------------------------------- |
| SP-3-CLOSE-1                  | Auto test                                                                    | 1h 30min            | 🔘 Pendiente |                                     |
| SP-3-CLOSE-2                  | Test E2C Local + WCAG 2.2 AA                                                 | 2h 30min            | 🔘 Pendiente | Flujo OAuth completo HubSpot + Zoho |
| SP-3-CLOSE-3                  | Test Manual del Dev                                                          | 1h                  | 🔘 Pendiente |                                     |
| SP-3-CLOSE-4                  | Corrección de Bugs detectados                                                | (variable)          | 🔘 Pendiente |                                     |
| SP-3-CLOSE-5                  | Cierre de Sprint → PR a `developer` + bump a `v0.3.0` + crear rama Sprint 3  | 30min               | 🔘 Pendiente |                                     |
| **Subtotal cierre Sprint 2**  |                                                                              | **5h 30min + bugs** |             |                                     |

---

## Fase 3 — Sprint 3: Hardening

| Campo                          | Valor                     |
| ------------------------------ | ------------------------- |
| **Sprint ID**                  | `SP-4`                    |
| **Versión objetivo al cierre** | `v0.4.0` (MVP completo, post-hardening) |
| **Estado del sprint**          | 🔘 Pendiente               |
| **Estimación total**           | 2-3 sem (80h–120h)        |
| **Rama de trabajo sugerida**   | `feature/sp-4-hardening`  |
| **Inicio**                     | —                         |
| **Fin Est.**                   | —                         |
| **Fin Real**                   | —                         |

### Tareas de desarrollo (Fase 3)

> Tests E2E completos, observabilidad, dashboards de costes, accesibilidad WCAG 2.2 AA total.

| ID                                | Tarea                                                               | Estimación              | Estado      | Notas                    |
| --------------------------------- | ------------------------------------------------------------------- | ----------------------- | ----------- | ------------------------ |
| 4-01                              | Test suite E2E completa (Playwright) cubriendo flujos golden path   | (pendiente estimar)     | 🔘 Pendiente |                          |
| 4-02                              | Coverage target ≥80% unit + integration                             | (pendiente estimar)     | 🔘 Pendiente |                          |
| 4-03                              | Observabilidad: logging estructurado + métricas BullMQ + dashboards | (pendiente estimar)     | 🔘 Pendiente |                          |
| 4-04                              | Dashboard de costes LLM (tokens por proveedor por tenant)           | (pendiente estimar)     | 🔘 Pendiente |                          |
| 4-05                              | Refactor accesibilidad WCAG 2.2 AA en todo el admin panel           | (pendiente estimar)     | 🔘 Pendiente | Findings deep audit DA-5 |
| 4-06                              | Hardening adicional: rate limits, CSP headers, CSRF tokens          | (pendiente estimar)     | 🔘 Pendiente |                          |
| 4-07                              | Documentación final cliente: release notes v0.4.0                   | (pendiente estimar)     | 🔘 Pendiente |                          |
| **Subtotal Fase 3 — Desarrollo**  |                                                                     | **(pendiente estimar)** |             |                          |

### Tareas de cierre obligatorias (Sprint 3)

| ID                            | Tarea                                                                                                     | Estimación    | Estado      | Notas                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- | ----------- | ------------------------------ |
| SP-4-CLOSE-1                  | Auto test                                                                                                 | 1h 30min      | 🔘 Pendiente |                                |
| SP-4-CLOSE-2                  | Test E2C Local + WCAG 2.2 AA — recorrido completo MVP                                                     | 4h            | 🔘 Pendiente | Más extenso por ser cierre MVP |
| SP-4-CLOSE-3                  | Test Manual del Dev                                                                                       | 2h            | 🔘 Pendiente | Más extenso                    |
| SP-4-CLOSE-4                  | Corrección de Bugs detectados                                                                             | (variable)    | 🔘 Pendiente |                                |
| SP-4-CLOSE-5                  | Cierre de Sprint → PR a `developer` + **bump a `v0.4.0`** + invitar a planificar Fase 4 (o cierre MVP)   | 30min         | 🔘 Pendiente | MVP completo                   |
| **Subtotal cierre Sprint 3**  |                                                                                                           | **8h + bugs** |             |                                |

---

## Fase 4 — Sprint 4 (post-release)

| Campo                          | Valor                                                          |
| ------------------------------ | -------------------------------------------------------------- |
| **Sprint ID**                  | `SP-5`                                                         |
| **Versión objetivo al cierre** | `v0.5.0+` (decidir al arrancar; v1.0.0 queda para futuro release público, post-MVP) |
| **Estado del sprint**          | 🔘 Pendiente (futuro)                                           |
| **Estimación total**           | 4-7 sem                                                        |
| **Rama de trabajo sugerida**   | `feature/sp-5-post-release`                                    |

### Tareas de desarrollo (Fase 4)

| ID   | Tarea                                                              | Estimación  | Estado      | Notas                                            |
| ---- | ------------------------------------------------------------------ | ----------- | ----------- | ------------------------------------------------ |
| 5-01 | Google Sheets bidireccional (OAuth2 + Drive API push + plantillas) | ~2-3 sem    | 🔘 Pendiente | Reutiliza código OAuth previo (commit `63e1e6e`) |
| 5-02 | Salesforce adapter (OAuth2, Connected Apps)                        | ~2-3 sem    | 🔘 Pendiente | Clientes enterprise                              |
| 5-03 | GoHighLevel adapter (OAuth2 v2)                                    | ~2 sem      | 🔘 Pendiente | Latam EduTech                                    |
| 5-04 | ActiveCampaign adapter (API Key)                                   | ~1-2 sem    | 🔘 Pendiente | Marketing-first                                  |
| 5-05 | Generalización del Adapter pattern tras 4-5 implementaciones       | ~1 sem      | 🔘 Pendiente |                                                  |
| 5-06 | Tier 2 on-demand (Clientify, Bitrix24, Pipedrive, Monday, Holded)  | ~1 sem cada | 🔘 Pendiente | Sólo bajo pedido cliente                         |

### Tareas de cierre obligatorias (Sprint 4)

| ID              | Tarea                                                                       | Estimación    | Estado      | Notas |
| --------------- | --------------------------------------------------------------------------- | ------------- | ----------- | ----- |
| SP-5-CLOSE-1..5 | (Mismo bloque que sprints anteriores: auto test, E2C, manual, bugs, cierre) | ~9-12h + bugs | 🔘 Pendiente |       |

---

## Resumen del estado actual

| Sprint             | Versión objetivo | Estado      | Tareas dev                              | Estimación dev                      | Cierre          |
| ------------------ | ---------------- | ----------- | --------------------------------------- | ----------------------------------- | --------------- |
| **1** (Sprint 0)   | v0.1.0           | 🔘 Pendiente | **26** (detalladas)                     | ~100h 30min (2 sem con paralelismo) | 5h 30min + bugs |
| **2** (Sprint 1)   | v0.2.0           | 🔘 Pendiente | **33** (detalladas, con 1 movida a 1)   | ~172h (3-4 sem con paralelismo)     | 5h 30min + bugs |
| **3** (Sprint 2)   | v0.3.0           | 🔘 Pendiente | 7 (placeholder — detallar al arrancar)  | 2-3 sem                             | 5h 30min + bugs |
| **4** (Sprint 3)   | v0.4.0           | 🔘 Pendiente | 7 (placeholder)                         | 2-3 sem                             | 8h + bugs       |
| **5** (Sprint 4)   | v0.5.0+          | 🔘 Pendiente | 6 (placeholder)                         | 4-7 sem                             | ~9-12h + bugs   |

---

## Cómo el agente actualiza este documento

Ver [.claude/agents/roadmap-keeper.md](../.claude/agents/roadmap-keeper.md) para el detalle.

Reglas clave:

1. Cada vez que una tarea cambia de estado → el agente actualiza la celda + añade timestamp interno en el log.
2. Cada vez que se planifica un sprint en detalle → el agente reemplaza las filas placeholder por tareas concretas con estimación real.
3. Cada vez que se cierra un sprint → el agente actualiza `Fin Real`, marca el sprint como 🟢 COMPLETADA, bumpea la versión del proyecto en frontmatter.
4. Cuando hay desviación significativa de estimación → el agente avisa al manager y al `productivity` agent.

---

**Última actualización**: 20-05-2026 14:00 por `roadmap-keeper` (Sprint 0 v3 + Sprint 1 con hallazgos ADR audit). Renombrado letras→números aplicado 20-05-2026.
