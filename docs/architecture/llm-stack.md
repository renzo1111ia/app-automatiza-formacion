# LLM Stack — Arquitectura

> Documento generado en auditoría Fase 3 (2026-05-18).
> Fuente: análisis estático de código. No refleja configuración de BD de producción.

---

## 1. Providers y dependencias

| Provider | SDK / Librería | Versión | Rol en el sistema |
|----------|---------------|---------|------------------|
| **OpenAI** | `openai` (directo) | ^4.x | Proveedor dominante. WhatsApp AI, extracción de hechos, análisis de transcripciones, recordatorios, widget |
| **OpenAI** | `@langchain/openai` | ^1.4.1 | Abstracción multi-provider (AgentFactory). No usado en ruta caliente |
| **Anthropic** | `@langchain/anthropic` | ^1.3.26 | Disponible en AgentFactory (`CLAUDE`/`ANTHROPIC`) — no activo en flujos de producción observados |
| **Google** | `@langchain/google-genai` | ^2.1.26 | Disponible en AgentFactory (`GEMINI`) — no activo en flujos de producción observados |
| **LangChain** | `langchain` | ^1.2.39 | PromptTemplate + StructuredOutputParser en `QualificationProcessor` |
| **Retell** | `retell-sdk` | ^5.12.0 | SDK oficial para voz. Gestiona el LLM de voz internamente |
| **Ultravox** | REST custom (`fetch`) | — | Alternativa de voz via Twilio. Sin SDK oficial |
| **AWS** | `@aws-sdk/client-s3` | — | Solo para MinIO (almacenamiento). AWS Bedrock NO está integrado |

---

## 2. Flujos de IA por canal

### 2.1 Canal WhatsApp (ruta caliente)

```
Mensaje entrante (WhatsApp webhook)
    → WhatsAppWebhookProcessor (deduplicación)
    → BullMQ queue
    → WhatsAppAIProcessor.generateAIWhatsAppResponse()
        ├── Supabase: leer lead, ai_agent_variants, tenants, programas [paralelo]
        ├── ChatMemoryService.getRecentContext() → últimas 10 mensajes de chat_messages
        ├── ChatSummaryService.getSummary() → resumen consolidado de chat_summaries
        ├── OpenAI embeddings (text-embedding-3-small) + KnowledgeBaseService.search() → RAG PGVector
        ├── AppointmentService.getLeadAppointments()
        ├── Build system prompt: timezoneContext + prompt_text (de ai_agent_variants) + variables + RAG + historial
        ├── openai.chat.completions.create() [gpt-4o o gpt-4o-mini]
        │   tools: book_appointment, cancel_appointment, reschedule_appointment, check_availability
        ├── [Si tool_calls] → AppointmentService → segunda llamada OpenAI (max 2 rondas)
        ├── WhatsApp send + guardar en chat_messages
        └── FactExtractionService.extractFromDialogue() [fire-and-forget]
            └── OpenAI (gpt-4o-mini) → JSON de variables → saveToLeadMetadata() → CRM_SYNC
```

**Modelo usado**: Configurable vía `ai_agent_variants.model_name`. Fallback a `gpt-4o`. El procesador corrige alias obsoletos (`gpt-4.1` → `gpt-4o`).

**API Key**: Se lee de `ai_agent_variants.api_key` (BD). Fallback a env `OPENAI_API_KEY`.

### 2.2 Canal Voz — Retell

```
Orquestador decide llamar
    → orchestrator.initiateVoiceCall()
        ├── Leer voice_agent_variants (prompt, model, api_key)
        ├── Construir dynamicVariables (user_name, user_phone, master_name, course_info...)
        └── RetellBridge.createCall(to, agentId, from, metadata, dynamicVariables, config)
            [Retell gestiona el LLM de voz internamente]

Llamada termina
    → Retell POST /api/webhooks/retell (call_analyzed / call_ended)
        ├── Guardar en tabla llamadas
        ├── PostAnalysisService.processInteraction() [fire-and-forget]
        │   ├── analyzeConversation() → OpenAI gpt-4o-mini → ConversationAnalysis JSON
        │   ├── Upsert lead_cualificacion
        │   ├── FactExtractionService.extractFromDialogue() → variables metadata
        │   └── CRMFactory.getProvider().updateLead()
        └── Guardar en chat_messages como SYSTEM_LOG

Tool calls en tiempo real
    → Retell POST /api/webhooks/retell/tools
        → switch(toolName): book_appointment | cancel_appointment | reschedule_appointment | check_availability | get_lead_info
```

