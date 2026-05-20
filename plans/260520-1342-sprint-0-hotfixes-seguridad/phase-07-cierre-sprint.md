# Phase 07 — Cierre de Sprint 0

## Context Links
- [plan.md](plan.md) — overview Sprint 0 (criterios de éxito + gates obligatorios)
- [RoadMap — Tareas de cierre SP-1-CLOSE-1..5](../RoadMap.md) — definición autoritativa
- [RoadMap — Pre-requisitos del cierre](../RoadMap.md) — gates que deben estar 🟢 para arrancar SP-1-CLOSE-5

## Overview

**Prioridad:** P1 — Bloquea el cierre del sprint y el bump a v0.1.0.
**Estado:** 🔘 Pendiente (no iniciar hasta que todas las tareas 1-01 a 1-24 estén en 🔵 o 🟢)
**Estimación:** 5h 30min + variable (bugs) | SP-1-CLOSE-5-bis: variable (~1h coordinación + 1-3 días espera clienta)
**Agentes asignados:**
- SP-1-CLOSE-1: `af-agents:testing`
- SP-1-CLOSE-2: `af-agents:testing` + `af-agents:uxui`
- SP-1-CLOSE-3: `af-agents:manager` (interacción con humano)
- SP-1-CLOSE-4: `af-agents:code` + `af-agents:debugger` (subtareas dinámicas)
- SP-1-CLOSE-5: `af-agents:git` + `af-agents:deployment` + `af-agents:productivity` + `af-agents:roadmap-keeper`

## Gates obligatorios antes de SP-1-CLOSE-5

Todos deben estar en 🟢 antes de iniciar el cierre:

- [ ] 1-01 a 1-24: todas en estado 🔵 o 🟢
- [ ] SP-1-CLOSE-1: Auto test 🟢 con 0 errores
- [ ] SP-1-CLOSE-2: E2C Local 🟢 sin findings WCAG críticos
- [ ] SP-1-CLOSE-3: Test Manual del Dev 🟢 (dev firma OK)
- [ ] SP-1-CLOSE-4: Bugs detectados 🟢 (sin subtareas abiertas)
- [ ] `CHANGELOG.md` entrada `## [v0.1.0]` completa
- [ ] `af-agents:help-docs-keeper` actualizó secciones de ayuda afectadas

## SP-1-CLOSE-1 — Auto test (1h 30min)

**Delegado a:** `af-agents:testing`

Ejecutar en orden:
1. `npm run typecheck` — 0 errores TypeScript
2. `npm run lint` — 0 errores de linting (warnings aceptables, no ignorar errores)
3. `npm run build` — build exitoso sin errores (warnings aceptables)
4. `npm test` — unit tests + integration tests

Reporte esperado:
- Número de tests: passed / failed / skipped
- Coverage si está configurado
- Lista de errores si los hay (con archivos y líneas)

Si hay errores en cualquier paso → no continuar a CLOSE-2. Delegar corrección a `af-agents:code` y repetir CLOSE-1.

## SP-1-CLOSE-2 — Test E2C Local — Browser + WCAG 2.2 AA (2h 30min)

**Delegado a:** `af-agents:testing` + `af-agents:uxui`

Flujos a recorrer con Playwright:
1. Login con credenciales de prueba → dashboard del tenant.
2. Verificar que los endpoints de orquestación devuelven 401 desde browser sin auth (abrir en incógnito).
3. Verificar que el widget embed (`/api/widget/embed.js?id=TEST_ID`) devuelve JS válido.
4. Verificar que el flujo de cron sweep da 401 sin el header `CRON_SECRET`.
5. Flujo básico: crear lead → verificar que no se mezclan datos cross-tenant.

Validación WCAG 2.2 AA:
- Usar axe-core (vía Playwright) para detectar findings críticos.
- **Scope**: solo las páginas/flujos afectados por las fases del Sprint 0. Los findings de DA-5 (accesibilidad general) son Sprint 3 — no bloquean este sprint salvo que sean nuevos o agravados por el Sprint 0.

Reporte: screenshots de pasos clave + lista de findings de accesibilidad encontrados.

## SP-1-CLOSE-3 — Test Manual del Dev (1h)

**Delegado a:** `af-agents:manager` (orquesta la entrega al humano)

El manager prepara y entrega al dev:
1. Credenciales de prueba (tenant de staging, usuario admin + usuario no-admin).
2. Guía paso a paso:
   - Intentar acceder a `/api/orchestration/deploy` sin auth → debe ver 401.
   - Intentar cambiar cookie `af-tenant-id` a UUID ajeno → debe no obtener datos ajenos.
   - Crear un lead → verificar que el flujo de orquestación arranca (1-01 corregido).
   - Probar que el endpoint de test `orchestrator` ya no está accesible (1-09).
   - Verificar en panel admin que no puede crear tenant si no es admin (1-17).
