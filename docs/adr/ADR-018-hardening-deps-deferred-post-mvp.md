# ADR-018 — Hardening de dependencias diferido a post-MVP

- **Fecha:** 22-05-2026 · **Addendum 30-05-2026** (SP-7-DEPS-AUDIT-26)
- **Estado:** Aceptado · sección original cerrada · addendum abierto (SP-7-DEPS-AUDIT-26 pendiente)
- **Sprint origen:** 1 (Bloque 2.8) · **Sprint cierre addendum:** Refinamiento Herramientas (Fase 03, v0.5.2)
- **Tareas:** 2-31, 2-32, 2-33, 2-34 + **SP-7-DEPS-AUDIT-26**
- **Autor:** Javi HP

## Contexto

El RoadMap del Sprint 1 incluye 4 tareas de hardening de dependencias:

| Tarea | Acción                                                                 | Estim |
| ----- | ---------------------------------------------------------------------- | ----- |
| 2-31  | `lucide-react@0.575 → 1.x` (major)                                     | 4h    |
| 2-32  | `shadcn@3.x → 4.x` (major)                                             | 6h    |
| 2-33  | Alinear `@types/node@^20` con Node 24                                  | 2h    |
| 2-34  | Investigar `eslint@9 → 10` (bloqueado por eslint-config-next peer dep) | 2h    |

Total: **14h**.

## Decisión

**Diferir 2-31, 2-32, 2-34 al sprint v0.5.x post-MVP. Cerrar 2-33 dentro del Sprint 1.**

## Razones

### 2-33 (cierra ya)

Alineación de tipos `@types/node` con runtime Node 24 es cambio menor y reduce noise en typecheck. Bajo riesgo. Se ejecuta en el Sprint 1 tras este ADR.

### 2-31 (defer)

`lucide-react` 1.x renombró iconos y cambió el sistema de imports tree-shakeable. Riesgo alto de regresión visual en dashboard que usa ~80 iconos. Requiere validación browser que estamos difiriendo a SP-4B. No aporta funcionalidad al MVP.

### 2-32 (defer)

`shadcn` 4.x rompe theming (paso a Tailwind 4 + nuevos tokens). El proyecto usa Tailwind 3.x. Saltar a shadcn 4 implica:

1. Migrar Tailwind 3 → 4.
2. Regenerar todos los design tokens.
3. Re-validar 30+ componentes.

Riesgo crítico de bloqueo del sprint. Tarea propia merece su sprint dedicado (estimación real: 12-16h, no 6h). Movida a sprint v0.6.x (UI refresh).

### 2-34 (defer/research only)

`eslint@9 → 10` está bloqueada por peer dep de `eslint-config-next@16.2.6`. Requiere esperar a release de `eslint-config-next@17` (no anunciado a 22-05-2026). Marcar como 🟢 Diferida con anota seguimiento de release.

## Plan v0.5.x

- Sprint v0.5.1 (Costes-LLM, ver memoria): NO incluye estas tareas.
- Sprint v0.5.3 (consolidación orquestador, ADR-015): NO incluye estas.
- Sprint v0.6.x candidato: "UI refresh" — engloba 2-31 + 2-32 + Tailwind 4 + design system refresh.
- Tarea 2-34: en backlog del subagente `af-agents:adr` para monitorizar release `eslint-config-next@17`.

## Impacto en Sprint 1

- 14h estim de hardening se reducen a ~2h (solo 2-33).
- 12h liberadas en el sprint → margen para Bloque 2.7 testing y SP-2-CLOSE.
- Total Sprint 1 ajustado: ~170h estim originales - 12h = ~158h.

## Riesgos del diferimiento

| Riesgo                                 | Severidad | Mitigación                                                                      |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| Vulnerabilidad en lucide-react 0.x     | Baja      | Sin CVE público; iconos son código de presentación, sin vector de ejecución     |
| shadcn 3.x marcado deprecated upstream | Baja      | shadcn no es package npm gestionado — son componentes copiados a /components/ui |
| eslint 9 con vulnerabilidades          | Baja      | npm audit limpio a 22-05-2026; revisar mensualmente                             |

## Referencias

- `plans/reports/adr-auditoria-dependencias-20260520.md` — auditoría original
- `plans/RoadMap.md` Bloque 2.8 (tareas 2-31..2-34)

---

## Addendum — 30-05-2026: 25 vulns nuevas en deps de producción (SP-7-DEPS-AUDIT-26)

