---
title: "RoadMap dashboard-af"
audience: equipo de desarrollo
status: LIVING_DOCUMENT
maintained_by: agente `roadmap-keeper` (proactivo) — orquestado por `af-agents:manager`
last_updated: 21-05-2026 22:30
last_updated_by: Renzo (políticas: naming `feature/sprint-N` desde Sprint 1, tiempo real anotado en Notas, distinción local-aplicable vs pre-deploy)
project_version: v0.0.0
sprint_0_progress: "Ph1 ✅ cerrada. 0-00, 0-01, 1-01, 1-02, 1-04, 1-26 → 🔵 pushed. 1-06 → 🟠 código listo (apply local pendiente del dev). 1-03, 1-05 → 🟡 100% VPS pre-deploy. Resto 🔘 pendiente. ⏱ Real total a push: ~4h 50min vs 26h estimadas."
excluded_from: [staging, main]
---

# RoadMap — dashboard-af

> ⚠️ **Documento vivo**. Mantenido proactivamente por el agente [`af-agents:roadmap-keeper`](../.claude/agents/roadmap-keeper.md). NO editar directamente sin orden del lead — pide al agente que lo haga.
>
> Cada tarea/fase/sprint tiene **estimación de tiempo** y **estado**. El agente actualiza el estado automáticamente cuando arranca o termina trabajo. Cualquier dev puede consultar aquí en qué fase va el proyecto.

---

## Políticas operativas (sesión planificación 21-05-2026)

| Item                              | Política                                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vacaciones / festivos             | **Javi HP sin vacaciones programadas en 2026.** Calendario L-V completo.                                                                                                                                                                                                              |
| Capacidad devs                    | **Javi HP: 10h productivas/día.** Renzo: 8h productivas/día (capacidad disponible — sin sprints asignados aún; el usuario avisará cuando se le asigne).                                                                                                                               |
| Deadline MVP                      | **"Lo antes posible"** — objetivo Lun 10-08-2026 (v0.4.0). Sin compromiso externo de fecha con cliente.                                                                                                                                                                               |
| Release a staging                 | **NO automático por sprint.** El usuario decide manualmente cuándo subir cada sprint a `staging` para review de la cliente. PRs paran en `developer` hasta orden explícita.                                                                                                           |
| Acceso Supabase del cliente (VPS) | **Diferido al pre-deploy.** Trabajamos **local-first** con Supabase self-hosted local. El acceso al VPS de Easypanel se prepara y rota tokens **antes del primer despliegue a staging**, no antes.                                                                                    |
| Tracking de tiempos y tareas      | **Sistema propio** — hook `af-productivity-logger.cjs` (tarea 2-30, Sprint 1). NO se usa GitHub Issues, Linear, Jira ni sistemas externos.                                                                                                                                            |
| GitHub Actions                    | **Minimizar al máximo.** Tier gratis = 2000 min/mes. Todo lo que pueda ejecutarse en local (typecheck, lint, build, test, browser tests, security scan) se ejecuta **LOCAL** vía pre-push hooks (tarea 0-01). CI en GH Actions solo para verificación mínima sobre PRs a `developer`. |

> Decisiones tomadas en sesión 21-05-2026 con Javi HP. Si alguna cambia, actualizar este bloque ANTES de seguir con el resto del roadmap.

---

## Leyenda de estados

| Icono | Estado                     | Significado                                                                           |
| ----- | -------------------------- | ------------------------------------------------------------------------------------- |
| 🔘    | **Pendiente**              | Aún no se ha empezado                                                                 |
| 🟡    | **En Desarrollo**          | Trabajo activo en curso (alguien está dándole, aunque sea en paralelo a otras tareas) |
| 🟠    | **P. Subir GH**            | Trabajo terminado localmente, falta hacer commit/push a su rama                       |
| 🔵    | **Subida rama `<nombre>`** | Ya pusheada a su `feature/*`, esperando PR / review / merge                           |
| 🟢    | **COMPLETADA**             | Mergeada a `developer`. Cierre de la tarea.                                           |

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

| Métrica                                    | Valor                                             |
| ------------------------------------------ | ------------------------------------------------- |
| Fases                                      | 10 (0..9)                                         |
| Sprints planificados                       | 10 (uno por fase)                                 |
| Tareas de cierre obligatorias por sprint   | 5                                                 |
| **Estimación total MVP (Sprints 0+1+2+3)** | ~9-12 semanas                                     |
| **Post-MVP (Sprints 4..9)**                | ~200-370h (split incremental por integración CRM) |
| **Versión objetivo MVP**                   | `v0.4.0`                                          |

---

## Fase 0 — Sprint 0: Hotfixes de seguridad

| Campo                            | Valor                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| **Sprint ID**                    | `SP-1`                                                      |
| **Versión objetivo al cierre**   | `v0.1.0`                                                    |
| **Estado del sprint**            | 🟡 En Desarrollo (5 tareas a 🔵, 2 diferidas)               |
| **Estimación total**             | ~107h 30min (11 días lab × 10h)                             |
| **Rama de trabajo sugerida**     | `feature/sp-0-sprint-0-hotfixes` (pushed origin 21-05-2026) |
| **Inicio**                       | Jue 21-05-2026 09:00                                        |
| **Fin Est.**                     | Jue 04-06-2026 19:00                                        |
| **Fin Real**                     | —                                                           |
| **Horas consumidas (estimadas)** | ~17h (0-00: 4h + 0-01: 3h + 1-04: 6h + 1-26: 4h)            |

> **Asignado a:** Javi HP (solo). Capacidad: 10h productivas/día, L-V. 11 días lab (~110h disponibles). Sin vacaciones en 2026.

### Prerequisitos del sprint

| Item                                                                              | Estado                                                                                 | Ref                                                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ADR auditoría dependencias 20-05-2026 (next 16.2.6, axios 1.16.1, crypto removal) | ✅ Aprobado DONE_WITH_CONCERNS                                                         | [plans/reports/adr-auditoria-dependencias-20260520.md](../plans/reports/adr-auditoria-dependencias-20260520.md) |
| Supabase local self-hosted activo (Docker)                                        | ✅ OK — Sprint 0 trabaja contra local                                                  | `npm run db:up` + commit 42ba022                                                                                |
| Acceso Supabase del cliente en VPS Easypanel                                      | 🟡 **Diferido pre-deploy** — se prepara antes de subir a staging, no antes de Sprint 0 | Pendiente que Javi HP obtenga acceso del cliente                                                                |
| Repo limpio en `developer` sincronizado origin                                    | ✅ OK                                                                                  | commit 42ba022                                                                                                  |
| Plantilla CHANGELOG.md disponible                                                 | 🔘 Pendiente verificar                                                                 | —                                                                                                               |

### Tareas de desarrollo (Fase 0) — DETALLADAS

Origen: Top 25 Critical de [docs/audit/deep/DEEP-FINDINGS-SUMMARY.md](../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) + audit RLS multi-tenant. 22 tareas distribuidas en 4 bloques temáticos. Paralelismo posible entre bloques.

#### Bloque 1.1 — Orquestador BullMQ (bloqueante de cadencia)

