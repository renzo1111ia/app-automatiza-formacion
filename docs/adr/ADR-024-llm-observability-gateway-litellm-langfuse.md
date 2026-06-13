# ADR-024 — LLM Observability & Gateway: LiteLLM Proxy + Langfuse

- **Status:** Accepted (13-06-2026 · implementado en Sprint 8 con alcance re-scopeado por red-team. Pendiente ratificación Bea de las cuestiones abiertas — ver §Cuestiones abiertas)
- **Date:** 2026-05-28 (Draft) · 2026-06-13 (Accepted)
- **Sprint:** Sprint 8 — Costes-LLM (`v0.8.0`). Sustituye a la numeración original SP-5B/`v0.5.1`.
- **Deciders:** Javi HP (Auditor del proyecto + dev orquestador) · Bea (clienta, ratificación pendiente de cuestiones abiertas)

## Contexto

El Sprint Costes-LLM (`SP-5B`) estaba planificado para resolver tres carencias del MVP `v0.4.0`:

1. **No hay tracking de costes LLM por tenant/agente/modelo** (audit DA-4-005 + F-DA-4).
2. **No hay observabilidad de cadenas LLM** (un fallo en agente conversacional Retell/Ultravox/WhatsApp solo deja un breadcrumb Sentry, sin trace de los steps intermedios).
3. **`completion.usage` no se persiste** en `chat_messages.metadata` para los 5 call sites OpenAI directos (WhatsApp, RescueWorker, widget, FactExtractor, AIAnalysis).

El plan original (22-05-2026, definido por Javi HP) era **construir solución custom in-house**: tabla `llm_usage_logs` + LangChain `CostTrackingCallback` + helper `recordLlmUsage()` + dashboard Recharts admin/tenant. Estimado: 23-31h dev + 5h 30min cierre.

Al evaluar el stack ampliado (28-05-2026, reporte consultivo `plans/visuals/consultivo-stack-evaluacion-280526.md`), se identificó que la **propuesta open-source LiteLLM Proxy + Langfuse** cubre los mismos 3 objetivos del sprint **más capacidades adicionales** (tracing span-level, prompt management versionado, evals LLM-as-judge, fallback runtime cross-provider, virtual keys multi-tenant con budget caps, replay de conversaciones) **dentro de la misma ventana de calendario** (Lun 24-08 → Jue 27-08-2026).

## Decisión

Sustituir el plan custom in-house del Sprint Costes-LLM por una arquitectura híbrida:

### 1. LiteLLM Proxy self-hosted en Dokploy

- **Modalidad**: LiteLLM **Proxy Server** (no SDK — no existe SDK Node.js oficial).
- **Despliegue**: contenedor Docker en Dokploy panel del VPS Hetzner, junto a Supabase y Next.js (red interna).
- **Postgres**: schema `litellm_proxy` dentro del cluster Supabase existente (NO mezclar con tablas multi-tenant del app).
- **Versión pineada**: `ghcr.io/berriai/litellm:main-stable` con tag SemVer concreto (no auto-update).
- **Configuración**: YAML declarativo con:
  - `model_list` cubriendo Anthropic Claude (Opus/Sonnet/Haiku), OpenAI (GPT-4o/4o-mini/o1), Google Gemini (Flash/Pro).
  - `fallbacks: [["claude-3-5-sonnet", "gpt-4o", "gemini-2.0-flash"]]` para resiliencia automática.
  - Virtual keys + budgets por tenant: `tenant_id → Organization`, agente/feature → `User`, runtime → `Key`.
  - Cache Redis para respuestas idempotentes (extracción, resúmenes batch).
- **Acceso desde Next.js**: LangChain JS apuntando con `basePath` al proxy interno (`http://litellm-proxy:4000`). Cambio de config, no de lógica.
- **Ramo de emergencia**: detector de proxy caído + fallback a SDK directo del provider, para evitar Single Point of Failure.

### 2. Langfuse Cloud Hobby (con migración condicional a self-hosted)

