# SP-4B Validation Plan Audit — 2026-05-24

**Auditor:** researcher (Sonnet)
**Scope:** `plans/260522-1700-sprint-validacion-pre-mvp/` — 5 phase files + plan.md
**Version target en plan:** v0.4.0 (GA) | **Versión real de Sprint 2:** v0.2.7 (no v0.2.5 ni v0.2.0-rc)

---

## 1. Coverage por phase (puntuaciones 0–10)

### phase-01 — Validación Sprint 0 (185 líneas)

| Dimensión                  | Estado        | Detalle                                                                                                                                                       |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comandos test automáticos  | ✅ Exactos    | L31–38: `npm run typecheck`, `npm run lint`, `npm run build`. Nota correcta de que `npm test` no existía en Sprint 0.                                         |
| Specs Playwright concretas | ✅ Concretas  | L64–68: tabla con rutas exactas (`tests/e2e/core/sprint-0-security.spec.ts` 16 tests, `smoke.spec.ts` 2 tests, `sprint-0-close/smoke-flows.spec.ts` 6 tests). |
| Checklist manual humano    | ✅ Desglosado | L121–154: bloques A/B/C/D con checks numerados, tiempos estimados, referencias SF-01..SF-06, BUG-001/BUG-002 marcados.                                        |
| Variables de entorno VPS   | ✅ Listadas   | L97–101: `CRON_SECRET`, `APP_USER_PASSWORD`, `REDIS_URL` + verificación por comando.                                                                          |
| Bug regression baseline    | ✅ Explícito  | L166–167: BUG-001 (logout redirect) + BUG-002 (viewer /admin) con commit `8beeddd`, estado, severidad.                                                        |

**Puntuación: 9/10.** El único hueco es que el umbral numérico de lint (≤128) en L35 asume que el baseline no cambió después de Sprint 1, lo que puede dar falso negativo si se ejecuta con código de sprint posterior.

---

### phase-02 — Validación Sprint 1 (171 líneas)

| Dimensión                  | Estado                 | Detalle                                                                                                                                                                       |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comandos test automáticos  | ✅ Exactos             | L46–60: todos los comandos Vitest, incluyendo `test:coverage`. Scripts `package.json` reproducidos.                                                                           |
| Specs Playwright concretas | ⚠️ Parcial             | L91–93: "Suite E2E Playwright pendiente para Sprint 1: aún no añadida". Comando con wildcard `tests/e2e/sprint-1/*.spec.ts` referencia specs que no existen todavía.          |
| Checklist manual humano    | ✅ Desglosado          | L138–147: 9 items concretos con acciones específicas (RLS cross-tenant, widget, duplicate lead, hook productivity-logger).                                                    |
| Variables de entorno VPS   | ✅ Crítica documentada | L113–115: `ENCRYPTION_KEY` (64-chars hex) con comando de generación y advertencia "perderla = perder acceso a integraciones".                                                 |
| Bug regression baseline    | ❌ Ausente             | No hay lista de bugs Sprint 1 corregidos. Sección 5 (L151–153) solo tiene plantilla vacía BUG-XXX. Los ADRs 014–019 y commit list son ricos pero no hay bugs con ID tracking. |

**Puntuación: 7/10.** La ausencia de bug regression list en bloque 5 es el déficit principal. Sprint 1 no reportó bugs numerados durante el cierre (el commit list muestra solo `fix(lint)` menores) — esto debería estar explicitamente documentado como "0 bugs cerrados con BUG-ID en Sprint 1, regression baseline = 0 items" para que Renzo sepa que es intencional, no un olvido.

---

### phase-03 — Validación Sprint 2 + 2B (139 líneas)

| Dimensión                  | Estado            | Detalle                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comandos test automáticos  | ✅ Exactos        | L35–40: 5 comandos con resultados esperados explícitos (168 pass + 4 skipped).                                                                                                                                                                                    |
| Specs Playwright concretas | ⚠️ Diferidas      | L54–64: lista de specs "a añadir en Sprint 3". El comando `npx playwright test tests/e2e/integrations-manager.spec.ts` (L55) referencia archivo que puede no existir pre-Sprint 3.                                                                                |
| Checklist manual humano    | ✅ Desglosado     | L79–100: 7 flujos manuales para CRM (HubSpot + Zoho) con subitems. Concreto y ejecutable.                                                                                                                                                                         |
| Variables de entorno VPS   | ✅ Tabla completa | L109–117: 8 vars con propósito y dónde obtener.                                                                                                                                                                                                                   |
| Bug regression baseline    | ⚠️ Incompleto     | L102–104: "Ninguno bloqueante." — NO lista los bugs cerrados con fixes del ck-debug report (`F-WG-1`, `F-API-1`, `F-API-2`) que sí fueron corregidos en Sprint 2 (referenciados en `PR-BODY.md` L128–130). BUG-2-01 (slug conflict, v0.2.7) tampoco está listado. |

