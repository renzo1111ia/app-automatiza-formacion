---
title: "Phase 04 — Cierre Sprint Costes-LLM (SP-5B-CLOSE-1..5)"
sprint: SP-5B
phase: 4
tasks: [SP-5B-CLOSE-1, SP-5B-CLOSE-2, SP-5B-CLOSE-3, SP-5B-CLOSE-4, SP-5B-CLOSE-5]
effort: 5h 30min + bugs
status: pending
agents: [af-agents:testing, af-agents:uxui, af-agents:git, af-agents:deployment, af-agents:productivity]
---

# Phase 04 — Cierre Sprint Costes-LLM

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) §Fase 4.5 — Tareas de cierre obligatorias
- Plantilla cierre estándar: misma estructura que `260520-1342-sprint-0-hotfixes-seguridad/phase-07-cierre-sprint.md`

## Overview

Las 5 tareas de cierre estándar del proyecto, instanciadas para este Sprint. Se ejecutan **al final del sprint** una vez que C-01, C-02, C-03 están a 🔵 o 🟢.

## Tareas

| ID            | Tarea | Estim. | Estado | Notas |
| ------------- | ----- | ------ | ------ | ----- |
| SP-5B-CLOSE-1 | **Auto test** — `npm run typecheck` + `lint` + `build` + `test` (unit + integration). Reporte coverage. | 1h 30min | 🔘 | Delegado a `af-agents:testing`. Verificar especialmente: tests de cost calculation, RLS `llm_usage_logs`, helper `recordLlmUsage` resiliente. |
| SP-5B-CLOSE-2 | **Test E2C Local** — Playwright recorre `/admin/costs` (admin) + vista tenant. Validar visual + diseño + WCAG 2.2 AA en las nuevas pantallas. Screenshots a `docs/screenshots/sprint-costes-llm/`. | 2h 30min | 🔘 | Delegado a `af-agents:testing` + `af-agents:uxui`. Foco: tooltips de Recharts accesibles vía teclado. |
| SP-5B-CLOSE-3 | **Test Manual del Dev** — Javi HP abre `/admin/costs` con datos reales (post-tráfico Sprint 3) y verifica que los números cuadran (chat WhatsApp + chat widget + qualification). | 1h | 🔘 | Delegado al manager (interacción con humano). |
| SP-5B-CLOSE-4 | **Corrección de Bugs detectados** — subtareas dinámicas, una por bug/cambio reportado. | (variable) | 🔘 | Delegado a `af-agents:code` + `af-agents:debugger`. |
| SP-5B-CLOSE-5 | **Cierre de Sprint** — PR `feature/sprint-costes-llm-post-mvp` → `developer`. Tras merge: bump SemVer a `v0.5.1`, invitar a Sprint 5 (Salesforce v0.6.0). | 30min | 🔘 | Delegado a `af-agents:git` + `af-agents:deployment` (gatekeeper changelog) + `af-agents:productivity` (cierre tracking). |

## Pre-requisitos del cierre (gates obligatorios)

Para que `SP-5B-CLOSE-5` arranque, **TODAS** estas condiciones deben estar a 🟢:

- [ ] C-01 (tabla + tracker) en 🔵/🟢.
- [ ] C-02 (dashboard) en 🔵/🟢.
- [ ] C-03 (token_usage chat_messages) en 🔵/🟢.
- [ ] SP-5B-CLOSE-1 Auto test 🟢 con 0 errores.
- [ ] SP-5B-CLOSE-2 E2C Local 🟢 sin findings WCAG críticos.
- [ ] SP-5B-CLOSE-3 Test Manual del Dev 🟢 (dev firma OK).
- [ ] SP-5B-CLOSE-4 Bugs detectados 🟢 (sin subtareas abiertas).
- [ ] `CHANGELOG.md` con entrada `## [v0.5.1]` completa (gatekeeper `af-agents:deployment`).
- [ ] `help-docs-keeper` actualizó secciones de ayuda afectadas (nuevo dashboard `/admin/costs`).

## Orden fijo en el roadmap

Este sprint va JUSTO DESPUÉS de Sprint 4 (Google Sheets `v0.5.0`) y ANTES de Sprint 5 (Salesforce `v0.6.0`). Inicio Lun 24-08-2026, fin Jue 27-08-2026. Bloquea la fecha de Sprint 5 (+4 días respecto plan original). Decisión clienta 22-05-2026.

## Next Steps

→ Sprint 5 (Salesforce adapter `v0.6.0`).