| ID   | Tarea                                                                                  | Estimación | Estado                   | Refs audit         | Notas                                                                                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------- | ---------- | ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-00 | Setup Playwright local + baseline tests E2E (devDependency `@playwright/test`)         | 4h         | 🔵 Subida `feature/sp-0` | DA-5 pre-requisito | ⏱ Real (a push): 45min · ✅ Commit `00cc35a` 21-05-2026 — config chromium + smoke spec + 5 scripts npm                                                                                                                 |
| 0-01 | Setup pre-push hooks (Husky/lefthook) — typecheck + lint + test + build en local       | 3h         | 🔵 Subida `feature/sp-0` | Política operativa | ⏱ Real (a push): 1h · ✅ Commit `a74406e` 21-05-2026 — husky + lint-staged + commit-msg + bonus 3 fixes typecheck                                                                                                      |
| 1-01 | Fix `worker.js:58` firma incorrecta `executeSequenceStep` — desbloquea flujo multi-día | 4h         | 🔵 Subida `feature/sp-0` | F-02-001 / DA-1    | ⏱ Real (a push): 30min · ✅ Commit `847ef79` — worker carga lead+config+sequence antes de llamar con firma `(lead, tenantId, sequence, stepIndex, config)`. typecheck+build OK. Test multi-día diferido a SP-1-CLOSE-2 |
| 1-02 | Fix `enqueueLeadStep` — quitar silenciado errores Redis (jobs perdidos sin log)        | 3h         | 🔵 Subida `feature/sp-0` | DA-1-005           | ⏱ Real (a push): 25min · ✅ Commit `662073f` — catch silencioso reemplazado por log estructurado (sin PII) + re-throw. Sin ID ficticio. 3 callers ya manejan throw. typecheck+build OK                                 |

#### Bloque 1.2 — Secretos y credenciales

| ID   | Tarea                                                                   | Estimación | Estado                     | Refs audit      | Notas                                                                                                                                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------- | ---------- | -------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-03 | Rotar JWTs comprometidos en Supabase (anon + service_role)              | 2h         | 🟡 **DIFERIDA pre-deploy** | F-05-SEC-001    | **100% VPS** — no hay parte local-aplicable: el Supabase local ya usa JWTs distintos a los comprometidos del cliente. Tras 1-04 el código ya no tiene fallback hardcoded → la app local funciona con cualquier JWT en `.env.local`. Se cierra en sesión pre-staging                                 |
| 1-04 | Quitar JWTs hardcodeados de 10 puntos del código fuente                 | 6h         | 🔵 Subida `feature/sp-0`   | F-04-002 / DA-2 | ⏱ Real (a push): 50min · ✅ Commit `d595287` — helper `src/lib/env.ts` (requireEnv/requireEnvAny) + refactor 5 archivos. `grep eyJhbGci\|FALLBACK_ src/` = 0                                                                                                                                        |
| 1-05 | Cambio password Postgres default `postgres:postgres`                    | 1h         | 🟡 **DIFERIDA pre-deploy** | R-023.a         | **100% VPS** — en local Postgres corre en `localhost:8200` no expuesto a internet (riesgo nulo). En producción es crítico cambiar password + cerrar puerto 5432. Se cierra en sesión pre-staging                                                                                                    |
| 1-06 | Crear usuario Postgres `app_user` con permisos limitados (no superuser) | 3h         | 🟠 P. Subir GH             | R-023.a         | ⏱ Real (código): 30min · ✅ SQL idempotente en `supabase/scripts/create-app-user.sql` + README. 🟡 **Apply en local pendiente** (psql con password fuerte = acción manual del dev) — comando preparado en README. Apply contra VPS diferido a pre-staging. Worker.js NO usa pg directo → 3h sin +1h |

#### Bloque 1.3 — Endpoints sin autenticación

| ID   | Tarea                                                                                                                                         | Estimación | Estado       | Refs audit          | Notas                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ------------------- | -------------------------------- |
| 1-07 | Auth en 7 endpoints orquestación (`/api/orchestration/deploy`, `graph`, `publish`, `sweep`, `workflows`, `calls/manual`, `cron/appointments`) | 8h         | 🔘 Pendiente | DA-2-001            | 1h por endpoint promedio + tests |
| 1-08 | Auth en 3 cron endpoints públicos (`/api/orchestration/sweep`, `/api/cron/appointments/reminders`)                                            | 4h         | 🔘 Pendiente | DA-3-001 / DA-3-007 | Reminders expone PII además      |
| 1-09 | Guard condicional `tenants.test_orchestrator_enabled` (deny by default)                                                                       | 2h         | 🔘 Pendiente | DA-3-003            | TEMPORAL — eliminar en Fase 3    |
| 1-10 | Cerrar `/api/admin/tenants/[id]/client-sql` (descarga SQL config sin auth)                                                                    | 2h         | 🔘 Pendiente | DA-2-002            | Requiere refactor mínimo         |
| 1-11 | Cerrar `/api/tenant/migrate` GET (sirve MIGRATION_SQL completo)                                                                               | 1h         | 🔘 Pendiente | DA-2-003            | Anónimo accesible                |

#### Bloque 1.4 — Webhooks y firmas

| ID   | Tarea                                                      | Estimación | Estado       | Refs audit | Notas                                                            |
| ---- | ---------------------------------------------------------- | ---------- | ------------ | ---------- | ---------------------------------------------------------------- |
| 1-12 | Validación firma webhook Retell                            | 4h         | 🔘 Pendiente | DA-4-001   | HMAC obligatorio                                                 |
| 1-13 | Validación firma Retell **tools** (cancelar/agendar citas) | 6h         | 🔘 Pendiente | DA-2-007   | El endpoint más peligroso                                        |
| 1-14 | Validación HMAC WhatsApp obligatoria (no condicional)      | 2h         | 🔘 Pendiente | DA-2-006   | Quitar fallback "si env var ausente"                             |
| 1-15 | Validación firma webhook CRM (anti tenant_id spoofing)     | 6h         | 🔘 Pendiente | DA-2-009   | Cualquiera puede inyectar leads ahora. +2h por secret por tenant |

#### Bloque 1.5 — Privilege escalation y RLS

| ID   | Tarea                                                                                 | Estimación | Estado　　　 | Refs audit       | Notas                                                 |
| ---- | ------------------------------------------------------------------------------------- | ---------- | ------------ | ---------------- | ----------------------------------------------------- |
| 1-16 | Fix privilege escalation via `user_metadata.is_admin` editable por usuario            | 4h         | 🔘 Pendiente | DA-2-005         | Mover `is_admin` a `app_metadata` (server-controlled) |
| 1-17 | Verificación rol admin en `createTenant`/`deleteTenant`/`updateTenant` server actions | 3h         | 🔘 Pendiente | DA-2-004         | `src/lib/actions/tenant.ts:140-197`                   |
| 1-18 | Fix RLS tabla `tenants` (quitar policy tautológica `USING(true)`)                     | 3h         | 🔘 Pendiente | DA-2-010         | RLS hardening multi-tenant #1                         |
| 1-19 | Fix RLS `knowledge_base` (quitar `app.current_tenant` dead letter — nunca se setea)   | 2h         | 🔘 Pendiente | F-04-004         | Migration nueva con policy correcta                   |
| 1-20 | Fix `fetchCalls` — añadir filtro `tenant_id` en 4 funciones                           | 4h         | 🔘 Pendiente | F-04-001 / DA-2  | `src/lib/actions/calls.ts:56-371`                     |
| 1-21 | Fix IDOR `inbox.ts` 9 funciones — verificar ownership tenant                          | 8h         | 🔘 Pendiente | DA-2 inbox sweep | `inbox.ts:448-501`                                    |

#### Bloque 1.6 — Otros críticos

