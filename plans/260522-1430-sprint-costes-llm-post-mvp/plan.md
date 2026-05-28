---
title: "Sprint Costes-LLM — LiteLLM Proxy + Langfuse Cloud Hobby (post-Sheets, patch v0.5.1)"
description: "Adopción de LiteLLM Proxy self-hosted en Dokploy + Langfuse Cloud Hobby para cubrir cost tracking, tracing, evals, fallback runtime y virtual keys multi-tenant. Sustituye el plan custom in-house original (descartado 28-05-2026). Reagrupa también trabajo legacy 2-36 (token_usage en chat_messages). Orden definitivo: JUSTO DESPUÉS de Sprint 4 (Google Sheets v0.5.0), antes de Sprint 5 (Salesforce v0.6.0)."
status: pending
priority: P2
effort: 15-25h realistas (~28-37h nominales) + 5h 30min cierre estándar
branch: feature/sprint-costes-llm-post-mvp
sprint_id: SP-5B
version_target: v0.5.1
adr: ADR-024 (Draft)
tags:
  - observabilidad-llm
  - llm-gateway
  - langfuse
  - litellm
  - tracking-tokens
  - prompt-management
  - multi-tenant-budget
  - post-mvp
  - post-sheets
created: 2026-05-22
last_updated: 2026-05-28
---

# Sprint Costes-LLM — LiteLLM + Langfuse (post-Sheets v0.5.1)

