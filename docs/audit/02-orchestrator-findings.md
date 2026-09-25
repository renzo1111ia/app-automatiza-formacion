---
title: "Audit Orchestrator — Findings"
date: 2026-05-18
agent: Audit-Orchestrator (Sonnet)
phase: 2
---

# Audit Orchestrator

## Perímetro auditado

| Archivo | Líneas |
|---------|--------|
| `worker.js` (raíz) | 90 |
| `src/lib/core/orchestrator.ts` | 1384 |
| `src/lib/core/queue/lead-sequence-queue.ts` | 188 |
| `src/lib/core/scheduler.ts` | 243 |
| `src/lib/core/compliance.ts` | 243 |
| `src/lib/core/feature-flags.ts` | 35 |
| `src/lib/core/multi-agent.ts` | 70 |
| `src/lib/core/sweep-queue.ts` | 81 |
| `src/lib/core/test-ab.ts` | 65 |
| `src/lib/core/intelligence/qualifier.ts` | 114 |
| `src/lib/core/processors/AppointmentWatchdog.ts` | 61 |
| `src/lib/core/processors/CRMExportProcessor.ts` | 165 |
| `src/lib/core/processors/CRMPollingProcessor.ts` | 82 |
| `src/lib/core/processors/QualificationProcessor.ts` | 193 |
| `src/lib/core/processors/WhatsAppAIProcessor.ts` | 591 |
| `src/lib/core/processors/WhatsAppWebhookProcessor.ts` | 283 |
| `src/lib/core/processors/ZohoPollingProcessor.ts` | 127 |
| `src/lib/core/workers/RescueWorker.ts` | 177 |

---

## Resumen ejecutivo

El orchestrator implementa un secuenciador de leads multi-paso sobre BullMQ con compliance de zona horaria, retry logic, y soporte A/B testing. La arquitectura es coherente en su diseño, pero presenta **un bug crítico de invocación** que hace que los jobs de secuencia reactivados por el worker fallen silenciosamente. Adicionalmente, la lógica de cualificación tiene umbrales distintos a los especificados por la cliente, y hay deuda técnica significativa en observabilidad, idempotencia y dead-letter queuing.

**Resumen de findings por severidad:**

| Severidad | Cantidad |
|-----------|---------|
| Critical | 5 |
| High | 7 |
| Medium | 5 |
| Low | 3 |

---

## Findings

### F-02-001: Firma incompatible — worker.js llama executeSequenceStep con argumento incorrecto

- **Archivo**: `worker.js:58` / `src/lib/core/orchestrator.ts:160-166`
- **Severidad**: Critical
- **Esfuerzo**: S
- **Descripción**: `worker.js` invoca `orchestrator.executeSequenceStep(job.data)` pasando un objeto `LeadSequenceJob` plano. La firma real del método es `executeSequenceStep(lead: Lead, tenantId: string, sequence: OrchestratorSequenceStep[], stepIndex: number, config: TenantOrchestratorConfig)`. El objeto `job.data` no es un `Lead`, y los parámetros `sequence` y `config` son `undefined`. Todos los jobs de secuencia estándar (`call`, `whatsapp`, `ai_agent`, `zoho`, `APPOINTMENT_REMINDER`) deactivados por BullMQ ejecutan código que crashea silenciosamente o hace nada útil. El primer paso de una secuencia (ejecutado directamente por `handleNewLead`) funciona; solo los pasos encolados y reactivados están rotos.
- **Spec relacionada**: Flujo deseado paso 2 (protocolo de contacto multi-día). El flujo multi-paso no funciona.
- **Fix sugerido**: En `worker.js`, recuperar los datos completos desde Supabase usando el `leadId` y `tenantId` del job, cargar el config del tenant y la secuencia, y llamar con la firma correcta:
  ```js
  // worker.js, reemplazar línea 58:
  const supabaseForStep = await getSupabaseServerClient();
  const { data: freshLead } = await supabaseForStep.from("lead").select("*").eq("id", leadId).single();
  const { getOrchestratorConfigForTenant } = await import("./src/lib/actions/orchestrator-config.js");
  const cfg = await getOrchestratorConfigForTenant(tenantId);
  const stepIdx = job.data.step ?? 0;
  await orchestrator.executeSequenceStep(freshLead, tenantId, cfg.sequence, stepIdx, cfg);
  ```

