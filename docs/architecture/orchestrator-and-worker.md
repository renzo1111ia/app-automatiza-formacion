# Orchestrator & Worker — Arquitectura Observada

**Fecha**: 2026-05-18
**Fuente**: Auditoría de código estático. Sin ejecución.

---

## 1. Visión general

El sistema implementa un secuenciador de leads asíncrono. El componente central es la clase `Orchestrator` (`src/lib/core/orchestrator.ts`), una instancia singleton que coordina llamadas de voz, mensajes WhatsApp, actualizaciones de CRM, y cualificación de leads. La ejecución diferida se gestiona vía BullMQ + Redis.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ENTRY POINTS                                   │
│                                                                     │
│  ZohoPollingProcessor    CRMPollingProcessor    WhatsApp Webhook     │
│  (cron 10min)            (cron genérico)        (tiempo real)       │
│         │                       │                      │            │
│         └───────────────────────┴──────────────────────┘            │
│                                 │                                   │
│                    orchestrator.handleNewLead()                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   ORCHESTRATOR CORE v3.0    │
                    │  orchestrator.ts            │
                    │                             │
                    │  1. Feature flag check      │
                    │  2. Entry filters           │
                    │  3. Circuit breaker (spend) │
                    │  4. Pacing check            │
                    │  5. AI enabled check        │
                    │  6. Stop condition check    │
                    │  7. Compliance guard        │
                    │  8. Execute step            │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              │                   │                    │
    ┌─────────▼────────┐ ┌───────▼───────┐ ┌─────────▼────────┐
    │  executeCallStep │ │executeWhatsApp│ │executeAIAgentStep│
    │  Retell / Ultravox│ │Step           │ │ (solo asigna     │
    │                  │ │WhatsApp Bridge│ │  agente — no envía│
    └─────────┬────────┘ └───────┬───────┘ │  mensaje)         │
              │                  │         └──────────────────┘
              │                  │
              └──────────────────┘
                        │
               ┌────────▼────────┐
               │   queueStep()   │
               │  enqueueLeadStep│
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │   BullMQ Queue  │
               │lead_sequence_q  │
               │  (Redis/Upstash)│
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │   worker.js     │ ← proceso Node.js standalone
               │  (BullMQ Worker)│
               └────────┬────────┘
                        │
         ┌──────────────┼─────────────────────────────┐
         │              │                             │
   WATCHDOG_SCAN  ZOHO_POLLING             call/whatsapp/ai_agent/zoho
         │              │                             │
         ▼              ▼                   ┌─────────▼──────────┐
   AppointmentWatchdog  ZohoPollingProcessor│orchestrator.execute│ ← BUG F-02-001
                                            │SequenceStep(job.data)│
                                            └──────────────────────┘
```

---

## 2. Colas y jobs

### Cola principal: `lead_sequence_queue`

| Propiedad | Valor |
|-----------|-------|
| Nombre | `lead_sequence_queue` |
| Backend | BullMQ + Redis (Upstash TLS) |
| Concurrencia | 5 workers paralelos |
| Reintentos | 3 intentos, backoff exponencial 5s |
| removeOnComplete | count: 1000 |
| removeOnFail | count: 500 |
| DLQ | No existe |

### Tipos de job (`action` field)

| Action | Handler | Descripción |
|--------|---------|-------------|
| `call` | orchestrator.executeSequenceStep | Llamada de voz (Retell/Ultravox) |
| `whatsapp` | orchestrator.executeSequenceStep | Plantilla WhatsApp |
| `ai_agent` | orchestrator.executeSequenceStep | Asignar agente IA (sin enviar mensaje) |
| `zoho` | orchestrator.executeSequenceStep | Actualización CRM (alias legacy) |
| `APPOINTMENT_REMINDER` | orchestrator.executeSequenceStep | Recordatorio de cita |
| `WATCHDOG_SCAN` | AppointmentWatchdog.run() | Escaneo de citas vencidas |
| `ZOHO_POLLING` | CRMPollingProcessor.run() | Polling CRM genérico |
| `QUALIFY_ANALYSIS` | QualificationProcessor.process() | Análisis LLM de transcripción |
| `CRM_SYNC` | CRMExportProcessor.exportLead() | Sync lead → CRM externo |
| `RETRY_SEQUENCE` | orchestrator.executeRetrySequenceStep() | Reintento multi-canal |

### Crons BullMQ

| Nombre | Pattern | Handler |
|--------|---------|---------|
| `watchdog_cron` | `*/15 * * * *` | WATCHDOG_SCAN |
| `zoho_cron` | `*/10 * * * *` | ZOHO_POLLING |

---

## 3. Secuencia de pasos (flujo lineal)

```
Lead nuevo
    │
    ▼