**Problemas adicionales:**

- **Version desactualizada:** L11 dice "v0.2.0-rc" pero Sprint 2 cerró como v0.2.7. Esto confunde a Renzo sobre qué versión validar.
- **Sprint 2B ausente por completo:** El plan.md (L44) dice que phase-03 cubre "Sprint 2 + Sprint 2B (Dashboard KPIs)". Sin embargo, phase-03 no tiene ninguna referencia a Sprint 2B, `/dashboard/overview`, `getKpiOverview`, `NEW-04`, ni las 16-24h de work de Sprint 2B. Sprint 2B es un sprint separado (branch `feature/sprint-02b-dashboard-kpis-conjunto`, target `v0.2.7`) que aún no ha arrancado — su CLOSE-5 debería auto-rellenar la sección 2B cuando llegue, pero el skeleton no está preparado.

**Puntuación: 5/10.** Version incorrecta + Sprint 2B completamente ausente + bugs Sprint 2 sin listar como regression checks.

---

### phase-04 — Validación Sprint 3 (70 líneas)

| Dimensión                  | Estado       | Detalle                                                                                                                                                                                    |
| -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comandos test automáticos  | ❌ Plantilla | L21–27: solo "⏳ Pendiente — al cierre Sprint 3. Foco esperado:..." con bullets genéricos.                                                                                                 |
| Specs Playwright concretas | ❌ Plantilla | L29–36: bullets aspiracionales. Sin spec path, sin test count target, sin rutas cubiertas.                                                                                                 |
| Checklist manual humano    | ❌ Plantilla | L45–50: "Foco UX: experiencia completa MVP... Más extenso que sprints anteriores (2h vs 1h)." Sin items de checklist.                                                                      |
| Variables de entorno VPS   | ❌ Ausente   | No hay sección de env vars. Sprint 3 añade Node 22, headers de seguridad (CSP, HSTS), observabilidad (Pino + Sentry DSN + BullMQ) — todas requieren vars nuevas que no están documentadas. |
| Bug regression baseline    | ❌ Plantilla | Sección 5 solo tiene la tabla vacía genérica. Sprint 3 no ha cerrado aún, es correcto que esté vacío, pero el skeleton no tiene filas de referencia de los sprints anteriores.             |

**Puntuación: 2/10.** Completamente plantilla. Esto es esperado dado que Sprint 3 no ha empezado, pero la plantilla es DEMASIADO delgada para un sprint de 95-127h que cierra el MVP. Ver punto 3 para detalles.

---

### phase-05 — Cierre SP-4B (44 líneas)

| Dimensión                   | Estado            | Detalle                                                                           |
| --------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| Comandos test automáticos   | ✅ Referenciados  | L16–17: "re-run completo de los 4 specs/suites" vía CLOSE-1/2/3 con estimaciones. |
| Specs Playwright            | ✅ Implícito      | "mismos specs" de phases 01..04 — correcto para fase de cierre.                   |
| Checklist de pre-requisitos | ✅ Tabla concreta | L26–31: 5 pre-requisitos con cómo verificar cada uno.                             |
| Env vars                    | N/A               | Fase de cierre — no aplica.                                                       |
| Semver y protecciones       | ✅ Explícito      | L42–45: instrucciones NO push staging/main muy claras.                            |

**Puntuación: 8/10.** Sólida para una fase de cierre. El único hueco: no especifica qué hacer si phase-04 no está todavía rellena cuando llegue el cierre (puede ocurrir si Sprint 3 se retrasa mucho y Renzo arranca SP-4B con phases 01-03 ya ejecutadas).

---

## 2. ¿phase-03 cubre realmente Sprint 2 + Sprint 2B?