- **Modalidad inicial**: Langfuse Cloud Hobby (free, 50k units/mes, 30 días retención, 2 users). Volumen esperado de academia mediana (2-5k calls × 5 spans = 25k units/mes) cabe holgadamente.
- **Integración**: 1 línea por agente — `CallbackHandler` de Langfuse en `config.callbacks` de cualquier cadena LangChain `.invoke()/.stream()/.batch()`. Captura inputs, outputs, tokens, coste, latencia, retries, tool calls automáticamente.
- **Wrappers SDK directos**: para los 5 call sites OpenAI no-LangChain, decorador `@observe()` o wrapper `langfuse.openai`.
- **Multi-tenant mapping**: 1 Project Langfuse por entorno (dev/staging/prod), `tenant_id` como `tag` + `metadata` en cada trace. Filtrado server-side via API.
- **Masking PII** obligatorio desde día 1 (transcripts Retell/Ultravox traen DNI, teléfonos, emails de leads). Function client-side + regex server-side.
- **Migración a self-hosted Dokploy** condicionada a: (a) clienta exige por compliance explícita, o (b) volumen sostenido >200k units/mes.

### 3. Persistencia `completion.usage` en `chat_messages.metadata` (C-03 legacy preservada)

- La tarea C-03 original del plan custom **se mantiene**: persistir `completion.usage` en `chat_messages.metadata` para los 5 call sites OpenAI.
- Razón: complementa a Langfuse — `chat_messages.metadata.token_usage` es vista por mensaje (1:1 con Inbox), Langfuse es vista por llamada LLM (1:N en flujos con tool calls). Ambas alimentan dashboards distintos.
- No requiere backfilling de chats históricos (OpenAI no expone usage retroactivo).

### 4. Tabla `llm_usage_logs` custom — DESCARTADA

- La tabla custom y el helper `recordLlmUsage()` quedan descartados.
- Razón: LiteLLM Proxy persiste cost tracking nativo en su schema Postgres (`litellm_proxy`), y Langfuse persiste tracing/cost por trace. Duplicar en `llm_usage_logs` propio sería overengineering.
- Si en el futuro se necesita una vista agregada custom (no cubierta por Langfuse UI ni LiteLLM admin), se materializará como vista SQL sobre los schemas de ambos.

### 5. Dashboard custom Recharts — DESCARTADO

- El dashboard custom Recharts (C-02 original, 16-22h) queda descartado.
- Razón: Langfuse UI cubre nativamente las métricas planificadas (coste por tenant/agente/modelo, evolución temporal, latencias P50/P95). Acceso vía SSO admin global.
- Si la clienta solicita una vista embebida dentro de `/admin/costs` del dashboard propio, se hará como iframe seguro a una dashboard pública de Langfuse o como llamada a su API REST (decisión a tomar en SP-5B si surge el requisito).

## Alternativas rechazadas

| Alternativa                                                     | Razón rechazo                                                                                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan custom in-house original** (tabla + tracker + Recharts)  | Mismo esfuerzo nominal (~28-37h), cubre solo 30% de capacidades. Construye lo que ya existe open-source maduro. No habilita evals ni prompt versioning. Discriminado por ROI. |
| Solo LiteLLM (sin Langfuse)                                     | Cubre cost tracking + routing pero pierde tracing span-level, evals y prompt versioning. Insuficiente para el objetivo de SP-5B.                                              |
| Solo Langfuse (sin LiteLLM)                                     | Cubre observabilidad pero pierde fallback runtime y virtual keys per tenant. El proyecto necesita ambos.                                                                      |
| Langfuse self-hosted desde día 1                                | Setup +8-12h (Web + Worker + Postgres separado + ClickHouse + Redis). Volumen esperado cabe en Cloud Hobby gratis. Migración futura es exportable (no vendor lock duro).      |
| LangSmith (LangChain)                                           | Cloud-only, sin self-host real. Vendor lock con LangChain Inc. PII en payloads va a SaaS USA. Descartado.                                                                     |
| Helicone Gateway                                                | Adquirido por Mintlify en marzo 2026, entrado en "maintenance mode". No adoptar como nueva tecnología.                                                                        |
| Portkey / Bifrost                                               | Menos maduros que LiteLLM en multi-tenant + virtual keys.                                                                                                                     |
| AWS Bedrock + CloudWatch                                        | AWS descartado del stack por orden del usuario (26-05-2026).                                                                                                                  |
| Mantener `chat_messages.metadata.token_usage` como única fuente | Pierde 100% de las capacidades de observabilidad. Solo cubre vista por mensaje, no por llamada LLM ni por agente.                                                             |

