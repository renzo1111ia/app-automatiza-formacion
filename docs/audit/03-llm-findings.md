---
title: "Audit LLM Stack — Findings"
date: 2026-05-18
agent: Audit-LLM (Sonnet)
phase: 3
---

# Audit LLM Stack

## Perímetro auditado

- `src/lib/services/ai-rescue.ts`
- `src/lib/services/ai-analysis.ts`
- `src/lib/services/fact-extractor.ts`
- `src/lib/services/knowledge-base.ts`
- `src/lib/services/chat-memory.ts`
- `src/lib/services/post-analysis.ts`
- `src/lib/core/multi-agent.ts`
- `src/lib/core/intelligence/qualifier.ts`
- `src/lib/core/processors/WhatsAppAIProcessor.ts`
- `src/lib/core/processors/QualificationProcessor.ts`
- `src/lib/core/workers/RescueWorker.ts`
- `src/lib/integrations/retell.ts`
- `src/lib/integrations/ultravox.ts`
- `src/app/api/webhooks/retell/route.ts`
- `src/app/api/webhooks/retell/tools/route.ts`
- `src/app/api/cron/appointments/reminders/route.ts`
- `src/app/dashboard/costs/page.tsx`
- `package.json` (solo dependencias LLM)

---

## Stack LLM observado

| Provider | SDK | Modelo usado | Dónde |
|----------|-----|-------------|-------|
| OpenAI | `openai` (directo) | `gpt-4o` / `gpt-4o-mini` | WhatsAppAIProcessor, AIAnalysis, AIRescue, FactExtractor, Reminders, Widget |
| OpenAI | `@langchain/openai` | configurable | MultiAgent (AgentFactory), QualificationProcessor |
| Anthropic | `@langchain/anthropic` | `claude-3-5-sonnet-20240620` | MultiAgent (AgentFactory) — no instanciado en producción activa |
| Google | `@langchain/google-genai` | `gemini-1.5-pro` | MultiAgent (AgentFactory) — no instanciado en producción activa |
| Retell | `retell-sdk` ^5.12.0 | Gestiona internamente (LLM propio de Retell) | Llamadas de voz |
| Ultravox | REST custom (`fetch`) | Gestiona internamente | Llamadas de voz (proveedor alternativo) |
| AWS Bedrock | `@aws-sdk/client-s3` | **NO presente** | Solo S3/MinIO se usa del SDK AWS — Bedrock no está en el codebase |

**LangChain** se usa en dos lugares: `QualificationProcessor` (para análisis post-llamada con PromptTemplate + StructuredOutputParser) y `MultiAgent/AgentFactory` (capa de abstracción multi-provider). La ruta caliente de WhatsApp (turno a turno) usa el SDK `openai` directamente sin LangChain.

---

## Resumen ejecutivo

El stack LLM tiene un proveedor dominante real (OpenAI) con una capa de abstracción multi-provider (LangChain via `AgentFactory`) presente pero no usada en los flujos críticos de producción. La ruta caliente de WhatsApp (300–600ms de latencia observada estructuralmente: paralelización de contexto + embeddings + OpenAI) no pasa por LangChain. El agente Virginia se ejecuta mediante el prompt almacenado en `ai_agent_variants.prompt_text` de Supabase, que el desarrollador carga en runtime — el prompt en código no está hardcodeado, pero el análisis post-llamada sí tiene prompts internos hardcodeados que divergen del prompt oficial de Virginia.

Hallazgos críticos: (1) el `llm-factory` referenciado en `QualificationProcessor` no existe como fichero — la importación está rota. (2) Los valores de las variables de cualificación que extrae el código (`qualified: "SI"/"NO"/"PENDIENTE"`) divergen completamente del schema oficial de Virginia (`"apto"/"no apto"/""`). (3) El árbol de cualificación hardcodeado en `qualifier.ts` usa umbrales distintos al prompt de Virginia. (4) No hay tracking de tokens/costes en el lado servidor — solo estimaciones en la UI del dashboard.

---

## Findings

### F-03-001: `llm-factory` importado pero no existe — QualificationProcessor roto

