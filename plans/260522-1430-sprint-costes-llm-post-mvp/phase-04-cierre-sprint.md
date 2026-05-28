---
title: "Phase 04 — Cierre Sprint Costes-LLM (SP-5B-CLOSE-1..5)"
sprint: SP-5B
phase: 4
tasks: [SP-5B-CLOSE-1, SP-5B-CLOSE-2, SP-5B-CLOSE-3, SP-5B-CLOSE-4, SP-5B-CLOSE-5]
adr: ADR-024 (Draft)
effort_nominal: 5h 30min + bugs
effort_realistic: 3-5h + bugs
status: pending
agents:
  [af-agents:testing, af-agents:uxui, af-agents:git, af-agents:deployment, af-agents:productivity]
---

# Phase 04 — Cierre Sprint Costes-LLM

## Context Links

- Plan overview: [plan.md](plan.md)
- ADR-024 (Draft): [`docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md`](../../docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md)
- Phase 01 LiteLLM: [phase-01-litellm-proxy-setup.md](phase-01-litellm-proxy-setup.md)
- Phase 02 Langfuse: [phase-02-langfuse-integration.md](phase-02-langfuse-integration.md)
- Phase 03 token_usage: [phase-03-token-usage-chat-messages.md](phase-03-token-usage-chat-messages.md)
- RoadMap: [RoadMap.md](../RoadMap.md) §Fase 4.5 — Tareas de cierre obligatorias
- Plantilla cierre estándar: misma estructura que `260520-1342-sprint-0-hotfixes-seguridad/phase-07-cierre-sprint.md`

## Overview

Las 5 tareas de cierre estándar del proyecto, instanciadas para este Sprint. Se ejecutan **al final del sprint** una vez que las tareas de desarrollo (C-01-new, C-02-new, C-03) están a 🔵 o 🟢.

## Tareas

| ID            | Tarea                                                                                                                                                                                                                                                                                                  | Estim. nominal | Estim. realista | Estado | Notas                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| SP-5B-CLOSE-1 | **Auto test** — `npm run typecheck` + `lint` + `build` + `test` (unit + integration). Reporte coverage.                                                                                                                                                                                                | 1h 30min       | 1h              | 🔘     | Delegado a `af-agents:testing`. Foco: tests `litellm-client` + `emergency-fallback` + `pii-mask` + multi-tenant Langfuse filter + prompt cache. |
| SP-5B-CLOSE-2 | **Test E2C Local** — Playwright recorre flujos LLM end-to-end (WhatsApp inbound → respuesta agente con trace Langfuse + cost log en `chat_messages` + entrada LiteLLM admin). Validar WCAG 2.2 AA si se embebe iframe Langfuse en `/admin/costs`. Screenshots a `docs/screenshots/sprint-costes-llm/`. | 2h 30min       | 1-2h            | 🔘     | Delegado a `af-agents:testing` + `af-agents:uxui`. Validar fallback ramo emergencia con LiteLLM Proxy apagado.                                  |
| SP-5B-CLOSE-3 | **Test Manual del Dev** — Javi HP genera tráfico LLM real con tenant de prueba, verifica que: (a) LiteLLM admin muestra spend per tenant, (b) Langfuse muestra trace replay completo, (c) `chat_messages.metadata.token_usage` poblado, (d) budget cap dispara 429 al superar threshold.               | 1h             | 30-60min        | 🔘     | Delegado al manager (interacción con humano).                                                                                                   |
| SP-5B-CLOSE-4 | **Corrección de Bugs detectados** — subtareas dinámicas, una por bug/cambio reportado.                                                                                                                                                                                                                 | (variable)     | (variable)      | 🔘     | Delegado a `af-agents:code` + `af-agents:debugger`.                                                                                             |
| SP-5B-CLOSE-5 | **Cierre de Sprint** — PR `feature/sprint-costes-llm-post-mvp` → `developer`. Tras merge: bump SemVer a `v0.5.1`, promover ADR-024 de `Draft` → `Accepted`, invitar a Sprint 5 (Salesforce v0.6.0).                                                                                                    | 30min          | 30min           | 🔘     | Delegado a `af-agents:git` + `af-agents:deployment` (gatekeeper changelog) + `af-agents:productivity` (cierre tracking).                        |

## Pre-requisitos del cierre (gates obligatorios)

Para que `SP-5B-CLOSE-5` arranque, **TODAS** estas condiciones deben estar a 🟢:

- [ ] Phase 01 (LiteLLM Proxy) en 🔵/🟢 con Success Criteria de su phase file todos cumplidos.
- [ ] Phase 02 (Langfuse) en 🔵/🟢 con masking PII validado por tests sintéticos.
- [ ] Phase 03 (token_usage `chat_messages`) en 🔵/🟢 con los 5 call sites cubiertos.
- [ ] SP-5B-CLOSE-1 Auto test 🟢 con 0 errores typecheck/lint/build.
- [ ] SP-5B-CLOSE-2 E2C Local 🟢 sin findings WCAG críticos en pantallas tocadas.
- [ ] SP-5B-CLOSE-3 Test Manual del Dev 🟢 (Javi HP firma OK con captura de pantalla de Langfuse trace + LiteLLM spend).
- [ ] SP-5B-CLOSE-4 Bugs detectados 🟢 (sin subtareas abiertas).
- [ ] `CHANGELOG.md` con entrada `## [v0.5.1]` completa (gatekeeper `af-agents:deployment`).
- [ ] `help-docs-keeper` actualizó secciones de ayuda afectadas (operativa LiteLLM admin + Langfuse UI para devs).
- [ ] ADR-024 promovido a `Accepted` con notas de implementación (variantes de config finalmente elegidas, decisiones que se tomaron en sprint).
- [ ] Runbooks operativos `runbook-litellm.md` + `runbook-langfuse.md` revisados y completos.

## Orden fijo en el roadmap

Este sprint va JUSTO DESPUÉS de Sprint 4 (Google Sheets `v0.5.0`) y ANTES de Sprint 5 (Salesforce `v0.6.0`). Inicio Lun 24-08-2026, fin Jue 27-08-2026. Bloquea la fecha de Sprint 5 (+4 días respecto plan original). Decisión clienta 22-05-2026.

## Next Steps

→ Sprint 5 (Salesforce adapter `v0.6.0`).