**No.** El archivo actual solo cubre Sprint 2 (HubSpot + Zoho). Sprint 2B (Dashboard KPIs, `NEW-04`, branch `feature/sprint-02b-dashboard-kpis-conjunto`, v0.2.7) no tiene ninguna referencia en phase-03:

- Cero menciones de `/dashboard/overview`, `getKpiOverview`, `getDynamicChartSeriesOverview`, `KpiBuilder`, filtros de fechas/campaña/origen.
- El plan.md de Sprint 2B (L47) indica que `SP-3B-CLOSE-5` hace el hand-off a SP-4B phase-03 — esto significa que **la fusión es posible en teoría**, pero actualmente el skeleton no tiene los bloques preparados para recibir ese hand-off.

**Recomendación: dividir en phase-03a + phase-03b.**

| Opción          | Pros                                                                                             | Contras                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mantener fusión | Menos archivos                                                                                   | phase-03 crece a 250+ líneas con dos sprints distintos; el hand-off de Sprint 2B sobreescribe secciones del hand-off de Sprint 2 si no hay separación de bloques |
| Dividir 03a/03b | Separación limpia, cada sprint auto-rellena su propio archivo, trazabilidad bug IDs no se mezcla | Requiere actualizar plan.md (tabla de fases) + referencias en SP-3B-CLOSE-5                                                                                      |

**Veredicto: dividir.** Sprint 2B es un sprint completo (16-24h de dev + cierre propio) con UI nueva, tests E2E distintos, y versión SemVer separada. Fusionarlo en phase-03 crea ambigüedad cuando Renzo ejecute las pruebas: ¿cuáles son de Sprint 2? ¿cuáles de 2B?

---

## 3. ¿Está incompleta phase-04? (70 líneas vs Sprint 3 de 95-127h)

**Sí, severamente incompleta.** Pero por razón estructural válida: Sprint 3 no ha empezado y la fase se rellena en `SP-4-CLOSE-5`. El problema real no es el contenido vacío — es que **el skeleton que recibirá el auto-fill es demasiado genérico** para guiar el llenado.

Lo que falta respecto a lo que Sprint 3 SABEMOS que entregará (por `plans/260520-1342-sprint-3-hardening/plan.md`):

| Bloque Sprint 3                                 | Contenido esperado en phase-04 que no está en el skeleton                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Phase 1: E2E Playwright completo (32-36h)       | Rutas `/dashboard/overview`, `/dashboard/conversaciones`, widget chatbot, voice agents, calendar — ninguna mencionada |
| Phase 2: Observabilidad Pino+Sentry (7-9h)      | `SENTRY_DSN`, `PINO_LEVEL`, `BULL_BOARD_USER/PASS` env vars ausentes del skeleton                                     |
| Phase 3: Node 22 LTS migration                  | `.nvmrc` check, `engines.node` verificación — ausente                                                                 |
| Phase 4: WCAG 2.2 AA (28-40h, 24 findings DA-5) | axe-core scan en todas las rutas MVP, sin ningún scaffolding en checklist manual                                      |
| Phase 5: CSP/HSTS/rate-limits                   | Headers `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` en E2E VPS — no hay hint de esto    |

El skeleton debería tener al menos los headers de sección vacíos para cada dominio de Sprint 3, de modo que el `SP-4-CLOSE-5` auto-fill tenga estructura donde insertar. Como está, el AI que rellene en `SP-4-CLOSE-5` probablemente replique la misma estructura genérica de phases anteriores y no cubra la complejidad de Sprint 3.

---

## 4. Hand-off auto-fill mechanism: ¿está documentado?

**Sí, en plan.md — pero la documentación es asimétrica.**

**Qué existe:**

- `plan.md` L63–74: sección "Mecánica de auto-fill" describe los 7 items que cada `SP-N-CLOSE-5` debe depositar en la phase correspondiente.
- `CLAUDE.md` (proyecto) sección "Hand-off al Sprint Validación Pre-MVP (SP-4B)": regla idéntica, con lista explícita de 7 campos.
- `plans/260524-1330-sprint-2-adapter-hubspot-zoho/phase-07-sprint-close.md` L51–58: instructions explícitas para el `SP-3-CLOSE-5` hand-off con qué insertar en phase-03.

**Qué falta:**

