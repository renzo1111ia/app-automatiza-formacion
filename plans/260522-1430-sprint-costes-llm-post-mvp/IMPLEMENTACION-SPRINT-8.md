# Implementación Sprint 8 — Costes-LLM (v0.8.0)

> Este sprint ejecuta el plan SP-5B (este directorio) **renumerado a Sprint 8** y
> con alcance **re-scopeado por un análisis red-team** (13-06-2026). El plan
> original de 4 fases sigue siendo la referencia; aquí se documenta lo realmente
> implementado y las desviaciones.
>
> Rama: `feature/sprint-08-costes-llm` · ADR: [ADR-024](../../docs/adr/ADR-024-llm-observability-gateway-litellm-langfuse.md) (Accepted).

## Veredicto red-team → re-scope

El objetivo real del sprint es **costes** (audit F-DA-4: `token_usage` no se persistía).
El red-team demostró que el alcance "completo" original era inviable/peligroso
(no hay LangChain en la ruta caliente — son 7+ call sites OpenAI directos; el
fallback descartaba tool calls; LiteLLM corría como superuser sobre el Postgres
de prod). Se re-scopeó a **mínimo seguro de alto valor**.

## Lo implementado

| Fase | Contenido | Commit | Estado |
|------|-----------|--------|--------|
| **Pre** | Hardening andamiaje: defaults inseguros, fallback con tools, imagen v1.85.5, Postgres aislado | `20847c1` | 🟢 |
| **Phase 01** | `token_usage` real en `chat_messages` (WhatsApp multi-llamada + widget) | `7a1c7bc` | 🟢 |
| **Phase 02** | LiteLLM Proxy aislado + `getLLMClient()` routing async (fact-extractor/ai-analysis/ai-rescue) + flag caos | `7a1c7bc` | 🟢 código · 🟡 deploy VPS diferido |
| **Phase 03** | Langfuse metadata-only (sin PII) en los 3 call sites async | `f82e792` | 🟢 |
| **Phase 04** | CLOSE-1 (typecheck/lint/build verdes, 12 tests propios) + CLOSE-1.5 (security delta OWASP, 0 críticos) | — | 🟢 |

## Desviaciones vs plan original

- **Phase 01**: el plan asumía 5-6 call sites; la realidad verificada es **2**
  (WhatsApp + widget) — el resto (ai-rescue/ai-analysis/fact-extractor/simulator)
  NO insertan en `chat_messages`, su coste se cubre por LiteLLM SpendLogs.
- **Phase 02**: routing vía `baseURL` del SDK (preserva tools/response_format),
  NO reescritura con `proxyChatCompletion`/fetch. Solo call sites async.
- **Phase 03**: SOLO metadata, NO payload (PII de leads). Se usa `langfuse@3.x`
  ya instalado (NO se migra a `@langfuse/node` v4 + OTel NodeSDK — YAGNI).

## Bug real encontrado y corregido en local

Al levantar el contenedor `v1.85.5` en local se descubrió que el formato
`fallbacks` del `config.yaml` (lista-de-listas, de v1.41) **rompe el arranque**
en v1.85. Corregido a lista-de-dicts. Sin esta validación local, el deploy en
VPS habría fallado.

## Validación E2E local del proxy

- Contenedor `ghcr.io/berriai/litellm:v1.85.5` + Postgres propio levantado en local.
- Completion real a través del proxy: `content: "OK"`, `usage: {12,1,13}`.
- `LiteLLM_SpendLogs` persistió el spend (`2.4e-06 USD`) → fuente canónica de coste.

## Diferido a sprint posterior

Migración ruta caliente WhatsApp/embeddings al proxy · virtual keys per-tenant ·
budget enforce (Sprint 8: alert-only) · Langfuse con payload PII (requiere
self-host + masking validado) · prompt management · evals · **deploy del stack
LiteLLM en Dokploy VPS** (pre-deploy).

## Pendiente de ratificación Bea

- Langfuse producción: self-host en Dokploy cuando se quiera tracing con PII real.
- Budget caps: activar enforce tras observar consumo real ~1 semana.