handleNewLead(leadId, tenantId)
    │
    ├─ [feature flag: native_orchestrator OFF] → salir
    ├─ [entry filters: campaign/origin/country] → salir si no pasa
    ├─ [config.sequence vacío] → salir
    │
    ▼
executeSequenceStep(lead, tenantId, sequence, stepIndex=0, config)
    │
    ├─ [spend limit superado] → log SKIPPED, salir
    ├─ [pacing limit superado] → re-encolar con delay de pacing
    ├─ [is_ai_enabled = false] → log SKIPPED, salir
    ├─ [lead respondió en últimos 20min] → pausa (no se encola siguiente)
    ├─ [shouldStopSequence: stage SCHEDULING/CLOSED/LOST/COMPLETED] → salir
    │
    ├─ compliance check (timezone)
    │   ├─ [acción = call] y fuera de horas → executeWhatsAppStep(fallback)
    │   └─ [otra acción] y fuera de horas → re-encolar para next window
    │
    ├─ ejecutar paso según step.action:
    │   ├─ call → executeCallStep (Retell o Ultravox)
    │   ├─ whatsapp → executeWhatsAppStep
    │   ├─ ai_agent → executeAIAgentStep (asigna agente, no envía)
    │   ├─ crm/zoho → executeCRMStep
    │   ├─ retry_sequence → executeRetrySequenceStep
    │   └─ wait → no-op (delay ya aplicado)
    │
    └─ encolar siguiente paso (nextIndex, delay = nextStep.delay_hours * 3600000)
```

---

## 4. Retry Sequence (contacto multi-día)

El paso `retry_sequence` implementa el protocolo de contacto configurable multi-día de la spec:

```
executeRetrySequenceStep(lead, tenantId, step, stepIndex, config)
    │
    ├─ Leer metadata.sequence_attempts (currentAttempt)
    ├─ Leer metadata.last_sequence_channel
    │
    ├─ buildComplianceDecision (timezone check)
    │
    ├─ Determinar channel (alternating: call ↔ whatsapp)
    │
    ├─ [DENTRO DE HORAS]:
    │   ├─ Ejecutar call o whatsapp
    │   ├─ Incrementar sequence_attempts en metadata
    │   └─ Si attempt < max_attempts → re-encolar con retry_delay_hours
    │   └─ Si attempt >= max_attempts → finishRetrySequence (estado: ilocalizable)
    │
    └─ [FUERA DE HORAS — Night Bridge]:
        ├─ Si canales incluye whatsapp → enviar WA (night bridge)
        ├─ Incrementar sequence_attempts
        └─ Re-encolar para next window (decision.delayMs)
```

### Configuración de retry_sequence

```typescript
{
  step: number,
  action: "retry_sequence",
  max_attempts: number,        // default 5
  channels: ["call", "whatsapp"],
  retry_delay_hours: number,   // default 27h
  final_status: string,        // default "ilocalizable"
  delay_hours: 0
}
```

---

## 5. Compliance (zona horaria)

```
buildComplianceDecision(phone, country, timezoneRules)
    │
    ├─ resolveTimezone:
    │   1. parsePhoneNumber → ISO country → IANA timezone (via libphonenumber-js + countries-and-timezones)
    │   2. Si falla → country string → lookup manual
    │   3. Fallback: timezoneRules.default_timezone || "Europe/Madrid"
    │
    ├─ isWithinLegalWindow(config):
    │   - Sábados: endHour recortado a 14h
    │   - Working days default: [1,2,3,4,5,6] (lunes–sábado)
    │
    └─ getNextWindowStart:
        - Busca el próximo día laboral con ventana no vencida
        - Fallback: +24h si no encuentra en 7 días
