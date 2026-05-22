# CLAUDE.md — dashboard-af

Instrucciones específicas del proyecto. Se combinan con las globales de cada dev (`~/.claude/CLAUDE.md`). Cuando hay conflicto, **manda este fichero**.

## Identidad del proyecto

**dashboard-af** — AI CRM + Workflow Orchestrator multi-tenant para academias formativas (sector formación, ES + Latam). Versión actual: **v0.0.0**.

- **Stack**: Next.js 16 + React 19 + Tailwind + PostgreSQL via **Supabase self-hosted (Easypanel)** + `@supabase/ssr` + **Zod** (validaciones) + Repository pattern + RLS multi-tenant + BullMQ + LangChain multi-LLM (Anthropic + OpenAI + Google Genai + AWS Bedrock) + Retell + Ultravox. **SIN ORM nuevo** (decisión confirmada — ver memoria `project_stack_data_layer.md`).
- **Cliente final**: academias y centros de formación (cada tenant elige su CRM).
- **Audiencia interna del repo**: equipo de desarrollo Automatiza Formación.

## Documentación autoritaria

Cuando haya cualquier duda de comportamiento esperado, consultar en este orden:

1. `docs/Docs-entrega-clienta/` — **spec de la cliente, manda sobre todo lo demás**. PDFs, DOCX, prompts, diagramas.
2. `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md` — decisiones cerradas con audit trail.
3. `docs/audit/findings-summary.md` + `docs/audit/gap-analysis-spec-vs-code.md` — estado real del código vs spec.
4. `docs/audit/STACK-TECNOLOGICO.md` — stack confirmado y excluidos.
5. `plans/YYMMDD-HHmm-slug/phase-XX-name.md` — plan activo de la fase en curso.
6. Código en `src/` — **última fuente, si contradice arriba el código está mal**.

## Plan vigente (5 fases — ver `DECISIONES R-020-refinement-v2`)

| Fase                           | Contenido                                                                              | Status    |
| ------------------------------ | -------------------------------------------------------------------------------------- | --------- |
| **0 — Sprint 0**               | Hotfixes de seguridad (4 vulnerabilidades RLS multi-tenant + tokens OAuth + Kong EOL)  | Pendiente |
| **1 — Capa de datos**          | Consolidación capa Supabase + Zod + Repository pattern + RLS hardening (sin ORM nuevo) | Pendiente |
| **2 — Adapter layer + 2 CRMs** | HubSpot adapter + Zoho adapter + UI admin de conexión (**MVP**)                        | Pendiente |
| **3 — Hardening**              | Tests E2E, observabilidad, dashboards de costes                                        | Pendiente |
| **4 — Post-release**           | Google Sheets bidireccional + Salesforce + GoHighLevel + ActiveCampaign                | Futuro    |

**MVP Fase 2 = HubSpot + Zoho.** Sheets NO entra en MVP — está aplazado a Fase 4.

## Ramas y SemVer

```
feature/* → PR → developer → (orden explícita) → staging → (orden explícita) → main
```

- Trabajo activo: feature branches partiendo de `developer` (o `auditoria` durante el audit inicial).
- **Naming de ramas por sprint** (decisión 21-05-2026, refinada 22-05-2026):
  - Sprint 0 (excepción legacy): `feature/sp-0-sprint-0-hotfixes` — ya creada, NO renombrar.
  - **A partir del Sprint 1**: `feature/sprint-NN-<slug>` con **dos dígitos** (ej. `feature/sprint-01-capa-datos`, `feature/sprint-02-adapter-hubspot-zoho`, `feature/sprint-03-hardening`). El prefijo `sp-` queda deprecated. NN coincide con el número de sprint (no con el sprint_id `SP-X` del RoadMap, que va offset +1).
- **`developer`** versiona TODO el scaffold de Claude Code (`.claude/`, `.claude-plugin/`, `docs/`, `plans/`, `.env.example`).
- **`staging`** y **`main`** son ramas protegidas — **NO se tocan sin orden explícita del usuario**.
- Versionado SemVer: `v0.0.0` inicial. Sprint cerrado → `v0.x.0`. Patch en sprint → `v0.0.x`. MVP completo → `v0.4.0`.
- `.env` real NUNCA va a git. Sólo `.env.example` con placeholders. Secretos por canal seguro (Easypanel env vars / vault).

## Tracking de tiempos reales (política RoadMap)

