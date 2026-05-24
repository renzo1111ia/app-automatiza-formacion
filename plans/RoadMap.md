---
title: "RoadMap dashboard-af"
audience: equipo de desarrollo
status: LIVING_DOCUMENT
maintained_by: agente `roadmap-keeper` (proactivo) — orquestado por `af-agents:manager`
last_updated: 24-05-2026 16:45
last_updated_by: Javi HP (Sprint 2 autoexec + ck-debug + PR #12 + rebajada de versiones MVP: Sprint 2=v0.2.5, Sprint 2B=v0.2.7, Sprint 3=v0.3.0-rc.1, MVP GA=v0.3.0)
project_version: v0.2.0
versioning_policy: "Rebajada 24-05-2026 por decisión Javi HP. Mapa nuevo: Sprint 0=v0.1.0, Sprint 1=v0.2.0, Sprint 2=v0.2.5, Sprint 2B=v0.2.7, Sprint 3=v0.3.0-rc.1, SP-4B Validación MVP GA=v0.3.0, Sprint 4 Sheets=v0.4.0, Sprint Costes-LLM=v0.4.1, Sprint Refinamiento=v0.4.2, Sprint 5 Salesforce=v0.5.0, etc."
sprint_0_progress: "✅ **Released v0.1.0 — Sprint 0 cerrado 22-05-2026 17:29 + cierre formal PR #4 a las 19:30** · Tag `v0.1.0` en commit `a387dfe` (merge PR #2) · DEV 🟢: 0-00, 0-01, 1-01, 1-02, 1-04, 1-06, 1-07..1-27 (26 tareas locales). 1-03, 1-05 → 🟡 diferidas 100% VPS pre-deploy staging. Cierre completo: CLOSE-1 🟢 (~30min, DONE_WITH_CONCERNS aceptado, lint 118 err preexistentes), CLOSE-2 🟢 (~45min, 24/24 E2E + 5 WCAG findings + 2 bugs corregidos), CLOSE-3 🟢 (~1h 30min, análisis Bea+Renzo V1), CLOSE-4 🟢 (~25min, 2 bugs + 2 lint fixes), CLOSE-5 🟢 (~45min, CHANGELOG + RoadMap + PR #4 cierre formal). ⏱ **Total Sprint 0: ~11h 5min vs 118h estimadas (−91%)**. CHANGELOG.md publicado."
sprint_1_progress: "MERGEADO a developer vía PR #5 (commit `94c035a`) · ⏱ Real efectivo ~12h vs ~205h estim (paralelismo orquestación). 24 tareas 🟢 Completada (Bloques 2.1, 2.2, 2.3, 2.6 completos · 2.5, 2.7, 2.8 parcial · 2.9 completo). 8 tareas 🟢 Diferida (2-19..2-22 a ADR-019; 2-31, 2-32, 2-34 a ADR-018; 2-36 a Sprint Costes-LLM; NEW-01 paso 3 a v0.5.3). 6 ADRs creados (014-019). SP-2-CLOSE-1..5 ✅ excepto CLOSE-3 diferido a SP-4B phase-02. ENCRYPTION_KEY env crítica para deploy. Resumen: `plans/260520-1342-sprint-1-capa-datos/SP-2-CLOSE-summary.md`."
autoexec_plan_260524_progress: "✅ COMPLETADO 24-05-2026 ~11:30 (3 commits directos a developer + 1 commit cierre) · Plan `plans/260524-1020-doc-agent-empty-states-full/` ejecutado sin intervención post-/clear · Phase B `6701b74` (70 alerts→toast, EmptyState, web_widgets.updated_at + orchestrator flag migrations LOCAL+VPS) · Phase C `93cf858` (help_sections table + API + HelpPageShell + /dashboard/docs-admin + /dashboard/docs-clientes + 11 secciones seeded LOCAL+VPS) · Phase D `e0dda4c` (help-docs-keeper agent actualizado a 2 scopes + hook `af-docs-watcher.cjs` registrado y testeado) · Cierre `b0e6769`. VPS aplicado vía pg-meta REST (SSH key denegada, workaround documentado en `reference-vps-pg-meta.md`). 11/12 acceptance criteria · 1 diferido orgánicamente (screenshots WCAG-validated, los hace help-docs-keeper en próximos Edit/Write)."
sprint_2_progress: "🔵 SUBIDA RAMA + PR #12 abierto 24-05-2026 16:30 · branch `feature/sprint-02-adapter-hubspot-zoho` pushed · **Target version: `v0.2.5`** (rebajada de v0.3.0 24-05-2026) · 11 commits (autoexec previo + Phase 00-07 + ck-debug + lint cleanup + roadmap) · 170 tests Vitest verdes · Typecheck + build + lint diff verdes · ADR-021/022/023 + doc crm-adapters.md + hand-off SP-4B/phase-03 · PR #12 a `developer`: https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/pull/12 · **Pendiente merge orden usuario.** Post-merge: bump package.json v0.2.5 + tag + release notes. **Bloqueante pre-deploy:** HubSpot Public App + OAUTH_STATE_SECRET + migración help_sections al VPS."
excluded_from: [staging, main]
---

# RoadMap — dashboard-af

> ⚠️ **Documento vivo**. Mantenido proactivamente por el agente [`af-agents:roadmap-keeper`](../.claude/agents/roadmap-keeper.md). NO editar directamente sin orden del lead — pide al agente que lo haga.
>
> Cada tarea/fase/sprint tiene **estimación de tiempo** y **estado**. El agente actualiza el estado automáticamente cuando arranca o termina trabajo. Cualquier dev puede consultar aquí en qué fase va el proyecto.

---

## Políticas operativas (sesión planificación 21-05-2026)

| Item                              | Política                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vacaciones / festivos             | **Javi HP sin vacaciones programadas en 2026.** Calendario L-V completo.                                                                                                                                                                                                                                                                                                                                                          |
| Capacidad devs                    | **Javi HP: 10h productivas/día**, L-V, sin vacaciones 2026 (orquesta + dev Sprints 0/1/2/2B/3). **Renzo: 8h productivas/día** + equipo de QA propio. Asignaciones cerradas: **SP-4B Sprint Validación Pre-MVP** (Mar 04-08 → Vie 14-08-2026, ~40-55h) y **Sprint Refinamiento Herramientas Internas post-MVP** (Simulator + Lanzador `/calls`, post-Costes-LLM). Decisión 22-05-2026 tras revisión docs Bea (clienta) + Renzo V1. |
| Deadline MVP                      | **"Lo antes posible"** — objetivo Lun 10-08-2026 (v0.3.0 GA, rebajado desde v0.4.0 por decisión 24-05-2026). Sin compromiso externo de fecha con cliente.                                                                                                                                                                                                                                                                         |
| Release a staging                 | **NO automático por sprint.** El usuario decide manualmente cuándo subir cada sprint a `staging` para review de la cliente. PRs paran en `developer` hasta orden explícita.                                                                                                                                                                                                                                                       |
| Acceso Supabase del cliente (VPS) | **Diferido al pre-deploy.** Trabajamos **local-first** con Supabase self-hosted local. El acceso al VPS de Easypanel se prepara y rota tokens **antes del primer despliegue a staging**, no antes.                                                                                                                                                                                                                                |
| Tracking de tiempos y tareas      | **Sistema propio** — hook `af-productivity-logger.cjs` (tarea 2-30, Sprint 1). NO se usa GitHub Issues, Linear, Jira ni sistemas externos.                                                                                                                                                                                                                                                                                        |
| GitHub Actions                    | **Minimizar al máximo.** Tier gratis = 2000 min/mes. Todo lo que pueda ejecutarse en local (typecheck, lint, build, test, browser tests, security scan) se ejecuta **LOCAL** vía pre-push hooks (tarea 0-01). CI en GH Actions solo para verificación mínima sobre PRs a `developer`.                                                                                                                                             |

> Decisiones tomadas en sesión 21-05-2026 con Javi HP. Si alguna cambia, actualizar este bloque ANTES de seguir con el resto del roadmap.

### 👤 Renzo + equipo (asignaciones cerradas)

> Tareas y sprints específicamente asignados al equipo de desarrollo de Renzo. **Visibilidad clara**: cualquier tarea/sprint con el icono 👤 en este RoadMap pertenece a Renzo + su equipo, no a Javi HP.

| Sprint                                                      | Versión     | Fechas                  | Estim           | Estado       | Notas                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ----------- | ----------------------- | --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 👤 **SP-4B — Sprint Validación Pre-MVP**                    | `v0.3.0 GA` | 04-08-2026 → 14-08-2026 | 40-55h          | 🔘 Pendiente | QA en VPS de los Sprints 0+1+2+2B+3. Re-test automático + E2C local + E2E VPS + **manual humano absorbido de CLOSE-3 de cada sprint MVP**. Bumpea SemVer a v0.3.0 GA (MVP). Detalle: [`plans/260522-1700-sprint-validacion-pre-mvp/plan.md`](260522-1700-sprint-validacion-pre-mvp/plan.md)                     |
| 👤 **Sprint Refinamiento Herramientas Internas (post-MVP)** | `v0.5.2`    | Post Costes-LLM         | 18-22h + cierre | 🔘 Pendiente | Fase 01 Simulator persistencia BD + voz · Fase 02 Lanzador `/calls` Retell SDK + WebSocket. Tareas movidas FUERA del MVP por decisión 22-05-2026 (Bea + Renzo). Detalle: [`plans/260522-1830-sprint-refinamiento-herramientas-post-mvp/plan.md`](260522-1830-sprint-refinamiento-herramientas-post-mvp/plan.md) |

**Tareas individuales de Renzo dentro de otros sprints**:

- Sprints 1, 2, 2B, 3: la subtarea **`SP-N-CLOSE-3 (test manual del dev)`** está **diferida a SP-4B phase-NN bloque 4** — Renzo la absorbe junto con su validación E2E VPS. Documentado en cada sección de cierre.

**Capacidad Renzo**: 8h productivas/día. Asume todo el bloque de validación pre-MVP (~2 semanas) y el refinamiento post-MVP. Disponibilidad fuera de esos sprints: backlog libre.

**Coordinación**:

- Hand-off de cada Sprint MVP (1, 2, 2B, 3) a Renzo: en `SP-N-CLOSE-5` se rellena la plantilla [`plans/260522-1700-sprint-validacion-pre-mvp/phase-NN-validacion-sprint-N.md`](260522-1700-sprint-validacion-pre-mvp/) con tests, comandos, manual checklist, variables VPS y bugs ya cerrados.
- Hand-off Sprint Refinamiento: tras `SP-5B-CLOSE-5` (cierre Costes-LLM), Javi HP redacta el plan detallado del refinamiento y notifica a Renzo.

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

| Métrica                                                                  | Valor                                                                                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fases                                                                    | 10 (0..9) + Fase 2.5 (Sprint 2B Dashboard KPIs MVP) + Fase 3.5 (Sprint Validación Pre-MVP) + Fase 4.5 (Sprint Costes-LLM) + Fase 4.6 (Sprint Refinamiento Herramientas post-MVP) |
| Sprints planificados                                                     | 10 + 1 dashboard KPIs MVP (SP-3B v0.2.7) + 1 validación pre-MVP (SP-4B v0.3.5 GA) + 1 costes-LLM (v0.4.1) + 1 refinamiento herramientas (v0.4.2)                                 |
| Tareas de cierre obligatorias por sprint                                 | 5                                                                                                                                                                                |
| **Estimación total MVP (Sprints 0+1+2+3)**                               | ~9-12 semanas                                                                                                                                                                    |
| **Post-MVP (Sprint 4 Sheets + Sprint Costes-LLM v0.4.1 + Sprints 5..9)** | ~225-405h (Sheets primero, luego Costes-LLM, luego CRMs)                                                                                                                         |
| **Versión objetivo MVP**                                                 | `v0.3.0` GA (rebajada desde `v0.4.0` por decisión 24-05-2026) · Sprint 2 = `v0.2.5`, Sprint 2B = `v0.2.7`, Sprint 3 = `v0.3.0-rc.1`, SP-4B GA = `v0.3.0`                         |
| **Versión patch post-Sheets**                                            | `v0.5.1` (Sprint Costes-LLM, justo después de Sheets `v0.5.0`)                                                                                                                   |

---

## Protocolo estándar de cierre de sprint (CLOSE-1..5 + paso 6 condicional)

> **Aplicable a TODOS los sprints** del proyecto (MVP y post-MVP). Se ejecuta SIN preguntar al usuario en orden estricto. Sincronizado con [`CLAUDE.md` § "Phase/Sprint Completion Protocol"](../CLAUDE.md). Cada paso solo arranca si el anterior cerró en verde; si algo falla, se itera fix + re-run del paso fallido (no se salta).

| Paso | Subtarea CLOSE                                    | Qué se hace                                                                                                                                     | Ejecutor                         |
| ---- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1    | `SP-N-CLOSE-1` Auto test                          | `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` (unit + integration). Verde obligatorio.                                    | `af-agents:testing`              |
| 2    | `SP-N-CLOSE-2` E2C Local + WCAG 2.2 AA            | Claude abre navegador con Playwright contra `localhost:8500`. Recorre flujos del sprint + a11y rutas clave.                                     | `af-agents:testing` + Playwright |
| 3    | `SP-N-CLOSE-3` Test manual del dev                | **MVP (Sprints 1, 2, 2B, 3): DIFERIDO a SP-4B phase-NN bloque 4** (Renzo). Post-MVP: ejecutado por el dev.                                      | Renzo (MVP) / Dev (post-MVP)     |
| 4    | `SP-N-CLOSE-4` Corrección de bugs                 | Bugs detectados en CLOSE-1/2 (o CLOSE-3 post-MVP) se corrigen y se re-corre el paso afectado hasta verde.                                       | Claude orquestador               |
| 5    | `SP-N-CLOSE-5` paso 1 — Push a GitHub             | `git push` de la rama `feature/sprint-NN-<slug>`. Solo si CLOSE-1/2/4 están 🟢.                                                                 | `af-agents:git`                  |
| 6    | `SP-N-CLOSE-5` paso 2 — PR a `developer`          | Crear PR. **NO mergear** sin orden explícita del usuario. El merge lo confirma el usuario manualmente.                                          | `af-agents:git`                  |
| 7    | `SP-N-CLOSE-5` paso 3 — E2E VPS (CONDICIONAL)     | **SOLO si el VPS Easypanel está desplegado**: Playwright contra URL del VPS (no localhost). Si no hay VPS: OMITIDO + diferido a SP-4B phase-NN. | `af-agents:testing` contra VPS   |
| 8    | `SP-N-CLOSE-5` paso 4 — Hand-off SP-4B (solo MVP) | Rellenar `plans/260522-1700-sprint-validacion-pre-mvp/phase-NN-validacion-sprint-N.md` con tests + manual + vars + bugs.                        | `roadmap-keeper` + Claude        |
| 9    | Informe final al usuario                          | Resumen ejecutivo: tests passed/failed/fixed + diff de lo implementado + invitación a test manual (si UI).                                      | Claude orquestador               |

### Detector "VPS desplegado" (cuándo activar paso 7)

El paso 7 (E2E VPS) se activa SOLO si TODAS estas condiciones se cumplen:

- Existe `NEXT_PUBLIC_VPS_URL` en `.env.example` con valor distinto a placeholder.
- El branch `staging` ha sido promovido al menos una vez (verificable con `git log staging`).
- El usuario ha confirmado explícitamente que el VPS está en marcha (memoria persistente o nota en RoadMap).

Si cualquier condición falla → paso 7 OMITIDO + nota en `SP-N-CLOSE-5`: "E2E VPS diferido — pre-deploy VPS no realizado todavía". El `roadmap-keeper` NO bloquea el cierre por esto. **Estado actual (22-05-2026): VPS NO desplegado → paso 7 omitido en todos los sprints hasta primer despliegue.**

### Diferencias por tipo de sprint

| Tipo de sprint                          | CLOSE-3                                 | Paso 7 (E2E VPS)                                | Paso 8 (Hand-off SP-4B)                 |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| **MVP** (Sprints 0, 1, 2, 2B, 3)        | DIFERIDO a SP-4B (Renzo)                | Condicional (probablemente OMITIDO hasta SP-4B) | Obligatorio                             |
| **SP-4B Validación Pre-MVP** (Renzo)    | Absorbe los CLOSE-3 de Sprints 1/2/2B/3 | Obligatorio (E2E contra VPS)                    | N/A (es el propio sprint de validación) |
| **Post-MVP** (Sheets, Costes-LLM, etc.) | Estándar — dev lo ejecuta               | Condicional (depende de estado VPS)             | N/A                                     |
| **Sprint Refinamiento Renzo**           | Renzo lo absorbe en su propio sprint    | Condicional                                     | N/A                                     |

---

## 🎯 Cuadro de mando — Vista por sprint

> Vista de monitoreo agregada. **Una tabla por sprint** con cabecera repetida — separación visual clara entre sprints.
>
> Reglas de relleno:
>
> - **Bloque → ⏱ Push** = suma de tiempos reales de las tareas hijas que estén a 🔵 (las tareas individuales viven en sus secciones detalladas más abajo, `## Fase X — Sprint Y`).
> - **Sprint → ⏱ Push** = suma de los ⏱ Push de sus bloques.
> - **Sprint → ⏱ Cierre** SE RELLENA SOLO cuando el sprint completa `SP-X-CLOSE-5` (probado + mergeado a `developer`).
> - El estado se propaga automáticamente: tarea a 🔵 → bloque recalcula; todas las del bloque a 🔵/diferida → bloque 🔵 cerrada; todas dev+cierre a 🟢 → sprint 🟢.
> - **Detalle por tarea individual** (con commits, refs, estado fino): ver cada sección `## Fase X — Sprint Y` más abajo. Los estados de tareas SE ACTUALIZAN allí; el agente `roadmap-keeper` propaga los agregados a este cuadro.

### Sprint 0 — Hotfixes seguridad

| Item                                      | Estado                 | Estim.          | ⏱ Push   | ⏱ Cierre         | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------- | --------------- | -------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 0**                           | 🟢 Completada (merged) | 115h 30min      | 7h 30min | ~8h 45min        | v0.1.0 · `feature/sp-0-sprint-0-hotfixes` **MERGED a developer** (PR #2, commit `a387dfe`) · 26/27 dev tareas ✅ · 2 diferidas pre-deploy (1-03, 1-05 a VPS) · CLOSE-1 DONE_WITH_CONCERNS / CLOSE-2 24/24 E2E + 2 bugs fixed / CLOSE-3 reemplazado por análisis docs Bea+Renzo / CLOSE-4 bugs cerrados / CLOSE-5 ✅ · ⏱ Cierre = 7h 30min push + 1h 15min cierre (CLOSE-1..5)                                                           |
| ▸ Bloque 1.1 — Orquestador BullMQ         | 🔵 Ph cerrada          | 14h             | 2h 40min | —                | 4/4 🔵 (0-00, 0-01, 1-01, 1-02)                                                                                                                                                                                                                                                                                                                                                                                                         |
| ▸ Bloque 1.2 — Secretos y credenciales    | 🟡 Parcial             | 12h             | 1h 30min | —                | 2/4 🔵 (1-04, 1-06) · 2/4 🟡 diferidas pre-deploy (1-03, 1-05)                                                                                                                                                                                                                                                                                                                                                                          |
| ▸ Bloque 1.3 — Endpoints sin auth         | 🔵 Ph cerrada          | 17h             | 30min    | —                | 5/5 🔵 (1-07, 1-08, 1-09, 1-10, 1-11) · commit `4da79b1`                                                                                                                                                                                                                                                                                                                                                                                |
| ▸ Bloque 1.4 — Webhooks y firmas          | 🔵 Ph cerrada          | 18h             | 25min    | —                | 4/4 🔵 (1-12, 1-13, 1-14, 1-15) · commit `a17c687`                                                                                                                                                                                                                                                                                                                                                                                      |
| ▸ Bloque 1.5 — Privilege escalation y RLS | 🔵 Ph cerrada          | 24h             | 35min    | —                | 6/6 🔵 (1-16..1-21) · migrations RLS + admin-meta aplicadas en local · commit `da64297`                                                                                                                                                                                                                                                                                                                                                 |
| ▸ Bloque 1.6 — Otros críticos             | 🔵 Ph cerrada          | 31h             | 2h       | —                | 6/6 🔵 (1-22..1-27) · 1-27 widget hardening: migración + helpers + Origin/rate-limit · informe Renzo §3 🔴 cerrado                                                                                                                                                                                                                                                                                                                      |
| ▸ Cierre Sprint 0 (SP-1-CLOSE-1..5)       | 🟢 Completada          | 5h 30min + bugs | 3h 35min | 22-05-2026 19:30 | CLOSE-1 🟢 ~30min (DONE_WITH_CONCERNS aceptado, lint 118 err preexistentes -46 vs baseline) · CLOSE-2 🟢 ~45min (24/24 E2E + 2 bugs corregidos: BUG-001 logout, BUG-002 viewer→admin) · CLOSE-3 🟢 ~1h 30min (análisis cruzado docs Bea+Renzo V1 → 13 tareas NEW-01..NEW-13) · CLOSE-4 🟢 ~25min (2 bugs + 2 lint fixes ThemeToggle/compliance) · CLOSE-5 🟢 ~45min (CHANGELOG + RoadMap + PR #4 cierre formal merged commit `2a12c7d`) |

### Sprint 1 — Capa de datos (sin ORM nuevo)

| Item                                                 | Estado                 | Estim.                                 | ⏱ Push   | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ---------------------- | -------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 1**                                      | 🟢 Completada (merged) | **~205h**                              | ~12h     | ~12h     | v0.2.0 · `feature/sprint-01-capa-datos` (16 commits) **MERGED a developer** vía PR #5 (commit `94c035a`, 22-05-2026 23:41) · Sprint 1 legacy: Push = Cierre (sin fixes post-merge). ⏱ Real distribuido proporcionalmente por bloques (opción B, 23-05-2026). 24 🟢 Completada + 8 🟢 Diferida + 6 ADRs (014-019). Resumen: [`plans/260520-1342-sprint-1-capa-datos/SP-2-CLOSE-summary.md`](260520-1342-sprint-1-capa-datos/SP-2-CLOSE-summary.md) |
| ▸ Bloque 2.1 — Unificación cliente Supabase          | 🟢 Completada parcial  | 19h                                    | 1h 33min | 1h 33min | 3/3 · **2-01 ✅** audit (reporte `sp-2-01-audit-clients-supabase-20260522.md`) · **2-02.a ✅** upgrade ssr 0.10.3 + supabase-js 2.106.1 (ADR-016) · **2-02.b ✅** DI services parcial · **2-03 ✅** 3 services cleanup. Resto cron/webhooks/processors/whatsapp.ts → ADR-019                                                                                                                                                                      |
| ▸ Bloque 2.2 — Schemas Zod                           | 🟢 Completada          | 25h                                    | 2h 3min  | 2h 3min  | 9/9 · 8 schemas + barrel en `src/lib/schemas/` · **2-35** ModelNameSchema whitelist + drop hack widget.ts:150 + migración SQL `20260522210000`                                                                                                                                                                                                                                                                                                    |
| ▸ Bloque 2.3 — Repository pattern                    | 🟢 Completada          | 31h                                    | 2h 32min | 2h 32min | 7/7 · 7 repositorios + barrel en `src/lib/repositories/` (patrón `IRepository<T>` + `RepoResult` + `withTenantFilter` + `paginate`). Repos: leads, tenants, appointments(+calls+attempts), ai-agents(+variants+voice), knowledge-base(+embeddings+chat-messages), integrations(+field-mapping+write-audit+webhooks), lead-opportunities                                                                                                           |
| ▸ Bloque 2.4 — Refactor queries existentes           | 🟢 Diferida            | 18h                                    | —        | —        | 0/3 desarrollo · **2-19, 2-20, 2-21 → ADR-019** migración incremental · ~~2-36~~ MOVIDA a Sprint Costes-LLM (C-03) post-MVP · ⏱ Real = 0 (todas diferidas, sin trabajo en Sprint 1)                                                                                                                                                                                                                                                               |
| ▸ Bloque 2.5 — Type safety + limpieza                | 🟢 Completada parcial  | 17h                                    | 5min     | 5min     | 1/2 · **2-37 ✅** logger estructurado `src/lib/utils/logger.ts` con scrubbing PII · **2-22 🟢 Diferida ADR-019** (426 `as any` baseline documentado, Sprint v0.5.4 candidate)                                                                                                                                                                                                                                                                     |
| ▸ Bloque 2.6 — RLS hardening complementario          | 🟢 Completada          | 19h                                    | 1h 33min | 1h 33min | 4/4 · **2-23 ✅** RLS ai_agents+ai_agent_variants (F-04-005) · **2-24 ✅** RLS web_widgets (F-04-006) · **2-25 ✅** RLS programas (F-04-008) · **2-26 ✅** AES-256-GCM tokens OAuth (ADR-017, `token-crypto.ts` + tabla integrations + ENCRYPTION_KEY) · 2-27 → 1-26                                                                                                                                                                              |
| ▸ Bloque 2.7 — Testing + documentación               | 🟢 Completada parcial  | 16h                                    | 1h 19min | 1h 19min | 2/2 · **2-28** Vitest + 58 unit tests + 4 integration skip-by-env (schemas 35, crypto 8, logger 4, base-repository 11, lead-opportunities 4). E2E full → SP-4B · **2-29 ✅** `docs/architecture/data-layer.md` sección 6 + SP-2-CLOSE-summary.md                                                                                                                                                                                                  |
| ▸ Bloque 2.8 — Hardening dependencias (ADR)          | 🟢 Completada parcial  | 20h                                    | 39min    | 39min    | 3/5 · **2-30 ✅** hook `af-productivity-logger.cjs` Path B híbrido · **2-33 ✅** @types/node ^20 → ^24.12.4 · **2-37 ✅** logger estructurado (compartida con 2.5) · **2-31, 2-32, 2-34 🟢 Diferida ADR-018** post-MVP v0.6.x (lucide-react, shadcn 4, eslint 10)                                                                                                                                                                                 |
| ▸ **Bloque 2.9 — Fix bugs Renzo + reqs Bea (NUEVO)** | 🟢 Completada          | **23h** (8h→3h NEW-01 paso 3 diferido) | 1h 53min | 1h 53min | 4/4 · **NEW-01 paso 2 ✅** fix saveOrchestratorConfig (commit `837e12f`); paso 3 DIFERIDO a v0.5.3 post-MVP (ADR-015) · **NEW-02 ✅** enum unificado `LeadStageEnum` + UNREACHABLE + refactor 6 ficheros · **NEW-06 ✅** modelo oportunidades múltiples + dedup 48h · **NEW-13 ✅** política handoff humano (ADR-014, `handoff.ts`, migración SQL)                                                                                                |
| ▸ Cierre Sprint 1 (SP-2-CLOSE-1..5)                  | 🟢 Completada          | **4h 30min + bugs**                    | 22min    | 22min    | CLOSE-1 ✅ (typecheck OK / lint 120 err preexistentes baseline ADR-019 / build 41 rutas / 58 tests OK) · CLOSE-2 ✅ smoke crypto + hook (E2E full → SP-4B) · **CLOSE-3 🟢 Diferida** a SP-4B phase-02 bloque 4 · CLOSE-4 ✅ lint fixes (9f1fbca + ccd6a50) · CLOSE-5 ✅ merged PR #5                                                                                                                                                              |

### Sprint 2 — Adapter HubSpot + Zoho (MVP)

| Item                                           | Estado             | Estim.                           | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------ | -------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 2**                                | 🔵 **Subida rama** | **74h** (refinada vs ~169h orig) | ~40min | —        | v0.2.5 · `feature/sprint-02-adapter-hubspot-zoho` · **Inicio REAL: 24-05-2026 14:00** · Phase 00+01 🟢 (`38a6667` + `000cd23`) · **AUTOEXEC + ck-debug fixes** en commits `74cc137` + `ce166ec` + `5af8476`. **PR #12 abierto** a `developer`: <https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/pull/12>. 111 archivos, +27377/-12199 líneas. 170 tests verdes + build. Pendiente merge orden usuario. |
| ▸ Phase 00 Setup                               | 🟢 Completada      | 2h                               | 25min  | 25min    | Commit `38a6667`. Env vars OAUTH_STATE_SECRET + NEXT_PUBLIC_APP_URL + scopes documentados. msw@^2.14.6 devDep + ADR-020. Carpetas crm/oauth, tests/integrations, tests/mocks creadas. Tests: 58 passed sin regresiones.                                                                                                                                                                                                      |
| ▸ Phase 01 Foundation                          | 🟢 Completada      | 14h                              | 25min  | 25min    | Commit `000cd23`. `interface.ts` ampliada (6 nuevos métodos). `crm-error.ts` mappers HubSpot/Zoho. `oauth/oauth-state.ts` HMAC-SHA256 constant-time. `token-manager.ts` cache+dedup+writeback. `factory.ts` dual-mode. Migration `20260524100000_integrations_oauth_and_audit.sql` LOCAL+VPS (via pg-meta). **47 tests nuevos** (105 totales).                                                                               |
| ▸ Phase 02 Zoho multi-DC bugfixes (B-01..B-07) | 🔵 Subida rama     | 10h → ~10min                     | ~10min | —        | Commit `74cc137` pushed (PR #12). `zoho-dc-detector.ts` (9 DCs + exchangeCodeForTokens + refreshAccessToken). Refactor `zoho.ts` (B-01..B-07 fix). Tests: 13 + 5 (dc-detector). MSW handlers en `tests/mocks/zoho-handlers.ts`.                                                                                                                                                                                              |
| ▸ Phase 03 HubSpot Public App OAuth            | 🔵 Subida rama     | 16h → ~8min                      | ~8min  | —        | Commit `74cc137` pushed (PR #12). `hubspot.ts` provider Public App OAuth + fetch puro. CRUD contacts/tasks/meetings con association IDs. Tests: 21 + 7 (mappers). Doc `docs/integrations/hubspot-app-setup.md`. **Bloqueante usuario**: registrar Public App en developers.hubspot.com.                                                                                                                                      |
| ▸ Phase 04 WriteGuard + audit log              | 🔵 Subida rama     | 6h → ~4min                       | ~4min  | —        | Commit `74cc137` + `ce166ec` (F-WG-1 fail-closed) pushed. `write-guard.ts` con `applyWritePolicy` standalone + escape hatch `allowEmptyCurrent`. `audit-query.ts` getAuditLog RLS multi-tenant. Tests: 10 unit + 2 integration.                                                                                                                                                                                              |
| ▸ Phase 05 UI admin IntegrationsManager        | 🔵 Subida rama     | 12h → ~10min                     | ~10min | —        | Commits `74cc137` + `ce166ec` (F-API-1 session check + F-API-2 cookie deletion) pushed. API routes con quad-check state (cookie+DB+HMAC+session). UI: crm-section + crm-provider-card + write-policy-editor + audit-log-viewer. Tests: 6 API oauth-callback. **WCAG axe + Playwright E2E** diferidos a Sprint 3.                                                                                                             |
| ▸ Phase 06 Tests + docs + ADRs 021/022/023     | 🔵 Subida rama     | 10h → ~5min                      | ~5min  | —        | Commits `74cc137` + `ce166ec` (F-COV-1 coverage config) pushed. `docs/architecture/crm-adapters.md` 10 secciones. ADR-021/022/023. Migración help_sections seed. **Tests: 170 passed + 4 skipped.**                                                                                                                                                                                                                          |
| ▸ Phase 07 Cierre (SP-3-CLOSE-1..5)            | 🔵 PR #12 abierto  | 6h + bugs → ~5min                | ~5min  | —        | CLOSE-1 🟢 typecheck + build + 170 tests + lint diff verde. CLOSE-2 🟡 parcial (E2E diferido Sprint 3). CLOSE-3 🟢 diferida SP-4B. CLOSE-4 🟢 cleanup lint legacy en `5af8476`. CLOSE-5 🟢 push + PR #12 abiertos. **Pendiente merge orden usuario.** QA report: `plans/reports/qa-260524-1625-sprint-2-cierre.md`.                                                                                                          |
| ▸ **Bloque 3.B Fix bugs + reqs Bea (NUEVO)**   | 🔘 Pendiente       | **21h**                          | —      | —        | 0/4 · **NEW-03** Fix Voice Agents (4h) · **NEW-05** Widget switch + auto-purga (6h) · **NEW-07** Inbox apagar bot (5h) · **NEW-08** Round Robin avanzado (6h). En paralelo a Phase 03/04 si tiempo.                                                                                                                                                                                                                          |

### Sprint 2B — Dashboard KPIs conjunto (NUEVO, MVP)

| Item                                  | Estado       | Estim.              | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------ | ------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 2B**                      | 🔘 Pendiente | **16-24h + cierre** | —      | —        | **v0.2.7** · `feature/sprint-02b-dashboard-kpis-conjunto` · Inicio Lun 27-07-2026 · creado 22-05-2026 por requerimiento Bea: dashboard KPIs agregado (llamada+whatsapp+web) configurable. Detalle: [`plans/260522-1800-sprint-2b-dashboard-kpis-conjunto/plan.md`](260522-1800-sprint-2b-dashboard-kpis-conjunto/plan.md) |
| ▸ Tareas de desarrollo                | 🔘           | 16-24h              | —      | —        | 0/1 · **NEW-04** Dashboard KPIs conjunto: nuevo `/dashboard` agregado con widget builder (reusa SummaryManager + ChartManager). Server actions agregadas cruzando lead+llamadas+whatsapp+widget. WCAG.                                                                                                                    |
| ▸ Cierre Sprint 2B (SP-3B-CLOSE-1..5) | 🔘           | **4h 30min + bugs** | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · CLOSE-3 **DIFERIDO a SP-4B phase-03 bloque 4** (junto a Sprint 2) · paso 7 E2E VPS condicional (omitido) · paso 8 hand-off SP-4B obligatorio                                                                |

### Sprint 3 — Hardening (cierre release candidate v0.3.0-rc.1)

| Item                                           | Estado       | Estim.        | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ------------ | ------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 3**                                | 🔘 Pendiente | **~112-140h** | —      | —        | **v0.3.0-rc.1** (release candidate) · `feature/sprint-03-hardening` · Inicio Vie 31-07-2026 (+8 días por Sprint 1 +28h, Sprint 2 +21h, Sprint 2B nuevo) · +4 NEW tareas docs Bea+Renzo (NEW-09, 10, 11, 12) +23h                                                                                                                    |
| ▸ Tareas de desarrollo (Fase 3)                | 🔘           | 89-117h       | —      | —        | 0/8 (4-01, 4-02, 4-03 reducido, 4-05, 4-06, 4-07, **4-08**, **4-09**) · ~~4-04~~ MOVIDA al Sprint Costes-LLM como C-02                                                                                                                                                                                                              |
| ▸ **Bloque 3.B — Fix bugs + reqs Bea (NUEVO)** | 🔘           | **23h**       | —      | —        | 0/4 · **NEW-09** Campañas: importar Excel + filtros multi-variable + cola configurable cadencia (12h) · **NEW-10** Calendario festivos manuales por país (3h) · **NEW-11** Renombrar UI Historial→Leads + consolidación (2h) · **NEW-12** Settings UX (buscador, probar conexión, confirmación robusta, edición panel lateral) (6h) |
| ▸ Cierre Sprint 3 (SP-4-CLOSE-1..5)            | 🔘           | **7h + bugs** | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · CLOSE-3 **DIFERIDO a SP-4B phase-04 bloque 4** · paso 7 E2E VPS condicional (omitido) · CLOSE-5 incluye hand-off a SP-4B phase-04 + bump v0.3.0-rc.1 + crear rama `feature/sprint-03b-validacion-pre-mvp` para Renzo  |

### 👤 Sprint Validación Pre-MVP — Equipo Renzo (entre Hardening y Sheets, cierre MVP v0.3.0 GA)

| Item                                     | Estado       | Estim.       | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------ | ------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 👤 **🚀 Sprint Validación Pre-MVP**      | 🔘 Pendiente | **40-55h**   | —      | —        | **v0.3.0 GA** · `feature/sprint-03b-validacion-pre-mvp` · Inicio Mar 04-08-2026 (post-Sprint 3 merge) · **Asignado a Renzo + equipo Renzo** · estim. recalculada 22-05-2026 por absorber CLOSE-3 manuales de Sprints 1, 2, 2B, 3                                                                                                                                                                 |
| 👤 ▸ Phase 01 — Validación Sprint 0      | 📝 Llenada   | 8-10h        | —      | —        | Plantilla rellenada al cierre Sprint 0 con tests + manual + 2 bugs ya corregidos. Renzo ejecuta en VPS.                                                                                                                                                                                                                                                                                          |
| 👤 ▸ Phase 02 — Validación Sprint 1      | 🔘 Plantilla | 8-10h        | —      | —        | Se rellena en SP-2-CLOSE-5 (auto-fill) · incluye manual humano (antes CLOSE-3 Javi)                                                                                                                                                                                                                                                                                                              |
| 👤 ▸ Phase 03 — Validación Sprint 2 + 2B | 🔘 Plantilla | 10-13h       | —      | —        | Se rellena en SP-3-CLOSE-5 y SP-3B-CLOSE-5 (auto-fill) · cubre dos sprints en una fase (CRMs + dashboard KPIs conjunto)                                                                                                                                                                                                                                                                          |
| 👤 ▸ Phase 04 — Validación Sprint 3      | 🔘 Plantilla | 8-10h        | —      | —        | Se rellena en SP-4-CLOSE-5 (auto-fill)                                                                                                                                                                                                                                                                                                                                                           |
| 👤 ▸ Cierre SP-4B (CLOSE-1..5)           | 🔘           | 6-12h + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · SP-4B absorbe CLOSE-3 manual de Sprints 1, 2, 2B, 3 (Renzo) · **paso 7 E2E VPS OBLIGATORIO** (es el sprint de validación VPS) · paso 8 N/A (es el propio destino del hand-off) · Re-run consolidado + bump SemVer **v0.3.0 GA** · NO promociona a staging (requiere orden Javi HP) |

### Sprint 4 — Google Sheets bidireccional (post-MVP)

| Item                                | Estado       | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                              |
| ----------------------------------- | ------------ | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **🚀 Sprint 4**                     | 🔘 Pendiente | 60-100h         | —      | —        | v0.5.0 · `feature/sprint-04-google-sheets` · Inicio Mié 26-08-2026 (+15 días respecto plan original por extensiones SP1+SP2+SP2B+SP3+SP4B)                                                                         |
| ▸ Tareas de desarrollo (Fase 4)     | 🔘           | 60-100h         | —      | —        | 0/6 (5-01-a..5-01-f) · googleapis ya instalado                                                                                                                                                                     |
| ▸ Cierre Sprint 4 (SP-5-CLOSE-1..5) | 🔘           | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar (dev lo ejecuta) · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Sprint Costes-LLM — Centro de costes LLM (post-Sheets, patch v0.5.1)

| Item                                          | Estado       | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                              |
| --------------------------------------------- | ------------ | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **🚀 Sprint Costes-LLM**                      | 🔘 Pendiente | 23-31h          | —      | —        | v0.5.1 · `feature/sprint-costes-llm-post-mvp` · Inicio Lun 14-09-2026 (post-Sheets v0.5.0 · +14 días respecto plan previo) · creado 22-05-2026 por decisión clienta                                                |
| ▸ Tareas de desarrollo (Fase 4.5)             | 🔘           | 23-31h          | —      | —        | 0/3 (**C-01** tabla llm_usage_logs + tracker, **C-02** dashboard Recharts, **C-03** token_usage chat_messages)                                                                                                     |
| ▸ Cierre Sprint Costes-LLM (SP-5B-CLOSE-1..5) | 🔘           | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar (dev lo ejecuta) · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### 👤 Sprint Refinamiento Herramientas Internas — Equipo Renzo (post-Costes-LLM, v0.5.2)

| Item                                               | Estado       | Estim.              | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------ | ------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 👤 **🚀 Sprint Refinamiento Herramientas**         | 🔘 Pendiente | **18-22h + cierre** | —      | —        | **v0.5.2** · `feature/sprint-refinamiento-herramientas-post-mvp` · Inicio Jue 24-09-2026 (post-Costes-LLM) · **Asignado a Renzo + equipo Renzo** · creado 22-05-2026 por decisión Bea + Renzo: Simulator y Lanzador `/calls` fuera del MVP. Detalle: [`plans/260522-1830-sprint-refinamiento-herramientas-post-mvp/plan.md`](260522-1830-sprint-refinamiento-herramientas-post-mvp/plan.md) |
| 👤 ▸ Fase 01 — Simulator persistencia + voz        | 🔘           | 8-10h               | —      | —        | Persistir variables capturadas en BD (no sólo `useState`) + soporte simulación voz (no sólo texto) + retener historial al recargar página                                                                                                                                                                                                                                                   |
| 👤 ▸ Fase 02 — Lanzador `/calls` real Retell SDK   | 🔘           | 10-12h              | —      | —        | Reemplazar mockup hardcoded por endpoint `/api/calls/manual` real + WebSocket transcripción en vivo + LiveMonitor conectado al SDK de Retell                                                                                                                                                                                                                                                |
| 👤 ▸ Cierre Sprint Refinamiento (SP-5C-CLOSE-1..5) | 🔘           | **4h 30min + bugs** | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · CLOSE-3 manual ABSORBIDO por Renzo en este sprint (no diferido porque ya es Renzo) · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A                                                                                                                                   |

### Sprint 5 — Salesforce adapter (post-MVP)

| Item                                | Estado       | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                             |
| ----------------------------------- | ------------ | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 5**                     | 🔘 Pendiente | 60-100h         | —      | —        | v0.6.0 · `feature/sprint-05-salesforce` · Inicio Vie 02-10-2026 (post-Sprint Refinamiento Herramientas v0.5.2)                                                                                    |
| ▸ Tareas de desarrollo (Fase 5)     | 🔘           | 60-100h         | —      | —        | 0/6 (6-01..6-06) · jsforce vía ADR                                                                                                                                                                |
| ▸ Cierre Sprint 5 (SP-6-CLOSE-1..5) | 🔘           | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Sprint 6 — GoHighLevel adapter (post-MVP)

| Item                                | Estado       | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                             |
| ----------------------------------- | ------------ | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 6**                     | 🔘 Pendiente | 40-80h          | —      | —        | v0.7.0 · `feature/sprint-06-gohighlevel` · Inicio Mié 15-10-2026 (+28 días respecto plan original)                                                                                                |
| ▸ Tareas de desarrollo (Fase 6)     | 🔘           | 40-80h          | —      | —        | 0/5 (7-01..7-05) · foco Latam EduTech                                                                                                                                                             |
| ▸ Cierre Sprint 6 (SP-7-CLOSE-1..5) | 🔘           | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Sprint 7 — ActiveCampaign adapter (post-MVP)

| Item                                | Estado       | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                             |
| ----------------------------------- | ------------ | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 7**                     | 🔘 Pendiente | 20-50h          | —      | —        | v0.8.0 · `feature/sprint-07-activecampaign` · Inicio Vie 30-10-2026 (+33 días respecto plan original)                                                                                             |
| ▸ Tareas de desarrollo (Fase 7)     | 🔘           | 20-50h          | —      | —        | 0/5 (8-01..8-05) · auth API Key (la más sencilla)                                                                                                                                                 |
| ▸ Cierre Sprint 7 (SP-8-CLOSE-1..5) | 🔘           | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Sprint 8 — Adapter pattern generalization

| Item                                | Estado                        | Estim.          | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------- | --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 8**                     | 🔘 Bloqueado hasta SP-4..SP-7 | 20-40h          | —      | —        | v0.9.0 · `feature/sprint-08-adapter-generalization` · Inicio Mié 04-11-2026 (+33 días respecto plan original)                                                                                     |
| ▸ Tareas de desarrollo (Fase 8)     | 🔘                            | 20-40h          | —      | —        | 0/4 (9-01..9-04)                                                                                                                                                                                  |
| ▸ Cierre Sprint 8 (SP-9-CLOSE-1..5) | 🔘                            | 5h 30min + bugs | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) · post-MVP: CLOSE-3 estándar · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Sprint 9 — Tier 2 on-demand (backlog)

| Item                                         | Estado     | Estim.         | ⏱ Push | ⏱ Cierre | Notas                                                                                                                                                                                                         |
| -------------------------------------------- | ---------- | -------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Sprint 9**                              | 🔘 Backlog | 30-50h por CRM | —      | —        | v0.10.x+ · sólo bajo pedido cliente                                                                                                                                                                           |
| ▸ CRMs Tier 2 (10-01..10-05)                 | 🔘 Backlog | 30-50h c/u     | —      | —        | Clientify, Bitrix24, Pipedrive, Monday, Holded                                                                                                                                                                |
| ▸ Cierre Sprint 9 (SP-10-CLOSE-1..5 por CRM) | 🔘 Backlog | 5h 30min/CRM   | —      | —        | Sigue [Protocolo estándar de cierre](#protocolo-estándar-de-cierre-de-sprint-close-1-5--paso-6-condicional) por cada CRM activado · CLOSE-3 estándar · paso 7 E2E VPS condicional · paso 8 hand-off SP-4B N/A |

### Lectura rápida del cuadro

- **🚀 fila** = sprint completo (versión objetivo + branch + fecha de inicio).
- **▸ fila** = bloque/fase dentro del sprint (subtotal acumulado de sus tareas hijas).
- Las **tareas individuales NO aparecen en este cuadro**. Se siguen actualizando en sus secciones detalladas `## Fase X — Sprint Y` más abajo; el agente `roadmap-keeper` propaga los agregados aquí.
- **⏱ Push** se rellena con el tiempo real al pasar tareas a 🔵; el bloque suma sus hijas y el sprint suma sus bloques.
- **⏱ Cierre** SOLO se rellena en la fila Sprint, cuando termina `SP-X-CLOSE-5` (probado + mergeado a `developer`).

---

## Fase 0 — Sprint 0: Hotfixes de seguridad

| Campo                          | Valor                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **Sprint ID**                  | `SP-1`                                                                        |
| **Versión objetivo al cierre** | `v0.1.0`                                                                      |
| **Estado del sprint**          | 🟡 En Desarrollo (25/26 dev a 🔵 · 2 diferidas pre-deploy · cierre pendiente) |
| **Estimación total**           | ~107h 30min (11 días lab × 10h)                                               |
| **Rama de trabajo sugerida**   | `feature/sp-0-sprint-0-hotfixes` (pushed origin 22-05-2026 commit `2c9437c`)  |
| **Inicio**                     | Jue 21-05-2026 09:00                                                          |
| **Fin Est.**                   | Jue 04-06-2026 19:00                                                          |
| **Fin Real**                   | —                                                                             |
| **Horas reales DEV (a push)**  | ~6h 15min (vs 107h 30min estimadas)                                           |

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

| ID   | Tarea                                                                   | Estimación | Estado                     | Refs audit      | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------- | ---------- | -------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-03 | Rotar JWTs comprometidos en Supabase (anon + service_role)              | 2h         | 🟡 **DIFERIDA pre-deploy** | F-05-SEC-001    | **100% VPS** — no hay parte local-aplicable: el Supabase local ya usa JWTs distintos a los comprometidos del cliente. Tras 1-04 el código ya no tiene fallback hardcoded → la app local funciona con cualquier JWT en `.env.local`. Se cierra en sesión pre-staging                                                                                                                                                                                                                                                                                   |
| 1-04 | Quitar JWTs hardcodeados de 10 puntos del código fuente                 | 6h         | 🔵 Subida `feature/sp-0`   | F-04-002 / DA-2 | ⏱ Real (a push): 50min · ✅ Commit `d595287` — helper `src/lib/env.ts` (requireEnv/requireEnvAny) + refactor 5 archivos. `grep eyJhbGci\|FALLBACK_ src/` = 0                                                                                                                                                                                                                                                                                                                                                                                          |
| 1-05 | Cambio password Postgres default `postgres:postgres`                    | 1h         | 🟡 **DIFERIDA pre-deploy** | R-023.a         | **100% VPS** — en local Postgres corre en `localhost:8200` no expuesto a internet (riesgo nulo). En producción es crítico cambiar password + cerrar puerto 5432. Se cierra en sesión pre-staging                                                                                                                                                                                                                                                                                                                                                      |
| 1-06 | Crear usuario Postgres `app_user` con permisos limitados (no superuser) | 3h         | 🔵 Subida `feature/sp-0`   | R-023.a         | ⏱ Real (a push): 40min · ✅ SQL `supabase/scripts/create-app-user.sql` idempotente + README. 🟢 **Apply local OK** (rol creado vía `docker exec postgres psql -U postgres`, 3 verificaciones OK: rol sin privilegios elevados / 4 permisos DML / 0 DDL). Password en `.env.local` como `APP_USER_PASSWORD`. 🟡 Apply VPS diferido pre-staging. Worker.js NO usa pg directo → 3h sin +1h. **Ajuste técnico:** removido `NOSUPERUSER/NOREPLICATION/NOBYPASSRLS` del ALTER (sólo superuser real puede setear esos; CREATE ROLE defaults ya los excluyen) |

#### Bloque 1.3 — Endpoints sin autenticación

| ID   | Tarea                                                                                        | Estimación | Estado                   | Refs audit          | Notas                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------- | ---------- | ------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-07 | Auth en endpoints orquestación user-driven (deploy, graph, publish, workflows, calls/manual) | 8h         | 🔵 Subida `feature/sp-0` | DA-2-001            | ⏱ Real (a push): 25min · helper `src/lib/api-auth.ts` (requireApiUser + requireTenantAccess) · graph verifica ownership vía `data.tenant_id` · commit `4da79b1` |
| 1-08 | Auth en cron endpoints (sweep + cron/appointments/reminders)                                 | 4h         | 🔵 Subida `feature/sp-0` | DA-3-001 / DA-3-007 | ⏱ Real (a push): 10min · `requireCronSecret` timing-safe + `CRON_SECRET` añadido a `.env.example` · commit `4da79b1`                                            |
| 1-09 | Guard condicional `tenants.config.test_orchestrator_enabled` (DENY by default)               | 2h         | 🔵 Subida `feature/sp-0` | DA-3-003            | ⏱ Real (a push): 10min · `requireOrchestrationEnabled` aplicado a deploy/publish/workflows POST/calls/manual · TEMPORAL — eliminar en Fase 3 · commit `4da79b1` |
| 1-10 | Cerrar `/api/admin/tenants/[id]/client-sql` (descarga SQL config sin auth)                   | 2h         | 🔵 Subida `feature/sp-0` | DA-2-002            | ⏱ Real (a push): 5min · `requireApiAdmin` añadido al GET · commit `4da79b1`                                                                                     |
| 1-11 | Cerrar `/api/tenant/migrate` GET (sirve MIGRATION_SQL completo) + POST user-auth             | 1h         | 🔵 Subida `feature/sp-0` | DA-2-003            | ⏱ Real (a push): 5min · GET → `requireApiAdmin`, POST → `requireApiUser` (SSRF cerrado en 1-22) · commit `4da79b1`                                              |

#### Bloque 1.4 — Webhooks y firmas

| ID   | Tarea                                                      | Estimación | Estado                   | Refs audit | Notas                                                                                                                                                                                          |
| ---- | ---------------------------------------------------------- | ---------- | ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-12 | Validación firma webhook Retell                            | 4h         | 🔵 Subida `feature/sp-0` | DA-4-001   | ⏱ Real (a push): 8min · `verifyHmacSignature` + `verifyRetellWebhook` lee `x-retell-signature` y `RETELL_WEBHOOK_SECRET` env · commit `a17c687`                                                |
| 1-13 | Validación firma Retell **tools** (cancelar/agendar citas) | 6h         | 🔵 Subida `feature/sp-0` | DA-2-007   | ⏱ Real (a push): 5min · mismo helper que 1-12 · el más peligroso sin auth · commit `a17c687`                                                                                                   |
| 1-14 | Validación HMAC WhatsApp obligatoria (no condicional)      | 2h         | 🔵 Subida `feature/sp-0` | DA-2-006   | ⏱ Real (a push): 7min · `WHATSAPP_APP_SECRET` ahora obligatorio · `WHATSAPP_VERIFY_TOKEN` movido a env (antes hardcoded) · commit `a17c687`                                                    |
| 1-15 | Validación firma webhook CRM (anti tenant_id spoofing)     | 6h         | 🔵 Subida `feature/sp-0` | DA-2-009   | ⏱ Real (a push): 8min · `verifyCrmWebhookSignature` con secret per-tenant (`tenants.config.webhook_crm_secret`) · firma del header `x-webhook-signature` atada al tenant_id · commit `a17c687` |

#### Bloque 1.5 — Privilege escalation y RLS

| ID   | Tarea                                                                               | Estimación | Estado　　　             | Refs audit       | Notas                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------- | ---------- | ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-16 | Fix privilege escalation via `user_metadata.is_admin` editable por usuario          | 4h         | 🔵 Subida `feature/sp-0` | DA-2-005         | ⏱ Real (a push): 10min · middleware.ts/auth.ts/api-auth.ts/tenant.ts leen+escriben `is_admin` SOLO en `app_metadata` · script `supabase/scripts/migrate-is-admin-to-app-metadata.sql` aplicado en local (1 user migrado) · commit `da64297`                                            |
| 1-17 | Verificación rol admin en `createTenant`/`deleteTenant`/`updateTenant`/`getTenants` | 3h         | 🔵 Subida `feature/sp-0` | DA-2-004         | ⏱ Real (a push): 6min · helper `assertAdminAccess()` añadido a las 4 server actions · commit `da64297`                                                                                                                                                                                 |
| 1-18 | Fix RLS tabla `tenants` (quitar policy tautológica `USING(true)`)                   | 3h         | 🔵 Subida `feature/sp-0` | DA-2-010         | ⏱ Real (a push): 8min · migration `20260521000000_rls_tenants_hardening.sql` · SELECT por `auth_user_id`+admin / IUD solo admin · **aplicada en local** (4 CREATE POLICY OK) · 🟡 VPS pre-deploy · commit `da64297`                                                                    |
| 1-19 | Fix RLS `knowledge_base` (quitar `app.current_tenant` dead letter — nunca se setea) | 2h         | 🔵 Subida `feature/sp-0` | F-04-004         | ⏱ Real (a push): 7min · migration `20260521000001_rls_knowledge_base_hardening.sql` · 4 policies (S/I/U/D) ownership-based · **aplicada en local** · 🟡 VPS pre-deploy · commit `da64297`                                                                                              |
| 1-20 | Fix `fetchCalls` — añadir filtro `tenant_id` en 4 funciones                         | 4h         | 🔵 Subida `feature/sp-0` | F-04-001 / DA-2  | ⏱ Real (a push): 6min · fetchCalls/getCallsByPhone/fetchIntentosByPhone/fetchWhatsappByPhone usan `getActiveTenantId` + `.eq("tenant_id", id)` · sin tenant → resultado vacío · commit `da64297`                                                                                       |
| 1-21 | Fix IDOR `inbox.ts` 9 funciones — verificar ownership tenant                        | 8h         | 🔵 Subida `feature/sp-0` | DA-2 inbox sweep | ⏱ Real (a push): 13min · updateLeadSegment/sendManualMessage/injectMockupMessage/toggleLeadAI/assignAgentToLead/deleteLead/deleteChatHistory/deleteLeadFacts/updateLeadInfo · todas con `.eq("tenant_id", tenant.id)` + updateLeadInfo filtra tenant_id del payload · commit `da64297` |

#### Bloque 1.6 — Otros críticos

| ID                               | Tarea                                                                                                                                           | Estimación      | Estado                   | Refs audit                                                                                                                             | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-22                             | Fix SSRF `/api/tenant/migrate` cookie `af-tenant-url` (añadir allowlist)                                                                        | 8h              | 🔵 Subida `feature/sp-0` | DA-3-002                                                                                                                               | ⏱ Real (a push): 12min · URL+key del Supabase del tenant resueltas DESDE DB (no de cookie) usando `esden-tenant-id` · gate `requireApiAdmin` · `isAllowedTenantUrl()` bloquea loopback/RFC1918 (override en dev con `ALLOW_INTERNAL_TENANT_URLS=true`) · commit `2c9437c`                                                                                                                                                                                                                                                                                                                                              |
| 1-23                             | Sanitización XSS widget embed (interpolación `id` en JS servido a terceros)                                                                     | 4h              | 🔵 Subida `feature/sp-0` | DA-3-004                                                                                                                               | ⏱ Real (a push): 4min · validación regex UUID estricta antes de interpolar · `id`+`baseUrl` inyectados vía `JSON.stringify` (corte de escape imposible) · 400 si formato inválido · commit `2c9437c`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1-24                             | Update `axios@1.14.0` → `axios@1.16.1` (15 CVEs: SSRF + Prototype Pollution)                                                                    | 4h              | 🔵 Subida `feature/sp-0` | DA-3-CVE-001                                                                                                                           | ⏱ Real (a push): 8min · ADR-2026-05-20 ya aprobado · `npm install` OK · ajuste tipos `AxiosHeaderValue` en WhatsAppWebhookProcessor (content-type normalizado a string\|undefined) · commit `2c9437c`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1-25                             | Reemplazar paquete `crypto@1.0.1` DEPRECATED por built-in `node:crypto`                                                                         | 3h              | 🔵 Subida `feature/sp-0` | ADR-2026-05-20                                                                                                                         | ⏱ Real (a push): 3min · grep `from 'crypto'` en src/ + worker.js = 0 ocurrencias · paquete removido limpio de `package.json` · helpers HMAC ya usan `node:crypto` explícito · commit `2c9437c`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1-26                             | Update `next@16.1.6` → `next@16.2.6` (cierre 19 CVEs incl. middleware bypass)                                                                   | 4h              | 🔵 Subida `feature/sp-0` | DA-3-CVE-002                                                                                                                           | ⏱ Real (a push): 30min · ✅ Commit `1ce8e0b` 21-05-2026 — `next@16.2.6` + `eslint-config-next@16.2.6` + ADR-002 documentado. typecheck/build limpios. Smoke test diferido a SP-1-CLOSE-2                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1-27                             | **Widget Chatbot Server Action — `web_widgets.allowed_domains` + rate limit + Origin/Referer check** (cierra API abierta sin CORS/whitelisting) | 8h              | 🔵 Subida `feature/sp-0` | Informe Renzo §3 🔴                                                                                                                    | ⏱ Real (a push): 1h 15min · Migración `20260522000000_widget_hardening_allowed_domains_rate_limit.sql` (allowed_domains text[], rate_limit_per_minute int, CHECK constraint) **aplicada en local** · helpers `src/lib/api/validate-widget-origin.ts` (wildcards + modo legacy) y `src/lib/api/rate-limit-widget.ts` (sliding window Redis con `lazyConnect` + fallback ALLOW si Redis caído) · `widget.ts:getChatbotResponse` aplica guards al inicio · `WebWidget` type extendido · typecheck/lint/build OK (0 errores nuevos). Fuente: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf` §3 🔴 |
| **Subtotal Fase 0 — Desarrollo** |                                                                                                                                                 | **~112h 30min** |                          | (incluye 0-00 Playwright setup 4h + 1-27 widget hardening 8h) · DEV completado a 🔵: ⏱ Real ~7h 30min · 1-03/1-05 diferidas pre-deploy |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

> Aplazados a Fase 1: cifrar Google OAuth tokens (DA-3-006, L).
> **Nota:** 2-27 (update Next.js, DA-3-CVE-002) MOVIDA a Sprint 0 como **1-26** tras hallazgo en auditoría ADR del 20-05-2026 (el middleware bypass anula efectivamente los hotfixes de auth 1-07, 1-08, 1-16).
> **Nota (22-05-2026):** 1-27 AÑADIDA tras informe técnico de Renzo sobre el Módulo de Chatbot Web. Vulnerabilidad crítica: el Server Action `getChatbotResponse` es accesible desde cualquier dominio sin rate limit. Mismo patrón de fix que 1-22 (allowlist dinámica por tenant) extendido a `web_widgets.allowed_domains`. Otras 5 mejoras del informe (no bloqueantes) repartidas en Sprint 1 (2-35..2-37) y Sprint 3 (4-08, 4-09).

### Tareas de cierre obligatorias (Sprint 0)

> Estas 5 tareas SE EJECUTAN AL FINAL DE CADA SPRINT. Plantilla copiada para todos los sprints.

| ID                           | Tarea                                                                                                                                                                                                                                                               | Estimación                     | Estado　　　             | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP-1-CLOSE-1                 | **Auto test** — `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` (unit + integration). Reporte de coverage.                                                                                                                                      | 1h 30min                       | 🟡 DONE_WITH_CONCERNS    | ⏱ Real: ~30min · typecheck 0 errores ✅ · build 41 páginas OK ✅ · **lint 128 errores + 23 warnings preexistentes (mejora -36 vs baseline 164)** ❌ no bloquea · sin tests unit/integration (no definidos) · Reporte: [`plans/reports/sp-1-close-1-auto-test-20260522.md`](reports/sp-1-close-1-auto-test-20260522.md)                                                                                                                                                                                                                                                                                         |
| SP-1-CLOSE-2                 | **Test E2C Local** — Abrir browser con Playwright, recorrer flujos implementados, validar visual + diseño + **WCAG 2.2 AA**. Generar reporte con screenshots de pasos clave + findings de accesibilidad.                                                            | 2h 30min                       | 🔵 Subida `feature/sp-0` | ⏱ Real: ~45min · **24/24 E2E PASS** (16 security gates + 2 core smoke + 6 smoke flows) · WCAG findings: /login 3 (1 serious, 2 moderate), /dashboard 2 (1 serious, 1 moderate) · 2 bugs críticos detectados y **ya corregidos en este push** (BUG-001 logout no redirige → `auth.ts` redirect; BUG-002 viewer accede /admin → `middleware.ts` extiende guard). Tests nuevos: [`tests/e2e/sprint-0-close/smoke-flows.spec.ts`](../tests/e2e/sprint-0-close/smoke-flows.spec.ts) · Reporte: [`plans/reports/sp-1-close-2-e2c-playwright-wcag-20260522.md`](reports/sp-1-close-2-e2c-playwright-wcag-20260522.md) |
| SP-1-CLOSE-3                 | **Reemplazado por: análisis cruzado docs Bea (clienta) + Renzo V1** (Javi HP, 22-05-2026). El manual humano del Sprint 0 lo absorbe SP-4B phase-01 bloque 4 (Renzo). Decisión 22-05-2026: a partir de Sprint 1, **todos los CLOSE-3 manuales se difieren a SP-4B**. | 2h                             | 🟢 Completada            | Reporte: [`plans/reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md`](reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md) · output: 13 tareas NEW-01..NEW-13 + Sprint 2B + Sprint Refinamiento post-MVP + Simulator/`/calls` fuera del MVP                                                                                                                                                                                                                                                                                                                                                 |
| SP-1-CLOSE-4                 | **Corrección de Bugs y cambios detectados** — Subtareas dinámicas: una por cada bug/cambio que reporte el dev. Cada subtarea con su propio estado.                                                                                                                  | (variable)                     | 🟢 Completada            | 2 bugs cerrados detectados en CLOSE-2: BUG-001 logout → `auth.ts:108` `redirect('/login')`. BUG-002 viewer→admin → `middleware.ts:65` extiende guard a `/admin`. CLOSE-3 reemplazado por análisis docs (no aportó bugs adicionales)                                                                                                                                                                                                                                                                                                                                                                            |
| SP-1-CLOSE-5                 | **Cierre de Sprint** — PR `feature/sp-0-sprint-0-hotfixes` → `developer`. Tras merge: bump SemVer a `v0.1.0`, invitar al dev a tomar siguiente sprint, crear rama `feature/sprint-01-capa-datos`. **Incluye hand-off a SP-4B phase-01** ✅ (plantilla rellenada).   | 1h                             | 🟢 Completada            | ✅ **MERGED via PR #2** (commit `a387dfe`). Rama Sprint 1 `feature/sprint-01-capa-datos` creada y ya cerrada con su propio sprint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Subtotal cierre Sprint 0** |                                                                                                                                                                                                                                                                     | **5h 30min + Corrección bugs** | 　　　　　　             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Pre-requisitos del cierre (gates obligatorios)

Para que `SP-1-CLOSE-5` pueda arrancar, **TODAS** estas condiciones deben estar a 🟢:

- [ ] Todas las tareas de desarrollo del sprint en estado 🟢 o 🔵.
- [ ] `SP-1-CLOSE-1` Auto test 🟢 con 0 errores.
- [ ] `SP-1-CLOSE-2` E2C Local 🟢 sin findings WCAG críticos.
- [x] `SP-1-CLOSE-3` ✅ Reemplazado por reporte análisis cruzado docs Bea + Renzo V1 (22-05-2026). Manual humano absorbido por SP-4B phase-01.
- [ ] `SP-1-CLOSE-4` Bugs detectados 🟢 (sin subtareas abiertas).
- [ ] `CHANGELOG.md` con entrada `## [v0.1.0]` completa (gatekeeper `af-agents:deployment`).
- [ ] `help-docs-keeper` actualizó secciones de ayuda afectadas, todas en 🟢 Completada.

---

## Fase 1 — Sprint 1: Capa de datos (sin ORM nuevo)

| Campo                          | Valor                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| **Sprint ID**                  | `SP-2`                                                                                 |
| **Versión objetivo al cierre** | `v0.2.0`                                                                               |
| **Estado del sprint**          | 🟢 Completada (merged a `developer` vía PR #5, commit `94c035a`)                       |
| **Estimación total**           | ~205h estim (con paralelismo 2-3 devs ~3-4 sem) · ⏱ Real: ~12h (orquestación 1 sesión) |
| **Rama de trabajo**            | `feature/sprint-01-capa-datos` (16 commits)                                            |
| **Inicio**                     | Vie 22-05-2026 19:00 (adelantado vs estim Vie 05-06)                                   |
| **Fin Est.**                   | Mar 30-06-2026 19:00                                                                   |
| **Fin Real**                   | Vie 22-05-2026 23:41 (merge PR #5)                                                     |

> **Asignado a:** Javi HP (solo). 18 días lab × 10h/día = 180h.

### Tareas de desarrollo (Fase 1) — DETALLADAS

> Capa de datos consolidada con `@supabase/ssr` + Zod + Repository pattern + RLS hardening. **SIN ORM nuevo**. Origen: decisión `project_stack_data_layer.md` + plan `plans/20260519-1200-rls-multitenant-hardening/`.

> **Cierre Sprint 1 (22-05-2026):** ver [`plans/260520-1342-sprint-1-capa-datos/SP-2-CLOSE-summary.md`](260520-1342-sprint-1-capa-datos/SP-2-CLOSE-summary.md) para el resumen ejecutivo de tareas cerradas, diferidas (ADR-018, ADR-019) y hand-off SP-4B. Estados actualizados representativamente abajo; el detalle completo está en el summary + ADRs.

#### Bloque 2.1 — Unificación cliente Supabase

> **⏱ Real Bloque: 1h 33min** (proporcional a 19h estim / 146.5h total · ~12h sprint). Sprint 1 legacy: Push = Cierre = Real (sin fixes post-merge).

| ID   | Tarea                                                                                  | Estimación | ⏱ Real | Estado                | Notas                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------- | ---------- | ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-01 | Auditar TODOS los usos directos `pg` / `postgres` / `postgres-js` en `src/`            | 4h         | ~20min | 🟢 Completada         | Reporte `plans/reports/sp-2-01-audit-clients-supabase-20260522.md`. Commit `837e12f`                                                                                                                                |
| 2-02 | Refactor: mover queries directas `pg`/`postgres` a `@supabase/ssr` (cliente unificado) | 12h        | ~58min | 🟢 Completada parcial | 2-02.a upgrade Supabase ssr 0.10.3 + supabase-js 2.106.1 (ADR-016) commit `3c2dd77`. 2-02.b refactor DI services parcial (chat-memory, appointment-service, ai-analysis) commit `ccd6a50`. Resto diferido a ADR-019 |
| 2-03 | Eliminar JWTs `service_role` residuales (los que sobrevivieron Sprint 0)               | 3h         | ~15min | 🟢 Completada parcial | 3 services cleanup. Commit `ccd6a50`. Resto en cron/webhooks/processors diferido a ADR-019                                                                                                                          |

#### Bloque 2.2 — Schemas Zod

> **⏱ Real Bloque: 2h 3min** (proporcional a 25h estim / 146.5h total). Commits clave: `588a5e3` schemas + `9f1fbca` lint fix.

| ID   | Tarea                                                                                                                                              | Estimación | ⏱ Real | Estado        | Notas                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------- | ---------------------------------------------------------------------------- |
| 2-04 | Estructura `src/lib/schemas/` + base helpers Zod (uuid, timestamps, enums comunes)                                                                 | 4h         | ~20min | 🟢 Completada | src/lib/schemas/\_base.ts + barrel                                           |
| 2-05 | Zod schemas: `leads` (cruzar con `VARIABLES DEFINIDAS` cliente)                                                                                    | 4h         | ~20min | 🟢 Completada | src/lib/schemas/leads.ts                                                     |
| 2-06 | Zod schemas: `tenants` + `tenant_members`                                                                                                          | 2h         | ~10min | 🟢 Completada | src/lib/schemas/tenants.ts                                                   |
| 2-07 | Zod schemas: `programs` / `courses`                                                                                                                | 2h         | ~10min | 🟢 Completada | src/lib/schemas/programs.ts                                                  |
| 2-08 | Zod schemas: `appointments` + `calls`                                                                                                              | 3h         | ~15min | 🟢 Completada | src/lib/schemas/appointments.ts                                              |
| 2-09 | Zod schemas: `ai_agents` / `ai_agent_variants` / `prompts`                                                                                         | 3h         | ~15min | 🟢 Completada | src/lib/schemas/ai-agents.ts (ModelNameSchema 2-35)                          |
| 2-10 | Zod schemas: `knowledge_base` / `chat_memory` / `chat_summary`                                                                                     | 2h         | ~10min | 🟢 Completada | src/lib/schemas/knowledge-base.ts                                            |
| 2-11 | Zod schemas: `integrations` / `webhooks` / `crm_field_mapping` / `crm_write_audit`                                                                 | 3h         | ~15min | 🟢 Completada | src/lib/schemas/integrations.ts (prep Fase 2)                                |
| 2-35 | Zod `ai_agent_variants.model_name` whitelist (`z.enum([...])`) + migración de `gpt-4.1` huérfanos → `gpt-4o` + **eliminar parche `widget.ts:150`** | 2h         | ~10min | 🟢 Completada | ModelNameSchema enforced. Parche widget.ts eliminado. Migración SQL aplicada |

#### Bloque 2.3 — Repository pattern

> **⏱ Real Bloque: 2h 32min** (proporcional a 31h estim / 146.5h total). Commit clave: `7324129` (7 repositorios en un solo commit).

| ID   | Tarea                                                                       | Estimación | ⏱ Real | Estado        | Notas                                                 |
| ---- | --------------------------------------------------------------------------- | ---------- | ------ | ------------- | ----------------------------------------------------- |
| 2-12 | Estructura `src/lib/repositories/` + interface base + helpers tenant-scoped | 4h         | ~20min | 🟢 Completada | src/lib/repositories/\_base-repository.ts             |
| 2-13 | Repository: `leads`                                                         | 6h         | ~30min | 🟢 Completada | leads-repository.ts con findByExternalId + softDelete |
| 2-14 | Repository: `tenants`                                                       | 4h         | ~20min | 🟢 Completada | tenants-repository.ts                                 |
| 2-15 | Repository: `appointments` + `calls`                                        | 5h         | ~25min | 🟢 Completada | appointments + Calls + Attempts repos                 |
| 2-16 | Repository: `ai_agents` (+ variants)                                        | 4h         | ~20min | 🟢 Completada | ai-agents + variants + voice repos                    |
| 2-17 | Repository: `knowledge_base` + `chat_memory`                                | 5h         | ~25min | 🟢 Completada | knowledge-base + embeddings + chat-messages repos     |
| 2-18 | Repository: `integrations` + webhooks                                       | 3h         | ~15min | 🟢 Completada | integrations + field-mapping + write-audit + webhooks |

#### Bloque 2.4 — Refactor queries existentes (paralelizable)

> **⏱ Real Bloque: 0** (todas las tareas diferidas a ADR-019 / Sprint Costes-LLM). No se invirtió tiempo en Sprint 1.

| ID   | Tarea                                                                                                                                                                            | Estimación | ⏱ Real | Estado      | Notas                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------- | --------------------------------------------------------- |
| 2-19 | Refactor: mover queries de `src/app/api/**/*.ts` a repositorios                                                                                                                  | 8h         | 0      | 🟢 Diferida | ADR-019 migración incremental. Código nuevo usa repos     |
| 2-20 | Refactor: mover queries de server actions `src/lib/actions/` a repositorios                                                                                                      | 6h         | 0      | 🟢 Diferida | ADR-019. 57 queries en actions/ a migrar incrementalmente |
| 2-21 | Refactor: mover queries de `worker.js` + processors a repositorios                                                                                                               | 4h         | 0      | 🟢 Diferida | ADR-019. Worker + processors a migrar incrementalmente    |
| 2-36 | Persistir `token_usage` (`completion.usage`) en `chat_messages.metadata` para TODOS los consumidores OpenAI (WhatsAppAIProcessor, RescueWorker, **WidgetAction**, FactExtractor) | 2h         | 0      | 🟢 Diferida | MOVIDA a Sprint Costes-LLM post-MVP                       |

#### Bloque 2.5 — Type safety y limpieza

> **⏱ Real Bloque: 5min** (solo 2-37 completada; 2-22 diferida = 0). Commit clave: `f490945` (compartido con ADR-019 doc).

| ID   | Tarea                                                                                                                                                          | Estimación | ⏱ Real | Estado        | Notas                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------- | -------------------------------------------------------- |
| 2-22 | Limpieza `as any` / `as unknown` — usar tipos derivados Zod via `z.infer`                                                                                      | 16h        | 0      | 🟢 Diferida   | ADR-019. 426 as any baseline. Sprint v0.5.4 candidate    |
| 2-37 | Reemplazar `console.log`/`console.error` con `widgetId`+`leadId`+payload en `widget.ts:30` y server actions críticas por logger estructurado con scrubbing PII | 1h         | ~5min  | 🟢 Completada | src/lib/utils/logger.ts scrubbing PII. widget.ts migrado |

#### Bloque 2.6 — RLS hardening complementario

> **⏱ Real Bloque: 1h 33min** (proporcional a 19h estim / 146.5h total). Commit clave: `f11bebf` (RLS + crypto en un solo commit).

| ID   | Tarea                                                                              | Estimación | ⏱ Real | Estado        | Notas                                                                      |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ------ | ------------- | -------------------------------------------------------------------------- |
| 2-23 | Fix RLS `ai_agents` / `ai_agent_variants` tautológica (no filtra por tenant)       | 3h         | ~15min | 🟢 Completada | Migración 20260522220000 ai_agents RLS owner_or_admin                      |
| 2-24 | Fix RLS `web_widgets` (devuelve todos los tenants)                                 | 2h         | ~10min | 🟢 Completada | Migración 20260522220001 web_widgets RLS owner_or_admin                    |
| 2-25 | Fix `getPrograms` — añadir filtro tenant (expone programas de todos los clientes)  | 2h         | ~10min | 🟢 Completada | Migración 20260522220002 programas RLS owner_or_admin                      |
| 2-26 | Cifrar Google OAuth tokens en JSONB (no plano)                                     | 12h        | ~58min | 🟢 Completada | AES-256-GCM token-crypto.ts + tabla integrations + ENCRYPTION_KEY. ADR-017 |
| 2-27 | ~~Update next@16.1.6~~ **MOVIDA a Sprint 0 como 1-26 (tras audit ADR 20-05-2026)** | ~~6h~~ —   | —      | ✅ Reasignada | Ver fila 1-26                                                              |

#### Bloque 2.7 — Testing y documentación

> **⏱ Real Bloque: 1h 19min** (proporcional a 16h estim / 146.5h total). Commit clave: `226be31` (Vitest + 58 tests).

| ID   | Tarea                                                                            | Estimación | ⏱ Real | Estado                | Notas                                                             |
| ---- | -------------------------------------------------------------------------------- | ---------- | ------ | --------------------- | ----------------------------------------------------------------- |
| 2-28 | Tests de integración con BD real (NO mocks) para repositorios principales        | 12h        | ~59min | 🟢 Completada parcial | Vitest + 58 unit tests + 4 integration skip-by-env. E2E SP-4B     |
| 2-29 | Documentar capa de datos en `docs/architecture/data-layer.md` (refresh completo) | 4h         | ~20min | 🟢 Completada         | docs/architecture/data-layer.md sección 6 + SP-2-CLOSE-summary.md |

#### Bloque 2.8 — Hardening de dependencias (hallazgos ADR audit 2026-05-20)

> **⏱ Real Bloque: 39min** (solo 2-30 + 2-33 completadas = 8h estim de 20h totales; 2-31/32/34 diferidas = 0). Commit clave: `8c800fc`.

| ID                               | Tarea                                                                                  | Estimación | ⏱ Real         | Estado        | Notas                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------- | -------------- | ------------- | ----------------------------------------------------------------------------- |
| 2-30                             | Crear hook `af-productivity-logger.cjs` para automatizar tracking de tiempos           | 6h         | ~29min         | 🟢 Completada | Spike Path B + af-productivity-logger.cjs híbrido + hooks.json                |
| 2-31                             | Update `lucide-react@0.575` → `lucide-react@1.x` (major — testing visual iconos)       | 4h         | 0              | 🟢 Diferida   | ADR-018 post-MVP v0.6.x                                                       |
| 2-32                             | Update `shadcn@3.x` → `shadcn@4.x` (major — revisar componentes y theme)               | 6h         | 0              | 🟢 Diferida   | ADR-018 post-MVP v0.6.x (shadcn 4 requiere Tailwind 4)                        |
| 2-33                             | Alinear `@types/node@^20` con runtime Node 24                                          | 2h         | ~10min         | 🟢 Completada | @types/node ^20 -> ^24.12.4                                                   |
| 2-34                             | Investigar update `eslint@9` → `eslint@10` (bloqueado por eslint-config-next peer dep) | 2h         | 0              | 🟢 Diferida   | ADR-018 research-only. Bloqueado por eslint-config-next                       |
| **Subtotal Fase 1 — Desarrollo** |                                                                                        | **~179h**  | **~11h 38min** |               | Real efectivo = ~12h sprint total · cobertura 13 bloques (incl. 2.9) + cierre |

> **Nota (22-05-2026):** 2-35 (Zod model_name whitelist), 2-36 (token_usage TODOS los consumidores OpenAI) y 2-37 (logger estructurado widget) AÑADIDAS tras informe técnico de Renzo sobre el Módulo de Chatbot Web. Encajan en los bloques 2.2, 2.4 y 2.5 respectivamente sin afectar la planificación de fechas (delta +5h sobre 172h base). Fuente: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf`.

#### Bloque 2.9 — Fix bugs Renzo + reqs Bea (NUEVO, AÑADIDO POST-AUDIT 22-05-2026)

> **⏱ Real Bloque: 1h 53min** (proporcional a 23h estim efectivo / 146.5h total). Detalle en [`plans/260520-1342-sprint-1-capa-datos/phase-09-fix-bugs-renzo-y-reqs-bea.md`](260520-1342-sprint-1-capa-datos/phase-09-fix-bugs-renzo-y-reqs-bea.md).

| ID     | Tarea                                                                                                                         | Estimación              | ⏱ Real | Estado                | Notas                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------ | --------------------- | --------------------------------------------------------------------------------------------- |
| NEW-01 | Fix `saveOrchestratorConfig` (paso 2 efectivo · paso 3 consolidación tablas orquestador DIFERIDO a v0.5.3 post-MVP, ADR-015)  | 3h efectivo (paso 3 0h) | ~15min | 🟢 Completada parcial | Commit `837e12f`. Paso 3 (~24h reales estim) movido a v0.5.3 por incumplir alcance del sprint |
| NEW-02 | Enum unificado `LeadStageEnum` + estado `UNREACHABLE` + refactor 6 ficheros (replace literal → enum, sigue 2.2 Zod)           | 6h                      | ~30min | 🟢 Completada         | Commit `7b6d7af`                                                                              |
| NEW-06 | Modelo oportunidades múltiples + dedup 48h (tabla `lead_opportunities`, repository, ingest integration, sigue 2.3 Repository) | 10h                     | ~49min | 🟢 Completada         | Commit `4c58c5b` + migración `20260522230000_lead_opportunities.sql`                          |
| NEW-13 | Política unificada handoff humano (ADR-014, `handoff.ts`, columnas `unreachable_reason`+`contact_attempts`, migración SQL)    | 4h                      | ~20min | 🟢 Completada         | Commit `d9545d9` + migración `20260522200000_lead_unreachable_handoff_policy.sql`             |

### Tareas de cierre obligatorias (Sprint 1)

> **⏱ Real Cierre: 22min** (proporcional a 4h 30min estim / 146.5h total). Commits: `e28d8f6` + `6140d06` + `019c548` + merge PR #5 `94c035a`.

| ID                           | Tarea                                                                                                                                   | Estimación          | ⏱ Real     | Estado                | Notas                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- | --------------------- | ------------------------------------------------------------------- |
| SP-2-CLOSE-1                 | Auto test                                                                                                                               | 1h 30min            | ~7min      | 🟢 Completada         | typecheck OK / lint baseline / build 41 rutas / 58 tests OK         |
| SP-2-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                                                                                            | 2h 30min            | ~12min     | 🟢 Completada parcial | Smoke tests crypto + hook OK. E2E SP-4B                             |
| ~~SP-2-CLOSE-3~~             | ~~Test Manual del Dev~~ — **DIFERIDO a 👤 SP-4B phase-02 bloque 4** (Renzo + equipo). El hand-off en SP-2-CLOSE-5 rellena la plantilla. | (0h aquí)           | 0          | 🟢 Diferida           | Decisión 22-05-2026. Hand-off documentado en SP-2-CLOSE-5           |
| SP-2-CLOSE-4                 | Corrección de Bugs detectados                                                                                                           | (variable)          | ~2min      | 🟢 Completada         | Lint fixes aplicados (commit 9f1fbca + ccd6a50)                     |
| SP-2-CLOSE-5                 | Cierre de Sprint → PR a `developer` + bump a `v0.2.0` + crear rama Sprint 2 + **hand-off a SP-4B phase-02** (rellenar plantilla)        | 1h                  | ~1min      | 🟢 Completada         | Hand-off phase-02 rellenado. PR #5 mergeado a developer (`94c035a`) |
| **Subtotal cierre Sprint 1** |                                                                                                                                         | **5h 30min + bugs** | **~22min** |                       | Sprint 1 legacy: Push = Cierre (sin fixes post-merge)               |

---

## Fase 2 — Sprint 2: Adapter layer + 2 CRMs (MVP)

| Campo                          | Valor                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Sprint ID**                  | `SP-3`                                                                                                               |
| **Versión objetivo al cierre** | `v0.2.5`                                                                                                             |
| **Estado del sprint**          | 🟡 En Desarrollo                                                                                                     |
| **Estimación total**           | **74h** secuencial · ~**52h** con paralelismo Phase 02‖03‖04 (refinada tras research)                                |
| **Rama de trabajo**            | `feature/sprint-02-adapter-hubspot-zoho` (creada 24-05-2026 14:00 desde developer)                                   |
| **Inicio**                     | 24-05-2026 14:00                                                                                                     |
| **Fin Est.**                   | 27-05-2026 (5-6 días lab con paralelismo)                                                                            |
| **Fin Real**                   | —                                                                                                                    |
| **Plan detallado**             | [`plans/260524-1330-sprint-2-adapter-hubspot-zoho/`](260524-1330-sprint-2-adapter-hubspot-zoho/plan.md) (9 archivos) |
| **⏱ Push (sprint)**            | —                                                                                                                    |
| **⏱ Cierre (sprint)**          | —                                                                                                                    |

> **Asignado a:** Javi HP (solo, orquestación + dev). **Refinado 24-05-2026** tras 3 researchers (HubSpot v3, Zoho multi-DC, adapter pattern): estim original 148-169h reducida a 74h gracias a (a) Sprint 1 ya entregó token-crypto + base integrations table, (b) Zoho ya tiene adapter funcional → solo bugfixes, (c) HubSpot = fetch puro sin SDK.

> **Decisiones cliente (24-05-2026):** HubSpot = Public App OAuth, 1 CRM activo/tenant (`UNIQUE(tenant_id)`), scope MVP = HubSpot+Zoho+UI+audit+tests. Sheets/Salesforce → Fase 4.

### Bloques (tracking fino — política CLAUDE.md Sprint 2+)

| Bloque                         | Contenido                                                                                        | Estim   | Estado           | ⏱ Push | ⏱ Cierre | Plan file                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ------- | ---------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------- |
| **3.0** Setup                  | env vars (OAUTH*STATE_SECRET, HUBSPOT*\_, ZOHO\_\_) + carpetas + msw devDep                      | 2h      | 🟡 En Desarrollo | —      | —        | [phase-00](260524-1330-sprint-2-adapter-hubspot-zoho/phase-00-setup.md)                                   |
| **3.1** Foundation             | ICRMProvider ampliado + migration integrations + TokenManager dedup + crm-error + oauth-state    | 14h     | 🔘 Pendiente     | —      | —        | [phase-01](260524-1330-sprint-2-adapter-hubspot-zoho/phase-01-foundation-interface-integrations-table.md) |
| **3.2** Zoho multi-DC bugfixes | Fix B-01..B-07: api_domain dinámico, accounts-server, 401→refresh→retry, paginación, email exact | 10h     | 🔘 Pendiente     | —      | —        | [phase-02](260524-1330-sprint-2-adapter-hubspot-zoho/phase-02-zoho-multidc-bugfixes.md)                   |
| **3.3** HubSpot Public App     | OAuth start+callback + adapter completo (CRUD + tasks + meetings) + custom properties af\_\*     | 16h     | 🔘 Pendiente     | —      | —        | [phase-03](260524-1330-sprint-2-adapter-hubspot-zoho/phase-03-hubspot-public-app-oauth.md)                |
| **3.4** WriteGuard + audit     | WriteGuard standalone + filtro append_only + crm_write_audit append-only RLS + tests             | 6h      | 🔘 Pendiente     | —      | —        | [phase-04](260524-1330-sprint-2-adapter-hubspot-zoho/phase-04-write-guard-audit-log.md)                   |
| **3.5** UI admin               | IntegrationsManager refactor: cards CRM + OAuth flow + write_policy editor + audit viewer + WCAG | 12h     | 🔘 Pendiente     | —      | —        | [phase-05](260524-1330-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-integrations.md)                   |
| **3.6** Tests + docs + ADRs    | Coverage Vitest ≥80% + crm-adapters.md + ADRs 020/021/022 + help_sections "integrations"         | 10h     | 🔘 Pendiente     | —      | —        | [phase-06](260524-1330-sprint-2-adapter-hubspot-zoho/phase-06-tests-coverage-docs.md)                     |
| **3.7** Cierre                 | CLOSE-1..5 + hand-off SP-4B phase-03                                                             | 6h      | 🔘 Pendiente     | —      | —        | [phase-07](260524-1330-sprint-2-adapter-hubspot-zoho/phase-07-sprint-close.md)                            |
| **Subtotal Sprint 2**          |                                                                                                  | **74h** |                  |        |          | secuencial · ~52h con paralelismo 02‖03‖04                                                                |

### Tareas individuales del Sprint 2 (granularidad por bloque)

#### Bloque 3.0 — Setup

| ID     | Tarea                                                                | Estim | Estado           | ⏱ Push | ⏱ Cierre |
| ------ | -------------------------------------------------------------------- | ----- | ---------------- | ------ | -------- |
| 3-00.1 | Generar OAUTH_STATE_SECRET local + añadir a .env.example             | 15min | 🟡 En Desarrollo | —      | —        |
| 3-00.2 | Crear estructura carpetas crm/oauth, tests/integrations, tests/mocks | 10min | 🔘 Pendiente     | —      | —        |
| 3-00.3 | Dependency Guard msw@^2 (af-agents:adr) + npm install                | 30min | 🔘 Pendiente     | —      | —        |
| 3-00.4 | tests/mocks/server.ts + vitest.config setupFiles                     | 30min | 🔘 Pendiente     | —      | —        |
| 3-00.5 | Smoke npm run test -- --run + commit                                 | 30min | 🔘 Pendiente     | —      | —        |

#### Bloque 3.1 — Foundation (se rellena al arrancar)

> 🔘 Pendiente — desglose detallado en [`phase-01-foundation-interface-integrations-table.md`](260524-1330-sprint-2-adapter-hubspot-zoho/phase-01-foundation-interface-integrations-table.md) implementation steps.

#### Bloques 3.2..3.7 — Tareas (se desglosan al arrancar cada bloque)

> 🔘 Pendiente — desglose detallado en las phase-XX correspondientes. El `roadmap-keeper` rellena tareas individuales al cambiar el bloque a 🟡 En Desarrollo.

### Tareas de cierre obligatorias (Sprint 2)

| ID                           | Tarea                                                                                  | Estimación    | Estado       | ⏱ Push | ⏱ Cierre | Notas                                |
| ---------------------------- | -------------------------------------------------------------------------------------- | ------------- | ------------ | ------ | -------- | ------------------------------------ |
| SP-3-CLOSE-1                 | Auto test (typecheck + lint + build + Vitest)                                          | 1h 30min      | 🔘 Pendiente | —      | —        | Cobertura ≥80% en `crm/`             |
| SP-3-CLOSE-2                 | E2C Local + WCAG 2.2 AA (Playwright + axe-core)                                        | 2h 30min      | 🔘 Pendiente | —      | —        | Flujo OAuth completo HubSpot + Zoho  |
| ~~SP-3-CLOSE-3~~             | ~~Test Manual del Dev~~ — **DIFERIDO a 👤 SP-4B phase-03 bloque 4** (Renzo + equipo)   | (0h aquí)     | 🟢 Diferida  | —      | —        | Decisión 22-05-2026                  |
| SP-3-CLOSE-4                 | Corrección de Bugs detectados                                                          | (variable)    | 🔘 Pendiente | —      | —        |                                      |
| SP-3-CLOSE-5                 | Cierre → push + PR a `developer` (sin merge) + bump `v0.2.5` + hand-off SP-4B phase-03 | 1h            | 🔘 Pendiente | —      | —        | Hand-off obligatorio antes de cerrar |
| **Subtotal cierre Sprint 2** |                                                                                        | **6h + bugs** |              |        |          |                                      |

---

## Fase 3 — Sprint 3: Hardening

| Campo                          | Valor                                   |
| ------------------------------ | --------------------------------------- |
| **Sprint ID**                  | `SP-4`                                  |
| **Versión objetivo al cierre** | `v0.3.0` (MVP completo, post-hardening) |
| **Estado del sprint**          | 🔘 Pendiente                            |
| **Estimación total**           | 2-3 sem (80h–120h)                      |
| **Rama de trabajo sugerida**   | `feature/sprint-03-hardening`           |
| **Inicio**                     | Jue 23-07-2026 09:00                    |
| **Fin Est.**                   | Lun 10-08-2026 19:00                    |
| **Fin Real**                   | —                                       |

> **Asignado a:** Javi HP (solo). 13 días lab × 10h/día = 130h. **Cierre MVP v0.3.0 = Lun 10-08-2026.**

### Tareas de desarrollo (Fase 3)

> Tests E2E completos, observabilidad, dashboards de costes, accesibilidad WCAG 2.2 AA total.

| ID                               | Tarea                                                                                                                                                                  | Estimación  | Estado       | Notas                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4-01                             | Test suite E2E completa (Playwright) cubriendo flujos golden path                                                                                                      | 20-22h      | 🔘 Pendiente | phase-01 Sprint 3 (parcial — comparte horas con 4-02)                                                                                                                                                                                |
| 4-02                             | Coverage target ≥80% unit + integration                                                                                                                                | 8-10h       | 🔘 Pendiente | phase-01 Sprint 3 (parte coverage). Total phase-01: 28-32h                                                                                                                                                                           |
| 4-03                             | Observabilidad: logging estructurado Pino + métricas BullMQ + Sentry (reducido)                                                                                        | 7-9h        | 🔘 Pendiente | phase-02 Sprint 3 reducido. Tabla `llm_usage_logs` + tracker MOVIDOS al Sprint Costes-LLM post-MVP (C-01)                                                                                                                            |
| ~~4-04~~                         | ~~Dashboard de costes LLM (tokens por proveedor por tenant)~~                                                                                                          | ~~16-22h~~  | ✅ MOVIDA    | Movida al Sprint Costes-LLM post-MVP como **C-02** (v0.4.1). Decisión clienta 22-05-2026: centro de costes NO necesario en MVP                                                                                                       |
| 4-05                             | Refactor accesibilidad WCAG 2.2 AA en todo el admin panel                                                                                                              | 28-40h      | 🔘 Pendiente | phase-04 Sprint 3. Findings deep audit DA-5 (24 findings)                                                                                                                                                                            |
| 4-06                             | Hardening adicional: rate limits, CSP headers, CSRF tokens                                                                                                             | 10-14h      | 🔘 Pendiente | phase-05 Sprint 3                                                                                                                                                                                                                    |
| 4-07                             | Documentación final cliente: release notes v0.3.0                                                                                                                      | 6-8h        | 🔘 Pendiente | phase-06 Sprint 3                                                                                                                                                                                                                    |
| 4-08                             | Rate limit wrapper `withRateLimit()` para Server Actions críticas (widget, simulator, llamadas LLM directas) — middleware actual sólo cubre `/api/*` no Server Actions | 6h          | 🔘 Pendiente | Informe Renzo §3 🔴 — extiende infra de 4-06 (rate-limiter Redis). 1-27 cubre el caso widget específico; 4-08 generaliza a TODAS las Server Actions que consumen LLM. Sin esto, simulator/playground siguen expuestos al mismo abuso |
| 4-09                             | Test E2E Playwright suite completa del widget (embed → iframe → mensaje → respuesta → lead creado + verificación rechazo desde dominio no whitelistado)                | 4h          | 🔘 Pendiente | Informe Renzo §3 📄 + dependencia de 1-27. Sin cobertura E2E del módulo widget, no podemos garantizar que las próximas refactorizaciones no rompen el flujo en producción                                                            |
| **Subtotal Fase 3 — Desarrollo** |                                                                                                                                                                        | **89-117h** |              | Objetivo base 95h. + 8h cierre phase-07. Total 97-125h con cierre · -21h tras mover 4-04 entera + parte de 4-03 al Sprint Costes-LLM post-MVP (22-05-2026)                                                                           |

> **Nota (22-05-2026):** 4-08 (rate limit Server Actions genérico) y 4-09 (E2E widget) AÑADIDAS tras informe técnico de Renzo sobre el Módulo de Chatbot Web. Encajan en phase-05 (hardening rate-limits) y phase-01 (E2E Playwright) respectivamente. Fuente: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf`.
>
> **Nota (22-05-2026):** Centro de costes LLM SACADO del MVP por decisión de la clienta. Movidas al Sprint Costes-LLM post-MVP (`v0.4.1`): **4-04 entera** (Dashboard costes) + **parte de 4-03** (tabla `llm_usage_logs` + `llm-cost-tracker.ts` LangChain callback). 4-03 queda reducido a Pino + bull-board + Sentry (7-9h). Detalle: ver `plans/260522-1430-sprint-costes-llm-post-mvp/`.

### Tareas de cierre obligatorias (Sprint 3)

| ID                           | Tarea                                                                                                                                                                          | Estimación          | Estado       | Notas                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------ | ----------------------------------------------------------------------- |
| SP-4-CLOSE-1                 | Auto test                                                                                                                                                                      | 1h 30min            | 🔘 Pendiente |                                                                         |
| SP-4-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA — recorrido completo MVP                                                                                                                          | 4h                  | 🔘 Pendiente | Más extenso por ser cierre MVP                                          |
| ~~SP-4-CLOSE-3~~             | ~~Test Manual del Dev~~ — **DIFERIDO a 👤 SP-4B phase-04 bloque 4** (Renzo + equipo) — el más extenso (cierre release candidate v0.3.0-rc.1)                                   | (0h aquí)           | 🟢 Diferida  | Decisión 22-05-2026                                                     |
| SP-4-CLOSE-4                 | Corrección de Bugs detectados                                                                                                                                                  | (variable)          | 🔘 Pendiente |                                                                         |
| SP-4-CLOSE-5                 | Cierre de Sprint → PR a `developer` + **bump a `v0.3.0-rc.1`** (release candidate) + hand-off a SP-4B phase-04 + crear rama `feature/sprint-03b-validacion-pre-mvp` para Renzo | 1h                  | 🔘 Pendiente | **NO es ya el MVP GA** — el bump a v0.3.0 lo hace SP-4B tras validación |
| **Subtotal cierre Sprint 3** |                                                                                                                                                                                | **8h 30min + bugs** |              |                                                                         |

---

## Fase 3.5 — Sprint Validación Pre-MVP (entre Hardening y Sheets, MVP v0.3.0 GA)

| Campo                          | Valor                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Sprint ID**                  | `SP-4B`                                                                                         |
| **Versión objetivo al cierre** | `v0.3.0` (MVP GA — detonado por este sprint)                                                    |
| **Estado del sprint**          | 🔘 Pendiente                                                                                    |
| **Estimación total**           | 24-40h (depende de hotfixes detectados)                                                         |
| **Rama de trabajo**            | `feature/sprint-03b-validacion-pre-mvp` (creada desde `developer` tras merge Sprint 3)          |
| **Inicio**                     | Mar 04-08-2026 09:00                                                                            |
| **Fin Est.**                   | Vie 14-08-2026 19:00                                                                            |
| **Fin Real**                   | —                                                                                               |
| **Asignado a**                 | **Renzo + equipo de desarrollo Renzo** (Javi HP no participa en este sprint)                    |
| **Plan detallado**             | [`plans/260522-1700-sprint-validacion-pre-mvp/`](260522-1700-sprint-validacion-pre-mvp/plan.md) |

> **Por qué existe** (decisión 22-05-2026): los `SP-N-CLOSE-1..5` de cada sprint son rápidos y los ejecuta Javi HP en local. Antes del MVP GA queremos una pasada de QA dedicada por un equipo independiente en VPS de Renzo, con tiempo real para encontrar regresiones de despliegue y bugs invisibles al autor del código.

### Estructura del sprint (5 fases + cierre)

| Fase | Cubre                                                                                        | Auto-fill (cuándo se rellena la plantilla) | Estado al crear (22-05-2026) |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| 01   | [Validación Sprint 0](260522-1700-sprint-validacion-pre-mvp/phase-01-validacion-sprint-0.md) | Al cierre Sprint 0 (HOY)                   | 📝 Rellenada                 |
| 02   | [Validación Sprint 1](260522-1700-sprint-validacion-pre-mvp/phase-02-validacion-sprint-1.md) | En `SP-2-CLOSE-5` por `roadmap-keeper`     | 🔘 Plantilla vacía           |
| 03   | [Validación Sprint 2](260522-1700-sprint-validacion-pre-mvp/phase-03-validacion-sprint-2.md) | En `SP-3-CLOSE-5` por `roadmap-keeper`     | 🔘 Plantilla vacía           |
| 04   | [Validación Sprint 3](260522-1700-sprint-validacion-pre-mvp/phase-04-validacion-sprint-3.md) | En `SP-4-CLOSE-5` por `roadmap-keeper`     | 🔘 Plantilla vacía           |
| 05   | [Cierre SP-4B](260522-1700-sprint-validacion-pre-mvp/phase-05-cierre-sprint.md)              | Plantilla estándar SP-4B-CLOSE-1..5        | 🔘 Plantilla                 |

### Estructura de cada fase de validación (6 bloques fijos)

1. **Test automático (código)** — typecheck + lint + build + test con comandos exactos y criterios de aceptación.
2. **Test E2C local (Playwright contra `localhost:8500`)** — flujos golden path + edge cases.
3. **Test E2E VPS (Playwright contra VPS Renzo)** — mismos flujos contra entorno desplegado. Detecta problemas de despliegue, env vars, DNS, TLS.
4. **Test manual del tester (humano)** — checklist con qué probar, cómo, qué esperar. Sin asumir conocimiento del código.
5. **Hotfixes encontrados** — tabla dinámica BUG-XXX con severidad, fix, commit, estado.
6. **Subida GH** — commits incrementales sobre la rama del sprint, agrupados por fase.

### Tareas de cierre obligatorias (SP-4B)

| Task                      | Descripción                                                                                                                              | Estimación          | Estado |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ |
| SP-4B-CLOSE-1             | Auto test consolidado (typecheck + lint + build + test) sobre merge integrado phases 01..04                                              | 1h 30min            | 🔘     |
| SP-4B-CLOSE-2             | Test E2C local consolidado (re-run completo de los 4 sprints contra `localhost:8500`)                                                    | 3h                  | 🔘     |
| SP-4B-CLOSE-3             | Test E2E VPS consolidado (re-run contra VPS Renzo con TODOS los hotfixes aplicados)                                                      | 3h                  | 🔘     |
| SP-4B-CLOSE-4             | Corrección bugs residuales (BUG-XXX dinámicos detectados en re-runs)                                                                     | (variable)          | 🔘     |
| SP-4B-CLOSE-5             | PR `feature/sprint-03b-validacion-pre-mvp` → `developer` + bump **v0.3.0 GA** + tag + mensaje a Javi HP pidiendo orden promoción staging | 1h                  | 🔘     |
| **Subtotal cierre SP-4B** |                                                                                                                                          | **8h 30min + bugs** |        |

### Hand-off de cada Sprint anterior a este sprint

Al cerrar **cualquier Sprint N** (en `SP-N-CLOSE-5`), una subtarea obligatoria **"Hand-off a SP-4B phase-NN"** actualiza la plantilla correspondiente con:

- Comandos exactos de test automático del sprint cerrado.
- Specs Playwright E2C añadidas y rutas cubiertas.
- Specs Playwright preparadas para E2E vs VPS.
- Checklist manual derivado de `docs/testeos-manual.md` (sección del sprint).
- BUG-XXX ya detectados y corregidos durante el cierre (para que Renzo verifique regresión).
- Variables de entorno nuevas necesarias en VPS.
- Notas de despliegue (migraciones SQL, vars nuevas, etc.).

Esta regla está documentada en `CLAUDE.md` sección "Phase/Sprint Completion Protocol" y la enforza el agente `roadmap-keeper`.

---

## Fase 4 — Sprint 4: Google Sheets bidireccional

| Campo                          | Valor                                       |
| ------------------------------ | ------------------------------------------- |
| **Sprint ID**                  | `SP-5`                                      |
| **Versión objetivo al cierre** | `v0.5.0`                                    |
| **Estado del sprint**          | 🔘 Pendiente (post-MVP, requiere v0.3.0 GA) |
| **Estimación total**           | 60-100h                                     |
| **Rama de trabajo sugerida**   | `feature/sprint-04-google-sheets`           |
| **Inicio**                     | Mar 11-08-2026 09:00                        |
| **Fin Est.**                   | Vie 21-08-2026 19:00                        |
| **Fin Real**                   | —                                           |

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

| ID                           | Tarea                                                                             | Estimación          | Estado       | Notas                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------- | ------------ | ------------------------------------------------------------------------------ |
| SP-5-CLOSE-1                 | Auto test                                                                         | 1h 30min            | 🔘 Pendiente |                                                                                |
| SP-5-CLOSE-2                 | Test E2C Local + WCAG 2.2 AA                                                      | 2h 30min            | 🔘 Pendiente | Flujo OAuth Google completo                                                    |
| SP-5-CLOSE-3                 | Test Manual del Dev                                                               | 1h                  | 🔘 Pendiente |                                                                                |
| SP-5-CLOSE-4                 | Corrección de Bugs detectados                                                     | (variable)          | 🔘 Pendiente |                                                                                |
| SP-5-CLOSE-5                 | Cierre Sprint → PR a `developer` + bump a `v0.5.0` + crear rama Sprint Costes-LLM | 30min               | 🔘 Pendiente | Crear rama del Sprint Costes-LLM (siguiente en orden), no del Sprint 5 todavía |
| **Subtotal cierre Sprint 4** |                                                                                   | **5h 30min + bugs** |              |                                                                                |

---

## Fase 4.5 — Sprint Costes-LLM (post-Sheets, patch v0.5.1)

| Campo                          | Valor                                                |
| ------------------------------ | ---------------------------------------------------- |
| **Sprint ID**                  | `SP-5B`                                              |
| **Versión objetivo al cierre** | `v0.5.1` (patch tras Sheets `v0.5.0`)                |
| **Estado del sprint**          | 🔘 Pendiente                                         |
| **Estimación total**           | 23-31h dev + 5h 30min cierre ≈ ~28-37h               |
| **Rama de trabajo sugerida**   | `feature/sprint-costes-llm-post-mvp`                 |
| **Inicio**                     | Lun 24-08-2026 09:00 (post-Sprint 4 Sheets `v0.5.0`) |
| **Fin Est.**                   | Jue 27-08-2026 19:00 (3-4 días lab)                  |
| **Fin Real**                   | —                                                    |

> **Asignado a:** Javi HP. **Orden fijo (22-05-2026, decisión clienta):** Sprint Costes-LLM va JUSTO DESPUÉS de Google Sheets, antes de Salesforce. Bloquea la fecha de inicio de Sprint 5 (Salesforce) por su duración (+4 días respecto plan original).
>
> **Origen del sprint (22-05-2026):** la clienta confirmó que el centro de costes LLM no es necesario en MVP `v0.3.0`. Trabajo trasladado: parte de 4-03 (tabla `llm_usage_logs` + tracker LangChain) + 4-04 entera (dashboard Recharts) + 2-36 (token_usage en `chat_messages`).

### Tareas de desarrollo (Fase 4.5) — DETALLADAS

| ID                                 | Tarea                                                                                                                                      | Estimación  | Estado       | Refs origen                           | Notas                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01                               | Tabla `llm_usage_logs` + RLS + `llm-cost-tracker.ts` LangChain CallbackHandler + helper `recordLlmUsage()` para call sites OpenAI directos | 5-7h        | 🔘 Pendiente | Era parte de 4-03 (Sprint 3 phase-02) | Reusa `logger` Pino del Sprint 3. Inventario obligatorio de los 5 call sites OpenAI directos (WhatsApp, RescueWorker, widget, FactExtractor, AIAnalysis) — incluido en estimación. Phase-01 sprint nuevo. |
| C-02                               | Dashboard de costes LLM por tenant/proveedor (admin global + vista tenant) con Recharts                                                    | 16-22h      | 🔘 Pendiente | Era 4-04 (Sprint 3 phase-03)          | Bloqueado por C-01 (necesita tabla `llm_usage_logs`). Precios actualizados mayo 2026 en `llm-pricing.ts` (cierra DA-4-005). Phase-02 sprint nuevo (la phase fue movida tal cual desde Sprint 3 phase-03). |
| C-03                               | Persistir `completion.usage` en `chat_messages.metadata` para TODOS los consumidores OpenAI                                                | 2h          | 🔘 Pendiente | Era 2-36 (Sprint 1 phase-04)          | Cierra audit F-DA-4 + informe Renzo §3 ⚠️. Sin backfilling de chats históricos (OpenAI no expone usage retroactivo). Paralelizable con C-01. Phase-03 sprint nuevo.                                       |
| **Subtotal Fase 4.5 — Desarrollo** |                                                                                                                                            | **~23-31h** |              |                                       | Objetivo base 27h. + 5h 30min cierre. Total 28-37h con cierre.                                                                                                                                            |

### Tareas de cierre obligatorias (Sprint Costes-LLM)

| ID                                    | Tarea                                                                               | Estimación          | Estado       | Notas                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- | ------------ | -------------------------------------------------------------------- |
| SP-5B-CLOSE-1                         | Auto test (typecheck + lint + build + tests)                                        | 1h 30min            | 🔘 Pendiente | Foco: tests cost calculation, RLS `llm_usage_logs`, `recordLlmUsage` |
| SP-5B-CLOSE-2                         | Test E2C Local + WCAG 2.2 AA en `/admin/costs` + vista tenant                       | 2h 30min            | 🔘 Pendiente | Playwright + screenshots a `docs/screenshots/sprint-costes-llm/`     |
| SP-5B-CLOSE-3                         | Test Manual del Dev — verificar números cuadran con tráfico real                    | 1h                  | 🔘 Pendiente |                                                                      |
| SP-5B-CLOSE-4                         | Corrección de Bugs detectados                                                       | (variable)          | 🔘 Pendiente | Subtareas dinámicas                                                  |
| SP-5B-CLOSE-5                         | Cierre Sprint → PR a `developer` + bump `v0.5.1` + crear rama Sprint 5 (Salesforce) | 30min               | 🔘 Pendiente |                                                                      |
| **Subtotal cierre Sprint Costes-LLM** |                                                                                     | **5h 30min + bugs** |              |                                                                      |

### Pre-requisitos del cierre

- [ ] Sprint 4 (Sheets) cerrado y mergeado a `developer` (versión `v0.5.0`).
- [ ] C-01, C-02, C-03 en 🔵 o 🟢.
- [ ] `CHANGELOG.md` con entrada `## [v0.5.1]` completa.

---

## Fase 5 — Sprint 5: Salesforce adapter

| Campo                          | Valor                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Sprint ID**                  | `SP-6`                                                                                   |
| **Versión objetivo al cierre** | `v0.6.0`                                                                                 |
| **Estado del sprint**          | 🔘 Pendiente                                                                             |
| **Estimación total**           | 60-100h                                                                                  |
| **Rama de trabajo sugerida**   | `feature/sprint-05-salesforce`                                                           |
| **Inicio**                     | Vie 28-08-2026 09:00 (+4 días respecto plan original — desplazado por Sprint Costes-LLM) |
| **Fin Est.**                   | Mié 09-09-2026 19:00                                                                     |
| **Fin Real**                   | —                                                                                        |

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

| Campo                          | Valor                                                 |
| ------------------------------ | ----------------------------------------------------- |
| **Sprint ID**                  | `SP-7`                                                |
| **Versión objetivo al cierre** | `v0.7.0`                                              |
| **Estado del sprint**          | 🔘 Pendiente                                          |
| **Estimación total**           | 40-80h                                                |
| **Rama de trabajo sugerida**   | `feature/sprint-06-gohighlevel`                       |
| **Inicio**                     | Jue 10-09-2026 09:00 (+4 días respecto plan original) |
| **Fin Est.**                   | Vie 18-09-2026 19:00                                  |
| **Fin Real**                   | —                                                     |

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

| Campo                          | Valor                                                 |
| ------------------------------ | ----------------------------------------------------- |
| **Sprint ID**                  | `SP-8`                                                |
| **Versión objetivo al cierre** | `v0.8.0`                                              |
| **Estado del sprint**          | 🔘 Pendiente                                          |
| **Estimación total**           | 20-50h                                                |
| **Rama de trabajo sugerida**   | `feature/sprint-07-activecampaign`                    |
| **Inicio**                     | Lun 21-09-2026 09:00 (+4 días respecto plan original) |
| **Fin Est.**                   | Jue 24-09-2026 19:00                                  |
| **Fin Real**                   | —                                                     |

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

| Campo                          | Valor                                                 |
| ------------------------------ | ----------------------------------------------------- |
| **Sprint ID**                  | `SP-9`                                                |
| **Versión objetivo al cierre** | `v0.9.0`                                              |
| **Estado del sprint**          | 🔘 Pendiente (bloqueado hasta SP-4..SP-7 completos)   |
| **Estimación total**           | 20-40h                                                |
| **Rama de trabajo sugerida**   | `feature/sprint-08-adapter-generalization`            |
| **Inicio**                     | Vie 25-09-2026 09:00 (+4 días respecto plan original) |
| **Fin Est.**                   | Mié 30-09-2026 19:00                                  |
| **Fin Real**                   | —                                                     |

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

| Campo                          | Valor                                     |
| ------------------------------ | ----------------------------------------- |
| **Sprint ID**                  | `SP-10`                                   |
| **Versión objetivo al cierre** | `v0.10.x+` (incremental por CRM)          |
| **Estado del sprint**          | 🔘 Backlog (on-demand)                    |
| **Estimación total**           | ~30-50h por CRM (sólo bajo pedido)        |
| **Rama de trabajo sugerida**   | `feature/sprint-09-tier2-<crm>` (por CRM) |
| **Inicio**                     | TBD (on-demand)                           |
| **Fin Est.**                   | TBD (on-demand)                           |
| **Fin Real**                   | —                                         |

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

| Sprint                             | Cierre = OK cuando...                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 0 (v0.1.0)**              | 0 credenciales hardcoded en `src/` · 0 endpoints orquestación sin auth accesibles desde internet · 0 webhooks con firma omitida incondicionalmente · `worker.js:58` firma corregida (flujo multi-día funciona) · RLS `tenants` no devuelve registros ajenos · typecheck+lint+build+tests sin errores · CHANGELOG `[v0.1.0]` completo · todas las tareas en 🔵/🟢 antes de SP-1-CLOSE-5                                                                                                    |
| **Sprint 1 (v0.2.0)**              | typecheck+lint+build sin errores · tests integración BD real (repos principales) pass · 0 queries directas `pg`/`postgres` en `src/app/api/` o `src/lib/actions/` · 0 JWTs `service_role` residuales fuera de admin scripts · `as any` reducidos >80% (426 → <85) · RLS `ai_agents`, `web_widgets`, `programs` corregida · `next@16.2.6` instalado (1-26) · hook `af-productivity-logger.cjs` operativo                                                                                   |
| **Sprint 2 (v0.3.0)**              | typecheck+lint+build sin errores · tenant conecta HubSpot vía OAuth2 desde UI admin · tenant conecta Zoho vía OAuth2 desde UI admin · push HubSpot/Zoho respeta R-014 append-only · webhook HubSpot valida `X-HubSpot-Signature-v3` · webhook Zoho valida token de canal · `crm_write_audit` registra toda sobrescritura `overwrite_with_audit` · RLS tenant-only en integraciones · tests sandbox HubSpot+Zoho pass                                                                      |
| **Sprint 3 (v0.4.0 — cierre MVP)** | `npx playwright test` → 0 failed (6+ golden path flows) · coverage `lines ≥ 80%`, `functions ≥ 80%` · Lighthouse a11y ≥ 90 en todas las rutas dashboard · 0 findings Critical DA-5 sin resolver · CSP headers en todas las rutas · rate limiting activo (`/api/auth/*` 5 req/min, `/api/*` 100 req/min) · Pino logging activo (API + workers) · bull-board accesible solo admin · CHANGELOG `[v0.4.0]` completo · ~~dashboard costes LLM~~ NO requerido en MVP (movido a v0.4.1 post-MVP) |
| **Sprint Costes-LLM (v0.5.1)**     | Tabla `llm_usage_logs` con RLS multi-tenant funcional · `llm-cost-tracker.ts` captura todas llamadas LangChain · `recordLlmUsage()` invocado en 5 call sites OpenAI directos · `chat_messages.metadata.token_usage` poblado para nuevos mensajes · Dashboard admin (`/admin/costs`) muestra costes por proveedor/mes + evolución tenant/semana · Vista tenant muestra sólo sus propios costes · Precios mayo 2026 (DA-4-005 cerrado) · CHANGELOG `[v0.5.1]` completo                      |
| **Sprint 4 (v0.5.0)**              | Tenant conecta Google vía OAuth2 desde UI admin · push Esden→Sheet < 5 min latencia · pull Sheet→Esden < 5 min (vía Drive webhook) · sin duplicados (idempotencia `_esden_updated_at`) · sin bucle push/pull infinito · canal Drive renovado antes de TTL 7 días · `crm_write_audit` registra todo sync · RLS tenant-only en `crm_connections` · typecheck+lint+build+tests sin errores                                                                                                   |
| **Sprint 5 (v0.6.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: tenant conecta Salesforce vía OAuth2 Connected App (prod+sandbox) · CRUD Leads/Contacts/Opportunities funcional · webhooks bidireccionales (Platform Events/Streaming) operativos · tests integración sandbox pass                                                                                                                                                                                                             |
| **Sprint 6 (v0.7.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: app registrada en GHL Marketplace + OAuth2 v2 · adapter Contacts+Opportunities+Calendars funcional · webhooks GHL bidireccionales · tests sandbox GHL pass                                                                                                                                                                                                                                                                     |
| **Sprint 7 (v0.8.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: auth API Key multi-cuenta funcional · adapter Contacts+Deals+Tags+Lists · webhooks ActiveCampaign (contact updated, deal stage changed) · tests sandbox pass                                                                                                                                                                                                                                                                   |
| **Sprint 8 (v0.9.0)**              | (pendiente extraer del plan.md cuando se cree) — esperado: `IntegrationAdapter` base con OAuth flow + field mapper genéricos · webhook handling + signature verification generalizado · rate limiting/retry/circuit breaker por adapter generalizado · refactor sin regresión en 6 adapters existentes                                                                                                                                                                                    |
| **Sprint 9 (v0.10.x+)**            | Plantilla on-demand: por cada CRM Tier 2 activado, cumplir gates estándar de cierre de sprint + pedido explícito cliente registrado                                                                                                                                                                                                                                                                                                                                                       |

---

## Resumen del estado actual

| Sprint                           | Versión objetivo | Estado                 | Tareas dev                                                                             | Estimación dev                                        | Cierre          |
| -------------------------------- | ---------------- | ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| **Sprint 0** (Fase 0)            | v0.1.0           | 🟢 Completada (merged) | **27** (26 ✅ dev + 2 diferidas VPS pre-deploy + cierre 5/5)                           | ~115h 30min · ⏱ Real ~7h 30min                        | 5h 30min + bugs |
| **Sprint 1** (Fase 1)            | v0.2.0           | 🟢 Completada (merged) | **32** (24 🟢 Completada + 8 🟢 Diferida; 1 movida a Sprint 0 + 1 a Sprint Costes-LLM) | ~205h estim · ⏱ Real ~12h (Push = Cierre legacy)      | 5h 30min + bugs |
| **Sprint 2** (Fase 2)            | v0.3.0           | 🔘 Pendiente           | 7 (detalladas con phase files)                                                         | 148h (~80-100h reales con 2 devs paralelos)           | 5h 30min + bugs |
| **Sprint 3** (Fase 3)            | v0.4.0           | 🔘 Pendiente           | 8 (detalladas con phase files, -1 movida a Sprint Costes-LLM)                          | 89-117h (objetivo base 95h)                           | 8h + bugs       |
| **Sprint Costes-LLM** (Fase 4.5) | v0.5.1           | 🔘 Pendiente           | 3 (C-01, C-02, C-03)                                                                   | 23-31h (justo después de Sheets, antes de Salesforce) | 5h 30min + bugs |
| **Sprint 4** (Fase 4)            | v0.5.0           | 🔘 Pendiente           | 6 (Google Sheets bidireccional)                                                        | 60-100h                                               | 5h 30min + bugs |
| **Sprint 5** (Fase 5)            | v0.6.0           | 🔘 Pendiente           | 6 (Salesforce adapter)                                                                 | 60-100h                                               | 5h 30min + bugs |
| **Sprint 6** (Fase 6)            | v0.7.0           | 🔘 Pendiente           | 5 (GoHighLevel adapter)                                                                | 40-80h                                                | 5h 30min + bugs |
| **Sprint 7** (Fase 7)            | v0.8.0           | 🔘 Pendiente           | 5 (ActiveCampaign adapter)                                                             | 20-50h                                                | 5h 30min + bugs |
| **Sprint 8** (Fase 8)            | v0.9.0           | 🔘 Pendiente           | 4 (Adapter generalization)                                                             | 20-40h (bloqueado hasta SP-4..SP-7)                   | 5h 30min + bugs |
| **Sprint 9** (Fase 9)            | v0.10.x+         | 🔘 Backlog             | 5 (Tier 2 on-demand)                                                                   | ~30-50h por CRM activado (no suma a total)            | 5h 30min + bugs |

**Totales del proyecto (excluyendo Sprint 9 on-demand):**

- **MVP (Sprints 0+1+2+3)**: ~526-554h base + cierres (~25h) + bugs variables · -21h tras mover centro de costes a v0.4.1
- **Post-MVP (Sprint Costes-LLM + Sprints 4..8)**: ~223-401h base + cierres (~34h) + bugs variables
- **Total proyecto sin Tier 2**: ~749-955h + cierres + bugs

---

## Cómo el agente actualiza este documento

Ver [.claude/agents/roadmap-keeper.md](../.claude/agents/roadmap-keeper.md) para el detalle.

Reglas clave:

1. Cada vez que una tarea cambia de estado → el agente actualiza la celda + añade timestamp interno en el log.
2. Cada vez que se planifica un sprint en detalle → el agente reemplaza las filas placeholder por tareas concretas con estimación real.
3. Cada vez que se cierra un sprint → el agente actualiza `Fin Real`, marca el sprint como 🟢 COMPLETADA, bumpea la versión del proyecto en frontmatter.
4. Cuando hay desviación significativa de estimación → el agente avisa al manager y al `productivity` agent.

---

**Última actualización**: 21-05-2026 14:30 por `roadmap-keeper` (políticas operativas sesión 21-05: sin vacaciones, Javi HP 10h/día, Renzo 8h/día disponible sin asignar, MVP ASAP, staging on-demand del usuario, local-first Supabase, sistema log propio, minimizar GitHub Actions; tarea 0-01 pre-push hooks añadida; fechas recalculadas con 10h/día → MVP v0.3.0 cierre Lun 10-08-2026 (adelantado ~7 semanas vs cálculo anterior)).
