---
title: "Phase 03 — token_usage en chat_messages todos los consumidores OpenAI (C-03)"
sprint: SP-5B
phase: 3
tasks: [C-03]
effort: 2h
status: pending
agents: [af-agents:code]
---

# Phase 03 — `token_usage` en `chat_messages` (todos los consumidores OpenAI)

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) §Fase 4.5 (C-03)
- **Origen del movimiento (22-05-2026):** esta tarea vivía como 2-36 en Sprint 1 phase-04. Se trasladó al Sprint Costes-LLM (post-MVP) cuando la clienta confirmó que el centro de costes LLM no es necesario en MVP — sin dashboard que lo consuma (Ph2 de este sprint), 2-36 no aportaba valor en `v0.4.0`.
- Audit F-DA-4: `docs/audit/deep/DA-4-llm-voice-deep.md` — token_usage no persistido en `chat_messages`
- Informe Renzo: `docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf` §3 ⚠️ — confirma el mismo bug para el widget

## Overview

- **Priority:** P2
- **Status:** Pendiente
- **Descripción:** Persistir `completion.usage` en `chat_messages.metadata` para TODOS los consumidores OpenAI (WhatsAppAIProcessor, RescueWorker, widget.ts, FactExtractor, AIAnalysis). Cambio mecánico de 2h. Complementa Ph1 (`llm_usage_logs`) — ambas fuentes alimentan Ph2 (dashboard).

## Key Insights

- **Dos fuentes de verdad por diseño:**
  - `llm_usage_logs` (Ph1): entrada granular por llamada LLM, incluida la llamada secundaria de los tool calls (Ph1 captura cada `chat.completions.create()`).
  - `chat_messages.metadata.token_usage` (esta fase): entrada por mensaje persistido en el historial — coincide 1:1 con un mensaje de usuario en el Inbox.
- **No es duplicación**: en flujos con tool calls (`AIRescueService` puede hacer 2-3 llamadas LLM por mensaje), `llm_usage_logs` tiene 2-3 filas pero `chat_messages` solo 1. El dashboard de Ph2 puede mostrar ambos ángulos: "coste por mensaje" (desde chat_messages) y "coste por llamada LLM" (desde llm_usage_logs).
- **Sin backfilling**: aplica solo a chats nuevos desde el deploy. Los chats históricos quedan sin `token_usage` (irrecuperable — OpenAI no expone usage retroactivo).

## Requirements

### Funcionales

- En cada call site donde se inserta en `chat_messages` tras una llamada OpenAI, añadir al payload de `metadata`: `{ ...metadataExistente, token_usage: completion.usage, model: completion.model }`.
- Aplica a (mínimo, según audit F-DA-4 + informe Renzo):
  - `WhatsAppAIProcessor.ts`
  - `AIRescueService.ts` (RescueWorker)
  - `src/lib/actions/widget.ts` (~línea 165, tras `openai.chat.completions.create`)
  - `FactExtractor.ts`
  - `AIAnalysis.analyzeConversation`

### No funcionales

- El `metadata` debe cumplir el Zod schema de `chat_messages` (`z.record(z.unknown())` o equivalente — confirmar en 2-10 si ya está hecho, si no quedará para Sprint 1 normal y este fix se hará con tipo más permisivo).
- Sin cambios en otras columnas de `chat_messages`.

## Architecture

```
ANTES (5 call sites):
  const completion = await openai.chat.completions.create(...);
  await supabase.from('chat_messages').insert({
    ..., metadata: { meta_id: completion.id, model: modelName }
  });
  // → metadata.token_usage = UNDEFINED en producción

DESPUÉS:
  const completion = await openai.chat.completions.create(...);
  await supabase.from('chat_messages').insert({
    ..., metadata: {
      meta_id: completion.id,
      model: completion.model ?? modelName,
      token_usage: completion.usage,   // ← NUEVO
    }
  });
```

## Related Code Files