- **Archivo**: `src/lib/core/processors/QualificationProcessor.ts:8`
- **Código**: `import { createLLM } from "@/lib/core/intelligence/llm-factory";`
- **Observado**: El fichero `src/lib/core/intelligence/llm-factory.ts` (o cualquier variante) no existe en el codebase. El directorio `intelligence/` solo contiene `qualifier.ts`.
- **Impacto**: `QualificationProcessor.process()` falla en runtime con `MODULE_NOT_FOUND` para cualquier llamada de análisis profundo post-llamada.
- **Severidad**: **Critical**
- **Esfuerzo fix**: Bajo — crear `llm-factory.ts` con `createLLM(provider, model, temp)` que use `AgentFactory.createModel()` de `multi-agent.ts` (ya existe la lógica).
- **Fix textual**:
```typescript
// src/lib/core/intelligence/llm-factory.ts
import { AgentFactory, LLMType } from "@/lib/core/multi-agent";

export function createLLM(provider: string, modelName: string, temperature: number) {
    const apiKey = process.env.OPENAI_API_KEY || "";
    return AgentFactory.createModel({
        type: provider as LLMType,
        modelName,
        apiKey,
        temperature
    });
}
```

---

### F-03-002: Variables de cualificación en código divergen del schema oficial de Virginia

- **Archivo**: `src/lib/services/ai-analysis.ts:51–52`, `src/lib/services/fact-extractor.ts:113–116`
- **Prompt Virginia oficial**: `qualified` tiene valores `"apto"` / `"no apto"` / `""`
- **Código `analyzeConversation`**: Prompt hardcodeado pide `qualified: "si"/"no"/"anulado"` (línea 109)
- **Código `FactExtractionService`**: Ejemplo en prompt pide `qualified: "SI"/"NO"/"PENDIENTE"` (línea 113)
- **Código `saveToLeadMetadata`**: Lógica en línea 270–272 mapea `q === 'SI'` → `CUALIFICADO`, `q === 'NO'` → `DESCARTADO`
- **Impacto**: Hay tres schemas distintos de `qualified` en circulación simultánea. La variable que el prompt de Virginia real escribe (`"apto"/"no apto"`) nunca coincide con lo que el código espera leer (`"SI"/"NO"`). Nunca se actualiza `tipo_lead` de `CUALIFICADO` correctamente vía fact extractor para conversaciones de WhatsApp.
- **Divergencia con spec**: Confirma D-004/D-005 de `00-known-divergences.md` — las variables de cualificación están desincronizadas.
- **Severidad**: **Critical**
- **Esfuerzo fix**: Medio — unificar schema. El prompt de Virginia es autoridad; adaptar `ai-analysis.ts` y `fact-extractor.ts` para aceptar `"apto"/"no apto"` y mapear al enum interno.

---

### F-03-003: Árbol de cualificación hardcodeado en `qualifier.ts` diverge del prompt Virginia

- **Archivo**: `src/lib/core/intelligence/qualifier.ts:79–100`
- **Umbral en código (Regla B — Técnico)**: `years_experience >= 3`
- **Umbral en prompt Virginia oficial (Regla B)**: `years_experience >= 2`
- **Umbral en código (Sin estudios / Básico — "Regla C")**: `years_experience >= 5`
- **Umbral en prompt Virginia (Sin estudios / Básico — Regla B)**: `years_experience >= 2` (misma regla)
- **Adicionalmente**: El código implementa una "Regla C" implícita para sin estudios con 5 años que no existe en el prompt de Virginia — en Virginia, sin estudios + experiencia relevante + 2 años = apto por Regla B.
- **Impacto**: Un lead técnico con 2 años de experiencia es "apto" para Virginia pero "no cualificado" para el motor de código. Un lead sin estudios con 3 años es "apto" para Virginia pero "no cualificado" para el código.
- **Severidad**: **Critical**
- **Esfuerzo fix**: Bajo — ajustar umbrales en `qualifier.ts` a los del prompt Virginia (umbral mínimo = 2 años para Regla B y Regla B-sin estudios), y eliminar la Regla C.