```

**Nota importante**: La spec dice 9am–9pm (21:00). El código usa `timezoneRules.end` como configurable, pero el coment dice "9:00 - 20:00". Verificar que `end = "21:00"` está configurado en `tenant_orchestrator_config`.

---

## 6. Procesadores de entrada de leads

### ZohoPollingProcessor (activo)
- Cada 10min vía cron BullMQ
- Criteria: `(Lead_Status:equals:Nuevo) AND (Lead_Source:equals:Meta) AND (Tag:not_contains:VirginIA)`
- Filtra por `L_nea_de_Negocio` (excluye GenD, EAP)
- Normaliza teléfono México (+521 → +52)
- Upsert en `lead` con `onConflict: "tenant_id, id_lead_externo"`
- Llama `orchestrator.handleNewLead` tras upsert

### CRMPollingProcessor (genérico, activo si crm.enabled)
- Igual patrón pero usa `CRMFactory` (abstracto, no solo Zoho)
- Sin filtros adicionales de L_nea_de_Negocio

### WhatsApp Webhook Processor (tiempo real)
- Identifica tenant por `phoneNumberId` (WABA ID)
- Deduplicación por `metadata->>meta_id` en `chat_messages`
- Crea lead si no existe (origen: `WHATSAPP_INBOUND`)
- Llama `generateAIWhatsAppResponse` si `is_ai_enabled = true`
- No llama al orchestrator principal de secuencia

---

## 7. WhatsApp AI Processor (WhatsApp conversacional)

El procesador de WhatsApp conversacional es independiente del orchestrator de secuencia:

```
generateAIWhatsAppResponse(tenantId, leadId, incomingMessage, messageId)
    │
    ├─ Fetch lead context
    ├─ Fetch agent variant (A/B, por orden: variant A first)
    │
    ├─ Parallel fetch:
    │   ├─ ChatMemoryService (últimas 10 mensajes de Redis o DB)
    │   ├─ ChatSummaryService (resumen long-term en Supabase)
    │   ├─ KnowledgeBaseService (PGVector RAG, embedding + search)
    │   ├─ Tenant WA credentials
    │   ├─ AppointmentService (citas activas del lead)
    │   └─ Programas del lead + todos los programas del tenant
    │
    ├─ Build system prompt con:
    │   ├─ Timezone rules master (contexto temporal)
    │   ├─ Datos del prospecto (nombre, teléfono, país, email)
    │   ├─ Criterios de cualificación por programa
    │   ├─ Tracked variables a capturar
    │   ├─ Local knowledge (RAG)
    │   ├─ Chat summary previo
    │   ├─ Contexto reciente (10 últimas líneas)
    │   └─ Citas programadas
    │
    ├─ Call OpenAI (gpt-4o o modelo configurado), tools activadas
    │
    ├─ Tool calls loop (max 2 rounds):
    │   ├─ book_appointment → AppointmentService.bookAppointment
    │   ├─ cancel_appointment → AppointmentService.cancelAppointment
    │   ├─ reschedule_appointment → AppointmentService.rescheduleAppointment
    │   └─ check_availability → AppointmentService.checkAvailability
    │
    ├─ Enviar respuesta vía WhatsApp Bridge
    ├─ Guardar en chat_messages (con retry strip de campos)
    ├─ Actualizar conversaciones_whatsapp (dashboard refresh)
    └─ FactExtractionService (async, non-blocking)
```

---

## 8. Qualification Processor (análisis post-llamada)

```
QualificationProcessor.process(leadId, tenantId, transcript, callId)
    │
    ├─ getContextualRules: curso + agent variant (con weighted random)
    ├─ createLLM(provider, modelName) ← BROKEN: llm-factory.ts no existe
    ├─ analyzeTranscript(llm, transcript, courseInfo, rules):
    │   └─ LangChain PromptTemplate + StructuredOutputParser (Zod schema)
    │   └─ Output: { interest_score, summary, objections, profile_fit,
    │               suggested_segment, next_steps, budget_mentioned }
    ├─ Persistir en lead_cualificacion (INSERT)
    ├─ Actualizar lead.metadata con RESUMEN_CONVERSACION, MOTIVO_DESCARTE, etc.
    └─ Actualizar lead.tipo_lead (CUALIFICADO | DESCARTADO | EN SEGUIMIENTO)