**Estado:** abierto · **Sprint target:** Sprint Refinamiento Herramientas (`v0.5.2`, Fase 03) · **Asignado:** Javi HP

### Contexto

Durante el cierre de Sprint 3 (PR #22 a `developer`), el check CI "Security Audit" (`.github/workflows/security.yml`) reportó **25 vulnerabilidades npm audit (14 moderate + 11 high)** en deps **transitivas de producción**. Todas son CVEs en `uuid` propagadas a través de:

| Paquete directo                   | Versión actual | Vulnerabilidad propagada vía |
| --------------------------------- | -------------- | ---------------------------- |
| `langchain`                       | `>=1.0.0-α.1`  | `uuid` (transitiva)          |
| `@langchain/langgraph`            | `*`            | `uuid` (transitiva)          |
| `@langchain/langgraph-checkpoint` | `*`            | `uuid` (transitiva)          |
| `bullmq`                          | `1.0.1-5.76.1` | `uuid` (transitiva)          |
| `exceljs`                         | `>=3.5.0`      | `uuid` (transitiva)          |

**Diagnóstico clave:**

- Pre-existentes en `developer` desde antes del Sprint 3 — verificable en Sprint 4 SPIKE (`gh run list --workflow "Security Audit" --branch developer` muestra fallos consistentes desde 28-05-2026).
- Sprint 3 NO las introdujo — son deps de producción ya en el árbol antes del LINT-ZERO / DEPRECATIONS-DEPLOY.
- Distintas de las 22 vulns mencionadas en ADR-020 (esas eran devDeps de MSW, no llegan a prod bundle). Estas SÍ son deps de prod.
- El check falla pero `gh pr merge` permitió el merge: `mergeStateStatus: UNSTABLE` (warning), no `BLOCKED`.

### Decisión

**Crear tarea SP-7-DEPS-AUDIT-26 dentro del Sprint Refinamiento Herramientas (v0.5.2) como Fase 03.** Estim 4-6h. Asignada a **Javi HP** (no Renzo — actualización de deps de prod requiere dev principal).

### Plan de ejecución

1. `npm audit fix --dry-run` para ver qué se resuelve sin breaking change.
2. Si requiere majors → abrir ADR específico con análisis de breaking + plan de tests.
3. Upgrade coordinado de `langchain` + `bullmq` + `exceljs` + verificación que `uuid` queda en versión segura.
4. Re-run `/e2ctotal` + `/e2etotal` VPS para verificar zero-regresión.
5. Actualizar este ADR-018 cerrando esta sección.

### Por qué no se hace en Sprint 3 ni en SP-4B

- **Sprint 3 (v0.3.0-rc.1)**: ya cerrado y mergeado a `developer`. Abrir otra ronda de upgrades de deps multiplicaría el surface de riesgo de regresión sin necesidad (las vulns son pre-existentes y no introducen exposición nueva por la entrega del sprint).
- **SP-4B Validación Pre-MVP**: Renzo solo valida, no actualiza deps. Su sprint es QA, no hardening.
- **Sprint 4 Sheets / Costes-LLM**: focalizados en feature delivery, deben mantener scope.
- **Sprint Refinamiento**: ya es post-MVP, sin presión de timeline, con margen para resolver el upgrade y re-test exhaustivo. Encaje natural.

### Riesgos del diferimiento

| Riesgo                                             | Severidad  | Mitigación                                                                                  |
| -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| Vulnerabilidades `uuid` explotables en prod        | Baja-Media | `uuid` se usa internamente para IDs aleatorios; no recibe input externo. Sin vector directo |
| Deps quedan más desactualizadas si SP-7 se retrasa | Media      | Renovate bot (pendiente activación, ver punto 3 de Pendientes Operativos en RELEASE-NOTES)  |
| Auditorías futuras del cliente detecten las vulns  | Media      | Documentado en RELEASE-NOTES v0.3.0-rc.1 + plan claro en este ADR + tarea trackeada         |

### Referencias

- Check CI fallido: [GitHub Actions run 26659624573](https://github.com/AutomatizaFormacion/Automatiza-Formacion-DashBoard/actions/runs/26659624573)
- RELEASE-NOTES v0.3.0-rc.1 sección "Vulnerabilidades en deps transitivas — planificadas para Sprint Refinamiento (v0.5.2)"
- `plans/RoadMap.md` Sprint Refinamiento Fase 03 (SP-7-DEPS-AUDIT-26)