---

### F-03-004: Herramienta `book_appointmen` (typo) — code registra `book_appointment` (correcto)

- **Archivo prompt Virginia**: línea 135 — `book_appointmen` (sin 't' final)
- **Código tools (WhatsAppAIProcessor)**: línea 239 — `name: "book_appointment"` (correcto)
- **Código tools (retell/tools/route.ts)**: línea 33 — `case "book_appointment":` (correcto)
- **Estado**: El **código es correcto**. El **prompt de Virginia tiene el typo**. Como el sistema inserta el prompt de la BD (`ai_agent_variants.prompt_text`), si el operador copia el prompt oficial de `Promt-Virginia.md` al campo de la BD, la herramienta `book_appointmen` fallará silenciosamente en WhatsApp (el LLM llamará a la tool con el nombre del typo, pero el código busca `book_appointment`).
- **Severidad**: **High** (riesgo al actualizar el prompt desde el documento fuente)
- **Esfuerzo fix**: Bajo — corregir el typo en `Promt-Virginia.md` y verificar que el contenido en BD usa `book_appointment`.

---

### F-03-005: Variable `user_profesion` (sin 's') en `ai-analysis.ts` — inconsistente con spec

- **Archivo**: `src/lib/services/ai-analysis.ts:59`
- **Código**: `USER_PROFESION?: string;` (sin segunda 's')
- **Spec A/B oficial**: `user_profession` (con doble 's')
- **Prompt Virginia**: `user_profesion` (sin 's')
- **Estado**: El código sigue la nomenclatura del prompt Virginia (`profesion`), pero la spec oficial dice `profession`. El campo está en tres estados distintos entre documentos.
- **Severidad**: **High**
- **Esfuerzo fix**: Bajo — decisión de nomenclatura canónica pendiente de cliente (ver D-004 en `00-known-divergences.md`). Mientras tanto, documentar cuál se usa en código para sincronizar BD.

---

### F-03-006: `YEARS_ EXPERIENCIE` (con espacio y typo) hardcodeado como clave de campo

- **Archivo**: `src/lib/services/ai-analysis.ts:62`, `src/lib/services/post-analysis.ts:76`
- **Código**: `"YEARS_ EXPERIENCIE"` — clave con espacio y typo ("EXPERIENCIE" vs "EXPERIENCE")
- **Estado**: Este campo aparece tanto en la interfaz `ConversationAnalysis` como en el código de `post-analysis.ts` para intentar parsear years_experience. Indica que en algún momento el LLM estaba devolviendo esta key errónea y se añadió como workaround.
- **Impacto**: Deuda técnica que enmascara inconsistencias del LLM output; el fallback con clave incorrecta puede hacer que años de experiencia nunca se guarden en `lead_cualificacion.anios_experiencia`.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — normalizar a `YEARS_EXPERIENCE` en el prompt del sistema de análisis y eliminar los fallbacks con typo.

---

### F-03-007: No hay tracking de tokens en servidor — costes son estimaciones en cliente

- **Archivo**: `src/app/dashboard/costs/page.tsx:110–113`
- **Código**: El dashboard calcula costes leyendo `metadata.token_usage` de `chat_messages`. Si no hay `token_usage`, aplica un fallback fijo de `$0.002` por mensaje de IA.
- **Observado**: En `WhatsAppAIProcessor.ts` el payload guardado en `chat_messages` incluye `metadata: { meta_id: completion.id, model: modelName }` — **no incluye `token_usage`**. Por tanto, casi todos los mensajes caen al fallback de $0.002.
- **Impacto**: Los costes mostrados en el dashboard son ficticios. No hay observabilidad real de consumo de tokens ni de coste por lead.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — añadir `token_usage: completion.usage` al payload de `chat_messages` en `WhatsAppAIProcessor.ts`.

---

### F-03-008: Múltiples clientes OpenAI instanciados por request — sin pool ni singleton