3. El dev firma OK o reporta issues → pasan a SP-1-CLOSE-4.

## SP-1-CLOSE-4 — Corrección de bugs detectados (variable)

**Delegado a:** `af-agents:code` + `af-agents:debugger`

- Cada bug reportado en CLOSE-2 o CLOSE-3 se convierte en una subtarea de esta tarea.
- Cada subtarea tiene su propio estado en el RoadMap (seguimiento granular).
- Esta tarea se cierra solo cuando TODAS las subtareas están en 🟢.
- Si una subtarea requiere más de 4h → escalar a manager para re-priorización.

## SP-1-CLOSE-5 — Cierre de Sprint (30min)

**Delegado a:** `af-agents:git` + `af-agents:deployment` + `af-agents:productivity` + `af-agents:roadmap-keeper`

Secuencia exacta:

### 1. Verificación de gates (af-agents:git)
- Verificar que todos los gates de pre-requisitos están en 🟢.
- Si algún gate no está verde → STOP. No proceder hasta resolverlo.

### 2. CHANGELOG.md (af-agents:deployment — gatekeeper)
- Verificar que existe `CHANGELOG.md` con entrada `## [v0.1.0] — DD-MM-YYYY`.
- Si no existe → crearlo con el listado de tareas 1-01 a 1-24 completadas.
- Formato mínimo:
  ```markdown
  ## [v0.1.0] — DD-MM-YYYY

  ### Security
  - [1-01] Fix firma executeSequenceStep en worker.js:58
  - [1-02] Fix silenciado errores Redis en enqueueLeadStep
  - [1-03] Rotación JWTs comprometidos (service_role + anon key)
  - [1-04] Eliminación 9 credenciales hardcoded del código fuente
  ... (resto de tareas)
  ```

### 3. PR a developer (af-agents:git)
- Crear PR: `feature/sp-0-sprint-0-hotfixes` → `developer`.
- Título: `feat: Sprint 0 — Hotfixes de seguridad (v0.1.0)`.
- Description: link al plan + lista de tareas + changelog.
- Confirmar con el dev antes de mergear (requiere aprobación humana).

### 4. Bump SemVer (af-agents:git, tras merge)
- Tras merge aprobado: bump en `package.json` a `v0.1.0`.
- Commit: `chore: bump version to v0.1.0`.
- Tag: `git tag v0.1.0`.

### 5. Crear rama Sprint 1 (af-agents:git)
- `git checkout -b feature/sp-2-capa-datos` desde `developer` (post-merge).

### 6. Actualizar RoadMap (af-agents:roadmap-keeper)
- Marcar Sprint 0 como 🟢 COMPLETADA.
- Actualizar `Fin Real` con la fecha real.
- Actualizar `project_version` en frontmatter a `v0.1.0`.
- Actualizar estados de todas las tareas 1-01 a 1-24 a 🟢.

### 7. Reporte final (af-agents:productivity)
- Tiempo real vs estimado por tarea y por bloque.
- Desviaciones significativas (>20%) con causa.
- Input para estimaciones del Sprint 1.

## Todo List

- [ ] SP-1-CLOSE-1: Delegar a testing → typecheck + lint + build + tests
- [ ] SP-1-CLOSE-1: Verificar 0 errores en todos los pasos
- [ ] SP-1-CLOSE-2: Delegar a testing+uxui → Playwright recorrido + WCAG
- [ ] SP-1-CLOSE-2: Verificar sin findings críticos nuevos
- [ ] SP-1-CLOSE-3: Manager prepara guía + credenciales → entrega al dev
- [ ] SP-1-CLOSE-3: Esperar feedback del dev
- [ ] SP-1-CLOSE-4: Abrir subtareas por cada bug reportado
- [ ] SP-1-CLOSE-4: Cerrar todas las subtareas antes de continuar
- [ ] SP-1-CLOSE-5: Verificar todos los gates en 🟢
- [ ] SP-1-CLOSE-5: Deployment crea/verifica CHANGELOG.md [v0.1.0]
- [ ] SP-1-CLOSE-5: Git crea PR feature/sp-1 → developer
- [ ] SP-1-CLOSE-5: Dev aprueba el PR
- [ ] SP-1-CLOSE-5: Git bumps version a v0.1.0 + tag
- [ ] SP-1-CLOSE-5: Git crea rama feature/sp-2-capa-datos
- [ ] SP-1-CLOSE-5: Roadmap-keeper actualiza RoadMap.md a 🟢
- [ ] SP-1-CLOSE-5: Productivity genera reporte de tiempos
- [ ] SP-1-CLOSE-5-bis: Crear PR developer → staging (esperar autorización Renzo)
- [ ] SP-1-CLOSE-5-bis: Health check staging tras merge
- [ ] SP-1-CLOSE-5-bis: Notificar a la clienta y coordinar test manual
- [ ] SP-1-CLOSE-5-bis: Recoger aprobación de la clienta
- [ ] SP-1-CLOSE-5-bis: Crear PR staging → main (esperar autorización Renzo)