| ID                               | Tarea                                                                         | Estimación      | Estado                   | Refs audit                         | Notas                                                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- | --------------- | ------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-22                             | Fix SSRF `/api/tenant/migrate` cookie `af-tenant-url` (añadir allowlist)      | 8h              | 🔘 Pendiente             | DA-3-002                           | Cookie editable por JS = vector activo. +2h por allowlist dinámica por tenant                                                                                                            |
| 1-23                             | Sanitización XSS widget embed (interpolación `id` en JS servido a terceros)   | 4h              | 🔘 Pendiente             | DA-3-004                           | URL pública vulnerable                                                                                                                                                                   |
| 1-24                             | Update `axios@1.14.0` (15 CVEs: SSRF + Prototype Pollution)                   | 4h              | 🔘 Pendiente             | DA-3-CVE-001                       | Pasar por `af-agents:adr` antes                                                                                                                                                          |
| 1-25                             | Reemplazar paquete `crypto@1.0.1` DEPRECATED por built-in `node:crypto`       | 3h              | 🔘 Pendiente             | ADR-2026-05-20                     | Imports en todo el src/ y worker.js. Vía af-agents:adr                                                                                                                                   |
| 1-26                             | Update `next@16.1.6` → `next@16.2.6` (cierre 19 CVEs incl. middleware bypass) | 4h              | 🔵 Subida `feature/sp-0` | DA-3-CVE-002                       | ⏱ Real (a push): 30min · ✅ Commit `1ce8e0b` 21-05-2026 — `next@16.2.6` + `eslint-config-next@16.2.6` + ADR-002 documentado. typecheck/build limpios. Smoke test diferido a SP-1-CLOSE-2 |
| **Subtotal Fase 0 — Desarrollo** |                                                                               | **~104h 30min** |                          | (incluye 0-00 Playwright setup 4h) |                                                                                                                                                                                          |

> Aplazados a Fase 1: cifrar Google OAuth tokens (DA-3-006, L).
> **Nota:** 2-27 (update Next.js, DA-3-CVE-002) MOVIDA a Sprint 0 como **1-26** tras hallazgo en auditoría ADR del 20-05-2026 (el middleware bypass anula efectivamente los hotfixes de auth 1-07, 1-08, 1-16).

### Tareas de cierre obligatorias (Sprint 0)

> Estas 5 tareas SE EJECUTAN AL FINAL DE CADA SPRINT. Plantilla copiada para todos los sprints.

| ID                           | Tarea                                                                                                                                                                                                    | Estimación                     | Estado　　　 | Notas                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP-1-CLOSE-1                 | **Auto test** — `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` (unit + integration). Reporte de coverage.                                                                           | 1h 30min                       | 🔘 Pendiente | Delegado a `af-agents:testing`                                                                                                                     |
| SP-1-CLOSE-2                 | **Test E2C Local** — Abrir browser con Playwright, recorrer flujos implementados, validar visual + diseño + **WCAG 2.2 AA**. Generar reporte con screenshots de pasos clave + findings de accesibilidad. | 2h 30min                       | 🔘 Pendiente | Delegado a `af-agents:testing` + `af-agents:uxui`                                                                                                  |
| SP-1-CLOSE-3                 | **Test Manual del Dev** — Abrir browser para el dev. Proveer credenciales de prueba si aplica. Entregar guía paso-a-paso: qué probar, cómo, qué esperar. Esperar feedback.                               | 1h                             | 🔘 Pendiente | Delegado al manager (interacción con humano)                                                                                                       |
| SP-1-CLOSE-4                 | **Corrección de Bugs y cambios detectados** — Subtareas dinámicas: una por cada bug/cambio que reporte el dev. Cada subtarea con su propio estado. Esta tarea queda 🟡 mientras haya subtareas abiertas. | (variable)                     | 🔘 Pendiente | Delegado a `af-agents:code` + `af-agents:debugger`                                                                                                 |
| SP-1-CLOSE-5                 | **Cierre de Sprint** — PR `feature/sp-0-sprint-0-hotfixes` → `developer`. Tras merge: bump SemVer a `v0.1.0`, invitar al dev a tomar siguiente sprint, crear rama `feature/sp-2-capa-datos`.             | 30min                          | 🔘 Pendiente | Delegado a `af-agents:git` (verifica estados previos) + `af-agents:deployment` (gatekeeper changelog) + `af-agents:productivity` (cierre tracking) |
| **Subtotal cierre Sprint 0** |                                                                                                                                                                                                          | **5h 30min + Corrección bugs** | 　　　　　　 |                                                                                                                                                    |

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
| **Estado del sprint**          | 🔘 Pendiente              |
| **Estimación total**           | 3-4 sem (120h–160h)       |
| **Rama de trabajo sugerida**   | `feature/sp-2-capa-datos` |
| **Inicio**                     | Vie 05-06-2026 09:00      |
| **Fin Est.**                   | Mar 30-06-2026 19:00      |
| **Fin Real**                   | —                         |

> **Asignado a:** Javi HP (solo). 18 días lab × 10h/día = 180h.

### Tareas de desarrollo (Fase 1) — DETALLADAS

> Capa de datos consolidada con `@supabase/ssr` + Zod + Repository pattern + RLS hardening. **SIN ORM nuevo**. Origen: decisión `project_stack_data_layer.md` + plan `plans/20260519-1200-rls-multitenant-hardening/`.

#### Bloque 2.1 — Unificación cliente Supabase

| ID   | Tarea                                                                                  | Estimación | Estado       | Notas                                               |
| ---- | -------------------------------------------------------------------------------------- | ---------- | ------------ | --------------------------------------------------- |
| 2-01 | Auditar TODOS los usos directos `pg` / `postgres` / `postgres-js` en `src/`            | 4h         | 🔘 Pendiente | Inventario antes de refactor                        |
| 2-02 | Refactor: mover queries directas `pg`/`postgres` a `@supabase/ssr` (cliente unificado) | 12h        | 🔘 Pendiente | Mantener `pg`/`postgres` SÓLO en scripts admin/seed |
| 2-03 | Eliminar JWTs `service_role` residuales (los que sobrevivieron Sprint 0)               | 3h         | 🔘 Pendiente | Continuación de 1-04                                |

#### Bloque 2.2 — Schemas Zod

| ID   | Tarea                                                                              | Estimación | Estado       | Notas                                            |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ------------ | ------------------------------------------------ |
| 2-04 | Estructura `src/lib/schemas/` + base helpers Zod (uuid, timestamps, enums comunes) | 4h         | 🔘 Pendiente | Convenciones de naming + ejemplos                |
| 2-05 | Zod schemas: `leads` (cruzar con `VARIABLES DEFINIDAS` cliente)                    | 4h         | 🔘 Pendiente | Nomenclatura oficial obligatoria                 |
| 2-06 | Zod schemas: `tenants` + `tenant_members`                                          | 2h         | 🔘 Pendiente |                                                  |
| 2-07 | Zod schemas: `programs` / `courses`                                                | 2h         | 🔘 Pendiente |                                                  |
| 2-08 | Zod schemas: `appointments` + `calls`                                              | 3h         | 🔘 Pendiente | Estados: agendada/realizada/cancelada/reagendada |
| 2-09 | Zod schemas: `ai_agents` / `ai_agent_variants` / `prompts`                         | 3h         | 🔘 Pendiente |                                                  |
| 2-10 | Zod schemas: `knowledge_base` / `chat_memory` / `chat_summary`                     | 2h         | 🔘 Pendiente |                                                  |
| 2-11 | Zod schemas: `integrations` / `webhooks` / `crm_field_mapping` / `crm_write_audit` | 3h         | 🔘 Pendiente | Prep para Fase 2                                 |

#### Bloque 2.3 — Repository pattern

| ID   | Tarea                                                                       | Estimación | Estado　　　 | Notas                                                       |
| ---- | --------------------------------------------------------------------------- | ---------- | ------------ | ----------------------------------------------------------- |
| 2-12 | Estructura `src/lib/repositories/` + interface base + helpers tenant-scoped | 4h         | 🔘 Pendiente | Convención `findByTenant`, `create`, `update`, `softDelete` |
| 2-13 | Repository: `leads`                                                         | 6h         | 🔘 Pendiente | El de más uso, hacer bien                                   |
| 2-14 | Repository: `tenants`                                                       | 4h         | 🔘 Pendiente |                                                             |
| 2-15 | Repository: `appointments` + `calls`                                        | 5h         | 🔘 Pendiente |                                                             |
| 2-16 | Repository: `ai_agents` (+ variants)                                        | 4h         | 🔘 Pendiente |                                                             |
| 2-17 | Repository: `knowledge_base` + `chat_memory`                                | 5h         | 🔘 Pendiente |                                                             |
| 2-18 | Repository: `integrations` + webhooks                                       | 3h         | 🔘 Pendiente |                                                             |