```

**Nota**: el análisis usa scoring numérico (1-10) como proxy de cualificación, no el árbol de decisión de la spec (Regla A/B). Son dos sistemas paralelos sin conexión.

---

## 9. Appointment Scheduler (booking)

```
bookAppointment(leadId, tenantId, requestedAt, options)
    │
    ├─ findAvailableAdvisor(tenantId, requestedAt, {timezone, programaId}):
    │   ├─ Query availability_slots WHERE day_of_week AND time in range
    │   ├─ Filter by advisor_programas if programaId given
    │   ├─ Count weekly appointments per advisor
    │   └─ Return least-loaded advisor (Round Robin by weekly load)
    │
    ├─ Check double-booking (conflicts en rango temporal)
    │
    └─ INSERT appointments {
           tenant_id, advisor_id, lead_id,
           scheduled_at, duration_minutes,
           status: "PENDING", agent_used, ab_variant
       }
```

---

## 10. Scheduler de logs

`logOrchestrationStep` inserta en `orchestration_logs`:

| Campo | Valores |
|-------|---------|
| `action_type` | CALL, WHATSAPP, AI_AGENT, CRM, SYSTEM, QUALIFICATION |
| `result` | SUCCESS, FAILED, SKIPPED, QUEUED |
| `ab_variant` | A, B, null |

---

## 11. Feature Flags

```
isFeatureEnabled(tenantId, flagKey) → boolean
    │
    └─ SELECT from feature_flags
       WHERE (tenant_id = tenantId OR tenant_id IS NULL)
       AND flag_key = flagKey
       ORDER BY tenant_id DESC LIMIT 1
       (tenant-specific overrides global)
```

Flag activo en flujo principal: `native_orchestrator`. Si está desactivado, `handleNewLead` no hace nada.

---

## 12. Multi-Agent Framework

`src/lib/core/multi-agent.ts` provee una fábrica polimórfica de LLMs:

| LLMType | Librería | Modelo por defecto |
|---------|----------|-------------------|
| OPENAI | @langchain/openai | gpt-4o |
| CLAUDE / ANTHROPIC | @langchain/anthropic | claude-3-5-sonnet-20240620 |
| GEMINI | @langchain/google-genai | gemini-1.5-pro |

`QualifyAgent.processConversation` es un stub sin implementar (TODO).

---

## 13. Dependencias externas del perímetro

| Servicio | Archivo | Uso |
|---------|---------|-----|
| Redis / Upstash | lead-sequence-queue.ts, sweep-queue.ts | Cola BullMQ + sweep manual |
| Supabase | todos | BD principal |
| Zoho CRM | ZohoPollingProcessor, CRMFactory | Polling + update leads |
| Meta WhatsApp API | WhatsApp Bridge | Envío de mensajes y templates |
| Retell / Ultravox | orchestrator.ts | Llamadas de voz (Fase 3, fuera de perímetro) |
| MinIO | WhatsAppWebhookProcessor | Almacenamiento de media inbound |
| OpenAI | WhatsAppAIProcessor | Conversación IA (gpt-4o) |
| LangChain | QualificationProcessor, multi-agent | Análisis transcripciones + fábrica LLM |

---

## 14. Bugs conocidos (resumen rápido)

1. **F-02-001 CRÍTICO**: `worker.js:58` — firma incompatible en `executeSequenceStep`. Todos los pasos encolados por BullMQ fallan.
2. **F-02-005 CRÍTICO**: `llm-factory.ts` no existe. `QualificationProcessor` falla en runtime.
3. **F-02-004 CRÍTICO**: `AppointmentWatchdog` sin filtro por tenant.
4. **F-02-002 CRÍTICO**: Sin DLQ. Jobs fallidos se pierden silenciosamente.
5. **F-02-010 HIGH**: No hay deduplicación de secuencia activa para leads re-polleados.