### 2.3 Canal Voz — Ultravox

```
Orquestador detecta provider = 'ULTRAVOX'
    → UltravoxBridge.createAgentCall(agentId, { templateContext: dynamicVariables, medium: twilio })
    → TelephonyFactory.getProvider().triggerCall({ to, from, joinUrl })

[SIN WEBHOOK POST-LLAMADA — gap conocido]
Transcripción solo recuperable via UltravoxBridge.getCallTranscript() bajo demanda.
```

### 2.4 Análisis profundo post-llamada (QualificationProcessor)

```
enqueueQualificationAnalysis (desde FactExtractionService o PostAnalysisService)
    → QualificationProcessor.process()
        ├── getContextualRules(): course info + ai_agent_variants (con A/B weighting)
        ├── createLLM(provider, modelName, 0) [ROTO — llm-factory no existe]
        └── analyzeTranscript(): LangChain PromptTemplate + StructuredOutputParser (Zod)
```

**Estado actual**: Este flujo está efectivamente deshabilitado en producción porque `llm-factory.ts` no existe.

### 2.5 Rescue / Re-engagement

```
RescueWorker (cron periódico)
    → Leads inactivos con inactivity_enabled = true
    ├── Si inactivity_ai_enabled = false: mensaje estático de BD
    └── Si inactivity_ai_enabled = true:
        → AIRescueService.generateSmartNudge()
            → OpenAI gpt-4o, max_tokens=150
            → Mensaje personalizado usando historial de chat_summaries
        → WhatsApp send
```

---

## 3. Abstracción multi-provider (AgentFactory / LangChain)

```typescript
// src/lib/core/multi-agent.ts
AgentFactory.createModel(config: AgentConfig): BaseChatModel
    OPENAI   → new ChatOpenAI({ openAIApiKey, modelName, temperature })
    CLAUDE   → new ChatAnthropic({ anthropicApiKey, modelName, temperature })
    ANTHROPIC→ (alias de CLAUDE)
    GEMINI   → new ChatGoogleGenerativeAI({ apiKey, model, temperature })
```

Esta capa existe en código pero **no está conectada a la ruta caliente de WhatsApp**. La ruta caliente usa el SDK `openai` directamente. La abstracción solo la usa `QualificationProcessor` (que está roto).

---

## 4. Gestión de prompts

Los prompts del agente Virginia no están hardcodeados en el código fuente principal. El flujo es:

1. Operador carga el prompt en `ai_agent_variants.prompt_text` vía el dashboard.
2. `WhatsAppAIProcessor` lee `prompt_text` de BD en cada request.
3. El procesador reemplaza variables `{{nombre}}`, `{{pais}}`, etc. con regex tolerante a espacios y mayúsculas.
4. Prepende `timezoneContext` (reglas de zona horaria, hardcodeadas en código) al inicio del prompt.

**Prompts hardcodeados en código** (no en BD):
- `ai-analysis.ts`: prompt de análisis de conversación para cualificación post-llamada.
- `fact-extractor.ts`: prompt del extractor de hechos.
- `ai-rescue.ts`: prompt de re-engagement.
- `cron/appointments/reminders`: prompt de recordatorios en modo AI.
- `QualificationProcessor`: prompt LangChain de análisis profundo.

---

## 5. RAG (Retrieval-Augmented Generation)

| Componente | Implementación |
|-----------|----------------|
| Vector store | PGVector en Supabase (tabla `knowledge_base_embeddings`) |
| Embedding model | `text-embedding-3-small` (OpenAI) |
| RPC de búsqueda | `supabase.rpc('match_knowledge_base', { query_embedding, match_threshold: 0.4, match_count: 3 })` |
| Filtrado por KB | `p_knowledge_base_ids` — array de IDs de bases de conocimiento del agente |
| Integración | Solo en `WhatsAppAIProcessor`. Las llamadas de voz Retell usan el contexto de curso de BD, no RAG dinámico |

---