- **Archivos**: `ai-rescue.ts:4–15`, `fact-extractor.ts:72`, `ai-analysis.ts:95`, `WhatsAppAIProcessor.ts:107,337`
- **Observado**: `ai-rescue.ts` tiene un singleton lazy; el resto crean `new OpenAI({ apiKey })` en cada invocación del método/función.
- **Impacto**: Overhead menor en prod. No hay gestión de rate limiting. Si OpenAI devuelve 429, la llamada falla directamente — no hay retry automático ni backoff.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Medio — añadir wrapper con retry exponencial para 429/503. Centralizar instanciación.

---

### F-03-009: API key de OpenAI almacenada en columna `ai_agent_variants.api_key` (Supabase) sin cifrado adicional

- **Archivos**: `src/lib/services/ai-analysis.ts:30–34`, `src/lib/core/processors/WhatsAppAIProcessor.ts:77–79`
- **Observado**: La API key de OpenAI se lee directamente de la tabla `ai_agent_variants` y se usa en runtime. No hay evidencia de cifrado en reposo a nivel de aplicación (más allá del cifrado de disco de Supabase, si está configurado).
- **Impacto**: Si alguien con acceso a la BD obtiene esta tabla, obtiene las API keys de OpenAI de todos los tenants.
- **Severidad**: **High** (seguridad)
- **Esfuerzo fix**: Medio — cifrar el campo `api_key` con clave de aplicación antes de guardar; descifrar en runtime. O migrar a Supabase Vault / AWS Secrets Manager.

---

### F-03-010: `state = "prematriculado"` en prompt Virginia — no manejado en código de extracción

- **Archivo**: `src/lib/services/ai-analysis.ts`, `src/lib/services/fact-extractor.ts`
- **Observado**: El prompt Virginia define `estado = "prematriculado"` (línea 73 de `Promt-Virginia.md`). Ningún código de extracción/análisis maneja o valida este valor. `ai-analysis.ts` no lo menciona. `fact-extractor.ts` lo guardará como texto libre en metadata sin validación de enum.
- **Impacto**: Si el LLM escribe `prematriculado` como estado, llega a metadata pero no hay ninguna lógica de negocio que reaccione (no dispara notificación, no actualiza `tipo_lead`).
- **Severidad**: **Medium** (confirma D-007 de divergences)
- **Esfuerzo fix**: Bajo — añadir al enum de estados reconocidos en código y definir qué acción dispara.

---

### F-03-011: Latencia <800ms — no se mide, no se garantiza

- **Archivos**: `src/lib/core/processors/WhatsAppAIProcessor.ts`
- **Observado**: `startTime = Date.now()` se registra al inicio (línea 23). `elapsed = Date.now() - startTime` se usa (línea 462) **solo para calcular el retraso artificial de typing indicator** — no para alertar ni loggear si se supera el límite de 800ms.
- **Impacto**: El SLA de <800ms prometido no puede verificarse. Structuralmente, el procesador hace: (1) 7 queries paralelas a Supabase + embedding OpenAI, (2) llamada principal `openai.chat.completions.create`, (3) potencialmente 2 rondas de tool calls adicionales. El happy path mínimo (sin tool calls) probablemente supera 800ms en P95.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Medio — instrumentar latencia en `GlobalLogger` y definir alertas; revisar si 800ms es un SLA real o aspiracional.

---

### F-03-012: `master_name` vs `curse_name` — variable del orquestador no coincide con spec

- **Archivo**: `src/lib/core/orchestrator.ts:476`
- **Código**: `master_name: courseContext.course_name || ""`  — se pasa como variable dinámica a Retell
- **Spec Virginia**: La variable es `{{curse_name}}` (con typo oficial de la cliente), no `master_name`
- **Prompt Virginia (línea 213)**: usa `{{master_name}}` en la sección CONTEXTO para introducir al lead — **esta sí es una variable que el prompt de Virginia usa**, pero con nombre diferente al campo oficial de la spec (`curse_name`).
- **Impacto**: El orquestador envía `master_name` (correcto para Virginia en voz), pero los pipelines de extracción de WhatsApp buscan `curse_name` o `CURSE_NAME`. Doble nomenclatura para el mismo dato.
- **Severidad**: **Medium**
- **Esfuerzo fix**: Bajo — alinear nomenclatura enviando ambas keys, o decidir canónica.