---

### F-02-002: Sin dead-letter queue — trabajos fallidos se pierden tras 3 reintentos

- **Archivo**: `src/lib/core/queue/lead-sequence-queue.ts:78-81`
- **Severidad**: Critical
- **Esfuerzo**: M
- **Descripción**: La configuración de BullMQ usa `removeOnFail: { count: 500 }`. Los jobs que exceden los 3 intentos con backoff exponencial se eliminan del store en Redis. No existe una dead-letter queue (DLQ) ni notificación de fallo permanente. Un lead cuyo job falla repetidamente desaparece silenciosamente, sin que ningún humano sea alertado ni el lead sea marcado como "error" en BD.
- **Spec relacionada**: Sistema de 3.000-4.000+ leads/mes requiere resiliencia operacional observable.
- **Fix sugerido**: Añadir listener `worker.on("failed", ...)` con persistencia en BD (`orchestration_logs` con `result: "PERMANENTLY_FAILED"`), y considerar una cola separada `lead_dlq` para jobs permanentemente fallidos.

---

### F-02-003: Hardcoded Zoho owner ID específico de Esden en código fuente

- **Archivo**: `src/lib/core/orchestrator.ts:36,54`
- **Severidad**: Critical
- **Esfuerzo**: S
- **Descripción**: El ID Zoho de Virginia (`781577000032471016`) y el ID de transición de anulación (`781577000002647388`) están hardcodeados en el código fuente. Esto viola multi-tenancy (el sistema está diseñado para varios centros educativos), hace imposible cambiar el agente sin desplegar código, y rompe otros tenants que tengan sus propios agentes. El mismo patrón aplica al ID de transición `781577000002647388` usado en la anulación por número inválido.
- **Spec relacionada**: D-002 (multi-tenancy); spec confirma plataforma multi-tenant para varios centros educativos.
- **Fix sugerido**: Mover ambos IDs a `tenant_orchestrator_config` (campos `zoho.ai_owner_id` y `zoho.invalid_phone_transition_id`). El código ya tiene `config.zoho?.ai_owner_id` como fallback pero el literal está en el fallback mismo.

---

### F-02-004: AppointmentWatchdog sin filtro por tenant — cross-tenant data access

- **Archivo**: `src/lib/core/processors/AppointmentWatchdog.ts:19-26`
- **Severidad**: Critical
- **Esfuerzo**: S
- **Descripción**: La query `.select("*, lead(*)").in("status", ["PENDING","SCHEDULED"]).lte("scheduled_at", ...).eq("watchdog_processed", false)` no incluye ningún filtro `tenant_id`. El watchdog procesa citas de TODOS los tenants sin distinción. Dado que el watchdog corre con `getAdminSupabaseClient()` (service role key, sin RLS), esto es un fallo de aislamiento de datos entre tenants.
- **Spec relacionada**: D-002 (multi-tenancy crítico).
- **Fix sugerido**: Iterar tenants activos explícitamente, o añadir `.eq("tenant_id", tenantId)` dentro de un loop por tenants (igual que hace `ZohoPollingProcessor`). Alternativamente, la query podría añadir un join sobre `lead(tenant_id)` y filtrar por tenant activo.

---

### F-02-005: `llm-factory` referenciado pero no existe — QualificationProcessor roto

- **Archivo**: `src/lib/core/processors/QualificationProcessor.ts:8`
- **Severidad**: Critical
- **Esfuerzo**: M
- **Descripción**: `import { createLLM } from "@/lib/core/intelligence/llm-factory"` está marcado con `@ts-expect-error` y el archivo `llm-factory.ts` no existe en `src/lib/core/intelligence/` (solo existe `qualifier.ts`). Cualquier llamada a `QUALIFY_ANALYSIS` en el worker crashea en runtime con `MODULE_NOT_FOUND`. El procesador de análisis profundo de transcripciones está completamente roto.
- **Spec relacionada**: Fase 3 del flujo deseado (cualificación por agente IA). Sin este procesador, los datos de cualificación no se persisten en `lead_cualificacion`.
- **Fix sugerido**: Crear `src/lib/core/intelligence/llm-factory.ts` con la función `createLLM(provider, modelName, temperature)` usando el `AgentFactory` ya existente en `multi-agent.ts`, o refactorizar `QualificationProcessor` para importar de `multi-agent.ts` directamente.