#### Bloque 2.4 — Refactor queries existentes (paralelizable)

| ID   | Tarea                                                                       | Estimación | Estado　　　 | Notas                                               |
| ---- | --------------------------------------------------------------------------- | ---------- | ------------ | --------------------------------------------------- |
| 2-19 | Refactor: mover queries de `src/app/api/**/*.ts` a repositorios             | 8h         | 🔘 Pendiente | Paralelo con 2-20 y 2-21                            |
| 2-20 | Refactor: mover queries de server actions `src/lib/actions/` a repositorios | 6h         | 🔘 Pendiente | Crítico — aquí estaban los 9 fallbacks service_role |
| 2-21 | Refactor: mover queries de `worker.js` + processors a repositorios          | 4h         | 🔘 Pendiente | Continuación de 1-01                                |

#### Bloque 2.5 — Type safety y limpieza

| ID   | Tarea                                                                     | Estimación | Estado       | Notas                                                                                               |
| ---- | ------------------------------------------------------------------------- | ---------- | ------------ | --------------------------------------------------------------------------------------------------- |
| 2-22 | Limpieza `as any` / `as unknown` — usar tipos derivados Zod via `z.infer` | 16h        | 🔘 Pendiente | 426 ocurrencias en audit. Paralelizable. Sprint completo en sí, hacer junto con refactor de queries |

#### Bloque 2.6 — RLS hardening complementario

| ID   | Tarea                                                                              | Estimación | Estado        | Notas                             |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ------------- | --------------------------------- |
| 2-23 | Fix RLS `ai_agents` / `ai_agent_variants` tautológica (no filtra por tenant)       | 3h         | 🔘 Pendiente  | F-04-005 / DA-2                   |
| 2-24 | Fix RLS `web_widgets` (devuelve todos los tenants)                                 | 2h         | 🔘 Pendiente  | F-04-006                          |
| 2-25 | Fix `getPrograms` — añadir filtro tenant (expone programas de todos los clientes)  | 2h         | 🔘 Pendiente  | F-04-008                          |
| 2-26 | Cifrar Google OAuth tokens en JSONB (no plano)                                     | 12h        | 🔘 Pendiente  | DA-3-006. Aplazado desde Sprint 0 |
| 2-27 | ~~Update next@16.1.6~~ **MOVIDA a Sprint 0 como 1-26 (tras audit ADR 20-05-2026)** | ~~6h~~ —   | ✅ Reasignada | Ver fila 1-26                     |

#### Bloque 2.7 — Testing y documentación

| ID   | Tarea                                                                            | Estimación | Estado　　　 | Notas                                |
| ---- | -------------------------------------------------------------------------------- | ---------- | ------------ | ------------------------------------ |
| 2-28 | Tests de integración con BD real (NO mocks) para repositorios principales        | 12h        | 🔘 Pendiente | Suite mínima — más en Fase 3         |
| 2-29 | Documentar capa de datos en `docs/architecture/data-layer.md` (refresh completo) | 4h         | 🔘 Pendiente | Delegado a `af-agents:documentation` |

#### Bloque 2.8 — Hardening de dependencias (hallazgos ADR audit 2026-05-20)

| ID                               | Tarea                                                                                  | Estimación | Estado       | Notas                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------- | ------------ | -------------------------------------------------------------------------------- |
| 2-30                             | Crear hook `af-productivity-logger.cjs` para automatizar tracking de tiempos           | 6h         | 🔘 Pendiente | Ver `plans/260520-1342-sistema-logs-tiempo-sprints/phase-03-hook-integration.md` |
| 2-31                             | Update `lucide-react@0.575` → `lucide-react@1.x` (major — testing visual iconos)       | 4h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-32                             | Update `shadcn@3.x` → `shadcn@4.x` (major — revisar componentes y theme)               | 6h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-33                             | Alinear `@types/node@^20` con runtime Node 24                                          | 2h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| 2-34                             | Investigar update `eslint@9` → `eslint@10` (bloqueado por eslint-config-next peer dep) | 2h         | 🔘 Pendiente | ADR-2026-05-20                                                                   |
| **Subtotal Fase 1 — Desarrollo** |                                                                                        | **~172h**  |              | (con paralelismo 2-3 devs: ~75-95h reales = 3-4 sem)                             |

### Tareas de cierre obligatorias (Sprint 1)

| ID                           | Tarea                                                                       | Estimación          | Estado       | Notas                            |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------- | ------------ | -------------------------------- |
| SP-2-CLOSE-1                 | Auto test                                                                   | 1h 30min            | 🔘 Pendiente | typecheck + lint + build + tests |
| SP-2-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                                | 2h 30min            | 🔘 Pendiente | Playwright + visual review       |
| SP-2-CLOSE-3                 | Test Manual del Dev                                                         | 1h                  | 🔘 Pendiente | Browser + guía paso-a-paso       |
| SP-2-CLOSE-4                 | Corrección de Bugs detectados                                               | (variable)          | 🔘 Pendiente | Subtareas dinámicas              |
| SP-2-CLOSE-5                 | Cierre de Sprint → PR a `developer` + bump a `v0.2.0` + crear rama Sprint 2 | 30min               | 🔘 Pendiente |                                  |
| **Subtotal cierre Sprint 1** |                                                                             | **5h 30min + bugs** |              |                                  |

---

## Fase 2 — Sprint 2: Adapter layer + 2 CRMs (MVP)

| Campo                          | Valor                               |
| ------------------------------ | ----------------------------------- |
| **Sprint ID**                  | `SP-3`                              |
| **Versión objetivo al cierre** | `v0.3.0`                            |
| **Estado del sprint**          | 🔘 Pendiente                        |
| **Estimación total**           | 2-3 sem (80h–120h)                  |
| **Rama de trabajo sugerida**   | `feature/sp-3-adapter-hubspot-zoho` |
| **Inicio**                     | Mié 01-07-2026 09:00                |
| **Fin Est.**                   | Mié 22-07-2026 19:00                |
| **Fin Real**                   | —                                   |

> **Asignado a:** Javi HP (solo). 16 días lab × 10h/día = 160h. Sin vacaciones, sin descuentos.

### Tareas de desarrollo (Fase 2)

> MVP de integraciones: HubSpot + Zoho. **Sheets queda fuera del MVP** (aplazado a Fase 4).

| ID                               | Tarea                                                                               | Estimación | Estado       | Notas                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------- | ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| 3-01                             | Diseñar `IntegrationAdapter` interface + factory por tenant                         | 12h        | 🔘 Pendiente | phase-01 Sprint 2                                                                        |
| 3-02                             | Adapter HubSpot (OAuth2, contacts, deals, webhooks bidireccionales)                 | 44h        | 🔘 Pendiente | phase-02 Sprint 2 — el más grande del sprint                                             |
| 3-03                             | Adapter Zoho CRM (OAuth2 / API Key, leads, deals, multi-región es/es-mx)            | 28h        | 🔘 Pendiente | phase-03 Sprint 2 — multi-DC EU/US                                                       |
| 3-04                             | Tabla `crm_field_mapping` editable + `write_policy` (R-014 append-only por defecto) | 14h        | 🔘 Pendiente | phase-04 Sprint 2. Crítico                                                               |
| 3-05                             | UI admin para conectar CRM del tenant (panel)                                       | 20h        | 🔘 Pendiente | phase-05 Sprint 2                                                                        |
| 3-06                             | `crm_write_audit` log + visualización en panel admin                                | 10h        | 🔘 Pendiente | phase-06 Sprint 2                                                                        |
| 3-07                             | Tests de integración contra cuentas sandbox HubSpot + Zoho                          | 20h        | 🔘 Pendiente | phase-07 Sprint 2                                                                        |
| **Subtotal Fase 2 — Desarrollo** |                                                                                     | **148h**   |              | + ~10h cierre (phase-08). Total Sprint 2 ≈ 158h (con paralelismo 2 devs: 80-100h reales) |