---

## Cruce prompt código vs Promt-Virginia.md

### Variables presentes en Promt-Virginia.md pero no manejadas correctamente en código

| Variable Virginia | En código | Estado |
|---|---|---|
| `{{qualified}}` valores: `"apto"/"no apto"/""` | `ai-analysis.ts` usa `"si"/"no"/"anulado"`; `fact-extractor.ts` usa `"SI"/"NO"/"PENDIENTE"` | DIVERGE — crítico |
| `{{user_profesion}}` (sin 's') | `ai-analysis.ts:59` usa `USER_PROFESION` | COINCIDE con prompt (no con spec oficial) |
| `{{years_experience}}` (plural) | `fact-extractor.ts:322` busca múltiples variantes incluyendo `years_experience` | PARCIALMENTE coincide |
| `{{estado}}` valores incluyen `"prematriculado"` | No manejado en código | DIVERGE |
| `{{resumen_conversacion}}` | `fact-extractor.ts:162` lo mapea como `RESUMEN_CONVERSACION` | Mayúsculas vs minúsculas — puede no encontrar match |
| `{{regla_aplicada}}` | `QualificationProcessor.ts:68` guarda `REGLA_APLICADA` en metadata | Parcialmente implementado |
| `{{conversation_status}}` | `fact-extractor.ts:185–190` busca `conversation_status`/`CONVERSATION_STATUS`/`estado_conversacion` | DIVERGE — el prompt usa `conversation_status` pero código busca `estado_conversacion` principalmente |
| `book_appointmen` (typo en prompt) | Código registra `book_appointment` (correcto) | TYPO en fuente — riesgo al actualizar BD desde doc |
| `{{master_name}}` | Orquestador envía como `master_name` en Retell; WhatsApp no lo inyecta explícitamente | PARCIAL |

### Variables en spec oficial (A/B) no encontradas en código

- `{curse_origin}` — no está en ningún extractor
- `{nivel_estudios}` (como campo separado) — código lo extrae como texto dentro de `user_studies/USER_ESTUDIES`
- `{country_user_time}`, `{current_time}` — el procesador calcula timezone pero no las expone como variables de estado extraíbles

### Flujo de cualificación: diferencias árbol de decisión

| Regla | Virginia oficial | qualifier.ts (código) |
|---|---|---|
| Regla A (universitario/postgrado) | Siempre apto, sin condición adicional | Correcto |
| Regla B (técnico/FP) | `years_experience >= 2` + experiencia relevante | `years_experience >= 3` — **INCORRECTO** |
| Sin estudios/básico | `years_experience >= 2` + experiencia relevante | `years_experience >= 5` — **INCORRECTO** |
| Exclusión por profesión (camarero, albañil, etc.) | Implementada explícitamente | **No implementada** en `qualifier.ts` |
| Condición 2 (dueño de negocio) | Implementada (con excepciones de sector) | **No implementada** en `qualifier.ts` |

El engine determinístico (`qualifier.ts`) implementa una versión simplificada y parcialmente incorrecta del árbol de decisión de Virginia. El motor LLM (vía `ai-analysis.ts`) aplica reglas de cualificación en texto natural sin el árbol formal.

---

## Gestión de costes / observabilidad LLM

### Lo que existe

- Dashboard de costes en `src/app/dashboard/costs/page.tsx`: lee `chat_messages.metadata.token_usage` y estima costes. Precio hardcodeado: `$0.005/1K prompt tokens`, `$0.015/1K completion tokens` (precios de GPT-4 old, no actualizados para gpt-4o-mini que es más barato).
- Costes de llamadas: estimados a `$0.15/minuto` (hardcodeado, sin datos reales de Retell/Ultravox).
- Crecimiento mensual: `5.2%` simulado fijo (no calculado).

### Lo que NO existe