Cada tarea del RoadMap tiene **Estimación** (columna fija) y **Tiempo real** (en columnas dedicadas `⏱ Push` y `⏱ Cierre`):

- Al pasar a 🔵 **Subida rama** (tras push): anotar `⏱ Push: XXh YYmin` con el tiempo invertido hasta el push. Es un valor provisional — puede haber fixes posteriores en SP-X-CLOSE-4.
- Al pasar a 🟢 **COMPLETADA** (tras merge a `developer`): anotar `⏱ Cierre: XXh YYmin` con el **TOTAL FINAL** incluyendo cualquier fix post-push (Push + cierre).
- Si una tarea se difiere o se cancela, anotar `⏱ Real (parcial): XXh YYmin` con lo invertido hasta el corte (en columna Notas si no hay columna dedicada).

### Granularidad obligatoria desde Sprint 2 (decisión 22-05-2026)

| Nivel                | Sprint 0/1 (legacy)                | Sprint 2 en adelante (OBLIGATORIO)                                    |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| **Sprint padre**     | OK Push + Cierre en tabla resumen  | OK Push + Cierre en tabla resumen                                     |
| **Bloque** (2.X)     | Solo Estimación, sin tracking real | Añadir columnas Push + Cierre a tabla resumen del sprint              |
| **Tarea individual** | Algunas en prosa en columna Notas  | Añadir columnas Push + Cierre a tabla detallada de cada bloque        |
| **Subtareas CLOSE**  | Algunas en prosa                   | Añadir columnas Push + Cierre a tabla "Tareas de cierre obligatorias" |

**Sprint 0 y Sprint 1 quedan congelados como legacy** — no se retro-calcula tracking fino. El `SP-2-CLOSE-summary.md` cubre el resumen agregado de Sprint 1; Sprint 0 tiene su agregado en RoadMap.md frontmatter (`sprint_0_progress` histórico).

**Sprint 2 (SP-3) inaugura tablas con tracking fino** — el `roadmap-keeper` enforza la presencia de columnas `⏱ Push` y `⏱ Cierre` en cada bloque/tarea al crear las tablas, y el hook `af-productivity-logger.cjs` (tarea 2-30) las rellena automáticamente al detectar cambios de estado en RoadMap.md.

Formato siempre: **horas y minutos**, nunca decimales (`2h 30min`, no `2.5h`). Coherente con la política global de productividad.

## Tareas diferidas: distinguir "local-aplicable" vs "pre-deploy"

Si una tarea no se puede cerrar al 100% por dependencia externa (acceso VPS, credenciales del cliente, etc.):

1. **Identificar la parte local-aplicable** y cerrarla en el sprint actual. Ejemplo: SQL script + apply contra Supabase local — se hace YA aunque el apply contra VPS se difiera.
2. **Sólo la parte que requiere acceso externo se difiere** a la sesión pre-deploy del sprint en el que toque promoción a staging/main.
3. **Anotar explícitamente** en Notas: `🟢 Local OK | 🟡 Pre-deploy pendiente: <razón>`.

Esto evita acumular trabajo bloqueado y permite probar el comportamiento de la app en local cuanto antes.

## Reglas de equipo (top-level)

1. **Co-authorship**: NUNCA Claude/Anthropic/IA como co-autor de commits. Sí se permiten co-autores humanos.
2. **Push protegido**: NUNCA push directo a `staging` o `main`. Merge sólo vía PR con autorización.
3. **No `git remote add origin <url-cliente>`** — el repo local NO se conecta al GitHub del cliente (`renzo1111ia/dashboard-af`).
4. **No Prisma, no Drizzle, no ningún ORM nuevo, no Dokploy, no Airtable** — stack ya decidido en audit, no reintroducir. La capa de datos se hace con `@supabase/ssr` + Zod + Repository pattern, sin ORM heavyweight.
5. **Dependency Guard**: TODA nueva dependencia de producción debe pasar por el subagente `af-agents:adr` antes de instalarse. El hook `af-deps-guard.cjs` lo bloquea automáticamente si se intenta saltar.
6. **RLS obligatorio** en toda tabla multi-tenant. El audit detectó 4 vulnerabilidades activas — ver plan en `plans/20260519-1200-rls-multitenant-hardening/`.
7. **Nomenclatura de variables**: ley = `docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`. Cualquier campo en código que no coincida es un finding.
8. **Sincronización CRM**: append-only por defecto (R-014). Sobrescritura sólo con `write_policy: overwrite_with_audit` registrada en `crm_write_audit`.
9. **Test con BD real** en integración — NO mocks de Supabase ni mocks de la cadena RLS.