## Success Criteria

- `npm run typecheck && npm run lint && npm run build && npm test` → 0 errores.
- Playwright: flujos principales funcionan, 0 findings WCAG críticos nuevos.
- Dev confirma OK en test manual.
- `CHANGELOG.md` tiene entrada `## [v0.1.0]` con todas las tareas.
- `package.json` muestra `"version": "0.1.0"`.
- Tag `v0.1.0` existe en git.
- Rama `feature/sp-2-capa-datos` creada desde `developer`.
- RoadMap.md: Sprint 0 en 🟢, todas las tareas 1-01..1-24 en 🟢.

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| CLOSE-1 encuentra errores de typecheck que bloquean build | Media | Alto | Resolver inmediatamente antes de continuar; no ignorar errores TS |
| SP-1-CLOSE-4 acumula muchos bugs → sprint se extiende | Media | Medio | Cap de 2h por bug antes de escalar; bugs cosméticos → deferir a Sprint 1 |
| Dev no disponible para CLOSE-3 → sprint bloqueado | Baja | Medio | Coordinar disponibilidad del dev antes de llegar a CLOSE-3 |
| Merge PR conflictos con cambios en developer | Baja | Bajo | Rebase de feature branch antes de PR; resolución manual si hay conflictos |

## Security Considerations

- El CHANGELOG.md no debe incluir detalles de explotación de las vulnerabilidades. Usar lenguaje de "corrección" no de "vector de ataque".
- El tag `v0.1.0` marca un hito de seguridad — documentar en el tag message que es un release de hardening.
- Antes de merge, el reviewer del PR debe verificar que ningún archivo de credenciales (.env real, keys) fue incluido accidentalmente.

## SP-1-CLOSE-5-bis — Promoción a staging y validación de la clienta (variable)

**Delegado a:** `af-agents:deployment`
**Estimación:** variable — ~1-3 días de espera (tiempo de la clienta) + ~1h coordinación técnica.
**Estado:** 🔘 Pendiente (no iniciar hasta que SP-1-CLOSE-5 esté en 🟢 en `developer`)

> **Esta tarea NO bloquea el cierre del Sprint 0.** El sprint se cierra cuando se mergea a `developer` y se hace el bump a v0.1.0. Esta tarea sí bloquea la promoción a `main`.

### Precondiciones
- Sprint 0 cerrado en `developer` (tag v0.1.0 creado).
- Rama `feature/sp-0-sprint-0-hotfixes` mergeada a `developer`.
- Autorización explícita del usuario (Renzo) para promover a `staging`.

### Secuencia

1. **`af-agents:deployment`** crea PR: `developer` → `staging`.
   - Esperar aprobación del usuario (Renzo) antes de mergear. **NO mergear sin orden explícita.**
2. Tras merge a `staging`: verificar que los servicios arrancan correctamente en el entorno de staging (health check).
3. Coordinar con la clienta (Esden): notificar que el entorno de staging está disponible para revisión.
4. La clienta realiza su test manual en staging. Tiempo estimado: 1-3 días (variable según disponibilidad).
5. Si la clienta aprueba → esperar autorización del usuario (Renzo) para PR: `staging` → `main`.
6. Si la clienta reporta issues → crear subtareas en SP-1-CLOSE-4 y repetir el ciclo.

### Gates para promoción a `main`
- [ ] La clienta confirma OK en staging (aprobación escrita o verbal documentada).
- [ ] Autorización explícita del usuario (Renzo) para merge a `main`.
- [ ] SP-1-CLOSE-5-bis no tiene subtareas abiertas.

### Notas
- **`staging` y `main` son ramas protegidas** — no se tocan sin orden explícita del usuario.
- Los tests automáticos (SP-1-CLOSE-1) y E2C (SP-1-CLOSE-2) ya se ejecutaron en `developer`. En staging solo se hace smoke test / health check del deploy + test manual de la clienta.
- Si la clienta tarda más de 5 días hábiles → escalar al usuario para decisión: promover a main sin validación de clienta o esperar.

---

## Next Steps

→ Sprint 1 planificado: [feature/sp-2-capa-datos] — ver [RoadMap.md Fase 1](../RoadMap.md)
→ Tarea de arranque de Sprint 1: delegar a `af-agents:planning` para detallar el plan de Fase 1 en `plans/YYMMDD-HHmm-sprint-1-capa-datos/`.
→ SP-1-CLOSE-5-bis se puede iniciar en paralelo con el arranque de Sprint 1 (no bloquea el trabajo de desarrollo en Fase 1).