---

### F-02-006: Umbrales de cualificación distintos a la spec de la cliente

- **Archivo**: `src/lib/core/intelligence/qualifier.ts:79-104`
- **Severidad**: High
- **Esfuerzo**: S
- **Descripción**: El motor de cualificación implementa umbrales diferentes a los del prompt Virginia (spec autoritaria):

  | Regla | Spec (Promt-Virginia.md) | Código (qualifier.ts) |
  |-------|--------------------------|----------------------|
  | Técnico/FP | `years_experience >= 2` | `expYears >= 3` |
  | Sin estudios/Básico | `years_experience >= 2` | `expYears >= 5` |
  | PREUNIVERSITARIO (Bachiller) | Regla A → apto directo | Cae en "SIN_ESTUDIOS/BASICO" si no es universitario puro |

  Adicionalmente, el campo de entrada se llama `nivel_estudios` (nombre del spec A/B) y no `user_studies` (que es lo que el agente reporta). El motor determinista no se llama desde ningún flujo activo en producción (solo `QualificationProcessor` usa el LLM), pero si se conectara, los resultados diferirían de la spec.
- **Spec relacionada**: Spec §3.5, Regla B: `years_experience >= 2`. Regla A incluye "bachiller" explícitamente como apto.
- **Fix sugerido**: Corregir umbrales: TECNICO → `>= 2`, SIN_ESTUDIOS → `>= 2`. Añadir regex para "bachiller" en categoría PREUNIVERSITARIO y marcarlo como apto por Regla A.

---

### F-02-007: Race condition en retry sequence — doble enqueue posible

- **Archivo**: `src/lib/core/orchestrator.ts:1262-1276`
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: En `executeRetrySequenceStep`, se actualiza el `sequence_attempts` en metadata del lead y luego se llama `queueStep` que usa `jobId: lead-{leadId}-step-{stepIndex}`. Si el worker tiene `concurrency: 5` y dos jobs del mismo lead llegan casi simultáneamente (posible si el pacing re-encola), ambos pueden pasar la verificación de `currentAttempt < maxAttempts` antes de que el primero haya escrito el incremento a BD. El resultado es un intento extra no deseado (llamada o WhatsApp duplicado).
- **Spec relacionada**: Protocolo multi-día configurable; duplicar contactos es un problema de compliance.
- **Fix sugerido**: Usar `jobId` único por intento (`lead-{leadId}-seq-attempt-{attempt}`) para que BullMQ rechace duplicados. Alternativamente, usar un lock optimista en BD: UPDATE con `WHERE sequence_attempts = {currentAttempt}` y verificar que se actualizó 1 fila.

---

### F-02-008: triggerDynamicResume usa `step_number` de logs como proxy de posición — frágil

- **Archivo**: `src/lib/core/orchestrator.ts:364-393`
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: `triggerDynamicResume` determina el siguiente paso consultando el último `step_number` con `result: "SUCCESS"` en `orchestration_logs`. Este enfoque falla si: (a) un paso previo falló y fue reintentado con éxito en número diferente, (b) el step number en logs no mapea 1:1 con `stepIndex` en la secuencia del config, (c) hay pasos `QUEUED` que no tienen SUCCESS todavía. La consecuencia es saltar pasos o repetir pasos.
- **Spec relacionada**: Flujo multi-paso; el estado de posición debe ser determinista.
- **Fix sugerido**: Persistir explícitamente el `current_step_index` en la tabla `lead` o en `metadata`, actualizado atomicamente al inicio de cada step exitoso. Usar ese campo en lugar de inferir posición desde logs.

---

### F-02-009: sweepQueue es una segunda cola Redis paralela no integrada con BullMQ

- **Archivo**: `src/lib/core/sweep-queue.ts:1-81`
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: `SweepQueue` implementa una sorted set de Redis manual (`sweep_queue:pending`) sin relación con la cola BullMQ. El método `sweep()` itera los items y los elimina, pero el bloque `// Logic to be implemented in worker` (línea 67) está vacío. La clase se instancia como singleton `sweepQueue` pero nunca se llama desde ningún worker activo ni cron. Es código muerto con una conexión Redis extra abierta.
- **Spec relacionada**: D-011 (features construidos antes de corregir bugs centrales — deuda estructural).
- **Fix sugerido**: Eliminar `SweepQueue` o conectarla al worker BullMQ. Si la intención era tener delayed jobs por tiempo, BullMQ lo resuelve nativamente con `delay`. No se necesita una sorted set manual.