## Model Tier Policy (heredada del global, recordatorio)

| Modelo | Cuándo                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Haiku  | Docs, traducciones, listados, sync, informes con datos ya investigados                                    |
| Sonnet | Código CRUD, tests, refactor sencillo, análisis de tecnologías habituales (Next/React/Supabase/Zod)       |
| Opus   | Concurrencia, seguridad cripto, decisiones arquitectónicas con trade-offs, research multi-fuente profundo |

Quota Fallback al 80% según política global. **NUNCA Opus por defecto.**

### Escalado proactivo por contexto/dificultad (anticipar, no esperar a que falle)

Filosofía base (idéntica a la global `~/.claude/CLAUDE.md`):

- **Haiku** para editar archivos y acciones sencillas con poco contexto. Si hay mucho contexto o le cuesta → **subir a Sonnet**.
- **Sonnet** para la mayoría de tareas y codificación. Si hay mucho contexto o le cuesta → **subir a Opus**.
- **Opus** reservado para investigación, mucho contexto y programación compleja donde Sonnet puede fallar.

Triggers de escalado **preventivo** (antes de empezar la tarea, sin esperar a fallar):

| Trigger                                                                                                   | Acción                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Haiku necesita >5 archivos de contexto, o el archivo objetivo >300 líneas                                 | Subir a Sonnet desde el inicio                     |
| Haiku tarea con lógica condicional no trivial (>1 if/else anidado o branching no lineal)                  | Subir a Sonnet desde el inicio                     |
| Sonnet necesita >15 archivos de contexto cross-package o cross-stack                                      | Subir a Opus desde el inicio                       |
| Sonnet tarea con concurrencia, criptografía, RLS multi-tenant, OAuth multi-DC, transacciones distribuidas | Subir a Opus desde el inicio                       |
| Sonnet tarea de research multi-fuente (3+ docs/webs/repos a sintetizar) o trade-offs arquitectónicos      | Subir a Opus desde el inicio                       |
| Cualquier modelo: bucle de >2 reintentos sobre el mismo error/test                                        | Escalar al siguiente tier y reintentar UNA vez más |

**Aplicación en `dashboard-af`:**

- Sprint 0 (hotfixes RLS, JWT, crypto, next bump): orquestación en **Sonnet**, escalada puntual a **Opus** para decisiones de RLS multi-tenant y firma de webhooks.
- Sprint 1 (capa de datos, Zod, Repository): **Sonnet** por defecto. **Opus** sólo para diseño del Repository pattern multi-tenant y cifrado AES-256 de tokens OAuth (tarea 2-26).
- Sprint 2 (adapter HubSpot + Zoho): **Sonnet** para adapters y OAuth flow estándar. **Opus** para Zoho multi-DC y diseño del `IntegrationAdapter` interface.
- Tareas de docs/READMEs/logs/traducciones/listados: **Haiku** salvo que el contexto pase de 5 archivos.

**Diferencia con regla global #6:**

- Regla #6 es reactiva (escalar tras fallo confirmado).
- Esta regla es preventiva (escalar antes de empezar si pinta complejo).
- Quota Fallback al 80% es ortogonal (escala/desciende por cuota, no por dificultad).

**Aplicación al abrir chat nuevo:** si el prompt del usuario contiene una tarea claramente compleja (research multi-fuente, refactor cross-package, decisión arquitectónica, debug no trivial), arrancar directamente en el tier adecuado sin esperar a fallar en uno inferior.

## Execution Autonomy

- Tras "adelante" / "sí" / "procede" → ejecutar TODA la tarea sin preguntar archivo por archivo.
- Confirma SÓLO antes de: acciones GitHub (push, PR, merge, tag), planes de tareas/sprints, ediciones de `staging`/`main`.
- Permiso de documentación persistente: si el usuario autoriza editar docs/.md, ese permiso vale para todo el proyecto hasta que diga "modo planificación sin permisos de edición".

## Phase/Sprint Completion Protocol (automático)

Al cerrar fase/sprint, ejecutar SIN preguntar y EN ESTE ORDEN ESTRICTO. Cada paso solo arranca si el anterior cerró en verde. Si algo falla, se itera fix + re-run del paso fallido (no se salta):