### Tareas de cierre obligatorias (Sprint 2)

| ID                           | Tarea                                                                       | Estimación          | Estado       | Notas                               |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------- | ------------ | ----------------------------------- |
| SP-3-CLOSE-1                 | Auto test                                                                   | 1h 30min            | 🔘 Pendiente |                                     |
| SP-3-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                                | 2h 30min            | 🔘 Pendiente | Flujo OAuth completo HubSpot + Zoho |
| SP-3-CLOSE-3                 | Test Manual del Dev                                                         | 1h                  | 🔘 Pendiente |                                     |
| SP-3-CLOSE-4                 | Corrección de Bugs detectados                                               | (variable)          | 🔘 Pendiente |                                     |
| SP-3-CLOSE-5                 | Cierre de Sprint → PR a `developer` + bump a `v0.3.0` + crear rama Sprint 3 | 30min               | 🔘 Pendiente |                                     |
| **Subtotal cierre Sprint 2** |                                                                             | **5h 30min + bugs** |              |                                     |

---

## Fase 3 — Sprint 3: Hardening

| Campo                          | Valor                                   |
| ------------------------------ | --------------------------------------- |
| **Sprint ID**                  | `SP-4`                                  |
| **Versión objetivo al cierre** | `v0.4.0` (MVP completo, post-hardening) |
| **Estado del sprint**          | 🔘 Pendiente                            |
| **Estimación total**           | 2-3 sem (80h–120h)                      |
| **Rama de trabajo sugerida**   | `feature/sp-4-hardening`                |
| **Inicio**                     | Jue 23-07-2026 09:00                    |
| **Fin Est.**                   | Lun 10-08-2026 19:00                    |
| **Fin Real**                   | —                                       |

> **Asignado a:** Javi HP (solo). 13 días lab × 10h/día = 130h. **Cierre MVP v0.4.0 = Lun 10-08-2026.**

### Tareas de desarrollo (Fase 3)

> Tests E2E completos, observabilidad, dashboards de costes, accesibilidad WCAG 2.2 AA total.

| ID                               | Tarea                                                               | Estimación   | Estado       | Notas                                                               |
| -------------------------------- | ------------------------------------------------------------------- | ------------ | ------------ | ------------------------------------------------------------------- |
| 4-01                             | Test suite E2E completa (Playwright) cubriendo flujos golden path   | 20-22h       | 🔘 Pendiente | phase-01 Sprint 3 (parcial — comparte horas con 4-02)               |
| 4-02                             | Coverage target ≥80% unit + integration                             | 8-10h        | 🔘 Pendiente | phase-01 Sprint 3 (parte coverage). Total phase-01: 28-32h          |
| 4-03                             | Observabilidad: logging estructurado + métricas BullMQ + dashboards | 12-16h       | 🔘 Pendiente | phase-02 Sprint 3. Crea tabla `llm_usage_logs`                      |
| 4-04                             | Dashboard de costes LLM (tokens por proveedor por tenant)           | 16-22h       | 🔘 Pendiente | phase-03 Sprint 3. Depende de 4-03 (tabla)                          |
| 4-05                             | Refactor accesibilidad WCAG 2.2 AA en todo el admin panel           | 28-40h       | 🔘 Pendiente | phase-04 Sprint 3. Findings deep audit DA-5 (24 findings)           |
| 4-06                             | Hardening adicional: rate limits, CSP headers, CSRF tokens          | 10-14h       | 🔘 Pendiente | phase-05 Sprint 3                                                   |
| 4-07                             | Documentación final cliente: release notes v0.4.0                   | 6-8h         | 🔘 Pendiente | phase-06 Sprint 3                                                   |
| **Subtotal Fase 3 — Desarrollo** |                                                                     | **100-132h** |              | Objetivo base 116h. + 8h cierre phase-07. Total 108-140h con cierre |

### Tareas de cierre obligatorias (Sprint 3)

| ID                           | Tarea                                                                                                  | Estimación    | Estado       | Notas                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- | ------------ | ------------------------------ |
| SP-4-CLOSE-1                 | Auto test                                                                                              | 1h 30min      | 🔘 Pendiente |                                |
| SP-4-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA — recorrido completo MVP                                                  | 4h            | 🔘 Pendiente | Más extenso por ser cierre MVP |
| SP-4-CLOSE-3                 | Test Manual del Dev                                                                                    | 2h            | 🔘 Pendiente | Más extenso                    |
| SP-4-CLOSE-4                 | Corrección de Bugs detectados                                                                          | (variable)    | 🔘 Pendiente |                                |
| SP-4-CLOSE-5                 | Cierre de Sprint → PR a `developer` + **bump a `v0.4.0`** + invitar a planificar Fase 4 (o cierre MVP) | 30min         | 🔘 Pendiente | MVP completo                   |
| **Subtotal cierre Sprint 3** |                                                                                                        | **8h + bugs** |              |                                |

---

## Fase 4 — Sprint 4: Google Sheets bidireccional

| Campo                          | Valor                                    |
| ------------------------------ | ---------------------------------------- |
| **Sprint ID**                  | `SP-5`                                   |
| **Versión objetivo al cierre** | `v0.5.0`                                 |
| **Estado del sprint**          | 🔘 Pendiente (post-MVP, requiere v0.4.0) |
| **Estimación total**           | 60-100h                                  |
| **Rama de trabajo sugerida**   | `feature/sp-5-01-google-sheets`          |
| **Inicio**                     | Mar 11-08-2026 09:00                     |
| **Fin Est.**                   | Vie 21-08-2026 19:00                     |
| **Fin Real**                   | —                                        |

> **Asignado a:** Javi HP (solo). 9 días lab × 10h/día = 90h. Estimación dentro del rango 60-100h.

### Tareas de desarrollo (Fase 4)

> Sincronización bidireccional Esden ↔ Google Sheets. Push via BullMQ. Pull via Drive push notifications. `googleapis@171.4.0` YA INSTALADO — cero deps nuevas.

| ID                               | Tarea                                                                                                | Estimación  | Estado       | Notas                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | ------------ | ------------------------------------------------ |
| 5-01-a                           | DB migration: columnas Sheets (`spreadsheet_id`, `gsheet_channel_id`, `gsheet_channel_expiry`, etc.) | 4-6h        | 🔘 Pendiente | Sobre tabla `crm_connections`                    |
| 5-01-b                           | `GoogleSheetsAdapter` + OAuth2 (refresh tokens, multi-tenant)                                        | 14-22h      | 🔘 Pendiente | `src/lib/integrations/sheets/*`                  |
| 5-01-c                           | Push job (BullMQ) + idempotencia `_esden_updated_at` + batching                                      | 12-18h      | 🔘 Pendiente | Reutiliza patrón Sprint 2                        |
| 5-01-d                           | Pull webhook `/api/webhooks/google-sheets` + Drive push notifications + canal renew cron             | 14-22h      | 🔘 Pendiente | TTL 7 días → renovación obligatoria              |
| 5-01-e                           | UI admin: form conexión Sheets + plantilla maestra + field-mapper                                    | 10-18h      | 🔘 Pendiente | Extiende UI Sprint 2                             |
| 5-01-f                           | Tests integración sandbox + auditoría `crm_write_audit`                                              | 6-14h       | 🔘 Pendiente | OAuth real con cuenta test                       |
| **Subtotal Fase 4 — Desarrollo** |                                                                                                      | **60-100h** |              | Reutiliza código OAuth previo (commit `63e1e6e`) |