---

### F-02-010: No hay deduplicación de leads en `handleNewLead` ni en `CRMPollingProcessor`

- **Archivo**: `src/lib/core/orchestrator.ts:114-154` / `src/lib/core/processors/CRMPollingProcessor.ts:46-58` / `src/lib/core/processors/ZohoPollingProcessor.ts:49-66`
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: `handleNewLead` no verifica si el lead ya existe en un estado activo (en curso, agendado). Solo comprueba `is_ai_enabled`. Los pollers (Zoho, CRM) hacen un `upsert` con `onConflict: "tenant_id, id_lead_externo"` que evita duplicar filas en BD, pero inmediatamente llaman `orchestrator.handleNewLead` sin verificar si el lead ya tiene una secuencia activa en BullMQ. Si el mismo lead de Zoho aparece en dos ciclos de polling consecutivos, se le encolaría dos veces la secuencia completa.
- **Spec relacionada**: Flujo deseado Fase 1: "Si es duplicado, NO procesar."
- **Fix sugerido**: Antes de `handleNewLead`, verificar si existe un job activo en BullMQ para el leadId (usando `queue.getJob(jobId)`) o un campo `sequence_started_at` en `lead` con timestamp. Si ya está activo, skip.

---

### F-02-011: `QualifyAgent.processConversation` — stub sin implementar

- **Archivo**: `src/lib/core/multi-agent.ts:66-70`
- **Severidad**: High
- **Esfuerzo**: L
- **Descripción**: El método `QualifyAgent.processConversation` contiene solo un `// TODO: Implement LangChain chain with prompt source` y un `console.log`. La clase existe y es instanciable pero no produce ningún resultado. Toda la lógica de qualificación vía LangChain multi-agente está sin implementar.
- **Spec relacionada**: Flujo deseado Fase 3 (cualificación por agente IA).
- **Fix sugerido**: Implementar la cadena LangChain: cargar el prompt de la variante A o B según `promptSource`, construir un `ChatPromptTemplate`, invocar el modelo, parsear el resultado para extraer variables de cualificación.

---

### F-02-012: `crons` de watchdog y Zoho usan `tenantId: "system"` — ids ficticios en logs

- **Archivo**: `src/lib/core/queue/lead-sequence-queue.ts:133-162`
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: Los cron jobs de BullMQ se registran con `leadId: "system"` y `tenantId: "system"`. Cuando el worker ejecuta el handler de WATCHDOG_SCAN o ZOHO_POLLING, comprueba el spend limit del tenant `"system"`: `supabase.from("tenants").select(...).eq("id", "system")`. Esa query devuelve `null`, lo que hace que el circuit breaker salte y el job continúe (comportamiento correcto por defecto nulo), pero el log de gasto no existe. Si la lógica cambia, los crons quedan bloqueados por un tenant ficticio.
- **Fix sugerido**: Refactorizar el circuit breaker check fuera del path de crons (verificar `action` antes del check), o usar un `tenantId` vacío explícitamente manejado.

---

### F-02-013: Compliance — ventana horaria solo verifica hora de llamada, no de WhatsApp

- **Archivo**: `src/lib/core/orchestrator.ts:257-266`
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: La compliance check en `executeSequenceStep` solo aplica la restricción horaria cuando `step.action === "call"`. El fallback WhatsApp (líneas 260-265) se ejecuta sin verificar si la plantilla de WhatsApp es legal según la zona horaria del lead. Las plantillas "oficiales" de WhatsApp pueden tener restricciones regulatorias dependiendo del país (GDPR, LGPD). Además, la spec dice que WhatsApp es el canal para "fuera de horario" — pero el código no confirma que sea dentro del horario para voz antes de ejecutar WhatsApp.
- **Spec relacionada**: Flujo deseado Fase 2 (lógica de zona horaria y canal de contacto).
- **Fix sugerido**: La lógica actual de "si call falla compliance → usar WA" es correcta en intención (WA fuera de horario está en spec). Sin embargo, documentar que las plantillas de WA tipo marketing tienen ventanas propias según Meta Business Policy, y añadir un flag configurable `whatsapp_also_respects_compliance_window`.