## Consecuencias

### Positivas

- **Misma ventana de calendario** (Lun 24-08 → Jue 27-08-2026), capacidades multiplicadas: tracing + evals + prompt mgmt + fallback + virtual keys + cost tracking + replay.
- **Coste runtime bajo**: ~5-10 €/mes infra LiteLLM Proxy en Dokploy + 0 € Langfuse Cloud Hobby (cabe en free tier sin overage).
- **Fallback automático cross-provider** mitiga riesgo histórico de rate-limit en horas pico (10:00 / 18:00 ES).
- **Budget caps por academia** sin código custom — virtual keys de LiteLLM lo proveen nativamente.
- **A/B prompts en producción** sin redeploy (Langfuse prompt management).
- **Cero vendor lock duro**: LiteLLM MIT, Langfuse MIT, ambos exportables. Migración futura factible.
- **Open-source mantenidos por upstream** activos (LiteLLM releases semanales BerriAI/YC, Langfuse releases mensuales YC W23).

### Negativas / costes

- **Single Point of Failure** del LiteLLM Proxy: si el proxy cae, todos los agentes fallan. Mitigado con health-check + ramo de emergencia a SDK directo (~2h de robustez incluidas en el sprint).
- **Otro servicio que mantener en Dokploy** (LiteLLM Proxy): suma a Supabase + Next.js + Sentry + Workers BullMQ. Operativamente: 1 contenedor más en el panel.
- **Latencia añadida** ~1-2ms intra-VPS por hop extra. Despreciable.
- **Multi-tenant Langfuse no es nativo** (1 Project por tenant no escala con N academias). Se modela vía `tags` + `metadata` con filtrado server-side. Aceptable para el volumen esperado pero limita RBAC granular a feature Enterprise de pago si la clienta lo exige.
- **PII en Langfuse Cloud**: transcripts pasan por servidores Langfuse (EU). Mitigación: masking client-side + server-side desde día 1, DPA con Langfuse Inc. Si la clienta veta SaaS para PII de leads, migrar a self-hosted antes de exponer producción real.
- **Curva de aprendizaje**: el equipo (Javi HP + Renzo) no ha usado LiteLLM ni Langfuse antes. Estimación realista incluye 2-3h de familiarización inicial.

### Acciones a ejecutar en SP-5B (cuando arranque 24-08-2026)

1. **Promover este ADR de Draft → Accepted** tras revisión Bea (clienta).
2. Ejecutar las 4 phase files actualizadas del sprint:
   - Phase 01: Setup LiteLLM Proxy en Dokploy + config YAML + virtual keys per tenant.
   - Phase 02: Integración Langfuse Cloud Hobby + callback handlers LangChain + wrappers SDK directos + masking PII.
   - Phase 03: Persistir `completion.usage` en `chat_messages.metadata` para los 5 call sites (legacy C-03 preservada).
   - Phase 04: Cierre estándar (SP-5B-CLOSE-1..5).
3. Actualizar RoadMap.md `Fase 4.5` reflejando la nueva arquitectura.
4. Si Bea aprueba, anunciar a Renzo en el hand-off de Sprint 4 Sheets.

## Referencias

- Reporte consultivo completo: [`plans/visuals/consultivo-stack-evaluacion-280526.md`](../../plans/visuals/consultivo-stack-evaluacion-280526.md)
- Bloque 4.0 auditoría V2: [`docs/audit2/index.html`](../audit2/index.html) §BLOQUE 4
- RoadMap §Fase 4.5: [`plans/RoadMap.md`](../../plans/RoadMap.md)
- Plan SP-5B (in-situ, actualizado): [`plans/260522-1430-sprint-costes-llm-post-mvp/plan.md`](../../plans/260522-1430-sprint-costes-llm-post-mvp/plan.md)
- LiteLLM Proxy docs: <https://docs.litellm.ai/docs/simple_proxy>
- LiteLLM multi-tenant: <https://docs.litellm.ai/docs/proxy/multi_tenant_architecture>
- Langfuse self-host: <https://langfuse.com/self-hosting>
- Langfuse PII masking: <https://langfuse.com/docs/observability/features/masking>
- LangChain callback handler: <https://langfuse.com/guides/cookbook/integration_langchain>
- Sentry + Langfuse stack (proyecto ya tiene Sentry de Sprint 3): complementarios, no se solapan (Sentry = errores app, Langfuse = traces LLM).