- **No hay template/skeleton de sección** que el agente `SP-N-CLOSE-5` deba rellenar. El agente tiene instrucciones textuales pero ningún YAML/MD template con placeholders como `<!-- COMANDOS_TEST -->`, `<!-- SPECS_PLAYWRIGHT -->`, `<!-- BUGS_CERRADOS -->`. Esto significa que cada sprint auto-rellena con formato diferente (phase-01 usa tablas, phase-02 usa listas, phase-03 tiene sección 7 "Notas de despliegue" que las otras no tienen).
- **No hay validación de completitud:** el `roadmap-keeper` en CLAUDE.md L189 dice "si la plantilla sigue marcada como `🔘 Plantilla vacía`, el cierre queda 🟡" — pero solo verifica el status tag, no si los 7 campos requeridos por plan.md están realmente rellenos.
- **Renzo no tiene un "qué esperar encontrar":** el plan.md describe la mecánica de auto-fill para el agente que rellena, no para Renzo que tiene que verificar que se rellenó correctamente antes de arrancar la fase.

---

## 5. Bug regression baseline: estado por phase

### Bugs de referencia (según brief del auditor)

| Sprint   | Bugs/Issues                                           | BUG-ID en plan.md                        |
| -------- | ----------------------------------------------------- | ---------------------------------------- |
| Sprint 0 | 4 vulns RLS + OAuth + Kong                            | BUG-001 + BUG-002 en phase-01            |
| Sprint 1 | ENCRYPTION_KEY + 16 commits + 6 ADRs                  | ❌ 0 BUG-IDs en phase-02                 |
| Sprint 2 | BUG-2-01 + B-01..B-07 Zoho + F-WG-1 + F-API-1/F-API-2 | ❌ Solo "Ninguno bloqueante" en phase-03 |
| Sprint 3 | Pendiente                                             | N/A (plantilla)                          |

### phase-01 (Sprint 0) — ✅ Correcto

BUG-001 y BUG-002 listados explícitamente en sección 5 (L165–168) con commit, severidad, estado. Las 4 vulnerabilidades RLS documentadas en Sprint 0 no tienen BUG-ID individualizado aquí (se validaron vía spec `sprint-0-security.spec.ts` 16 tests — aceptable, los tests son el regression check).

**Lo que falta:** la vuln de Kong EOL (mencionada en el brief) no tiene referencia en phase-01. El checklist manual no tiene item explícito de "verificar Kong no está corriendo / ha sido reemplazado".

### phase-02 (Sprint 1) — ❌ Déficit

Sección 5 está vacía (plantilla BUG-XXX). Sprint 1 no produjo bugs con ID numerado — correcto. Pero:

- La ENCRYPTION_KEY como "bug crítico de deploy" debería estar documentada como riesgo de regresión (si alguien hace redeploy sin la var, el cifrado falla silenciosamente). Debería ser item en checklist VPS, no solo en L113.
- Los 4 findings de RLS de audit (ai_agents, web_widgets, programas, integrations — migrations L100–129) deberían tener al menos un item de regresión en checklist manual: "ejecutar queries anti-fuga RLS del bloque 3" (ya están en L121–129 — esto sí está bien).

### phase-03 (Sprint 2) — ❌ Déficit crítico

"Ninguno bloqueante" (L103–104) es INCORRECTO. Según `PR-BODY.md` del Sprint 2:

- **F-API-1** (CRITICAL): session tenantId check post-HMAC — corregido en sprint pero no listado como regression check.
- **F-API-2** (HIGH): cookie deletion post-redirect correctness — idem.
- **F-WG-1** (HIGH): fail-closed WriteGuard — corregido, no listado.
- **BUG-2-01** (P0): slug conflict que causó 500 en TODAS las rutas en VPS — el más crítico de todos y no aparece en sección 5 de phase-03. Está en RELEASE-NOTES-v0.2.7.md pero Renzo no necesariamente va a leer ese archivo.

Los tests unitarios de Vitest cubren F-WG-1 y parte de F-API-1/F-API-2, pero BUG-2-01 es un runtime-only bug que NO es detectable por `npm run build` ni tests — requiere E2E VPS smoke check explícito, que actualmente no está en el checklist manual de phase-03.

### phase-04 (Sprint 3) — N/A (Sprint no ejecutado)