---

### F-02-014: `executeAIAgentStep` no envía mensaje al lead — solo asigna agente

- **Archivo**: `src/lib/core/orchestrator.ts:699-765`
- **Severidad**: Medium
- **Esfuerzo**: L
- **Descripción**: El paso `ai_agent` en la secuencia únicamente actualiza `lead.ai_agent_id` y construye un `systemPrompt` que no se envía a nadie. El comentario dice "In a real message event, this would be used for the AI Turn. The orchestrator just ensures the agent is assigned and ready." Esto significa que la acción `ai_agent` en la secuencia no dispara ninguna conversación activa — solo prepara el contexto. No hay ningún mensaje inicial enviado al lead.
- **Spec relacionada**: Flujo deseado Fase 3: el agente Virginia conduce la conversación. Si el primer contacto es por WhatsApp IA, se necesita un mensaje de apertura.
- **Fix sugerido**: Implementar el envío del mensaje inicial del agente IA desde `executeAIAgentStep`, usando el primer mensaje del prompt de Virginia como apertura, enviado via `whatsappBridge.sendTextMessage`.

---

### F-02-015: `CRMExportProcessor` — "agregar no sobrescribir" no implementado correctamente

- **Archivo**: `src/lib/core/processors/CRMExportProcessor.ts:75-87`
- **Severidad**: Medium
- **Esfuerzo**: M
- **Descripción**: El exportador itera `field_mapping` y actualiza solo los campos que existen en `metadata`. Sin embargo, llama a `provider.updateLead(extId, updateData)` que típicamente es un PUT o PATCH al CRM externo. Si el CRM externo (Zoho) sobreescribe campos no incluidos en el payload (comportamiento PUT), se pierden datos del CRM original. La spec requiere "agregar, no sobrescribir". La implementación correcta requeriría un GET previo + merge, o garantizar que el CRM provider use PATCH semántico.
- **Spec relacionada**: D-014 (agregar, no sobrescribir).
- **Fix sugerido**: Verificar que `ZohoProvider.updateLead` usa el endpoint `PUT /Leads/{id}` con solo los campos enviados (Zoho lo acepta como merge parcial). Documentar explícitamente el comportamiento. Si se usa un proveedor diferente, verificar idempotencia.

---

### F-02-016: `selectAgent` — A/B split no es reproducible ni auditable

- **Archivo**: `src/lib/core/orchestrator.ts:832-848`
- **Severidad**: Low
- **Esfuerzo**: S
- **Descripción**: La asignación A/B usa `Math.random()` en cada ejecución. No hay semilla ni tracking del grupo al que fue asignado el lead antes de ejecutar el paso. Si un lead re-entra a un paso (por retry o resume), puede recibir el agente B cuando antes tenía el A. Esto contamina los datos de A/B testing.
- **Fix sugerido**: Persistir el `abVariant` del lead en `metadata.ab_variant_assigned` en el primer paso. Leer ese valor en `selectAgent` para ser consistente con asignaciones previas.

---

### F-02-017: `RescueWorker` no está integrado en ningún cron del worker principal

- **Archivo**: `src/lib/core/workers/RescueWorker.ts` / `worker.js`
- **Severidad**: Low
- **Esfuerzo**: S
- **Descripción**: `runRescueCheck()` existe y está bien implementado, pero no hay ninguna llamada a esta función en `worker.js` ni en ningún cron de BullMQ. El rescue de inactividad nunca se ejecuta en producción salvo que exista otro punto de entrada no auditado.
- **Fix sugerido**: Añadir un cron BullMQ en `setupWatchdogCron` o separado: `repeat: { pattern: "*/5 * * * *" }` con `action: "RESCUE_CHECK"` y el handler correspondiente en `worker.js`.

---

### F-02-018: `test-ab.ts` llama método privado con `(orchestrator as any)` — anti-patrón