### Tareas de cierre obligatorias (Sprint 4)

| ID                           | Tarea                                                                    | Estimación          | Estado       | Notas                       |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------ | --------------------------- |
| SP-5-CLOSE-1                 | Auto test                                                                | 1h 30min            | 🔘 Pendiente |                             |
| SP-5-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                             | 2h 30min            | 🔘 Pendiente | Flujo OAuth Google completo |
| SP-5-CLOSE-3                 | Test Manual del Dev                                                      | 1h                  | 🔘 Pendiente |                             |
| SP-5-CLOSE-4                 | Corrección de Bugs detectados                                            | (variable)          | 🔘 Pendiente |                             |
| SP-5-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.5.0` + crear rama Sprint 5 | 30min               | 🔘 Pendiente |                             |
| **Subtotal cierre Sprint 4** |                                                                          | **5h 30min + bugs** |              |                             |

---

## Fase 5 — Sprint 5: Salesforce adapter

| Campo                          | Valor                     |
| ------------------------------ | ------------------------- |
| **Sprint ID**                  | `SP-6`                    |
| **Versión objetivo al cierre** | `v0.6.0`                  |
| **Estado del sprint**          | 🔘 Pendiente              |
| **Estimación total**           | 60-100h                   |
| **Rama de trabajo sugerida**   | `feature/sp-6-salesforce` |
| **Inicio**                     | Lun 24-08-2026 09:00      |
| **Fin Est.**                   | Jue 03-09-2026 19:00      |
| **Fin Real**                   | —                         |

> **Asignado a:** Javi HP (solo). 9 días lab × 10h/día = 90h. Estimación dentro del rango 60-100h.

### Tareas de desarrollo (Fase 5)

> Adapter Salesforce vía `jsforce@^3.10.15` (OAuth2 + Connected Apps). Clientes enterprise. Requiere ADR aprobado antes de instalar.

| ID                               | Tarea                                                                | Estimación  | Estado       | Notas               |
| -------------------------------- | -------------------------------------------------------------------- | ----------- | ------------ | ------------------- |
| 6-01                             | ADR + instalación `jsforce@^3.10.15`                                 | 2-4h        | 🔘 Pendiente | Vía `af-agents:adr` |
| 6-02                             | OAuth2 Connected App + token refresh + multi-instance (prod/sandbox) | 12-20h      | 🔘 Pendiente |                     |
| 6-03                             | `SalesforceAdapter`: Leads + Contacts + Opportunities CRUD           | 18-30h      | 🔘 Pendiente |                     |
| 6-04                             | Webhooks bidireccionales (Platform Events / Streaming API)           | 12-20h      | 🔘 Pendiente |                     |
| 6-05                             | UI admin: conexión + field-mapper Salesforce-específico              | 8-14h       | 🔘 Pendiente |                     |
| 6-06                             | Tests integración sandbox Salesforce                                 | 8-12h       | 🔘 Pendiente |                     |
| **Subtotal Fase 5 — Desarrollo** |                                                                      | **60-100h** |              |                     |

### Tareas de cierre obligatorias (Sprint 5)

| ID                           | Tarea                                                                    | Estimación          | Estado       | Notas |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------ | ----- |
| SP-6-CLOSE-1                 | Auto test                                                                | 1h 30min            | 🔘 Pendiente |       |
| SP-6-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                             | 2h 30min            | 🔘 Pendiente |       |
| SP-6-CLOSE-3                 | Test Manual del Dev                                                      | 1h                  | 🔘 Pendiente |       |
| SP-6-CLOSE-4                 | Corrección de Bugs detectados                                            | (variable)          | 🔘 Pendiente |       |
| SP-6-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.6.0` + crear rama Sprint 6 | 30min               | 🔘 Pendiente |       |
| **Subtotal cierre Sprint 5** |                                                                          | **5h 30min + bugs** |              |       |

---

## Fase 6 — Sprint 6: GoHighLevel adapter

| Campo                          | Valor                      |
| ------------------------------ | -------------------------- |
| **Sprint ID**                  | `SP-7`                     |
| **Versión objetivo al cierre** | `v0.7.0`                   |
| **Estado del sprint**          | 🔘 Pendiente               |
| **Estimación total**           | 40-80h                     |
| **Rama de trabajo sugerida**   | `feature/sp-7-gohighlevel` |
| **Inicio**                     | Vie 04-09-2026 09:00       |
| **Fin Est.**                   | Lun 14-09-2026 19:00       |
| **Fin Real**                   | —                          |

> **Asignado a:** Javi HP (solo). 7 días lab × 10h/día = 70h. Estimación dentro del rango 40-80h.

### Tareas de desarrollo (Fase 6)

> Adapter GoHighLevel (OAuth2 v2). Foco Latam EduTech. Requiere app registrada en GHL Marketplace.

| ID                               | Tarea                                                      | Estimación | Estado       | Notas              |
| -------------------------------- | ---------------------------------------------------------- | ---------- | ------------ | ------------------ |
| 7-01                             | Registrar app en GHL Marketplace + setup OAuth2 v2         | 4-8h       | 🔘 Pendiente | Bloqueante externo |
| 7-02                             | `GoHighLevelAdapter`: Contacts + Opportunities + Calendars | 14-26h     | 🔘 Pendiente |                    |
| 7-03                             | Webhooks GHL (eventos bidireccionales)                     | 8-16h      | 🔘 Pendiente |                    |
| 7-04                             | UI admin: conexión + field-mapper                          | 8-14h      | 🔘 Pendiente |                    |
| 7-05                             | Tests integración sandbox GHL                              | 6-16h      | 🔘 Pendiente |                    |
| **Subtotal Fase 6 — Desarrollo** |                                                            | **40-80h** |              |                    |

### Tareas de cierre obligatorias (Sprint 6)

| ID                           | Tarea                                                                    | Estimación          | Estado       | Notas |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------ | ----- |
| SP-7-CLOSE-1                 | Auto test                                                                | 1h 30min            | 🔘 Pendiente |       |
| SP-7-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                             | 2h 30min            | 🔘 Pendiente |       |
| SP-7-CLOSE-3                 | Test Manual del Dev                                                      | 1h                  | 🔘 Pendiente |       |
| SP-7-CLOSE-4                 | Corrección de Bugs detectados                                            | (variable)          | 🔘 Pendiente |       |
| SP-7-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.7.0` + crear rama Sprint 7 | 30min               | 🔘 Pendiente |       |
| **Subtotal cierre Sprint 6** |                                                                          | **5h 30min + bugs** |              |       |

---

## Fase 7 — Sprint 7: ActiveCampaign adapter

| Campo                          | Valor                         |
| ------------------------------ | ----------------------------- |
| **Sprint ID**                  | `SP-8`                        |
| **Versión objetivo al cierre** | `v0.8.0`                      |
| **Estado del sprint**          | 🔘 Pendiente                  |
| **Estimación total**           | 20-50h                        |
| **Rama de trabajo sugerida**   | `feature/sp-8-activecampaign` |
| **Inicio**                     | Mar 15-09-2026 09:00          |
| **Fin Est.**                   | Vie 18-09-2026 19:00          |
| **Fin Real**                   | —                             |

> **Asignado a:** Javi HP (solo). 4 días lab × 10h/día = 40h. Estimación dentro del rango 20-50h.

### Tareas de desarrollo (Fase 7)

> Adapter ActiveCampaign (API Key). Foco marketing-first. La integración más sencilla de las 4 (sin OAuth complejo).

| ID                               | Tarea                                                    | Estimación | Estado       | Notas       |
| -------------------------------- | -------------------------------------------------------- | ---------- | ------------ | ----------- |
| 8-01                             | Setup auth API Key + multi-cuenta                        | 2-4h       | 🔘 Pendiente | Auth simple |
| 8-02                             | `ActiveCampaignAdapter`: Contacts + Deals + Tags + Lists | 8-20h      | 🔘 Pendiente |             |
| 8-03                             | Webhooks (eventos contact updated, deal stage changed)   | 4-10h      | 🔘 Pendiente |             |
| 8-04                             | UI admin: conexión + field-mapper                        | 4-10h      | 🔘 Pendiente |             |
| 8-05                             | Tests integración sandbox                                | 2-6h       | 🔘 Pendiente |             |
| **Subtotal Fase 7 — Desarrollo** |                                                          | **20-50h** |              |             |

### Tareas de cierre obligatorias (Sprint 7)

| ID                           | Tarea                                                                    | Estimación          | Estado       | Notas |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------ | ----- |
| SP-8-CLOSE-1                 | Auto test                                                                | 1h 30min            | 🔘 Pendiente |       |
| SP-8-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                             | 2h 30min            | 🔘 Pendiente |       |
| SP-8-CLOSE-3                 | Test Manual del Dev                                                      | 1h                  | 🔘 Pendiente |       |
| SP-8-CLOSE-4                 | Corrección de Bugs detectados                                            | (variable)          | 🔘 Pendiente |       |
| SP-8-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.8.0` + crear rama Sprint 8 | 30min               | 🔘 Pendiente |       |
| **Subtotal cierre Sprint 7** |                                                                          | **5h 30min + bugs** |              |       |