> Ref: [RoadMap.md — Fase 4.5](../RoadMap.md#fase-45--sprint-costes-llm-post-sheets-patch-v051) · [ADR-024 (Draft)](../../docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md)

## Origen del sprint

**Decisión 22-05-2026** (clienta + Javi HP): el centro de costes LLM **no es necesario para el MVP** (`v0.4.0`). Trabajo diferido a este sprint post-Sheets (`v0.5.1`).

**Decisión 28-05-2026** (Javi HP, pendiente ratificación Bea): sustituir la arquitectura custom in-house original por **LiteLLM Proxy + Langfuse**. Misma ventana de calendario, capacidades multiplicadas. Detalle en [ADR-024](../../docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md).

**Orden definitivo en el roadmap:** Sprint 3 (MVP) → Sprint 4 (Sheets) → **Sprint Costes-LLM** → Sprint 5 (Salesforce) → Sprint 6 (GHL) → Sprint 7 (AC) → Sprint 8 (generalización).

## Objetivos del sprint

1. **Gobernanza de llamadas LLM multi-tenant** — virtual keys + budget caps + rate-limit per academia + fallback automático entre Anthropic / OpenAI / Gemini (LiteLLM Proxy).
2. **Observabilidad span-level** — trace completo de cadenas LangChain (intent → extraction → reply → summary) + replay de conversaciones (Langfuse).
3. **Cost tracking multi-fuente** — por tenant / agente / modelo / día, alimentado por LiteLLM Proxy (call-level) + Langfuse traces (span-level).
4. **Prompt management versionado + A/B testing** — editar prompts en UI Langfuse sin redeploy (cache server + client).
5. **Persistencia `completion.usage` en `chat_messages.metadata`** — vista por mensaje (1:1 con Inbox). Cierra audit F-DA-4 + informe Renzo §3 ⚠️. Legacy preservada de C-03 original.

## Prerrequisitos

- Sprint 3 cerrado (`v0.4.0` MVP) y mergeado a `developer`.
- **Sprint 4 (Google Sheets `v0.5.0`) cerrado y mergeado a `developer`** — este sprint arranca tras Sheets.
- Cuenta Langfuse Cloud Hobby creada (gratis, 50k units/mes, 2 users) — Javi HP la registra cuando arranque el sprint.
- ADR-024 promovido de `Draft` a `Accepted` tras revisión Bea.
- Variables nuevas `.env.example` preparadas: `LITELLM_PROXY_URL`, `LITELLM_MASTER_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`.

## Fases

| #   | Archivo                                                                        | Tareas RoadMap    | Estim. nominal  | Estim. realista | Estado    |
| --- | ------------------------------------------------------------------------------ | ----------------- | --------------- | --------------- | --------- |
| 1   | [phase-01-litellm-proxy-setup.md](phase-01-litellm-proxy-setup.md)             | C-01 (sustituida) | 8-14h           | 4-7h            | Pendiente |
| 2   | [phase-02-langfuse-integration.md](phase-02-langfuse-integration.md)           | C-02 (sustituida) | 14-20h          | 6-10h           | Pendiente |
| 3   | [phase-03-token-usage-chat-messages.md](phase-03-token-usage-chat-messages.md) | C-03 (preservada) | 2h              | 1-2h            | Pendiente |
| 4   | [phase-04-cierre-sprint.md](phase-04-cierre-sprint.md)                         | SP-5B-CLOSE-1..5  | 5h 30min + bugs | 3-5h + bugs     | Pendiente |

**Total desarrollo:** 24-36h nominales · **11-19h realistas** al ritmo del equipo (patrón Sprint 1: ratio −86%, Sprint 2B: ratio −86%).
**Total con cierre:** ~30-42h nominales · **14-24h realistas**.
**Ventana disponible:** Lun 24-08-2026 09:00 → Jue 27-08-2026 19:00 = ~30h netas de Javi HP. Cabe holgadamente.

## Dependencias entre fases

```text
PREREQUISITO GLOBAL:
  Sprint 3 (v0.4.0) cerrado y mergeado a developer
  Sprint 4 (Google Sheets v0.5.0) cerrado y mergeado a developer
  ADR-024 promovido a Accepted

ORDEN ÓPTIMO (1 dev):
  Ph1 (LiteLLM Proxy setup) →
    Ph2 (Langfuse integration) — depende parcialmente de Ph1 (callsites ya migrados al proxy)
    Ph3 (token_usage chat_messages) — independiente, paralelizable
  → Ph4 (cierre)

PARALELIZABLES (2+ devs):
  Ph1 y Ph3 — tocan archivos distintos (Ph3 modifica server actions, Ph1 levanta servicio Dokploy)
  Ph2 — empezar tras Ph1 (al menos el wrapping de cadenas LangChain al CallbackHandler de Langfuse asume que las llamadas pasan por LiteLLM Proxy o directo al SDK)
```

## Solapes con sprints anteriores

| Sprint anterior          | Componente reutilizado                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Sprint 3 (4-03 reducido) | Pino logger (`src/lib/logger.ts`) — sigue como logger app-level. Langfuse no lo sustituye.      |
| Sprint 1 (2-09)          | Zod schemas `ai_agent_variants` y `chat_messages` con whitelist `model_name` (2-35)             |
| Sprint 0 (1-27)          | Patrón Server Action hardening — endpoints que llaman LLM siguen pasando por `withRateLimit`    |
| Sprint 3 (Sentry)        | Sentry sigue capturando errores app. Langfuse cubre traces LLM. Complementarios, no se solapan. |

## Criterios de éxito del Sprint

- [ ] LiteLLM Proxy operativo en Dokploy del VPS Hetzner (`http://litellm-proxy:4000` accesible solo desde red interna).
- [ ] Schema `litellm_proxy` provisionado en cluster Supabase con virtual keys + budgets por tenant.
- [ ] `fallbacks: [["claude-3-5-sonnet", "gpt-4o", "gemini-2.0-flash"]]` validado: tirar Claude → siguiente call cae a OpenAI sin intervención.
- [ ] Todas las cadenas LangChain del proyecto apuntan a LiteLLM Proxy via `basePath` (validado en logs LiteLLM admin).
- [ ] Langfuse Cloud Hobby recibe traces de TODAS las llamadas LLM (LangChain + 5 call sites SDK directos).
- [ ] Masking PII validado: ningún DNI / teléfono / email aparece en traces Langfuse (test con lead sintético).
- [ ] `chat_messages.metadata.token_usage` poblado para nuevos mensajes (WhatsApp, Widget, Rescue, FactExtractor, AIAnalysis).
- [ ] Budget cap de prueba activado para 1 tenant: al superar 0.10 USD se devuelve 429 / `BudgetExceeded`.
- [ ] Ramo de emergencia: si LiteLLM Proxy está down, los call sites caen a SDK directo y el flujo no se interrumpe (test forzando timeout).
- [ ] Dashboard Langfuse muestra coste por tenant + modelo + día sin código custom.
- [ ] `npm run typecheck` + `lint` + `build` → 0 errores.
- [ ] `CHANGELOG.md` con entrada `## [v0.5.1]` completa.
- [ ] PR a `developer` con bump `v0.5.1`.
- [ ] ADR-024 promovido a `Accepted` con notas de implementación.

## Tracking de tiempos

Logs en `plans/logs/sprint-costes-llm/C-XX.log.md` (misma estructura Sprints 1/2/3).
Tabla de tracking `⏱ Push` y `⏱ Cierre` en RoadMap.md sección Fase 4.5.

## Riesgos top-5

| Riesgo                                                                                               | Prob  | Impacto | Mitigación                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single Point of Failure LiteLLM Proxy** — si el contenedor cae, todos los agentes fallan           | Media | Alto    | Health-check Dokploy + ramo de emergencia en código: detector de proxy down + fallback a SDK directo del provider. ~2h de robustez incluidos en Ph1         |
| **PII leak en Langfuse Cloud** — DNI/teléfonos/emails en transcripts Retell/Ultravox enviados a SaaS | Alta  | Alto    | Masking obligatorio client-side + server-side desde día 1. Tests sintéticos con lead `00000000-X` antes de exponer producción. DPA con Langfuse Inc.        |
| **Multi-tenant Langfuse no nativo** — un Project por tenant no escala con N academias                | Media | Medio   | Usar 1 Project por entorno + `tag` + `metadata.tenant_id`. Filtrado server-side via API REST cuando se necesite vista per-tenant en Langfuse UI             |
| **Curva de aprendizaje LiteLLM + Langfuse** — el equipo no las ha usado antes                        | Media | Bajo    | 2-3h de familiarización incluidas en Ph1+Ph2. Docs oficiales + runbook local en `plans/260522-1430-.../runbook.md` (a crear en Ph1)                         |
| **Volumen real supera Cloud Hobby free tier (50k units/mes)**                                        | Baja  | Medio   | Monitorear el dashboard "Usage" de Langfuse semana 1 post-deploy. Plan B: migración a self-hosted Dokploy (~10-20€/mes), exportable, sin pérdida histórica. |

## Orden fijo en el roadmap

**Decisión clienta 22-05-2026 (tarde):** este sprint va JUSTO DESPUÉS de Sprint 4 (Google Sheets `v0.5.0`), antes de Sprint 5 (Salesforce `v0.6.0`). Inicio Lun 24-08-2026 09:00, fin estimado Jue 27-08-2026 19:00.

## Referencias

- ADR-024 (Draft): [`docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md`](../../docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md)
- Reporte consultivo 28-05-2026: [`plans/visuals/consultivo-stack-evaluacion-280526.md`](../visuals/consultivo-stack-evaluacion-280526.md)
- Auditoría V2 bloque 4.0: [`docs/audit2/index.html`](../../docs/audit2/index.html) §BLOQUE 4
- RoadMap: [`plans/RoadMap.md`](../RoadMap.md) §Fase 4.5
- LiteLLM Proxy docs: <https://docs.litellm.ai/docs/simple_proxy>
- Langfuse docs: <https://langfuse.com/>
- Researcher observabilidad: `plans/reports/researcher-observability-d-20260520.md` §4 (Dashboard costes)
- DA-4 audit: `docs/audit/deep/DA-4-llm-voice-deep.md` — token_usage no persistido (F-DA-4)
- Informe Renzo: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf` §3 ⚠️ (widget mismo bug que WhatsApp)

---

## Histórico: plan custom in-house descartado 28-05-2026

Entre el 22-05-2026 y el 28-05-2026 este sprint estuvo planificado con una arquitectura custom in-house, que se descartó al evaluar el stack ampliado (reporte consultivo `plans/visuals/consultivo-stack-evaluacion-280526.md`). Se conserva este resumen como audit trail.

### Arquitectura descartada

| Tarea original        | Descripción                                                                                                                                                                                                                      | Estim. nominal |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **C-01 (descartada)** | Tabla `llm_usage_logs` custom con RLS multi-tenant + LangChain `CostTrackingCallback` + helper `recordLlmUsage()` + constante `src/lib/llm-pricing.ts` con precios mayo 2026.                                                    | 5-7h           |
| **C-02 (descartada)** | Dashboard de costes LLM custom con Recharts (admin global + vista tenant) sobre la tabla `llm_usage_logs`.                                                                                                                       | 16-22h         |
| **C-03 (preservada)** | Persistir `completion.usage` en `chat_messages.metadata` para los 5 call sites OpenAI directos. Se mantiene en Ph3 — Langfuse cubre vista por llamada LLM, `chat_messages.metadata.token_usage` cubre vista por mensaje (Inbox). | 2h             |

### Razones del descarte

1. **Mismo esfuerzo, menos capacidades** — el plan custom cubría solo cost tracking + dashboard. La propuesta LiteLLM + Langfuse cubre tracing span-level + evals + prompt versioning + fallback runtime + virtual keys + replay, dentro de la misma ventana de calendario.
2. **Reinventar la rueda** — tanto LiteLLM como Langfuse son MIT, mantenidos por upstream activos (BerriAI YC, Langfuse YC W23), production-ready (Khan Academy, Twilio, Samsara usan Langfuse).
3. **Vendor lock duro inexistente** — ambos exportables, self-hostables, sin riesgo de captura.

### Documentos relacionados (no borrar)

- ADR-024 contiene tabla completa de "Alternativas rechazadas" incluyendo este plan custom.
- Las phase files `phase-01-litellm-proxy-setup.md` y `phase-02-langfuse-integration.md` reemplazan a las antiguas `phase-01-tabla-llm-usage-y-tracker.md` y `phase-02-dashboard-costes-llm.md` (los nombres antiguos se renombran in-situ al actualizar; no se conservan ficheros separados con sufijo DESCARTADO para mantener el path stable).
