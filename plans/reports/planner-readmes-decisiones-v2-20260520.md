# Reporte — Decisiones v2 aplicadas al plan de READMEs por rama

**Fecha:** 2026-05-20
**Plan:** `plans/260520-1342-sistema-readmes-por-rama/`
**Agente:** planner

---

## Archivos modificados

| Archivo | Decisión aplicada | Cambio |
|---------|------------------|--------|
| `plans/260520-1342-sistema-readmes-por-rama/plan.md` | 3-1, 3-3, 3-4, 3-5 | Frontmatter effort 6h30min → 8h; tabla de archivos con nuevas rutas; sección "Decisiones confirmadas" con tabla de 5 decisiones |
| `plans/260520-1342-sistema-readmes-por-rama/phase-01-script-generador.md` | 3-1 | Añadida sección "Scripts en `package.json`" con entradas exactas `generate-readmes` y `generate-readmes:check`; success criteria actualizado |
| `plans/260520-1342-sistema-readmes-por-rama/phase-02-plantillas-por-rama.md` | 3-3 | Sección "Ubicación final de templates" reescrita: path definitivo es `scripts/readme-templates/`, `plans/templates/` queda como referencia histórica; rationale documentado |
| `plans/260520-1342-sistema-readmes-por-rama/phase-05-actualizar-ci-purity-check.md` | 3-2, 3-5 | Título actualizado; overview con estimación 1h; sección "CI bloqueante — Required Status Check" (3-2) con instrucciones GitHub + fallback + nota de rodaje; sección "Pre-commit hook local" (3-5) con spec de `af-readme-sync-precommit.cjs`, mensaje de error, guard de rama, y registro en `hooks.json` |
| `plans/260520-1342-sistema-readmes-por-rama/phase-06-bootstrap-readmes-iniciales.md` | 3-1, 3-3 | Pre-condiciones actualizadas con paths `scripts/readme-templates/` + check de scripts en `package.json`; Paso 1 con comentario de path; Paso 2 usa `npm run generate-readmes`; Paso 4 usa `npm run generate-readmes:check`; Paso 5 commit atómico ampliado con `package.json`, `.claude/hooks/af-readme-sync-precommit.cjs`, y nombre de workflow actualizado |
| `plans/260520-1342-sprint-1-capa-datos/plan.md` | 3-4 | Sección "2-35 — Sistema de 3 READMEs por rama" añadida con estimación, entregables, nota para roadmap-keeper; referencia al plan de READMEs en sección Referencias |

## Archivos movidos físicamente (plantillas)

| Origen | Destino | Estado |
|--------|---------|--------|
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.developer.template.md` | `scripts/readme-templates/README.developer.template.md` | CREADO (contenido idéntico) |
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.staging.template.md` | `scripts/readme-templates/README.staging.template.md` | CREADO (contenido idéntico) |
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.main.template.md` | `scripts/readme-templates/README.main.template.md` | CREADO (contenido idéntico) |

> Los originales en `plans/templates/` se conservan como referencia histórica del plan. El script usa exclusivamente `scripts/readme-templates/`.

## Estimación final 2-35

| Subtarea | Estimación |
|----------|-----------|
| Script `generate-readmes.cjs` + scripts `package.json` | 4h |
| Plantillas (ya creadas en `scripts/readme-templates/`) | 1h |
| Integración `promote.sh` + `promote.ps1` | 1h |
| CI (`repo-purity-check.yml`) + pre-commit hook | 1h |
| Bootstrap inicial (3 READMEs) | 1h |
| **Total 2-35** | **8h** |

## Pendiente (fuera de scope de este plan)

- `plans/RoadMap.md`: NO modificado — el roadmap-keeper debe añadir 2-35 en la próxima actualización de estados (ver nota en `plans/260520-1342-sprint-1-capa-datos/plan.md`)
- GitHub Branch Protection Rules para `developer`: acción manual post-implementación (ver instrucciones en `phase-05`)
- `plans/260520-1342-sistema-readmes-por-rama/templates/`: los originales no se eliminaron — borrado opcional, no urgente

---

**Status:** DONE
**Summary:** 6 archivos de plan modificados, 3 plantillas movidas físicamente a `scripts/readme-templates/`, tarea 2-35 registrada en Sprint 1 con estimación 8h. Todas las decisiones del usuario aplicadas como Recommended.