---

## Fase 8 — Sprint 8: Adapter pattern generalization

| Campo                          | Valor                                               |
| ------------------------------ | --------------------------------------------------- |
| **Sprint ID**                  | `SP-9`                                              |
| **Versión objetivo al cierre** | `v0.9.0`                                            |
| **Estado del sprint**          | 🔘 Pendiente (bloqueado hasta SP-4..SP-7 completos) |
| **Estimación total**           | 20-40h                                              |
| **Rama de trabajo sugerida**   | `feature/sp-9-adapter-generalization`               |
| **Inicio**                     | Lun 21-09-2026 09:00                                |
| **Fin Est.**                   | Jue 24-09-2026 19:00                                |
| **Fin Real**                   | —                                                   |

> **Asignado a:** Javi HP (solo). 4 días lab × 10h/día = 40h. Estimación dentro del rango 20-40h.

### Tareas de desarrollo (Fase 8)

> Refactor post-implementación: tras tener 6 adapters reales (HubSpot, Zoho, Sheets, Salesforce, GHL, ActiveCampaign), generalizar el patrón. Extraer abstracciones comunes: OAuth flow, field mapping, webhook handling, rate limiting, write_policy.

| ID                               | Tarea                                                                           | Estimación | Estado       | Notas                                    |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------- | ------------ | ---------------------------------------- |
| 9-01                             | Análisis comparativo: extraer patrones comunes a los 6 adapters                 | 4-8h       | 🔘 Pendiente | Bloqueado hasta SP-4..SP-7 completos     |
| 9-02                             | Refactor `IntegrationAdapter` base: OAuth flow genérico + field mapper genérico | 8-14h      | 🔘 Pendiente |                                          |
| 9-03                             | Generalizar webhook handling + signature verification                           | 4-8h       | 🔘 Pendiente |                                          |
| 9-04                             | Generalizar rate limiting / retry / circuit breaker por adapter                 | 4-10h      | 🔘 Pendiente |                                          |
| **Subtotal Fase 8 — Desarrollo** |                                                                                 | **20-40h** |              | Bloqueado: requiere SP-4..SP-7 completos |

### Tareas de cierre obligatorias (Sprint 8)