## 6. Gestión de costes LLM

### Lo implementado

- Página `/dashboard/costs` estima costes leyendo `chat_messages.metadata.token_usage`.
- Precios hardcodeados: `$0.005/1K prompt_tokens`, `$0.015/1K completion_tokens`.
- Coste de llamadas: `$0.15/min` (estimación fija).

### Gaps

- **Token usage no se persiste en servidor**: `WhatsAppAIProcessor` no guarda `completion.usage` en BD. Los datos son nulos en producción y el dashboard aplica un fallback fijo de $0.002/mensaje.
- **Sin alertas de umbral de coste**.
- **Sin rate limiting ni retry para 429 de OpenAI**.
- **Precios hardcodeados desactualizados** (gpt-4o-mini es significativamente más barato que los precios reflejados).

---

## 7. Voz: Retell vs Ultravox

| Aspecto | Retell | Ultravox |
|---------|--------|----------|
| SDK | `retell-sdk` oficial | REST custom vía `fetch` |
| Webhook post-llamada | Implementado (`/api/webhooks/retell`) | **No existe** |
| Tool calls en tiempo real | Implementado (`/api/webhooks/retell/tools`) | No aplicable (sin webhook) |
| Análisis post-llamada | Sí (vía PostAnalysisService) | No (gap) |
| Grabación / transcripción | Retell la envía en webhook | Recuperable bajo demanda vía `UltravoxBridge.getCallTranscript()` |
| Fallback entre proveedores | No — mutuamente excluyentes por config tenant | No |

---

## 8. Routing y selección de modelo

```
ai_agent_variants.model_provider: 'OPENAI' | 'ANTHROPIC' | 'GEMINI'  (campo BD)
ai_agent_variants.model_name: string  (ej: "gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet-20240620")
ai_agent_variants.api_key: string  (key del proveedor, guardada en BD)
ai_agent_variants.is_active: boolean
ai_agent_variants.is_variant_b: boolean  (para A/B testing)
ai_agent_variants.weight: number  (peso para A/B en QualificationProcessor)
```

`WhatsAppAIProcessor` selecciona variante con `is_active=true`, ordena por `is_variant_b ASC` (Variant A primero) y luego `updated_at DESC`. No usa `model_provider` — solo llama a OpenAI independientemente del proveedor configurado.

`QualificationProcessor` sí respeta `model_provider` (usa `createLLM(provider, model, 0)`), pero el módulo está roto.

---

## 9. Diagrama de dependencias

```
WhatsApp Message
    └── WhatsAppAIProcessor
            ├── openai SDK (gpt-4o / gpt-4o-mini)
            ├── KnowledgeBaseService ──── PGVector (Supabase)
            ├── ChatMemoryService ──────── chat_messages (Supabase)
            ├── ChatSummaryService ─────── chat_summaries (Supabase)
            ├── AppointmentService ─────── appointments (Supabase)
            └── FactExtractionService ──── openai SDK (gpt-4o-mini)
                    └── evaluateLeadQualification (qualifier.ts — determinístico)

Retell Call
    └── RetellBridge ─────────────── retell-sdk → Retell API
    └── Webhook → PostAnalysisService
            ├── analyzeConversation ──── openai SDK (gpt-4o-mini)
            └── FactExtractionService

Ultravox Call
    └── UltravoxBridge ────────────── fetch → Ultravox API
    └── TelephonyFactory (Twilio)
    [SIN PostAnalysisService]

Inactivity Rescue
    └── AIRescueService ──────────── openai SDK (gpt-4o)

Deep Qualification [ROTO]
    └── QualificationProcessor
            └── createLLM [MISSING FILE]
```

---

## 10. Consideraciones de seguridad

- API keys de OpenAI almacenadas en columna `ai_agent_variants.api_key` (Supabase). Sin cifrado a nivel de aplicación.
- API key de Retell leída de `tenants.config.retell.api_key` (JSONB). Mismo riesgo.
- No hay validación de firma de webhook Retell — cualquier POST a `/api/webhooks/retell` es aceptado sin verificar que venga de Retell.
- Prompts de agente visibles para cualquier usuario con acceso a la tabla `ai_agent_variants`.

---

*Última actualización: 2026-05-18 — Auditoría Fase 3*