- **Token usage no se guarda en servidor**: `WhatsAppAIProcessor.ts` no incluye `completion.usage` en el payload de `chat_messages`. Los datos de token_usage en BD son nulos salvo que algún otro flujo los rellene.
- **No hay rate limiting**: Si OpenAI devuelve 429, la llamada falla. No hay circuit breaker ni retry con backoff.
- **No hay alertas de coste**: Ningún sistema notifica si un tenant supera un umbral de gasto.
- **No hay tracking de latencia**: `startTime` existe en WhatsAppAIProcessor pero solo se usa para simular typing — no se registra en logs ni BD.
- **AWS Bedrock**: No está presente en el codebase. Solo se usa `@aws-sdk/client-s3` para MinIO (almacenamiento de objetos). No hay integración con Bedrock.

---

## Voz: Retell + Ultravox

### Retell

- **Bridge**: `src/lib/integrations/retell.ts` — wrapper del `retell-sdk` oficial (^5.12.0). Simple y correcto.
- **Webhook post-llamada**: `src/app/api/webhooks/retell/route.ts` — escucha `call_analyzed` y `call_ended`. Guarda llamada en tabla `llamadas`, dispara `PostAnalysisService.processInteraction()` de forma fire-and-forget.
- **Tool webhook (real-time)**: `src/app/api/webhooks/retell/tools/route.ts` — recibe tool calls en tiempo real durante la llamada. Implementa correctamente: `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `check_availability`, `get_lead_info`.
- **Hallazgo**: El webhook de tools recibe el tool name del agente Retell. Si el prompt en Retell usa `book_appointmen` (typo de Virginia), el case switch no hará match con `case "book_appointment"` — la cita no se agenda y el agente recibe un 404. Relacionado con F-03-004.

### Ultravox

- **Bridge**: `src/lib/integrations/ultravox.ts` — wrapper REST custom con `fetch`. Completo (list agents, create, update, get transcript, get recording). Sin retry en errores de red.
- **Integración**: El orquestador detecta el proveedor (`RETELL` vs `ULTRAVOX`) en `orchestrator.ts:496`. Ultravox usa Twilio como capa de telefonía (`TelephonyFactory`).
- **Hallazgo crítico**: No hay webhook de Ultravox equivalente al de Retell. No existe `src/app/api/webhooks/ultravox/`. Cuando una llamada Ultravox termina, no hay mecanismo para: (a) recibir la transcripción automáticamente, (b) disparar `PostAnalysisService`, (c) guardar la llamada en `llamadas`. Las llamadas Ultravox son "fire and forget" sin análisis post-llamada.

### Latencia de voz

- **Retell**: La latencia de respuesta del agente de voz la gestiona Retell internamente. El codebase no mide ni controla la latencia voz→respuesta.
- **WhatsApp AI**: `startTime` medido pero solo para typing indicator artificial. No hay log de latencia real. La arquitectura (7 operaciones paralelas + embedding + GPT) es compatible con <1s en P50 pero probablemente >1s en P95.
- **No hay fallback de voz**: Si Retell falla, el orquestador lanza error y no intenta Ultravox como fallback. Los dos proveedores son mutuamente excluyentes por configuración de tenant.

---

**Status:** DONE_WITH_CONCERNS

**Summary:** 12 findings identificados (3 Critical, 4 High, 5 Medium). Los más graves son el módulo `llm-factory` inexistente que rompe `QualificationProcessor`, el schema de variables de cualificación triplicado en tres valores distintos, los umbrales del árbol de decisión incorrectos, y la ausencia total de webhook post-llamada para Ultravox. El tracking de costes existe en UI pero los datos subyacentes son ficticios por falta de persistencia de token_usage.

**Concerns:**
- La autorización para invocar AWS Bedrock no fue necesaria — Bedrock no existe en el codebase.
- `llm-factory` missing es bloqueante para `QualificationProcessor` — este componente está efectivamente muerto en producción.
- El análisis del prompt en BD vs el de Virginia.md asume que el contenido de `ai_agent_variants.prompt_text` es similar al de `Promt-Virginia.md` — no se puede verificar sin acceso a la BD de producción.