Correcto que esté vacío. Cuando se rellene debe incluir todos los findings de las fases de Sprint 3 (WCAG, CSP, rate-limits, Node 22).

---

## Resumen ejecutivo: veredictos por phase

| Phase    | Veredicto     | Razón principal                                                                                                                                                                                                      |
| -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| phase-01 | 🟢 Listo      | Comandos exactos, specs concretas, checklist completo, bugs listados. Solo hueco menor: Kong EOL no referenciado.                                                                                                    |
| phase-02 | 🟡 Ajustar    | Specs Playwright inexistentes (wildcard), sección bugs vacía sin aclaración "0 bugs intencionado".                                                                                                                   |
| phase-03 | 🔴 Reescribir | Versión incorrecta (v0.2.0-rc vs v0.2.7), Sprint 2B completamente ausente, bugs críticos F-WG-1/F-API-1/F-API-2/BUG-2-01 no listados como regression checks.                                                         |
| phase-04 | 🟡 Ajustar    | Plantilla esperablemente vacía (Sprint 3 no ejecutado), pero skeleton demasiado genérico para recibir el auto-fill de un sprint de 127h con 5 subdominios técnicos distintos. Añadir headers de sección por área ya. |
| phase-05 | 🟢 Listo      | Sólida para fase de cierre. Sin huecos bloqueantes.                                                                                                                                                                  |

---

## Acciones recomendadas (priorizadas)

1. **[CRÍTICO — phase-03]** Dividir en `phase-03a-validacion-sprint-2.md` + `phase-03b-validacion-sprint-2b.md`. Actualizar `plan.md` tabla de fases y referencia en `SP-3B-CLOSE-5` (`plans/260522-1800-sprint-2b-dashboard-kpis-conjunto/plan.md` L49).

2. **[CRÍTICO — phase-03]** Añadir sección 5 regression baseline con: BUG-2-01 (E2E VPS slug conflict check), F-WG-1 (WriteGuard fail-closed), F-API-1 (session tenantId check), F-API-2 (cookie deletion). Referencia: `PR-BODY.md` L128–130.

3. **[CRÍTICO — phase-03]** Corregir `version_target: v0.2.0-rc` → `v0.2.7` en overview (L11).

4. **[IMPORTANTE — phase-04]** Añadir skeleton de secciones por área: "1.1 Node 22 LTS", "1.2 E2E Playwright (rutas MVP)", "2. Observabilidad (Pino+Sentry+BullMQ)", "3. WCAG 2.2 AA", "4. CSP/HSTS/rate-limits". Con env vars ya conocidas: `SENTRY_DSN`, `PINO_LOG_LEVEL`, `BULL_BOARD_USER`, `BULL_BOARD_PASS`.

5. **[MENOR — phase-02]** Documentar explícitamente en bloque 2: "specs E2E Playwright para Sprint 1 no existen aún — se crean en Sprint 3 phase-01". Añadir en sección 5: "0 bugs con BUG-ID numerado en Sprint 1 — intencional."

6. **[MENOR — plan.md / auto-fill]** Añadir template MD con placeholders (`<!-- SECTION: COMANDOS_TEST -->` etc.) al pie de cada phase file para que el agente `SP-N-CLOSE-5` tenga estructura normalizada donde insertar, y Renzo pueda verificar rápidamente que el auto-fill fue completo.

---

## Limitaciones de esta auditoría

- No se verificó si `tests/e2e/integrations-manager.spec.ts` existe realmente en el repo (referenciado en phase-03 L55) — requiere `ls tests/e2e/`.
- No se leyó `docs/testeos-manual.md` para validar si las secciones de Sprint 2 / Sprint 3 ya existen.
- Sprint 3 no ha empezado: phase-04 se auditó solo en cuanto a adecuación del skeleton, no del contenido final.
- El auto-fill mechanism en CLAUDE.md no fue testado end-to-end — se audita solo la documentación.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** phase-01 y phase-05 están listas. phase-02 necesita ajustes menores. phase-03 requiere reescritura: versión incorrecta, Sprint 2B ausente, bugs críticos sin listar. phase-04 es un skeleton demasiado delgado para Sprint 3.
**Concerns:** BUG-2-01 (el único bug que causó 500 en producción en Sprint 2) no aparece en ningún regression check de phase-03. Es el riesgo más alto de regresión no detectada en SP-4B.