1. **Auto test (CLOSE-1)** — `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` (unit + integration). Delegado a `af-agents:testing`. Verde obligatorio para seguir.
2. **E2C local (CLOSE-2)** — Claude abre navegador con Playwright contra `localhost:8500` y recorre los flujos implementados en el sprint + WCAG 2.2 AA en rutas clave. Capturas en `docs/screenshots/`. Verde obligatorio para seguir.
3. **Corrección de bugs (CLOSE-4)** — Cualquier bug detectado en CLOSE-1 o CLOSE-2 se corrige aquí y se re-corre el paso afectado hasta verde.
4. **Push a GitHub (parte de CLOSE-5)** — `git push` de la rama `feature/sprint-NN-<slug>`. Solo después de que CLOSE-1/2/4 estén 🟢.
5. **PR a `developer` (parte de CLOSE-5)** — Crear PR. NO mergear sin orden explícita del usuario (regla absoluta del proyecto). El merge a `developer` lo confirma el usuario manualmente.
6. **CONDICIONAL — E2E VPS (parte de CLOSE-5)** — **SOLO si el proyecto ya está desplegado en el VPS Easypanel del cliente**: Claude ejecuta los specs Playwright contra la URL del VPS (no localhost). Si NO hay despliegue VPS todavía (estado actual: local-first), este paso se omite y se difiere su contenido al hand-off a `SP-4B phase-NN`.
7. **Informe al usuario** — Resumen: tests passed/failed/fixed + diff de lo implementado + invitación a probar manualmente si aplica (UI visible o flujo de cara al usuario).

### Detector "VPS desplegado" (cuándo activar paso 6)

El paso 6 (E2E VPS) se activa SOLO si se cumplen TODAS estas condiciones:

- Existe variable `NEXT_PUBLIC_VPS_URL` en `.env.example` con valor distinto a placeholder.
- El staging branch ha sido promovido al menos una vez (verificable con `git log staging`).
- El usuario ha confirmado explícitamente que el VPS está en marcha (memoria persistente o nota en RoadMap).

Si cualquier condición falla → paso 6 OMITIDO + nota en `SP-N-CLOSE-5`: "E2E VPS diferido — pre-deploy VPS no realizado todavía". El `roadmap-keeper` no bloquea el cierre por esto.

### Mapping protocolo → subtareas CLOSE-1..5

| Paso protocolo | Subtarea RoadMap                                  | Ejecutor                         |
| -------------- | ------------------------------------------------- | -------------------------------- |
| 1              | `SP-N-CLOSE-1` Auto test                          | `af-agents:testing`              |
| 2              | `SP-N-CLOSE-2` E2C Local + WCAG 2.2 AA            | `af-agents:testing` + Playwright |
| 3              | `SP-N-CLOSE-4` Corrección de bugs                 | Claude orquestador               |
| 4              | `SP-N-CLOSE-5` paso 1 (push)                      | `af-agents:git`                  |
| 5              | `SP-N-CLOSE-5` paso 2 (PR a developer, sin merge) | `af-agents:git`                  |
| 6 (condic.)    | `SP-N-CLOSE-5` paso 3 E2E VPS                     | `af-agents:testing` contra VPS   |
| 7              | Informe final al usuario                          | Claude orquestador               |

`SP-N-CLOSE-3` (test manual del dev) NO entra en este protocolo automático — está diferido a SP-4B para sprints MVP (ver sección siguiente).

### `SP-N-CLOSE-3` (test manual del dev) DIFERIDO a SP-4B (regla 22-05-2026)

A partir de Sprint 1, **NO se ejecuta CLOSE-3 (test manual del dev) en cada sprint MVP**. Se difiere al `SP-4B phase-NN bloque 4` (test manual del tester Renzo), que lo absorbe junto con su validación E2E VPS.

- ✅ Sprint 0 (cerrado): CLOSE-3 ya reemplazado por reporte análisis docs Bea + Renzo.
- Sprints 1, 2, 2B, 3: CLOSE-3 marcado como 🟢 Diferida en RoadMap. El manual humano lo ejecuta Renzo en SP-4B.
- Sprints post-MVP (Sheets, Costes-LLM, Refinamiento, Salesforce, etc.): mantienen su CLOSE-3 estándar (no se difieren).

Razón: liberar a Javi HP de la coordinación con humano por cada sprint, concentrar todo el QA manual en un sprint dedicado con un equipo independiente (Renzo + tester) que pueda dedicarle tiempo real.