### Modificar (5 archivos)

- `src/lib/processors/whatsapp-ai-processor.ts` (o el path real — verificar antes de empezar)
- `src/lib/services/ai-rescue.ts` (o el path real del RescueWorker)
- `src/lib/actions/widget.ts` — línea ~165 (tras `openai.chat.completions.create`)
- `src/lib/services/fact-extractor.ts`
- `src/lib/services/ai-analysis.ts` (o donde viva `analyzeConversation`)

## Implementation Steps

1. **Inventario exacto** (15min):
   ```bash
   grep -rn "openai.chat.completions.create\|openai\.chat\.completions\.create" src/
   ```
   Cruzar con `grep -rn "chat_messages" src/lib/` para identificar qué call sites insertan tras la llamada LLM.

2. **Cambio mecánico** (5 archivos × ~15min): en cada insert a `chat_messages` posterior a una llamada OpenAI, añadir `token_usage: completion.usage` al payload de `metadata`.

3. **Verificación con Zod** (15min): confirmar que `MetadataSchema` de `chat_messages` permite el campo `token_usage` con la forma `{ prompt_tokens: number, completion_tokens: number, total_tokens: number }`. Si no lo permite, ajustar el schema (coordinar con 2-10 si todavía no se ha hecho, o usar `z.record(z.unknown())` temporalmente).

4. **Test smoke** (15min): tras chat de widget completo, verificar en DB:
   ```sql
   SELECT metadata->'token_usage' FROM chat_messages
   ORDER BY created_at DESC LIMIT 1;
   ```
   Debe devolver `{ "prompt_tokens": N, "completion_tokens": M, "total_tokens": N+M }`.

## Todo List

- [ ] C-03: Inventario `grep` de call sites OpenAI + insert chat_messages (5 esperados)
- [ ] C-03: Modificar `WhatsAppAIProcessor.ts` — añadir `token_usage` al insert
- [ ] C-03: Modificar `AIRescueService.ts`
- [ ] C-03: Modificar `widget.ts` (~línea 165, tras llamada OpenAI)
- [ ] C-03: Modificar `FactExtractor.ts`
- [ ] C-03: Modificar `AIAnalysis.analyzeConversation`
- [ ] C-03: Verificar Zod `MetadataSchema` permite `token_usage`
- [ ] C-03: Smoke test — chat de widget → fila en chat_messages con token_usage poblado
- [ ] C-03: Typecheck + lint + build limpios

## Success Criteria

- 5/5 call sites identificados modificados.
- 1 chat de cada tipo (widget, WhatsApp, rescue) → `chat_messages.metadata.token_usage` poblado con `{ prompt_tokens, completion_tokens, total_tokens }`.
- 0 errores typecheck (el cambio es aditivo en un campo `metadata` JSONB — debería ser trivial).

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| `completion.usage` es `undefined` en algún flujo (modelo cambiado o error API) | Baja | Bajo | `token_usage: completion.usage ?? null` — opcional, no rompe la inserción |
| El Zod schema rechaza el nuevo campo | Media | Bajo | Si 2-10 todavía no se hizo o usa schema estricto, ampliar `metadata: z.record(z.unknown())` |
| Call site nuevo añadido después olvida el `token_usage` | Media | Bajo | Documentar en `docs/architecture/llm-cost-tracking.md` como patrón obligatorio + code review check |

## Security Considerations

- `token_usage` no contiene PII — solo enteros (contadores de tokens).
- Sin cambios en RLS de `chat_messages` (la RLS se aborda en otra tarea audit F-04-013 pendiente, no en esta fase).

## Next Steps

- → [Phase 04 — Cierre Sprint](phase-04-cierre-sprint.md)
- **Cross-ref con Ph1**: las inserciones de `chat_messages` (esta fase) y `llm_usage_logs` (Ph1) **no se deduplican** — son dos vistas distintas del mismo flujo (por mensaje vs por llamada LLM).
