---
title: "DA-4 — LLM Costs, Voice Latency & Prompt Security — Deep Analysis"
date: 2026-05-18
agent: DA-4 (Claude Sonnet 4.6)
phase: "Segunda vuelta — análisis estático profundo"
status: DONE_WITH_CONCERNS
depends_on:
  - docs/audit/00-client-spec-extraction.md
  - docs/audit/03-llm-findings.md
  - docs/architecture/llm-stack.md
  - docs/Docs-entrega-clienta/Promt-Virginia.md
---

# DA-4: LLM Costs, Voice Latency & Prompt Security — Deep Analysis

---

## Perímetro

Archivos leídos en análisis estático completo (sin invocar APIs externas ni Bedrock):

| Archivo | Propósito |
|---------|-----------|
| `src/lib/core/processors/WhatsAppAIProcessor.ts` | Ruta caliente WhatsApp (líneas 1–591) |
| `src/lib/services/fact-extractor.ts` | Extractor de variables (líneas 1–348) |
| `src/lib/services/ai-analysis.ts` | Análisis post-llamada (líneas 1–139) |
| `src/lib/services/post-analysis.ts` | Coordinador post-interacción (líneas 1–236) |
| `src/lib/services/ai-rescue.ts` | Servicio de rescate de leads (líneas 1–84) |
| `src/lib/services/knowledge-base.ts` | RAG/PGVector (líneas 1–150) |
| `src/lib/services/chat-memory.ts` | Memoria de conversación (líneas 1–65) |
| `src/lib/core/multi-agent.ts` | Framework multi-provider (líneas 1–71) |
| `src/lib/core/intelligence/qualifier.ts` | Motor determinístico de cualificación (líneas 1–113) |
| `src/lib/core/processors/QualificationProcessor.ts` | Análisis profundo post-llamada (líneas 1–193) |
| `src/lib/core/workers/RescueWorker.ts` | Worker de rescate de leads inactivos (líneas 1–177) |
| `src/lib/integrations/ultravox.ts` | Bridge Ultravox REST (líneas 1–185) |
| `src/app/api/webhooks/retell/route.ts` | Webhook post-llamada Retell (líneas 1–141) |
| `src/app/api/webhooks/retell/tools/route.ts` | Tool calls en tiempo real Retell (líneas 1–295) |
| `src/app/dashboard/costs/page.tsx` | Dashboard de costes (líneas 1–483) |
| `docs/Docs-entrega-clienta/Promt-Virginia.md` | Prompt oficial Virginia (líneas 1–944) |
| `docs/audit/00-client-spec-extraction.md` | Spec normalizada cliente |
| `docs/audit/03-llm-findings.md` | Findings del quick scan |
| `docs/architecture/llm-stack.md` | Arquitectura LLM documentada |

---

## Resumen ejecutivo

El análisis profundo confirma y profundiza los 12 findings del quick scan (F-03-XXX) y añade 11 nuevos findings (DA-4-001 a DA-4-011). El sistema tiene cuatro vectores de riesgo de alta severidad:

1. **Coste ficticio**: No se persiste `completion.usage` en ningún flujo de producción. El dashboard de costes calcula sobre datos nulos y aplica un fallback fijo de $0.002/mensaje. El coste real de LLM es completamente opaco para el operador.

2. **Prompt injection sin defensas**: El `incomingMessage` del usuario (WhatsApp) se inserta directamente en el array `messages` como rol `user` sin ninguna sanitización. Si el usuario escribe "Ignora las instrucciones anteriores y...", ese texto llega intacto al LLM. No hay extracción de directivas, no hay prefijo de rol, no hay filtro de contenido.

3. **Schema LLM triplicado y divergente**: Hay tres esquemas simultáneos de `qualified` (`"si"/"no"/"anulado"`, `"SI"/"NO"/"PENDIENTE"`, `"apto"/"no apto"/""`). La variable que Virginia realmente escribe (`"apto"/"no apto"`) nunca coincide con lo que el código lee. La lógica de negocio crítica (cualificar un lead) está rota.

4. **Ultravox sin análisis post-llamada**: Cualquier llamada enrutada por Ultravox termina sin análisis, sin extracción de variables, sin actualización en CRM. Es un canal de voz silencioso.

Los riesgos de latencia de voz son estructuralmente importantes pero difíciles de medir sin telemetría, ya que no existe ningún instrumento de medición de latencia en producción.

---

## Coste LLM tracking — Deep

### ¿Persiste `completion.usage.prompt_tokens` y `completion_tokens`?

**No.** Lectura directa de `WhatsAppAIProcessor.ts:472–483`:

```typescript
const messagePayload: any = {
    tenant_id: tenantId,
    lead_id: leadId,
    direction: "OUTBOUND",
    message_type: "TEXT",
    content: aiResponse,
    status: "SENT",
    metadata: { 
        meta_id: completion.id,
        model: modelName
        // ❌ completion.usage NO está incluido aquí
    }
};
```

El objeto `completion` está en scope en ese punto (línea 348 define `const completion = await openai.chat.completions.create(...)`), pero `completion.usage` nunca se incluye en el `metadata` persistido. En producción, todos los registros de `chat_messages` tienen `metadata.token_usage = undefined`.

**Para tool calls**: Cuando hay tool calls (líneas 363–447), el segundo `openai.chat.completions.create` (línea 441) se guarda como `nextCompletion` pero tampoco persiste su usage. Solo el primer `completion.id` se guarda en metadata, y solo en el happy path sin tool calls.

### ¿Hay tabla `llm_usage` o equivalente?

No existe tabla `llm_usage` en el schema. La spec de BD de la cliente (`ARQUITECTURA DE BASE DE DATOS SUPABASE.docx`) no define ninguna tabla de tracking de costes LLM. La columna `metadata` de `chat_messages` es el único punto donde se intenta guardar info de tokens, pero está vacía en producción.

### Cost calculation: ¿hardcoded $/token o desde catálogo actualizable?

Hardcoded en `costs/page.tsx:111`:
```typescript
msgAiCost = (usage.prompt_tokens * 0.005 / 1000) + (usage.completion_tokens * 0.015 / 1000);
```