### Hand-off al Sprint Validación Pre-MVP (SP-4B) — obligatorio en `SP-N-CLOSE-5`

Al cerrar **cualquier Sprint N** del MVP (Sprints 0, 1, 2, 2B, 3 — NO los post-MVP), su `SP-N-CLOSE-5` lleva una subtarea obligatoria **"Hand-off a SP-4B phase-NN"** que actualiza el archivo `plans/260522-1700-sprint-validacion-pre-mvp/phase-NN-validacion-sprint-N.md` correspondiente con:

- Comandos exactos de test automático del sprint cerrado (`npm run …`).
- Specs Playwright E2C añadidas en este sprint, con rutas que cubren.
- Specs Playwright listas para ejecutar contra VPS (E2E).
- Checklist manual derivado de `docs/testeos-manual.md` (sección del sprint).
- BUG-XXX ya detectados y corregidos durante el cierre (referencia commit) — para verificar no-regresión en VPS.
- Variables de entorno NUEVAS que necesita el VPS de Renzo para que los tests pasen.
- Notas de despliegue: migraciones SQL pendientes, vars nuevas, dependencias añadidas, comandos de seed/migración.

El agente `roadmap-keeper` enforza esta regla al detectar `SP-N-CLOSE-5` cerrando: si la plantilla `phase-NN-validacion-sprint-N.md` sigue marcada como `🔘 Plantilla vacía`, el cierre del sprint queda 🟡 hasta rellenarla.

**Excepciones**: los sprints post-MVP (Sheets, Costes-LLM, Salesforce, etc.) NO hacen hand-off a SP-4B — cierran directamente con su `CLOSE-5` y promueven a `developer`.

## Screenshots

**Ubicación única**: `docs/screenshots/`. NUNCA guardar `.png`/`.jpg` sueltos en la raíz del proyecto ni en `src/`.

- Screenshots manuales (capturas para docs, debugging, onboarding): `docs/screenshots/<descriptive-name>.png`.
- Screenshots vía Playwright MCP (`browser_take_screenshot`): pasar siempre `filename: "docs/screenshots/<name>.png"` (o ruta absoluta equivalente).
- Excepciones permitidas (NO mover): `playwright-report/**` y `test-results/**` (los genera Playwright en sus paths fijos), `public/`, `src/app/icon.png`, `node_modules/**`, `.next/**`.

Si encuentras screenshots fuera de `docs/screenshots/` que no caigan en las excepciones, muévelos sin preguntar.

## Productivity Time Format

- Duración: `2h 30min`, `45min`. NUNCA decimales.
- Fechas de sprint: `DD-MM-YYYY HH:MM` (europeo).
- Tablas de tareas: sólo duración.
- Identificadores técnicos `ck-*` (carpetas `plans/YYMMDD-HHmm-slug/`): mantienen formato compacto.

## Orquestador y subagentes

El orquestador es **`af-agents:manager`** (Opus). Coordina 19 subagentes especializados (14 del patrón saas-agents adaptados a AF + debugger, journal-writer, mcp-manager, code-simplifier, researcher, brainstormer de la config global).

Para delegar: `Task(subagent_type="af-agents:database", prompt="...")`.

Ver detalle completo de cada subagente en `.claude/agents/*.md`.

## Skills disponibles

28 skills en `.claude/skills/`. Conjunto enfocado: 8 de gestión de sprint (saas-agents) + ~20 globales filtradas (ck-plan, ck-debug, ck-security, code-review, fix, ship, watzup, retro, backend/frontend-development, databases, web-testing, security-scan, docs, docs-seeker, research, brainstorm, find-skills, mcp-management, skill-creator).

**Excluidas explícitamente del proyecto**: payment-integration, pinokio, gepeto, MCPs personales (Gmail/Calendar/Drive/Gamma/pencil).

## MCP servers activos

- ✅ `plugin:context7:context7` — docs Next/React/Supabase/Zod/HubSpot/Zoho.
- ✅ `plugin:playwright:playwright` — browser tests Fase 3.
- 🔜 (Fase 4) MCP/skill Google Sheets — añadir cuando lleguemos a esa fase.

## Para el equipo de desarrollo

Cuando clones este repo, lee primero [docs/dev-onboarding.md](docs/dev-onboarding.md). Cubre setup, ramas, .env, primer arranque y cómo trabajar con Claude Code en este proyecto.