- **Archivo**: `src/lib/core/test-ab.ts:59`
- **Severidad**: Low
- **Esfuerzo**: S
- **Descripción**: El script de verificación A/B llama `(orchestrator as any).executeAIAgentAction(...)` — un método que no existe (el nombre real es `executeAIAgentStep`). El script falla silenciosamente. Además es un archivo de test en el directorio de producción `src/lib/core/`.
- **Fix sugerido**: Eliminar el archivo del build de producción moviéndolo a `src/__tests__/` o eliminándolo. Si se necesita verificación A/B, usar un endpoint de playground.

---

## Cruce con flujo deseado (spec cliente)

| Paso del flujo cliente | Implementación en código | Gap |
|------------------------|--------------------------|-----|
| **Fase 1**: Lead entra desde CRM en tiempo real | `ZohoPollingProcessor` (cada 10min) + webhook WhatsApp (tiempo real) | GAP PARCIAL: el polling no es tiempo real (10min lag). No hay webhook CRM nativo para Zoho. |
| **Fase 1**: Deduplicación por teléfono/email | `upsert` en pollers previene filas duplicadas en BD | GAP CRÍTICO: `handleNewLead` se llama igualmente; no hay verificación de secuencia activa. Ver F-02-010. |
| **Fase 2**: Verificar hora local del lead (9am–9pm) | `buildComplianceDecision` + `resolveTimezone` from phone prefix | OK: Implementado. Sábado cap a 14h está en código. |
| **Fase 2**: Si fuera de horario → WhatsApp plantilla | `executeWhatsAppStep` como fallback de compliance | OK: Implementado. |
| **Fase 2**: Si dentro de horario → llamada de voz | `executeCallStep` → Retell o Ultravox | OK: Implementado con detección de proveedor. |
| **Fase 2**: Protocolo multi-día configurable | `executeRetrySequenceStep` (max_attempts, channels, retry_delay_hours) | GAP CRÍTICO: jobs reactivados no funcionan por F-02-001. |
| **Fase 3**: Cualificación conversacional Virginia | `WhatsAppAIProcessor` (WA) + Retell/Ultravox (voz) | GAP PARCIAL: WA tiene tools y fact extraction. Voz requiere webhook post-call con transcript → `QUALIFY_ANALYSIS`, que está roto por F-02-005. |
| **Fase 3.5**: Árbol de decisión (Reglas A/B) | `qualifier.ts` (determinista) + `QualificationProcessor` (LLM) | GAP: umbrales erróneos en qualifier (F-02-006). QualificationProcessor roto (F-02-005). |
| **Fase 4**: Si apto → proponer agenda | `book_appointment` tool en `WhatsAppAIProcessor` | OK para WA. Para voz, depende de webhook Retell/Ultravox (Fase 3, fuera del perímetro). |
| **Fase 4**: Si no apto → descarte | No hay lógica de descarte explícita en orchestrator. `QualificationProcessor` actualiza `tipo_lead` a "DESCARTADO" | GAP: flujo de descarte no conectado al orchestrator principal. |
| **Fase 5**: Sync al CRM del cliente | `CRMExportProcessor` (via `CRM_SYNC` action) | GAP PARCIAL: "agregar no sobrescribir" no garantizado (F-02-015). |
| **Fase 6**: Estados `informado`/`matriculado` | No implementado en orchestrator | GAP: spec dice estos son gestionados manualmente por el asesor. Acceptable si se documenta. |

---

**Status:** DONE_WITH_CONCERNS

**Summary:** Se encontraron 5 findings críticos. El más urgente (F-02-001) rompe silenciosamente todos los pasos de secuencia encolados por BullMQ. El segundo más urgente (F-02-005) rompe el análisis de transcripciones. Ambos pueden provocar que el flujo multi-día de la cliente nunca funcione en producción.

**Concerns/Blockers:**
- F-02-001 es un bug de producción activo que requiere fix inmediato antes de cualquier otra mejora.
- F-02-005 requiere creación de `llm-factory.ts` (archivo faltante).
- Los umbrales de cualificación (F-02-006) requieren confirmación de la cliente antes de corregir — Regla B del spec dice `>= 2` pero podría ser intencional el `>= 3` en código si hay una versión actualizada de los requisitos.
- AppointmentWatchdog (F-02-004) tiene riesgo de cross-tenant. Prioritario si hay más de un tenant activo.