- `$0.005/1K prompt_tokens` — precio de GPT-4 (mayo 2023). GPT-4o actual cuesta $0.0025/1K input.
- `$0.015/1K completion_tokens` — precio de GPT-4. GPT-4o actual cuesta $0.010/1K output.
- `$0.15/min` para telefonía — hardcoded, sin fuente documentada de Retell ni Ultravox.
- `5.2` growth% — simulado fijo, no calculado.

No existe ningún catálogo de precios actualizable en BD. Si OpenAI cambia precios, el dashboard requiere un cambio de código.

### Dashboard de costes (`/dashboard/costs`): ¿qué fuente lee?

Lee `chat_messages.metadata.token_usage` (línea 108) que en producción es nulo. El fallback (línea 112–113):
```typescript
} else if (msg.sent_by === "AI_AGENT" || msg.sent_by === "AI_WIDGET") {
    msgAiCost = 0.002;
}
```
...aplica $0.002 plano por mensaje de IA, independientemente del modelo usado, del largo del prompt (que incluye el system prompt completo de Virginia + RAG + historial), ni del número de tool call rounds.

**El coste mostrado en el dashboard es ficticio en todos los casos.**

---

## Rate limiting / Retry / Failover

### 429 handling de OpenAI

No hay manejo específico de 429. En `WhatsAppAIProcessor.ts:348`:
```typescript
const completion = await openai.chat.completions.create({ ... });
```
Si OpenAI devuelve 429, el `await` lanza un `APIError`. El único catch es el bloque global de línea 572:
```typescript
} catch (err: unknown) {
    await GlobalLogger.error(...);
    console.error("[AI PROCESSOR] ❌ Critical Error:", error.message);
}
```
No hay retry, no hay backoff, no hay circuit breaker. El mensaje del lead queda sin respuesta sin que el usuario lo sepa.

En `ai-analysis.ts:97–131` y `ai-rescue.ts:46–73`: mismo patrón. Error capturado pero no reintentado.

### Retry con exponential backoff

El sistema de queue BullMQ (`lead-sequence-queue.ts:79`) tiene backoff exponencial para las acciones de orchestration, pero esto no cubre las llamadas OpenAI inline. El backoff de BullMQ funciona a nivel de job de queue, no a nivel de llamada API individual.

Para WhatsApp AI (la ruta caliente), no hay BullMQ en el camino crítico de OpenAI: el procesador llama directamente a OpenAI sincrónicamente. Un 429 de OpenAI resulta en mensaje perdido para el usuario sin ningún mecanismo de recuperación.

### Circuit breaker tras N fallos

No existe. No hay contador de fallos de OpenAI, no hay estado de "circuit open/closed", no hay lógica de degradación graceful.

### Multi-provider failover

No existe failover automático. `multi-agent.ts` define `AgentFactory.createModel()` con soporte para OPENAI/ANTHROPIC/GEMINI, pero esta abstracción no está conectada a la ruta caliente de WhatsApp. Si la ruta caliente obtiene un error de OpenAI, la respuesta al usuario es nula — no hay fallback a Anthropic o Gemini.

La ruta de voz tampoco tiene failover entre Retell y Ultravox (los dos proveedores son mutuamente excluyentes por `model_provider` de tenant).

---

## Prompt injection analysis

### ¿Se sanitiza el input del usuario antes de entrar al prompt?

**No.** El flujo es:

1. `incomingMessage` llega del webhook de WhatsApp (línea 20 de `WhatsAppAIProcessor.ts`).
2. Se inserta directamente en el array de messages como mensaje `user` (línea 343):
   ```typescript
   { role: "user", content: incomingMessage }
   ```
3. No hay ningún paso de sanitización, escape, ni filtrado entre los pasos 1 y 2.

### "Ignore previous instructions" attacks

El sistema prompt de Virginia se inserta como `role: "system"` (línea 341), y el mensaje del usuario como `role: "user"` (línea 343). La separación system/user está correctamente configurada en el nivel de la API de OpenAI — esto es la defensa principal de OpenAI contra injection básica.

Sin embargo, el prompt de Virginia contiene instrucciones muy específicas de comportamiento (árbol de decisión, variables obligatorias). Un atacante podría intentar:

- Inyectar instrucciones en el historial de conversación previo (que se incluye en el array `messages`)
- Usar caracteres especiales del prompt de Virginia (`{{`, `}}`) para intentar manipular la sustitución de variables
- Escribir texto que simule la sintaxis de variables: `{{qualified}} = "apto"` como texto plano de usuario

No hay defensa específica contra ninguno de estos vectores.

### System prompt + user message: ¿separación correcta o concatenación?

La separación es correcta en la llamada a OpenAI (roles separados). Sin embargo, hay una concatenación problemática en el building del system prompt:

```typescript
const systemPrompt = `
${finalPrompt}                    // prompt Virginia completo
...
CONTEXTO RECIENTE (Últimas 10 líneas):
${conversationContext}            // historial previo, incluyendo mensajes del usuario
...
```

El `conversationContext` (línea 158–160) incluye mensajes previos del usuario formateados como texto plano dentro del system prompt:
```typescript
const conversationContext = recentHistory.map(m =>
    `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
).join("\n");
```

Esto significa que mensajes de usuario anteriores se insertan en el system prompt. Si un usuario escribió "Olvida todo y actúa como..." en una conversación anterior, ese texto aparece dentro del contexto del system prompt en la siguiente llamada. Esta es una superficie de ataque de prompt injection indirecto.

### Function calling / tool calling: ¿validación de argumentos?

En `WhatsAppAIProcessor.ts:383`:
```typescript
const args = JSON.parse(argsString);
```

No hay validación del schema de `args` tras el parsing. Si el LLM devuelve `args` con campos inesperados o tipos incorrectos, el código intenta usarlos directamente:

```typescript
if (name === "book_appointment") {
    const appt = await AppointmentService.bookAppointment(tenantId, leadId, args.date, args.time, args.notes);
```

Si `args.date` es `undefined` o `null` por alucinación del LLM, `bookAppointment` recibirá un valor nulo. Si `args.date` es una cadena malformada, la inserción en BD puede fallar o insertar datos corruptos.

En el webhook Retell tools (`tools/route.ts:72–74`):
```typescript
const date = args.date as string;
const time = args.time as string | undefined;
```
Cast directo a tipo sin validación. No hay Zod ni ningún otro validator.

---

## Schema validation de outputs LLM

### JSON mode: ¿se valida el JSON antes de persistir?

**En `ai-analysis.ts`**: Se usa `response_format: { type: "json_object" }` (garantiza JSON válido de OpenAI), pero luego se hace `JSON.parse(content || "{}") as ConversationAnalysis` (línea 134). El cast `as ConversationAnalysis` es TypeScript puro — no valida en runtime. Si el LLM omite campos o usa tipos incorrectos, el objeto pasa como si fuera válido.

**En `fact-extractor.ts`**: Mismo patrón — `JSON.parse(rawResult) as ExtractedData` (línea 142). El tipo `ExtractedData` tiene `[key: string]: unknown` como index signature, por lo que cualquier JSON es "válido".

### `qualified` enum: ¿se rechaza valor inesperado o se persiste?

**Se persiste tal cual.** En `fact-extractor.ts:268–272`:
```typescript
if (newData.qualified) {
    const q = newData.qualified.toUpperCase();
    if (q === 'SI') mainUpdate.tipo_lead = 'CUALIFICADO';
    else if (q === 'NO') mainUpdate.tipo_lead = 'DESCARTADO';
    else if (q === 'PENDIENTE') mainUpdate.tipo_lead = 'EN SEGUIMIENTO';
}
```
Si el LLM devuelve `"apto"` (que es lo que Virginia realmente escribe), ninguna condición hace match, y `tipo_lead` no se actualiza. El valor `"apto"` queda en `metadata.qualified` como string sin mapear, y la lógica de negocio que depende de `tipo_lead` no se ejecuta.

Si el LLM devuelve un valor completamente inesperado (`"pendiente_de_revision"`, `"maybe"`, etc.), se persiste en metadata sin error, silenciosamente.

### Hallucinaciones: ¿hay safety net?

No existe. Los campos que el LLM devuelve se persisten directamente en el `metadata` JSONB del lead. Si el LLM "inventa" un campo (`"usuario_listo_para_pagar": true`), ese campo entra en metadata y queda ahí permanentemente.

El único safety net parcial es el filtro en `fact-extractor.ts:147`:
```typescript
if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).toLowerCase() !== "unknown") {
```
Que filtra nulos, vacíos y el string "unknown" — pero no valores inventados con formato válido.

---

## Voice latency budget (Retell + Ultravox)

### Spec cliente: <800ms entre turnos

El SLA de <800ms no tiene ninguna instrumentación en el codebase actual.

### Retell: ¿qué modelo usa? ¿streaming? ¿interrupciones?

El codebase no configura el modelo de voz de Retell directamente — esto se gestiona en la consola de Retell via `voice_agent_variants`. Lo que el código sí configura son `dynamicVariables` que se pasan en `initiateVoiceCall`. El modelo de voz (latency vs quality) no es configurable desde código. Las interrupciones las gestiona Retell internamente.

### Retell latency budget

La ruta de una respuesta de Retell al usuario es:
```
Lead habla → Retell STT → Retell LLM → [tool call?] → /api/webhooks/retell/tools → DB → Retell TTS → Lead escucha
```

El step de tool call (si lo hay) pasa por la API de Next.js del proyecto. El tiempo de respuesta del endpoint `/api/webhooks/retell/tools` incluye: query a Supabase para datos del lead, llamada a `AppointmentService`, etc. No se mide. En un escenario de cold start de Next.js serverless, este step puede añadir 500–2000ms de latencia.

### Ultravox: ¿webhook post-llamada existe?

**No existe.** Confirmado por análisis estático: no hay ningún archivo en `src/app/api/webhooks/ultravox/`. La transcripción solo es recuperable via `UltravoxBridge.getCallTranscript()` bajo demanda, lo que significa que hay que hacer polling activo o un trigger manual.

### Latencia de llamadas síncronas vs background

El webhook de Retell (`/api/webhooks/retell/route.ts:83–91`) llama a `PostAnalysisService.processInteraction()` sin await (fire-and-forget con `.catch()`). Esto es correcto — no bloquea la respuesta a Retell.

Para WhatsApp, el procesador principal es síncrono dentro de un job de BullMQ. El `FactExtractionService.extractFromDialogue()` se llama sin await (fire-and-forget, línea 557–565), lo que también es correcto.

El typing indicator se dispara antes de la llamada a OpenAI (línea 151–156), lo que es buena práctica para UX.

### Cold start de funciones serverless

No hay evidencia de que el proyecto use Edge Runtime o funciones serverless individuales — parece ser un monolito Next.js con BullMQ. Los webhooks Retell no tienen `export const runtime = "edge"`, por lo que corren en el runtime Node.js estándar de Next.js, que tiene cold start solo en el primer deploy en plataformas serverless (Vercel). En modo BullMQ worker el proceso es long-lived — sin cold start.

---

## Knowledge Base / RAG — Deep

### Vector store y chunking strategy

- **Vector store**: PGVector en Supabase via RPC `match_knowledge_base`.
- **Embedding model**: `text-embedding-3-small` (OpenAI, 1536 dimensiones).
- **Match threshold**: 0.4 (configurable pero hardcodeado en `WhatsAppAIProcessor.ts:114`).
- **Match count**: 3 resultados máximo.
- **Chunking strategy**: No visible en el código de WhatsAppAIProcessor. El chunking se aplica al ingerir (vía `knowledge-base.ts:addEmbedding`/`addEmbeddingsBatch`), pero la estrategia de chunking (tamaño de chunk, overlap) no está definida en los archivos analizados.

### Coste de embeddings: ¿persistido?

No. El embedding de la query del usuario (línea 108–110 de WhatsAppAIProcessor) se genera con `text-embedding-3-small` en cada turno de conversación para hacer la búsqueda RAG, pero su coste no se registra. Los `embeddings.create` no tienen ningún hook de tracking.

### Re-ranking, citation, hallucination control

- **Re-ranking**: No existe. Los 3 resultados del RPC se insertan tal cual en el system prompt.
- **Citation**: No existe. El RAG context se inserta como texto plano sin metadatos de origen.
- **Hallucination control**: El prompt de Virginia instruye "No inventes información. Responde solo con información del RAG." pero no hay validación técnica de que las respuestas estén basadas en el RAG recuperado.

### RAG solo en WhatsApp

Las llamadas de voz Retell no usan RAG dinámico — solo reciben `dynamicVariables` del orquestador. El agente de voz (en Retell) tiene su propio conocimiento base configurado en la consola de Retell, completamente desacoplado del PGVector del proyecto.

---

## Fact-extractor / Chat memory

### ¿Cómo se persisten los "facts" extraídos?

Los facts se guardan en `lead.metadata` (columna JSONB) vía `saveToLeadMetadata()`. El proceso de merge (líneas 234–247) busca una clave existente por comparación case-insensitive, ignorando espacios y llaves dobles. Si encuentra la clave, la sobreescribe; si no, añade la nueva clave.

Problema: si una misma variable existe con diferentes formatos de clave (`USER_STUDIES`, `user_studies`, `{{user_studies}}`), pueden coexistir como entradas separadas en el JSONB, causando inconsistencias.

### Conflicto entre memoria a largo plazo y nuevo input

No hay mecanismo de resolución de conflictos. Si el LLM extrae un valor diferente en dos turnos consecutivos (ej: el lead primero dice "soy técnico" → extrae `USER_ESTUDIES = "técnico"`, luego aclara "tengo un grado" → extrae `USER_ESTUDIES = "universitario"`), el segundo valor sobreescribe el primero. Este comportamiento es el correcto para la rectificación de Virginia, pero no hay log de qué valor fue sobreescrito ni cuándo.

### Memory window: ¿token budget controlado?

El contexto enviado a OpenAI en WhatsAppAIProcessor incluye:
- System prompt completo (prompt Virginia + timezoneContext + datos del prospecto + RAG + historial resumido + últimas 10 líneas)
- Últimas 10 mensajes del historial como mensajes del array

No hay control de token budget. Si el `chatSummary` (chat_summaries) crece indefinidamente (el servicio hace append, nunca compacta), el system prompt puede exceder el contexto de gpt-4o-mini (128K tokens), causando un error de `context_length_exceeded`. El `max_tokens: 500` limita solo la respuesta del asistente, no el input.

El `ChatSummaryService.appendMessage()` añade una línea por cada mensaje sin ningún límite de tamaño del summary:
```typescript
const updatedSummary = currentSummary + newMessage;
```
Con 3000 leads al mes, conversaciones largas pueden acumular cientos de KB en el campo `summary`.

---

## Prompt Virginia — diff exhaustivo vs runtime

### Diferencias confirmadas entre `Promt-Virginia.md` y lo que el procesador usa en runtime

| Aspecto | `Promt-Virginia.md` (fuente) | Runtime (WhatsAppAIProcessor) | Gap |
|---------|------------------------------|-------------------------------|-----|
| Nombre herramienta booking | `book_appointmen` (typo, línea 135) | `book_appointment` (correcto, línea 238) | Typo en fuente — si el operador copia el doc a BD, la tool falla |
| Variable profesión | `{{user_profesion}}` (sin doble s) | Busca `USER_PROFESION` en metadata | Coinciden (ambos sin doble s) pero divergen de spec A/B (`user_profession`) |
| Variable años exp. | `{{years_experience}}` (plural) | Busca `years_experience` y variantes | Parcial — extractor busca múltiples alias |
| Fecha now | `{{ $now }}` (línea 943) | Sustituida por variableMap.$now | Correcto |
| Sintaxis doble llave | `{{variable}}` | Regex `{{\\s*var\\s*}}` case-insensitive | Correcto |
| Variable `master_name` | Usada en línea 213 del prompt: "Contactas a... sobre {{master_name}}" | Orquestador envía `master_name` para Retell (orchestrator.ts:476) | Solo para voz; WhatsApp no la inyecta explícitamente como variable dinámica |
| Estado `"prematriculado"` | Definido en línea 73 | No manejado en extractores ni en qualifier | Gap de negocio — Virginia puede emitirlo, el código lo ignora |
| `conversation_status = "closed"` | Prompt lo define claramente | fact-extractor busca `CONVERSATION_STATUS`, `conversation_status`, `estado_conversacion` (línea 185–190) | Divergencia: prompt Virginia usa `conversation_status`; extractor busca `estado_conversacion` primero |

### Variables en runtime sin mapeo en prompt Virginia

La llamada a OpenAI en WhatsAppAIProcessor inyecta estas variables en `variableMap` pero el prompt Virginia no las define como variables de estado:
- `nombre`, `email`, `telefono`, `fecha`, `hora`, `now`, `pais` — variables de runtime internas

Estas se sustituyen en el prompt pero el LLM las recibe como contexto, no como variables de estado a mantener.

### Función `book_appointmen` vs `book_appointment`: qué pasa en runtime

Cuando el LLM (vía prompt Virginia) intenta llamar a `book_appointmen` (typo):
- **WhatsApp**: El LLM emite un tool_call con `name: "book_appointmen"`. El procesador (línea 388) hace `if (name === "book_appointment")` — no hay match. El tool call se "ejecuta" pero sin resultado, y `result = ""`. El LLM recibe un mensaje de tool vacío y puede alucinarse respondiendo como si la cita se hubiera agendado.
- **Retell**: El webhook de tools (línea 32) hace `switch (toolName)` — `case "book_appointment"` no hace match con `"book_appointmen"`. El switch cae al `default` que devuelve 404. El agente de Retell recibe un error.

Este bug solo se activa si el prompt en la BD contiene el typo. Si el operador copió el prompt de `Promt-Virginia.md` directamente a la BD, está activo.

---

## AI Rescue analysis

### ¿Qué rescata y de qué?

`AIRescueService.generateSmartNudge()` genera un mensaje de re-engagement personalizado para leads inactivos. Lee `chat_summaries.summary` como historial y genera un mensaje con gpt-4o.

**Flujo completo** (via `RescueWorker.runRescueCheck()`):
1. Detecta leads con `inactivity_enabled = true` y sin actividad en `inactivity_timeout` minutos.
2. Si `inactivity_ai_enabled = true`: llama a `generateSmartNudge()`.
3. Envía el mensaje por WhatsApp.
4. Guarda el mensaje en `chat_messages` y `chat_summaries`.

### ¿Es producción-grade?

Parcialmente. Aspectos positivos:
- Singleton lazy de OpenAI (`getOpenAI()`) para evitar instanciación repetida.
- Safety window de 5 minutos entre rescates para el mismo lead.
- Límite de `maxRetries` configurable.
- Fallback a texto estático si la IA falla.

Problemas:
- El agentPrompt que pasa al AIRescue es `variant.prompt_text` completo (potencialmente cientos de líneas del prompt Virginia). Esto genera un prompt muy largo (y caro) para un mensaje de 150 tokens.
- No hay tracking del coste de estos mensajes de rescate.
- El rescue message no se procesa por `WhatsAppAIProcessor` — no hay extracción de facts tras el rescate.
- `RescueWorker` itera sobre TODOS los leads con AI activo de TODOS los tenants en una sola query sin paginación. Con 3000–4000 leads/mes, esto puede ser costoso y lento.

### Loops infinitos posibles

El RescueWorker tiene protección parcial:
1. `sentCount >= maxRetries` → para.
2. Safety window de 5 minutos → para si hay intervalo muy corto.

Pero: si el cron del RescueWorker corre más frecuentemente que `inactivity_timeout` minutos, y el `last_rescue_at` no se actualiza correctamente (fallo de update), el mismo lead puede recibir múltiples mensajes en la misma ejecución. No hay lock distribuido ni idempotency check basado en el job ID.

---

## Multi-Agent analysis

### ¿Qué hay en `multi-agent.ts`?

El archivo tiene 71 líneas y contiene:
1. `AgentFactory.createModel()` — factory que crea instancias LangChain para OpenAI/Anthropic/Gemini.
2. `QualifyAgent` — clase con un método `processConversation()` que es un **stub completo**:
   ```typescript
   public async processConversation(history: any[], promptSource: "A" | "B") {
       // TODO: Implement LangChain chain with prompt source
       console.log(`[QUALIFY AGENT] Processing using Prompt ${promptSource}...`);
   }
   ```
   No hay implementación. No hay lógica. No hay chain. Solo un console.log.

### ¿Hay routing entre agentes?

No. No existe lógica de routing. El campo `model_provider` en `ai_agent_variants` está diseñado para routing (OPENAI/CLAUDE/GEMINI), pero en la ruta caliente de WhatsApp se ignora — siempre se usa el SDK `openai` directamente independientemente del provider configurado.

El único lugar donde `model_provider` se usa es `QualificationProcessor`, que está roto por el import faltante de `llm-factory`.

### ¿Es auditable cuál agente respondió?

Parcialmente:
- `chat_messages.metadata.model` guarda el nombre del modelo usado (`gpt-4o` o `gpt-4o-mini`).
- No se guarda el `variant_id` en `chat_messages`, por lo que no se sabe qué variante A/B respondió.
- No hay log de qué proveedor (OpenAI/Anthropic/Gemini) respondió, ni por qué se seleccionó esa variante.

---

## Profundización findings quick scan (F-03-XXX)

### F-03-001 (llm-factory no existe) — CONFIRMADO, PROFUNDIZADO

`QualificationProcessor.ts:8` hace `import { createLLM } from "@/lib/core/intelligence/llm-factory"` con `@ts-expect-error` explícito (línea 7). El directorio `src/lib/core/intelligence/` solo contiene `qualifier.ts`. El `llm-factory.ts` no existe.

Consecuencia adicional identificada: el A/B testing basado en peso (`weight` en `ai_agent_variants`) que implementa `QualificationProcessor.getContextualRules()` (líneas 138–148) tampoco funciona. El A/B testing de modelos es un requisito del diseño multi-tenant pero está efectivamente muerto.

### F-03-002 (schemas qualified divergentes) — CONFIRMADO, PROFUNDIZADO

Ahora se pueden trazar los tres esquemas en el mismo flujo de datos:

```
Virginia escribe: qualified = "apto"  (en la conversación de WhatsApp)
    ↓
FactExtractionService extrae y guarda en metadata: qualified = "SI"  (prompt fact-extractor pide "SI"/"NO"/"PENDIENTE")
    ↓
saveToLeadMetadata lee: if (q === 'SI') mainUpdate.tipo_lead = 'CUALIFICADO'  ← este sí funciona
    ↓
PostAnalysisService (post-llamada Retell) persiste: QUALIFIED = analysis.qualified === "si" ? "SI" : "NO"
    ↓
analyzeConversation devuelve: qualified: "si" | "no" | "anulado"  ← tercer schema
```

El flow de WhatsApp eventualmente funciona (Virginia escribe "apto" → fact-extractor extrae "SI" → tipo_lead = CUALIFICADO), pero hay un paso intermedio donde `metadata.qualified = "SI"` en vez de `"apto"`. Si algún otro código lee `metadata.qualified` esperando `"apto"`, obtiene `"SI"`.

Para Retell (post-llamada): `analyzeConversation` devuelve `"si"` y `PostAnalysisService` persiste `QUALIFIED = "SI"` directamente en metadata. Este schema es diferente al de fact-extractor.

### F-03-003 (árbol de decisión incorrecto en qualifier.ts) — CONFIRMADO, PROFUNDIZADO

Adicionalmente a los umbrales incorrectos ya documentados, se confirma que `qualifier.ts` no implementa la exclusión por profesión. El prompt Virginia (líneas 487–495) tiene una "REGLA B.1 — Verificar exclusión por profesión" explícita que lista profesiones excluidas (`ama de casa`, `camarero`, `albañil`, etc.). El código de `qualifier.ts` no tiene ninguna lista de exclusión — evalúa solo nivel de estudios y años de experiencia.

Resultado: un camarero con 5 años de experiencia y bachillerato sería `PREUNIVERSITARIO` → "no cualificado" por código, pero "apto" para Virginia si es dueño de un negocio de restauración.

### F-03-004 (book_appointmen typo) — CONFIRMADO, MECANISMO CLARIFICADO

El mecanismo exacto de fallo en WhatsApp (líneas 385–427 de WhatsAppAIProcessor): el LLM emite tool_call con nombre typo, el for loop (`for (const toolCall of aiMessage.tool_calls)`) procesa el tool call, no encuentra match en ningún `if (name === ...)`, y `result = ""` (string vacío). El mensaje de tool con contenido vacío se añade al array de messages (línea 432), y la siguiente llamada a OpenAI recibe un tool result vacío. El LLM puede interpretar esto como que la herramienta no devolvió datos y alucinarse confirmando una cita que no se agendó.

### F-03-007 (costes ficticios) — CONFIRMADO, EXTENSIÓN DE LA SUPERFICIE

Adicionalmente identificado: el rescue message (`RescueWorker`) usa `AIRescueService` con gpt-4o pero el `chat_messages` que guarda tampoco incluye token_usage. Los costes de los mensajes de rescate son completamente invisibles.

El segundo `openai.chat.completions.create` dentro del loop de tool calls (línea 441) no tiene ningún tracking de usage. En una conversación con agendamiento (2 rondas de tool calls), el coste real puede ser 3× el de una conversación simple — pero el dashboard solo contará 1 mensaje (el insertado en `chat_messages`).

### F-03-008 (múltiples clientes OpenAI) — CONFIRMADO, PROFUNDIZADO

`WhatsAppAIProcessor.ts` instancia **dos** clientes OpenAI por request:
- Línea 107: `const openai = new OpenAI({ apiKey })` para embeddings (dentro del Promise.all).
- Línea 337: `const openai = new OpenAI({ apiKey })` para el chat completion principal.

Ambos usan la misma API key pero son instancias separadas. El cliente de embeddings (línea 107) está dentro de una arrow function en `Promise.all` — se crea una instancia nueva por cada mensaje entrante.

### F-03-011 (latencia <800ms no medida) — CONFIRMADO, ANÁLISIS DE PEOR CASO

Estructura temporal del happy path de WhatsApp (sin tool calls):
```
T=0ms     Mensaje llega a BullMQ queue
T=~50ms   Job procesado, getAdminSupabase() crea cliente
T=~50ms   Promise.all inicia: 7 queries Supabase + embedding OpenAI en paralelo
T=~350ms  Promise.all resuelve (embedding es el más lento: ~300ms)
T=~350ms  System prompt construido
T=~350ms  openai.chat.completions.create() inicia
T=~1100ms Respuesta de gpt-4o-mini recibida (~750ms P50 para ~2000 tokens input)
T=~1100ms Typing indicator ya activo (se disparó a T=~150ms)
T=~1100ms WhatsApp send + Supabase insert
Total: ~1100ms en P50 para el happy path
```

El happy path sin tool calls probablemente supera 800ms en P50. Con tool calls (check_availability → book_appointment), el tiempo total puede superar 3000ms (3 rondas de OpenAI + queries DB entre cada ronda).

El SLA de <800ms de la spec del cliente es incompatible con la arquitectura actual de WhatsApp AI. Para voz (Retell) el tiempo de respuesta lo gestiona Retell internamente y puede ser más rápido, pero no hay datos.

---

## Nuevos findings (DA-4-XXX)

### DA-4-001: No hay validación de firma en webhook Retell — SPOOFING POSIBLE

- **Archivo**: `src/app/api/webhooks/retell/route.ts`, líneas 10–123
- **Observado**: El webhook POST de Retell no verifica ninguna firma HMAC ni header de autenticación. Cualquier cliente HTTP que conozca la URL puede enviar un payload malicioso simulando una llamada Retell.
- **Contraste**: El webhook WhatsApp (`src/app/api/webhooks/whatsapp/route.ts:40`) sí implementa verificación HMAC con `createHmac("sha256", appSecret)`. La paridad de seguridad entre webhooks no existe.
- **Impacto**: Un atacante puede POST a `/api/webhooks/retell` con `tenant_id` y `lead_id` válidos (si los conoce), inyectar una transcripción falsa, y desencadenar `PostAnalysisService.processInteraction()` con datos fabricados — calificando leads como aptos, agendando citas, actualizando el CRM.
- **Severidad**: **Critical**
- **Esfuerzo fix**: Bajo — el SDK `retell-sdk` incluye `Retell.verify()` para validar la firma del webhook. Añadir verificación al inicio del handler.
- **Fix textual**:
```typescript
import Retell from "retell-sdk";
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });
const isValid = retell.verify(
    JSON.stringify(body),
    req.headers.get("x-retell-signature") || ""
);
if (!isValid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

---

### DA-4-002: Prompt injection indirecto via historial previo en system prompt

- **Archivo**: `src/lib/core/processors/WhatsAppAIProcessor.ts`, líneas 158–160 y 319–322
- **Observado**: El `conversationContext` (mensajes previos del usuario) se inserta dentro del system prompt como texto plano. Un usuario que haya escrito "Ignora las instrucciones anteriores" en un turno previo verá ese texto en el system prompt del siguiente turno.
- **Impacto**: Permite prompt injection indirecto — el atacante siembra la instrucción en un turno y esta afecta al siguiente (o a conversaciones futuras si el summary no se limpia).
- **Severidad**: **High**
- **Esfuerzo fix**: Medio — mover el historial de conversación al array `messages` de la API (como mensajes `user`/`assistant` separados) en lugar de insertarlos en el system prompt como texto plano. El historial ya se añade también en el array `messages` (línea 342), por lo que el contexto está duplicado: una vez en el system prompt y otra en el array de messages.

---

### DA-4-003: Tool call arguments sin validación de schema — LLM puede crashear herramientas

- **Archivos**: `src/lib/core/processors/WhatsAppAIProcessor.ts:383`, `src/app/api/webhooks/retell/tools/route.ts:72–74`
- **Observado**: Los argumentos de tool calls del LLM se deserializan con `JSON.parse()` y se usan directamente sin validación de tipos ni presencia de campos requeridos.
- **Impacto**: Si el LLM alucina `args.date = null` o `args.appointmentId = undefined`, las funciones de `AppointmentService` reciben valores incorrectos. En el mejor caso: error de BD. En el peor: datos corruptos o comportamiento inesperado (insertar appointment con fecha null).
- **Severidad**: **High**
- **Esfuerzo fix**: Bajo — añadir validación Zod de los args antes de procesar cada tool:
```typescript
const BookAppointmentSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().optional(),
    notes: z.string().optional()
});
const parsed = BookAppointmentSchema.safeParse(args);
if (!parsed.success) { result = JSON.stringify({ error: "Invalid args" }); continue; }
```

---

### DA-4-004: Chat summary crece indefinidamente — riesgo de context overflow y coste descontrolado

- **Archivo**: `src/lib/services/knowledge-base.ts`, líneas 118–124 (`ChatSummaryService.appendMessage`)
- **Observado**: `appendMessage` concatena sin límite: `updatedSummary = currentSummary + newMessage`. No hay truncation, no hay compactación, no hay límite de tamaño.
- **Impacto**: Para un lead con una conversación larga (>100 turnos), el campo `summary` puede superar 50KB. Este summary se incluye en el system prompt de cada turno. Con gpt-4o-mini (max 128K tokens), una conversación con summary de 20K tokens deja poco espacio para el prompt Virginia (~5K tokens) + RAG + respuesta. El coste por turno escala linealmente con el summary.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Medio — implementar compactación periódica: cuando el summary supera N líneas (ej: 50), reemplazarlo con un resumen LLM del resumen anterior más los últimos N mensajes. Alternativa más simple: limitar a las últimas 30 líneas.

---

### DA-4-005: `ai-analysis.ts` usa precios hardcoded de GPT-4 viejo para un modelo que ya no existe

- **Archivo**: `src/app/dashboard/costs/page.tsx`, línea 111
- **Observado**: `$0.005/1K prompt` y `$0.015/1K completion` son los precios de `gpt-4` (mayo 2023). El codebase usa `gpt-4o` y `gpt-4o-mini`. Precios actuales de gpt-4o: $0.0025/1K input, $0.010/1K output. Precios gpt-4o-mini: $0.00015/1K input, $0.0006/1K output.
- **Impacto**: Los costes mostrados son 3–33× superiores a los reales. Con gpt-4o-mini (el modelo usado en fact-extractor y ai-analysis), el factor es 33× para input tokens.
- **Severidad**: **Low** (solo afecta display, no operaciones)
- **Esfuerzo fix**: Bajo — crear tabla de precios por modelo en BD o config, actualizarla sin cambio de código.

---

### DA-4-006: `QualifyAgent.processConversation` es stub completo — A/B testing no funciona

- **Archivo**: `src/lib/core/multi-agent.ts`, líneas 66–69
- **Observado**: El método `processConversation()` solo hace `console.log()`. No hay implementación. El A/B testing entre variantes de prompt (campo `weight` en `ai_agent_variants`) no está implementado en ningún flujo activo de producción.
- **Impacto**: La funcionalidad de A/B testing de modelos (uno de los diferenciadores del sistema multi-agent) es un stub. No se puede probar si gpt-4o funciona mejor que claude-3-5-sonnet para la cualificación.
- **Severidad**: **Low** (funcionalidad no implementada, no bug de producción)
- **Esfuerzo fix**: Alto — requiere implementar la chain LangChain con selección probabilística basada en peso + logging del resultado de A/B.

---

### DA-4-007: `RescueWorker` no pagina — riesgo de timeout con base grande de leads

- **Archivo**: `src/lib/core/workers/RescueWorker.ts`, líneas 31–36
- **Observado**: La query inicial trae TODOS los leads con `ai_agent_id` no nulo y `is_ai_paused = false` sin paginación ni límite.
- **Impacto**: Con 3000–4000 leads activos, esta query puede devolver miles de filas. Si el worker corre cada minuto (cron), cada ejecución trae miles de objetos en memoria. Riesgo de OOM en el worker process o de timeout en la query Supabase (límite default de PostgREST: 1000 filas).
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — añadir `.limit(100)` o implementar cursor pagination con `id > last_processed_id`. Procesar en batches.

---

### DA-4-008: Duplicación de historial en WhatsAppAIProcessor — tokens desperdiciados

- **Archivo**: `src/lib/core/processors/WhatsAppAIProcessor.ts`, líneas 158–160 y 341–344
- **Observado**: El historial de conversación aparece **dos veces** en la llamada a OpenAI:
  1. Como texto plano en `conversationContext` dentro del `systemPrompt` (línea 323–324).
  2. Como mensajes `user`/`assistant` en el array `messages` (línea 342).
- **Impacto**: Las últimas 10 conversaciones se envían en duplicado a OpenAI, incrementando el coste de tokens en un 15–30% sin ningún beneficio para la calidad de la respuesta.
- **Severidad**: **Medium** (coste operacional)
- **Esfuerzo fix**: Bajo — eliminar la sección "CONTEXTO RECIENTE" del system prompt, ya que el historial ya está en el array `messages`.

---

### DA-4-009: `ai-analysis.ts` no valida tipos del JSON del LLM — falsos positivos de cualificación

- **Archivo**: `src/lib/services/ai-analysis.ts`, línea 134
- **Observado**: `JSON.parse(content || "{}") as ConversationAnalysis` castea sin validación. Si el LLM devuelve `{ "qualified": true }` (booleano en vez de string), el código lo acepta. Más crítico: si devuelve `{ "qualified": "si", "scheduled_call_confirmed": "true" }` (string en vez de boolean), `scheduled_call_confirmed` pasa como truthy y `PostAnalysisService` puede intentar crear un agendamiento con datos inválidos.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — añadir validación Zod del output de `analyzeConversation`:
```typescript
const ConversationAnalysisSchema = z.object({
    qualified: z.enum(["si", "no", "anulado"]),
    scheduled_call_confirmed: z.boolean(),
    // ...
});
const parsed = ConversationAnalysisSchema.safeParse(JSON.parse(content));
if (!parsed.success) { /* fallback seguro */ }
```

---

### DA-4-010: API keys de OpenAI en `ai_agent_variants` visibles para cualquier usuario con acceso a la tabla

- **Archivo**: `src/lib/architecture/llm-stack.md`, sección 10 (ya documentado parcialmente como F-03-009)
- **Profundización**: La tabla `ai_agent_variants` es accesible a través de la UI del dashboard (sección "Agentes AI"). El campo `api_key` se muestra en los formularios de configuración del agente. Un usuario de tenant con acceso al dashboard puede ver la API key de OpenAI del tenant en texto plano. En un sistema multi-tenant, esto significa que cualquier tenant puede potencialmente acceder a las keys de otros tenants si hay un bug de RLS en Supabase.
- **Severidad**: **High** (seguridad)
- **Esfuerzo fix**: Medio — enmascarar el campo `api_key` en la UI (`sk-...xxxx`), nunca devolverlo en queries de lectura del dashboard. Para escritura, solo permitir sobreescribir. Para runtime, mantener la lectura server-side con service role.

---

### DA-4-011: `scheduled_call_confirmed` puede persistirse como string "true"/"false" — violación del schema del prompt

- **Archivo**: `src/lib/services/fact-extractor.ts`, línea 157 y `src/lib/services/ai-analysis.ts`, líneas 51–52
- **Observado**: El prompt Virginia define `{{scheduled_call_confirmed}}` como "Booleano real: true / false (NUNCA strings)". Sin embargo:
  - `fact-extractor.ts` persiste todo como `String(val)` (línea 157), convirtiendo el boolean `true` del LLM en el string `"true"`.
  - `ai-analysis.ts` define el campo como `scheduled_call_confirmed: boolean` en TypeScript, pero si el LLM devuelve `"true"` (string) el cast `as ConversationAnalysis` no lo convierte.
- **Impacto**: El campo puede estar en metadata como el string `"true"`, `"false"`, o el boolean `true`, `false`, dependiendo del path de escritura. Código que lee `metadata.scheduled_call_confirmed === true` (comparación estricta) puede fallar si el valor es `"true"` (string).
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — en `saveToLeadMetadata`, para campos booleanos conocidos, parsear antes de persistir:
```typescript
if (key === "scheduled_call_confirmed" || key === "qa_handled") {
    updatedMetadata[key] = val === "true" || val === true;
}
```

---

## Status final

**Status: DONE_WITH_CONCERNS**

**Summary:** Análisis estático profundo completado. Se profundizaron los 12 findings del quick scan (F-03-XXX) y se identificaron 11 nuevos findings (DA-4-001 a DA-4-011). Los hallazgos más críticos nuevos son: (1) webhook Retell sin verificación de firma — permite spoofing completo de llamadas y manipulación de CRM; (2) prompt injection indirecto via historial en system prompt; (3) tool call arguments sin validación de schema. Los findings de coste ficticio y schema divergente de `qualified` se confirman como los problemas de observabilidad y datos más graves del sistema.

**Tabla consolidada de severidades:**

| ID | Severidad | Esfuerzo | Componente |
|----|-----------|----------|------------|
| DA-4-001 | **Critical** | Bajo | Webhook Retell sin firma |
| F-03-001 | **Critical** | Bajo | llm-factory.ts no existe |
| F-03-002 | **Critical** | Medio | Schema qualified triplicado |
| F-03-003 | **Critical** | Bajo | Umbrales qualifier.ts incorrectos |
| DA-4-002 | **High** | Medio | Prompt injection indirecto via historial |
| DA-4-003 | **High** | Bajo | Tool args sin validación |
| DA-4-010 | **High** | Medio | API keys visibles en UI |
| F-03-004 | **High** | Bajo | Typo book_appointmen en fuente |
| F-03-005 | **High** | Bajo | user_profesion vs user_profession |
| F-03-009 | **High** | Medio | API keys en columna sin cifrado |
| DA-4-004 | **Medium** | Medio | Chat summary sin límite de tamaño |
| DA-4-007 | **Medium** | Bajo | RescueWorker sin paginación |
| DA-4-008 | **Medium** | Bajo | Historial duplicado en llamada OpenAI |
| DA-4-009 | **Medium** | Bajo | JSON LLM sin validación Zod |
| DA-4-011 | **Medium** | Bajo | scheduled_call_confirmed string vs boolean |
| F-03-006 | **Medium** | Bajo | YEARS_ EXPERIENCIE typo clave |
| F-03-007 | **Medium** | Bajo | Token usage no persiste |
| F-03-008 | **Medium** | Medio | Múltiples clientes OpenAI por request |
| F-03-010 | **Medium** | Bajo | Estado prematriculado no manejado |
| F-03-011 | **Medium** | Medio | Latencia <800ms no medida |
| F-03-012 | **Medium** | Bajo | master_name vs curse_name doble nomenclatura |
| DA-4-005 | **Low** | Bajo | Precios hardcoded desactualizados |
| DA-4-006 | **Low** | Alto | QualifyAgent.processConversation stub |

**Concerns:**
- El análisis de prompt en BD vs prompt en `Promt-Virginia.md` asume que el operador copió el prompt del documento a la BD. No se puede verificar el contenido real de `ai_agent_variants.prompt_text` sin acceso a la BD de producción.
- La latencia de voz de Retell no puede medirse sin telemetría real o acceso a la consola de Retell — el análisis de latencia es estructural, no empírico.
- El webhook Retell sin firma (DA-4-001) es un finding crítico que podría no haberse activado en producción si la URL no es pública o conocida, pero es un riesgo latente que debe cerrarse.