## Notas de implementación (Sprint 8 — 13-06-2026)

El sprint se ejecutó tras un análisis adversarial (red-team) que **re-scopeó** el alcance original por riesgo. Cambios respecto al plan inicial:

### Re-scope por red-team

1. **Alcance mínimo seguro, lo peligroso diferido.** El objetivo real del sprint (costes) se entregó sin introducir el SPOF del gateway en la ruta caliente:
   - **Phase 01** — persistencia de `token_usage` en `chat_messages` (cierra el gap del dashboard `/dashboard/costs`, que caía a un fallback fijo `$0.002/msg`). WhatsApp suma las hasta 3 llamadas del turno (tool calls).
   - **Phase 02** — LiteLLM Proxy enruta SOLO call sites async no-críticos (`fact-extractor`, `ai-analysis`, `ai-rescue`) vía helper `getLLMClient()` (baseURL del SDK OpenAI, preserva `tools`/`response_format`). La ruta caliente (WhatsApp/widget) NO se migró.
   - **Phase 03** — Langfuse recibe SOLO metadata (tokens/modelo/latencia/tenant), NUNCA inputs/outputs (PII de leads).
2. **DIFERIDO a sprint posterior:** migración de WhatsApp/embeddings al proxy, virtual keys per-tenant, budget enforce (en Sprint 8 caps en modo alert-only), Langfuse con payload PII (requiere self-host + masking validado), prompt management, evals.

### Defectos del andamiaje previo corregidos

- **Versión LiteLLM**: la imagen estaba en `main-v1.41.0-stable` (2024) y el ADR mencionaba `main-stable`. **Pineada a `ghcr.io/berriai/litellm:v1.85.5`** (estable 11-06-2026, SemVer plano, firmada cosign).
- **Formato `fallbacks`**: el `config.yaml` usaba el formato lista-de-listas de v1.41, que **rompe el arranque** en v1.85. Corregido a lista-de-dicts. Validado levantando el contenedor v1.85.5 en local (completion real + `LiteLLM_SpendLogs` persistido).
- **Postgres**: LiteLLM apuntaba al cluster Supabase de prod como superuser. **Ahora usa su propio Postgres dedicado** (`litellm-db`), aislado, sin RLS cross-tenant ni riesgo de pool exhaustion.
- **Vars unificadas**: el código usa `LITELLM_BASE_URL`/`LITELLM_API_KEY` (no `LITELLM_PROXY_URL`/`LITELLM_MASTER_KEY`). Eliminado el default inseguro `sk-1234`/`localhost:4000` → fail-safe al SDK directo.
- **Fallback de emergencia**: ahora propaga `tools`/`tool_choice`/`response_format`/`messages` y mapea por provider (antes descartaba tool calls y forzaba `gpt-4o-mini` — habría roto el agendado de WhatsApp en una caída).
- **Healthcheck**: añadido `start_period: 60s` (evita crash-loop durante las migraciones de arranque).

### Cuestiones abiertas (ratificación Bea)

- **Langfuse producción**: en Sprint 8 NO se envía payload PII. Para tracing con payload real → **self-hosted en Dokploy** (sin transferencia internacional, sin DPA), nunca Cloud con datos de leads. Decisión de Bea sobre cuándo.
- **Budget caps**: alert-only en Sprint 8; activar enforce tras observar consumo real ~1 semana.

### Decisión nº4/nº5 originales — confirmadas

La tabla `llm_usage_logs` custom y el dashboard Recharts custom siguen DESCARTADOS. `LiteLLM_SpendLogs` es la **fuente canónica de coste €** (validada en local); `chat_messages.metadata.token_usage` es la vista aproximada por mensaje (solo tokens, sin €).

## Status update history

- **2026-05-28** — Draft creado por Javi HP. Pendiente revisión Bea (clienta) antes de arranque SP-5B en agosto.
- **2026-06-13** — Promovido a Accepted e implementado en Sprint 8 (`v0.8.0`) con alcance re-scopeado por red-team. Renumera SP-5B → Sprint 8. Pendiente ratificación Bea de cuestiones abiertas (Langfuse self-host + budget enforce).