| ID                           | Tarea                                                                    | Estimación          | Estado       | Notas |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- | ------------ | ----- |
| SP-9-CLOSE-1                 | Auto test                                                                | 1h 30min            | 🔘 Pendiente |       |
| SP-9-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                             | 2h 30min            | 🔘 Pendiente |       |
| SP-9-CLOSE-3                 | Test Manual del Dev                                                      | 1h                  | 🔘 Pendiente |       |
| SP-9-CLOSE-4                 | Corrección de Bugs detectados                                            | (variable)          | 🔘 Pendiente |       |
| SP-9-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.9.0` + crear rama Sprint 9 | 30min               | 🔘 Pendiente |       |
| **Subtotal cierre Sprint 8** |                                                                          | **5h 30min + bugs** |              |       |

---

## Fase 9 — Sprint 9: Tier 2 on-demand (backlog)

| Campo                          | Valor                                 |
| ------------------------------ | ------------------------------------- |
| **Sprint ID**                  | `SP-10`                               |
| **Versión objetivo al cierre** | `v0.10.x+` (incremental por CRM)      |
| **Estado del sprint**          | 🔘 Backlog (on-demand)                |
| **Estimación total**           | ~30-50h por CRM (sólo bajo pedido)    |
| **Rama de trabajo sugerida**   | `feature/sp-10-tier2-<crm>` (por CRM) |
| **Inicio**                     | TBD (on-demand)                       |
| **Fin Est.**                   | TBD (on-demand)                       |
| **Fin Real**                   | —                                     |

> **Asignado a:** Javi HP (solo, por defecto). On-demand: sólo bajo pedido cliente.

### Tareas de desarrollo (Fase 9) — Backlog

> CRMs Tier 2 sólo se implementan **bajo pedido explícito de cliente**. No entran en estimación ni planificación proactiva. Cada CRM se ejecuta como mini-sprint independiente con bump v0.10.x.

| ID                               | Tarea                         | Estimación                   | Estado     | Notas                                          |
| -------------------------------- | ----------------------------- | ---------------------------- | ---------- | ---------------------------------------------- |
| 10-01                            | Clientify adapter (on-demand) | ~30-50h                      | 🔘 Backlog | Sólo si cliente lo pide                        |
| 10-02                            | Bitrix24 adapter (on-demand)  | ~30-50h                      | 🔘 Backlog | Sólo si cliente lo pide                        |
| 10-03                            | Pipedrive adapter (on-demand) | ~30-50h                      | 🔘 Backlog | Sólo si cliente lo pide                        |
| 10-04                            | Monday adapter (on-demand)    | ~30-50h                      | 🔘 Backlog | Sólo si cliente lo pide                        |
| 10-05                            | Holded adapter (on-demand)    | ~30-50h                      | 🔘 Backlog | Sólo si cliente lo pide                        |
| **Subtotal Fase 9 — Desarrollo** |                               | **~30-50h por CRM activado** |            | No suma al total del proyecto hasta activación |

### Tareas de cierre obligatorias (Sprint 9)

> Plantilla aplicable cada vez que se activa un CRM Tier 2.

| ID                           | Tarea                                                       | Estimación                  | Estado     | Notas |
| ---------------------------- | ----------------------------------------------------------- | --------------------------- | ---------- | ----- |
| SP-10-CLOSE-1                | Auto test                                                   | 1h 30min                    | 🔘 Backlog |       |
| SP-10-CLOSE-2                | Test E2C Local + WCAG 2.2 AA                                | 2h 30min                    | 🔘 Backlog |       |
| SP-10-CLOSE-3                | Test Manual del Dev                                         | 1h                          | 🔘 Backlog |       |
| SP-10-CLOSE-4                | Corrección de Bugs detectados                               | (variable)                  | 🔘 Backlog |       |
| SP-10-CLOSE-5                | Cierre Sprint → PR a `developer` + bump a `v0.10.x` por CRM | 30min                       | 🔘 Backlog |       |
| **Subtotal cierre Sprint 9** |                                                             | **5h 30min + bugs por CRM** |            |       |

### Pre-requisitos del cierre Sprint 9 (gates)

Aplican los mismos gates que el resto de sprints, además:

- [ ] Pedido explícito del cliente para ese CRM concreto (registrado en issue / decisión audit).
- [ ] Sprint 8 (generalización adapter) en 🟢 — para aprovechar la abstracción común.

---

## Métricas de éxito por sprint

| Sprint                             | Cierre = OK cuando...                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 0 (v0.1.0)**              | 0 credenciales hardcoded en `src/` · 0 endpoints orquestación sin auth accesibles desde internet · 0 webhooks con firma omitida incondicionalmente · `worker.js:58` firma corregida (flujo multi-día funciona) · RLS `tenants` no devuelve registros ajenos · typecheck+lint+build+tests sin errores · CHANGELOG `[v0.1.0]` completo · todas las tareas en 🔵/🟢 antes de SP-1-CLOSE-5                               |
| **Sprint 1 (v0.2.0)**              | typecheck+lint+build sin errores · tests integración BD real (repos principales) pass · 0 queries directas `pg`/`postgres` en `src/app/api/` o `src/lib/actions/` · 0 JWTs `service_role` residuales fuera de admin scripts · `as any` reducidos >80% (426 → <85) · RLS `ai_agents`, `web_widgets`, `programs` corregida · `next@16.2.6` instalado (1-26) · hook `af-productivity-logger.cjs` operativo              |
| **Sprint 2 (v0.3.0)**              | typecheck+lint+build sin errores · tenant conecta HubSpot vía OAuth2 desde UI admin · tenant conecta Zoho vía OAuth2 desde UI admin · push HubSpot/Zoho respeta R-014 append-only · webhook HubSpot valida `X-HubSpot-Signature-v3` · webhook Zoho valida token de canal · `crm_write_audit` registra toda sobrescritura `overwrite_with_audit` · RLS tenant-only en integraciones · tests sandbox HubSpot+Zoho pass |
| **Sprint 3 (v0.4.0 — cierre MVP)** | `npx playwright test` → 0 failed (6+ golden path flows) · coverage `lines ≥ 80%`, `functions ≥ 80%` · Lighthouse a11y ≥ 90 en todas las rutas dashboard · 0 findings Critical DA-5 sin resolver · CSP headers en todas las rutas · rate limiting activo (`/api/auth/*` 5 req/min, `/api/*` 100 req/min) · dashboard costes LLM visible admin · Pino logging activo (API + workers) · CHANGELOG `[v0.4.0]` completo   |
| **Sprint 4 (v0.5.0)**              | Tenant conecta Google vía OAuth2 desde UI admin · push Esden→Sheet < 5 min latencia · pull Sheet→Esden < 5 min (vía Drive webhook) · sin duplicados (idempotencia `_esden_updated_at`) · sin bucle push/pull infinito · canal Drive renovado antes de TTL 7 días · `crm_write_audit` registra todo sync · RLS tenant-only en `crm_connections` · typecheck+lint+build+tests sin errores                              |
| **Sprint 5 (v0.6.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: tenant conecta Salesforce vía OAuth2 Connected App (prod+sandbox) · CRUD Leads/Contacts/Opportunities funcional · webhooks bidireccionales (Platform Events/Streaming) operativos · tests integración sandbox pass                                                                                                                                        |
| **Sprint 6 (v0.7.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: app registrada en GHL Marketplace + OAuth2 v2 · adapter Contacts+Opportunities+Calendars funcional · webhooks GHL bidireccionales · tests sandbox GHL pass                                                                                                                                                                                                |
| **Sprint 7 (v0.8.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: auth API Key multi-cuenta funcional · adapter Contacts+Deals+Tags+Lists · webhooks ActiveCampaign (contact updated, deal stage changed) · tests sandbox pass                                                                                                                                                                                              |
| **Sprint 8 (v0.9.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: `IntegrationAdapter` base con OAuth flow + field mapper genéricos · webhook handling + signature verification generalizado · rate limiting/retry/circuit breaker por adapter generalizado · refactor sin regresión en 6 adapters existentes                                                                                                               |
| **Sprint 9 (v0.10.x+)**            | Plantilla on-demand: por cada CRM Tier 2 activado, cumplir gates estándar de cierre de sprint + pedido explícito cliente registrado                                                                                                                                                                                                                                                                                  |

---

## Resumen del estado actual

| Sprint                | Versión objetivo | Estado       | Tareas dev                            | Estimación dev                              | Cierre          |
| --------------------- | ---------------- | ------------ | ------------------------------------- | ------------------------------------------- | --------------- |
| **Sprint 0** (Fase 0) | v0.1.0           | 🔘 Pendiente | **26** (detalladas)                   | ~100h 30min (2 sem con paralelismo)         | 5h 30min + bugs |
| **Sprint 1** (Fase 1) | v0.2.0           | 🔘 Pendiente | **33** (detalladas, con 1 movida a 0) | ~172h (3-4 sem con paralelismo)             | 5h 30min + bugs |
| **Sprint 2** (Fase 2) | v0.3.0           | 🔘 Pendiente | 7 (detalladas con phase files)        | 148h (~80-100h reales con 2 devs paralelos) | 5h 30min + bugs |
| **Sprint 3** (Fase 3) | v0.4.0           | 🔘 Pendiente | 7 (detalladas con phase files)        | 100-132h (objetivo base 116h)               | 8h + bugs       |
| **Sprint 4** (Fase 4) | v0.5.0           | 🔘 Pendiente | 6 (Google Sheets bidireccional)       | 60-100h                                     | 5h 30min + bugs |
| **Sprint 5** (Fase 5) | v0.6.0           | 🔘 Pendiente | 6 (Salesforce adapter)                | 60-100h                                     | 5h 30min + bugs |
| **Sprint 6** (Fase 6) | v0.7.0           | 🔘 Pendiente | 5 (GoHighLevel adapter)               | 40-80h                                      | 5h 30min + bugs |
| **Sprint 7** (Fase 7) | v0.8.0           | 🔘 Pendiente | 5 (ActiveCampaign adapter)            | 20-50h                                      | 5h 30min + bugs |
| **Sprint 8** (Fase 8) | v0.9.0           | 🔘 Pendiente | 4 (Adapter generalization)            | 20-40h (bloqueado hasta SP-4..SP-7)         | 5h 30min + bugs |
| **Sprint 9** (Fase 9) | v0.10.x+         | 🔘 Backlog   | 5 (Tier 2 on-demand)                  | ~30-50h por CRM activado (no suma a total)  | 5h 30min + bugs |

**Totales del proyecto (excluyendo Sprint 9 on-demand):**

- **MVP (Sprints 0+1+2+3)**: ~520-570h base + cierres (~25h) + bugs variables
- **Post-MVP (Sprints 4..8)**: ~200-370h base + cierres (~28h) + bugs variables
- **Total proyecto sin Tier 2**: ~720-940h + cierres + bugs

---

## Cómo el agente actualiza este documento

Ver [.claude/agents/roadmap-keeper.md](../.claude/agents/roadmap-keeper.md) para el detalle.

Reglas clave:

1. Cada vez que una tarea cambia de estado → el agente actualiza la celda + añade timestamp interno en el log.
2. Cada vez que se planifica un sprint en detalle → el agente reemplaza las filas placeholder por tareas concretas con estimación real.
3. Cada vez que se cierra un sprint → el agente actualiza `Fin Real`, marca el sprint como 🟢 COMPLETADA, bumpea la versión del proyecto en frontmatter.
4. Cuando hay desviación significativa de estimación → el agente avisa al manager y al `productivity` agent.

---

**Última actualización**: 21-05-2026 14:30 por `roadmap-keeper` (políticas operativas sesión 21-05: sin vacaciones, Javi HP 10h/día, Renzo 8h/día disponible sin asignar, MVP ASAP, staging on-demand del usuario, local-first Supabase, sistema log propio, minimizar GitHub Actions; tarea 0-01 pre-push hooks añadida; fechas recalculadas con 10h/día → MVP v0.4.0 cierre Lun 10-08-2026 (adelantado ~7 semanas vs cálculo anterior)).
