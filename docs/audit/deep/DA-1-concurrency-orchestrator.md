---
title: "Deep Audit DA-1 — Concurrencia & Orchestrator"
date: 2026-05-18
agent: DA-1 (Sonnet)
phase: deep-audit
related_quick: [02-orchestrator-findings.md]
---

# DA-1 — Concurrencia & Orchestrator

## Metodología

Análisis estático línea-por-línea de los archivos del perímetro. Sin ejecución de código.
Cada archivo fue leído completo. Los findings del quick scan se profundizan con el callstack
real, datos exactos de línea, y análisis de escenarios de fallo concretos.

---

## Perímetro auditado (archivos leídos completos)

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `worker.js` | 90 | Leído completo |
| `src/lib/core/orchestrator.ts` | 1384 | Leído completo (4 bloques) |
| `src/lib/core/queue/lead-sequence-queue.ts` | 188 | Leído completo |
| `src/lib/core/scheduler.ts` | 243 | Leído completo |
| `src/lib/core/sweep-queue.ts` | 81 | Leído completo |
| `src/lib/core/compliance.ts` | 243 | Leído completo |
| `src/lib/core/feature-flags.ts` | 35 | Leído completo |
| `src/lib/core/multi-agent.ts` | 70 | Leído completo |
| `src/lib/core/intelligence/qualifier.ts` | 114 | Leído completo |
| `src/lib/core/processors/AppointmentWatchdog.ts` | 61 | Leído completo |
| `src/lib/core/processors/CRMExportProcessor.ts` | 165 | Leído completo |
| `src/lib/core/processors/CRMPollingProcessor.ts` | 82 | Leído completo |
| `src/lib/core/processors/QualificationProcessor.ts` | 193 | Leído completo |
| `src/lib/core/processors/WhatsAppAIProcessor.ts` | 591 | Leído completo (3 bloques) |
| `src/lib/core/processors/WhatsAppWebhookProcessor.ts` | 283 | Leído completo |
| `src/lib/core/processors/ZohoPollingProcessor.ts` | 127 | Leído completo |
| `src/lib/core/workers/RescueWorker.ts` | 177 | Leído completo |

Nota: `src/lib/core/compliance/*` y `src/lib/core/feature-flags/*` no son subdirectorios
sino archivos únicos (`compliance.ts`, `feature-flags.ts`) en `src/lib/core/`. No hay
carpetas `intelligence/` adicionales más allá de `qualifier.ts`.

---

## Resumen ejecutivo

El sistema BullMQ tiene un **bug de firma silencioso** (F-02-001) que hace que todos los
pasos de secuencia reactivados por el worker fallen silenciosamente o ejecuten código con
datos incorrectos. Este es el defecto más grave: el flujo multi-día de la spec nunca
funciona en producción para ningún step encolado.

Además de confirmar y profundizar los 18 findings del quick scan, este deep audit identifica
**8 nuevos findings** (DA-1-001 a DA-1-008) con severidades entre Critical y Medium,
centrados en: race conditions concretas, dos conexiones Redis redundantes abiertas siempre,
ausencia total de pool de Supabase clients, circuit breaker duplicado worker+orchestrator,
comportamiento peligroso del fallback silencioso de Redis en enqueueLeadStep, y un problema
de idempotencia grave en el retry sequence que puede producir contactos dobles.

---

## Profundización de findings del quick scan

### F-02-001 — Worker signature mismatch (CRITICAL)

**Profundiza F-02-001 del quick scan.**

**Callstack completo cuando BullMQ reactiva un job de secuencia:**

```
BullMQ Worker (concurrency: 5)
  └─ processor callback (worker.js:19–71)
       └─ if action === "call" || "whatsapp" || "ai_agent" || "zoho" || "APPOINTMENT_REMINDER"
            └─ orchestrator.executeSequenceStep(job.data)   [worker.js:58]
                 ↑
                 FIRMA REAL: executeSequenceStep(lead: Lead, tenantId: string,
                             sequence: OrchestratorSequenceStep[], stepIndex: number,
                             config: TenantOrchestratorConfig)   [orchestrator.ts:160-166]
```

`job.data` es de tipo `LeadSequenceJob` (lead-sequence-queue.ts:57-69):
```typescript
interface LeadSequenceJob {
    leadId: string;       // ← esto pasa como argumento 'lead'
    tenantId: string;     // ← esto pasa como argumento 'tenantId'
    workflowId?: string;  // ← esto pasa como argumento 'sequence'
    step?: number;        // ← esto pasa como argumento 'stepIndex'
    action: ...;          // ← esto pasa como argumento 'config'
    ...
}
```

**Qué pasa exactamente en runtime:**

1. `lead` recibe el objeto `LeadSequenceJob` entero (no un `Lead`). No tiene `.telefono`,
   `.pais`, `.is_ai_enabled`, ni ningún campo de lead real.
2. `tenantId` recibe la cadena correcta del tenantId — coincide por azar porque
   `LeadSequenceJob.tenantId` es el segundo campo y TypeScript en runtime no valida tipos.
3. `sequence` recibe `job.data.workflowId` (string `"sequence"` o `undefined`).
4. `stepIndex` recibe `job.data.step` (number o `undefined`).
5. `config` recibe `job.data.action` (string como `"call"`).

**Consecuencias concretas en executeSequenceStep (orchestrator.ts:160-359):**

- `sequence.length` → `"sequence".length = 8` o `undefined.length` → TypeError crash → el
  job lanza excepción → BullMQ lo marca como failed → después de 3 intentos lo elimina
  (removeOnFail count: 500).
- La excepción se captura en `worker.js:59-62` y se re-lanza (`throw err`) → BullMQ
  incrementa el contador de reintentos. Con backoff exponencial: intento 2 a +5s, intento 3
  a +25s. Tras el tercer fallo el job desaparece del store.
- No hay log estructurado del error, solo `console.error("[WORKER] Execution failed...")`.
- El lead queda en el estado que tenía antes del job, sin avanzar en la secuencia.
- Si el primer paso se ejecutó bien (directamente desde `handleNewLead`, que sí usa la firma
  correcta), el lead puede haber recibido la primera llamada/WA pero nunca los siguientes.

**Jobs permanentes vs silenciados:**
El job falla permanentemente (no se silencia — hay un console.error). Pero como no hay DLQ
ni persistencia del estado de fallo en BD, el lead queda "congelado" sin indicación visible
en el dashboard de que su secuencia está rota. Desde la perspectiva del operador, el lead
simplemente no progresa.

**Primer paso funciona — solo pasos encolados están rotos:**
`handleNewLead` (orchestrator.ts:153) llama `executeSequenceStep(lead as Lead, tenantId,
sequence, 0, config)` con la firma correcta. Solo los pasos encolados via `queueStep` →
`enqueueLeadStep` → BullMQ → `worker.js:58` están rotos.

**Fix mínimo verificado (worker.js:55-63):**
```javascript
if (action === "call" || action === "whatsapp" || action === "ai_agent" ||
    action === "zoho" || action === "APPOINTMENT_REMINDER") {
    try {
        // Recuperar lead y config frescos desde BD
        const supabase = await getSupabaseServerClient();
        const { data: freshLead } = await supabase
            .from("lead").select("*").eq("id", leadId).single();
        if (!freshLead) throw new Error(`Lead ${leadId} not found`);

        const { getOrchestratorConfigForTenant } = await import(
            "./src/lib/actions/orchestrator-config.js"
        );
        const config = await getOrchestratorConfigForTenant(tenantId);
        const stepIndex = step ?? 0;

        await orchestrator.executeSequenceStep(
            freshLead, tenantId, config.sequence, stepIndex, config
        );
    } catch (err) {
        console.error(`[WORKER] Execution failed for job ${job.id}:`, err);
        throw err;
    }
}
```

---

### F-02-002 — DLQ ausente (CRITICAL)

**Profundiza F-02-002 del quick scan.**

**Datos exactos de configuración (lead-sequence-queue.ts:76-83):**
```typescript
defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
}
```

**Qué significa `removeOnFail: { count: 500 }`:**
BullMQ mantiene en Redis hasta 500 jobs fallidos en el set `bull:lead_sequence_queue:failed`.
Cuando hay más de 500, elimina los más antiguos. Dado que F-02-001 hace que TODOS los jobs
de secuencia fallen, en producción activa este límite se alcanza rápidamente.

**El listener de failed (lead-sequence-queue.ts:183-185) solo hace console.error:**
```typescript
worker.on("failed", (job, err) => {
    console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
});
```
No hay ninguna escritura a BD, no hay alerta, no hay actualización del estado del lead.

**Backoff real con attempts: 3 y delay: 5000:**
- Intento 1: inmediato
- Intento 2: +5s (5000ms * 2^0)
- Intento 3: +25s (5000ms * 2^2)
- Total tiempo hasta eliminación: ~30 segundos desde el primer intento.

Con 3000-4000 leads/mes (spec), y asumiendo que el 20% generan pasos encolados, son
600-800 jobs/mes que fallan silenciosamente. Sin DLQ, no hay forma de reprocesarlos.

**Fix:** Añadir persistencia en el listener `failed`:
```typescript
worker.on("failed", async (job, err) => {
    console.error(`[WORKER] ❌ Job ${job?.id} failed permanently:`, err.message);
    if (job?.attemptsMade >= (job?.opts?.attempts || 3)) {
        // Job permanentemente fallido — persistir en BD
        const supabase = await getSupabaseServerClient();
        await supabase.from("orchestration_logs").insert({
            tenant_id: job.data.tenantId,
            lead_id: job.data.leadId,
            action_type: job.data.action,
            result: "PERMANENTLY_FAILED",
            error_message: err.message,
            metadata: { jobId: job.id, attempts: job.attemptsMade }
        });
        // Opcional: mover a DLQ separada
        const dlq = getLeadQueue(); // o nueva cola lead_dlq
        await dlq.add("dlq-item", job.data, { jobId: `dlq-${job.id}` });
    }
});
```

---

### F-02-003 — Hardcoded Zoho owner ID (CRITICAL)

**Profundiza F-02-003 del quick scan.**

Dos constantes hardcodeadas confirmadas:

- `orchestrator.ts:54`: `"781577000032471016"` — ID de Virginia como owner en Zoho.
  Contexto: `const virginiaOwnerId = (config as any).zoho?.ai_owner_id || "781577000032471016"`
  El fallback es el literal. Si el campo no está en config (tenant nuevo, config incompleta),
  se usa el ID de Esden para el tenant equivocado.

- `orchestrator.ts:295`: `"781577000002647388"` — ID de transición de anulación Zoho.
  Contexto: `await provider.executeAction(..., "781577000002647388", { transitionId: "781577000002647388" })`
  Aquí NO hay lookup de config — el literal está directamente en la llamada. Cualquier
  tenant que tenga un error de teléfono inválido ejecutará una transición en el Zoho de
  Esden, no en el suyo propio.

**Escenario de fallo multi-tenant:** Tenant B (diferente escuela) se configura en el
sistema. Un lead de Tenant B tiene número inválido. El código llama
`provider.executeAction(lead.id_lead_externo_B, "781577000002647388", ...)` — ese ID
pertenece al Zoho de Esden, no al de Tenant B. Resultado: la transición falla con error
"Record not found" o, peor, actualiza un registro incorrecto en Zoho de Esden si el ID
coincide por casualidad.

---

### F-02-004 — AppointmentWatchdog sin filtro tenant (CRITICAL)

**Profundiza F-02-004 del quick scan.**

**Líneas exactas (AppointmentWatchdog.ts:20-25):**
```typescript
const { data: staleAppointments, error } = await (supabase
    .from("appointments" as any) as any)
    .select("*, lead(*)")
    .in("status", ["PENDING", "SCHEDULED"])
    .lte("scheduled_at", thirtyMinsAgo)
    .eq("watchdog_processed", false);
```

No hay `.eq("tenant_id", ...)` en ninguna parte. La tabla `appointments` tiene `tenant_id`
según la spec de BD, pero el watchdog no lo usa.

`supabase` viene de `getAdminSupabaseClient()` (service role key) — RLS desactivada.
Resultado: el watchdog procesa citas de TODOS los tenants en cada ciclo de 15 minutos.

**Acción que toma por cada cita (lines 44-45):**
```typescript
await supabase.from("appointments" as any).update({
    watchdog_processed: true, status: "NO_SHOW"
}).eq("id", apt.id);
```
Marca como NO_SHOW citas de tenants que no son el objetivo. El comentario dice
"You can call orchestrator.handleNoShow(apt.lead_id, apt.tenant_id)" pero esa llamada
no está implementada — el bloque de follow-up está vacío (línea 52).

**Doble problema:** (a) cross-tenant data access y (b) el follow-up nunca se ejecuta.
El watchdog solo marca como NO_SHOW pero no dispara ninguna secuencia de seguimiento.

---

### F-02-005 — llm-factory.ts no existe (CRITICAL)

**Profundiza F-02-005 del quick scan.**

**Import exacto (QualificationProcessor.ts:7-8):**
```typescript
// @ts-expect-error - Internal alias resolution in background jobs
import { createLLM } from "@/lib/core/intelligence/llm-factory";
```

El `@ts-expect-error` suprime el error de TypeScript en tiempo de compilación. En runtime
(worker.js ejecuta CJS/ESM transpilado), la importación dinámica falla con
`MODULE_NOT_FOUND` o equivalente.

**Glob sobre `src/lib/core/intelligence/`:** Solo existe `qualifier.ts`. No hay
`llm-factory.ts`.

**Callstack cuando QUALIFY_ANALYSIS se procesa:**
```
worker.js:43-45
  → qualificationProcessor.process({ leadId, tenantId, transcript, callId })
       → QualificationProcessor.process (line 40)
            → createLLM(provider, modelName, 0)   ← MODULE_NOT_FOUND aquí
```

El job falla en el primer intento, se reintenta 2 veces más, luego desaparece (F-02-002
aplica también aquí).

**`multi-agent.ts` ya tiene `AgentFactory.createModel`** que hace exactamente lo que
`createLLM` haría. La solución mínima es crear `llm-factory.ts`:
```typescript
// src/lib/core/intelligence/llm-factory.ts
import { AgentFactory } from "../multi-agent";
export function createLLM(provider: string, modelName: string, temperature: number) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    return AgentFactory.createModel({
        type: provider as any,
        modelName,
        apiKey,
        temperature
    });
}
```
Problema pendiente: el API key debe venir del variant, no del env global. Ver DA-1-003.

---

### F-02-006 — Umbrales cualificación distintos a spec (HIGH)

**Profundiza F-02-006 del quick scan.**

**Código exacto (qualifier.ts:79-104):**
```typescript
// REGLA B: Técnico -> >= 3 años
if (category === "TECNICO") {
    if (expYears >= 3) { ... "cualificado" ... }
    return { status: "no cualificado", reason: "...requiere al menos 3 años..." }
}

// REGLA C: Sin estudios / Básico -> >= 5 años
if (expYears >= 5) {
    return { status: "cualificado", ... "experiencia >= 5 años" }
}
```

**Spec (Promt-Virginia.md, Regla B):** `years_experience >= 2` para Técnico/FP,
Preuniversitario/Básico/Sin estudios. El código usa 3 y 5 respectivamente.

**Problema adicional — PREUNIVERSITARIO no tiene Regla A:**
`categorizeStudies` (qualifier.ts:48-58):
```typescript
if (/bachillerato|cou/.test(s)) return "PREUNIVERSITARIO";
```
`PREUNIVERSITARIO` no está en el bloque de Regla A (lines 68-76 solo comprueban
`UNIVERSITARIO` y `POSTGRADO`). Cae en la Regla C (>= 5 años).

Pero la spec (Promt-Virginia.md) es explícita: "bachiller en..." → `UNIVERSITARIO` por
Regla A (apto directo sin experiencia). La regex distingue `bachiller en` (universitario)
de `bachillerato` (preuniversitario), lo cual es correcto. Sin embargo, "COU" (el antiguo
bachillerato español) también es Preuniversitario en el código pero la spec menciona
"bachiller" como apto directo — ambigüedad que debe resolverse con la cliente.

**El qualifier no está conectado a ningún flujo activo:**
`evaluateLeadQualification` de `qualifier.ts` no es llamada desde ningún processor activo.
Solo `QualificationProcessor` usa LLM (roto por F-02-005). Cuando F-02-005 se corrija, el
LLM usará criterios numéricos (score 1-10, umbral 7) que no coinciden con el árbol de
decisión de la spec. Los dos sistemas de cualificación (determinista + LLM) son paralelos
sin conexión ni conciliación.

---

### F-02-007 — Race condition en retry sequence (HIGH)

**Profundiza F-02-007 del quick scan.**

**Código exacto (orchestrator.ts:1263-1276):**
```typescript
const nextAttempt = currentAttempt + 1;
await (supabase.from("lead" as any) as any)
    .update({ metadata: { ...meta, sequence_attempts: nextAttempt, ... } })
    .eq("id", lead.id);

if (nextAttempt < maxAttempts) {
    const delayMs = retryDelayHours * 60 * 60 * 1000;
    await this.queueStep(lead, tenantId, step, stepIndex, config, delayMs);
}
```

**Escenario de race condition con concurrency: 5:**

1. Job A llega al worker, `currentAttempt = 2`, `maxAttempts = 5`.
2. Job A ejecuta la llamada/WA (paso lento, ~2-5s).
3. Mientras Job A ejecuta, otro job del mismo lead llega (por pacing re-encole, o porque
   el watchdog triggeró un resume). `currentAttempt` en metadata todavía es `2` porque
   Job A no ha escrito aún.
4. Job B también ve `currentAttempt = 2`, ejecuta la llamada/WA por segunda vez.
5. Job A escribe `sequence_attempts: 3`. Job B escribe `sequence_attempts: 3` (no 4).
6. Resultado: dos llamadas/WA al lead, y el contador de intentos no se incrementó
   correctamente (se perdió un incremento).

**¿Cuán probable es esto?**
- El retry tiene delay de 27 horas (default) → en condiciones normales, no hay dos jobs
  del mismo lead simultáneos.
- Pero si el lead llega por webhook WhatsApp Y por polling Zoho (F-02-010), ambos pueden
  disparar `handleNewLead` y crear jobs con el mismo jobId. BullMQ deduplica por jobId en
  `queueStep` (`jobId: lead-${leadId}-step-${stepIndex}`) → solo uno entra a la cola.
- El riesgo real surge si el sistema se reinicia mientras hay jobs delayed: BullMQ puede
  procesar el job retrasado Y el job re-encolado por restart casi simultáneamente.

**Fix:** Usar update atómico con optimistic locking:
```typescript
const { count } = await supabase.from("lead")
    .update({ metadata: { ...meta, sequence_attempts: nextAttempt } })
    .eq("id", lead.id)
    .eq("metadata->sequence_attempts", currentAttempt) // optimistic lock
    .select("id", { count: "exact", head: true });

if (!count || count === 0) {
    // Otro proceso ya actualizó — abort (no re-encolar)
    console.warn(`[RETRY-SEQ] Concurrent update detected for lead ${lead.id}. Aborting.`);
    return;
}
```

---

### F-02-008 — triggerDynamicResume usa logs como proxy frágil (HIGH)

**Profundiza F-02-008 del quick scan.**

**Código exacto (orchestrator.ts:371-392):**
```typescript
const { data: lastLogs } = await (supabase.from("orchestration_logs" as any) as any)
    .select("step_number")
    .eq("lead_id", leadId)
    .eq("result", "SUCCESS")
    .order("created_at", { ascending: false })
    .limit(1);

const lastStep = lastLogs && lastLogs.length > 0 ? lastLogs[0].step_number : -1;
const nextIndex = lastStep + 1;
```

**Problemas con este enfoque:**

1. **step_number ≠ stepIndex:** `logOrchestrationStep` recibe `step: step.step`
   (orchestrator.ts:278), que es el número de paso en la config (ej: 1, 2, 3) — no el
   índice de array (0-based). Si la secuencia tiene pasos numerados [1, 3, 5], el cálculo
   `lastStep + 1 = 4` no corresponde a ningún índice real.

2. **Pasos QUEUED no tienen SUCCESS:** Un paso encolado con delay se loguea como QUEUED
   (orchestrator.ts:277), no SUCCESS. Si `triggerDynamicResume` se llama mientras el paso
   está delayed, ve el último SUCCESS anterior y salta al siguiente de ese, no del actual.

3. **Pasos fallidos con retry exitoso:** Si el paso 2 falló y se reintentó con éxito,
   el log más reciente con SUCCESS puede ser el paso 2 (índice 1), y el código calcularía
   `nextIndex = 2` aunque el paso 3 ya estaba en progreso.

4. **No hay `triggerDynamicResume` llamado desde ningún lugar activo** en el código
   auditado — es un método público huérfano. Si se conecta en el futuro sin corregir este
   cálculo, producirá saltos o repeticiones de pasos.

---

### F-02-009 — SweepQueue: segunda conexión Redis muerta (HIGH)

**Profundiza F-02-009 del quick scan.**

**Código exacto (sweep-queue.ts:12-13):**
```typescript
constructor() {
    this.redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy(times) { ... }
    });
```

**Singleton exportado (sweep-queue.ts:81):**
```typescript
export const sweepQueue = new SweepQueue();
```

Este singleton se instancia al importar el módulo. Si cualquier archivo importa
`sweep-queue.ts` (verificar: no aparece importado en los archivos auditados, pero puede
importarse en rutas Next.js), abre una conexión Redis adicional permanente.

**El bucle `sweep()` está vacío (líneas 65-70):**
```typescript
for (const item of items) {
    try {
        const { leadId, tenantId, actionType } = JSON.parse(item);
        // Logic to be implemented in worker
        await this.redis.zrem("sweep_queue:pending", item);
    } catch (err) { ... }
}
```
El item se elimina de la cola sin procesar nada. `sweepQueue.sweep()` no es llamada desde
`worker.js` ni desde ningún cron BullMQ.

**Conclusión:** Conexión Redis extra abierta permanentemente, código muerto que nunca
procesa nada. Con Upstash (que cobra por commands), incluso los pings de keepalive
consumen cuota.

---

### F-02-010 — Deduplicación de secuencia incompleta (HIGH)

**Profundiza F-02-010 del quick scan.**

**CRMPollingProcessor (lines 67-68):**
```typescript
await orchestrator.handleNewLead(lead.id, tenant.id);
```
Llamado incondicionalmente tras el upsert, aunque el upsert no cambie nada (lead existente).

**ZohoPollingProcessor (lines 81-82):**
```typescript
await orchestrator.handleNewLead(lead.id, tenant.id);
```
Mismo patrón.

**handleNewLead no verifica secuencia activa (orchestrator.ts:114-154):**
Solo verifica feature flag y si la secuencia config está vacía. No consulta BullMQ ni BD
para ver si el lead ya tiene una secuencia en curso.

**Escenario concreto:**
1. Lead X llega por Zoho a las 10:00. Se encola en BullMQ con jobId
   `lead-X-step-0`. Job delayed 2 horas.
2. A las 10:10 el poller vuelve a encontrar el mismo lead (si Zoho no ha sido
   actualizado con tag "VirginIA" todavía). Llama `handleNewLead` de nuevo.
3. `enqueueLeadStep` intenta añadir jobId `lead-X-step-0` a BullMQ. BullMQ tiene
   `jobId` como dedup key → rechaza el duplicado silenciosamente.
4. **Caso parcialmente protegido por BullMQ jobId dedup.**

**Pero hay un gap:** Si el lead ya completó el step 0 y ahora está en step 1 delayed,
el poller llama `handleNewLead` → `executeSequenceStep(lead, tenantId, sequence, 0, config)`.
Esto ejecuta inmediatamente el step 0 de nuevo (primera llamada/WA duplicada), porque el
jobId es `lead-X-step-0` que ya fue completado y eliminado del store (removeOnComplete).
BullMQ no rechaza añadir un job con un jobId ya completado — lo acepta como nuevo.

**Riesgo real:** Un lead que ya recibió su primera llamada puede recibirla de nuevo en el
próximo ciclo de polling (10 minutos después) si el tag VirginIA no se ha sincronizado
a Zoho. F-02-015 muestra que el sync de vuelta al CRM no está garantizado.

---

### F-02-011 — QualifyAgent stub sin implementar (HIGH)

**Profundiza F-02-011 del quick scan.**

**Código exacto (multi-agent.ts:66-69):**
```typescript
public async processConversation(history: any[], promptSource: "A" | "B") {
    // TODO: Implement LangChain chain with prompt source
    console.log(`[QUALIFY AGENT] Processing using Prompt ${promptSource}...`);
}
```

El método devuelve `Promise<void>` (undefined). No hay return value. Cualquier llamante
que espere un resultado de cualificación recibirá `undefined`.

`QualifyAgent` tiene `private model: BaseChatModel` correctamente inicializado en el
constructor — el modelo LangChain se crea. Solo falta la lógica de la cadena.

**No está llamado desde ningún lugar activo:** `processConversation` no aparece en ningún
otro archivo del perímetro auditado. La cualificación se hace via `QualificationProcessor`
(LLM directo con LangChain PromptTemplate) y via `qualifier.ts` (determinista). El
`QualifyAgent` es una tercera implementación nunca conectada.

---

### F-02-012 — Crons con tenantId ficticio (MEDIUM)

**Profundiza F-02-012 del quick scan.**

**Código exacto (lead-sequence-queue.ts:136-143):**
```typescript
await queue.add("watchdog_scan", { 
    action: "WATCHDOG_SCAN", 
    leadId: "system", 
    tenantId: "system" 
}, {
    repeat: { pattern: "*/15 * * * *" },
    jobId: "watchdog_cron"
});
```

**Flujo en worker.js (lines 25-31):**
```javascript
if (tenantId) {
    const { data: tenant } = await supabase
        .from("tenants").select("daily_spend_limit, current_daily_spend")
        .eq("id", tenantId).single();
    if (tenant && tenant.current_daily_spend >= tenant.daily_spend_limit) {
        return; // Circuit breaker
    }
}
```

Con `tenantId: "system"`, la query devuelve `null` (no existe tenant con id "system").
El bloque `if (tenant && ...)` es falso → el circuit breaker no aplica → continúa al
handler correcto (WATCHDOG_SCAN, ZOHO_POLLING). Comportamiento por defecto correcto, pero
frágil. Si la condición cambia a `if (!tenant || ...)`, los crons se bloquearían.

**Impacto adicional:** `logOrchestrationStep` para watchdog/zoho loguea con
`tenant_id: "system"`, `lead_id: "system"`. Si hay queries de métricas que filtran por
tenant_id real, estos logs desaparecen del análisis.

---

### F-02-013 — Compliance WhatsApp sin ventana horaria (MEDIUM)

**Profundiza F-02-013 del quick scan.**

**Código exacto (orchestrator.ts:257-282):**
```typescript
if (!decision.canExecuteNow && step.action === "call") {
    await this.executeWhatsAppStep(activeLead, tenantId, { ...step, action: "whatsapp",
        template: config.scheduling?.reminder_template || "appointment_reminder_es" } as any);
    return; // ← no encola siguiente paso, no loguea que WA fue fallback
}

if (!decision.canExecuteNow && step.action !== "wait") {
    // Queue for next window (applies to whatsapp, ai_agent, crm steps)
    await this.queueStep(...);
}
```

**Dos problemas detectados en el deep audit:**

1. Cuando el fallback WA se ejecuta (fuera de horas, acción era `call`), el método retorna
   inmediatamente después. No encola el siguiente paso de la secuencia. El lead recibe el
   WA de fallback pero la secuencia se detiene ahí — el siguiente paso nunca se programa.

2. El fallback usa `config.scheduling?.reminder_template || "appointment_reminder_es"` como
   template. Este template puede no existir en la cuenta de WhatsApp del tenant. Si no
   existe, la llamada a Meta API falla con 400. Como no hay try/catch alrededor de
   `executeWhatsAppStep` en este bloque (el try/catch de orchestrator.ts:285 no aplica
   porque el return ocurre antes), el error burbujea sin log de orchestration_logs.

---

### F-02-014 — executeAIAgentStep no envía mensaje (MEDIUM)

**Profundiza F-02-014 del quick scan.**

**Comentario explícito en el código (orchestrator.ts:753-754):**
```typescript
// 4. In a real message event, this would be used for the AI Turn.
// The orchestrator just ensures the agent is assigned and ready.
```

El `systemPrompt` construido (líneas 738-751) no se usa para nada — variable asignada y
descartada (el eslint-disable-next-line comentado lo confirma).

**Impacto:** Si la secuencia tiene un paso `ai_agent`, el lead simplemente recibe
asignación de agente en BD (`ai_agent_id = agentId`) pero ningún mensaje de apertura.
El agente solo responde si el lead escribe primero (webhook WhatsApp). Esto es incompatible
con la spec que indica que Virginia inicia la conversación.

---

### F-02-015 — CRMExportProcessor "agregar no sobrescribir" (MEDIUM)

**Profundiza F-02-015 del quick scan.**

**Código exacto (CRMExportProcessor.ts:96-101):**
```typescript
const tenantConfig = { crm: { ...crmConfig, enabled: true } };
const provider = CRMFactory.getProvider(tenantId, tenantConfig as unknown);
await provider.updateLead(l.id_lead_externo || leadId, updateData);
```

La implementación de `ZohoProvider.updateLead` usa `PUT /Leads/{id}` con los campos en
`updateData`. Zoho CRM acepta PUT parcial (no sobreescribe campos no enviados) — correcto
para el requisito de la spec de "agregar, no sobrescribir".

**Pero hay un bug sutil:** Si `id_lead_externo` es null o vacío, se usa `leadId` (UUID
interno) como identificador en Zoho. Zoho no reconocerá ese UUID → el update falla con
"Record not found". El error se captura (CRMExportProcessor.ts:113-127) y se loguea como
FAILURE en orchestration_logs, pero no se reintenta y el lead queda sin sincronizar.

---

### F-02-016 — A/B split no reproducible (LOW)

**Profundiza F-02-016 del quick scan.**

**Código exacto (orchestrator.ts:839-846):**
```typescript
if (abConfig.enabled && agents.length >= 2) {
    const roll = Math.random();
    const isVariantA = roll <= abConfig.split;
    return {
        agentId: isVariantA ? agents[0] : agents[1],
        variant: isVariantA ? "A" : "B",
    };
}
```

`Math.random()` sin semilla. No hay persistencia del variant asignado en ningún campo del
lead antes de ejecutar el paso. Si el mismo lead re-entra a un paso (retry, resume, doble
polling), puede recibir el agente opuesto.

**Adicionalmente:** `QualificationProcessor.getContextualRules` también usa `Math.random()`
para selección de variant (QualificationProcessor.ts:138-147):
```typescript
const rand = Math.random();
const totalWeight = variants.reduce((acc, v) => acc + (v.weight || 0.5), 0);
```
Dos sistemas de selección aleatoria independientes para el mismo lead — doble contaminación
de datos A/B.

---

### F-02-017 — RescueWorker no integrado en cron (LOW)

**Profundiza F-02-017 del quick scan.**

`runRescueCheck()` está bien implementado (177 líneas, incluye safety window de 5 min,
max_retries, inactivity_timeout, generación de mensaje IA). Pero en `worker.js` solo hay:
```javascript
setupWatchdogCron()
setupZohoCron()
```
No hay `setupRescueCron`. La función nunca se ejecuta en producción.

**Impacto:** Los leads en conversaciones WhatsApp que se vuelven inactivos nunca reciben
el mensaje de rescue configurado en el agente. La feature de "reactivación por inactividad"
está completamente muerta.

**Fix:** Añadir en `lead-sequence-queue.ts`:
```typescript
export async function setupRescueCron() {
    const queue = getLeadQueue();
    await queue.add("rescue_check", {
        action: "RESCUE_CHECK", leadId: "system", tenantId: "system"
    }, { repeat: { pattern: "*/5 * * * *" }, jobId: "rescue_cron" });
}
```
Y en `worker.js` añadir handler `if (action === "RESCUE_CHECK")` y llamar
`setupRescueCron()`.

---

### F-02-018 — test-ab.ts llama método inexistente (LOW)

**Profundiza F-02-018 del quick scan.**

El método correcto en orchestrator.ts es `executeAIAgentStep` (private). El test llama
`executeAIAgentAction` que no existe. Esto es código muerto de test en directorio de
producción. No tiene impacto en runtime, pero contamina el codebase.

---

## Nuevos findings (DA-1-XXX)

### DA-1-001: Doble conexión Redis — SweepQueue + BullMQ connection pool compartido

- **Archivo**: `src/lib/core/sweep-queue.ts:12-13` + `src/lib/core/queue/lead-sequence-queue.ts:10-51`
- **Severidad**: High
- **Esfuerzo**: S

**Descripción:**
`lead-sequence-queue.ts` exporta `export const connection = createRedisConnection()` —
singleton de IORedis compartido por la Queue y el Worker de BullMQ.
`sweep-queue.ts` crea su propia instancia `new Redis(REDIS_URL, ...)` completamente
independiente. Resultado: **dos conexiones TCP distintas a Redis** abiertas permanentemente
por el worker process, más la del BullMQ Worker internamente.

BullMQ por diseño necesita dos conexiones por Worker (una para blocking commands, una para
non-blocking). Con la sweep-queue, el proceso abre al menos 3-4 conexiones Redis para un
solo worker.

Con Upstash en el plan gratuito/básico hay límites de conexiones concurrentes. En
producción con múltiples réplicas del worker, las conexiones se multiplican linealmente.

**Escenario adicional:** Si el worker se lanza con `REDIS_URL` apuntando a Upstash TLS
(`rediss://...`), `createRedisConnection()` en queue usa `isTLS && { tls: {} }`. La
SweepQueue usa `new Redis(REDIS_URL)` directamente sin el flag TLS explícito — puede fallar
la handshake TLS con ciertos setups de Upstash que requieren `tls: {}` explícito.

**Fix:** Eliminar `SweepQueue` (es código muerto — ver F-02-009) o hacer que importe
y reutilice el `connection` de `lead-sequence-queue.ts`.

---

### DA-1-002: getSupabaseServerClient llamado en cada step — sin pool

- **Archivo**: `src/lib/core/orchestrator.ts` (múltiples líneas: 44, 119, 173, 200, 229, 307, etc.)
- **Severidad**: High
- **Esfuerzo**: M

**Descripción:**
`getSupabaseServerClient()` se llama en cada método del Orchestrator que accede a BD:
`handleLeadQualification` (line 44), `handleNewLead` (line 119), `executeSequenceStep`
(line 173, 200, 229, 307), `executeCallStep` (line 419), `executeWhatsAppStep` (line 565),
`checkPacing` (line 1149), `triggerHumanEscalation` (line 1173), etc.

Con concurrency: 5 en el BullMQ Worker, pueden ejecutarse 5 jobs simultáneamente, cada
uno llamando a `executeSequenceStep` que llama a `getSupabaseServerClient()` múltiples
veces. Dependiendo de la implementación de `getSupabaseServerClient`, esto puede crear:
- Un nuevo cliente Supabase por llamada (instancia `createClient`) → sin conexión
  persistente, sin pool, overhead por request.
- O el mismo singleton si `getSupabaseServerClient` tiene memoization interna.

Sin poder verificar la implementación completa de `getSupabaseServerClient` (fuera del
perímetro auditado), el patrón de múltiples llamadas por job es claramente ineficiente y
potencialmente problemático bajo carga.

**Patrón correcto:** Crear el cliente una vez por job y pasarlo como parámetro:
```typescript
public async executeSequenceStep(lead: Lead, tenantId: string, ...) {
    const supabase = await getSupabaseServerClient(); // una sola vez
    // pasar supabase a métodos auxiliares como parámetro
}
```

---

### DA-1-003: QualificationProcessor usa API key de variant sin validar — falla silenciosa

- **Archivo**: `src/lib/core/processors/QualificationProcessor.ts:36-40`
- **Severidad**: High
- **Esfuerzo**: S

**Descripción:**
```typescript
const provider = (variant?.model_provider as LLMType) || "OPENAI";
const modelName = variant?.model_name || "gpt-4o-mini";
const llm = createLLM(provider, modelName, 0);
```

`createLLM` (cuando exista) necesita un API key. El código no pasa el API key del variant
(`variant.api_key`). Si `llm-factory.ts` usa `process.env.OPENAI_API_KEY` como fallback,
funciona en dev pero no si el tenant tiene su propio API key en `variant.api_key`.

Más grave: si el variant tiene `model_provider: "ANTHROPIC"` y solo `OPENAI_API_KEY` en el
env, la llamada LLM fallará con auth error. Esto ocurrirá silenciosamente (error capturado
por el worker, job fallido, DLQ ausente).

**Contrasta con WhatsAppAIProcessor (líneas 77-84)** que sí tiene manejo correcto del key:
```typescript
const apiKey = (activeVariant.api_key && activeVariant.api_key !== "your_api_key_here")
    ? activeVariant.api_key 
    : process.env.OPENAI_API_KEY;
```
`QualificationProcessor` debe replicar este patrón.

---

### DA-1-004: Circuit breaker duplicado — worker.js + orchestrator.ts verifican spend limit dos veces

- **Archivo**: `worker.js:25-31` + `src/lib/core/orchestrator.ts:174-184`
- **Severidad**: Medium
- **Esfuerzo**: S

**Descripción:**
El circuit breaker de spend limit se verifica **dos veces** por job:

1. En `worker.js:25-31` — antes de dispatch al handler.
2. En `orchestrator.ts:174-184` — dentro de `executeSequenceStep`.

Ambas queries son idénticas:
```typescript
supabase.from("tenants").select("daily_spend_limit, current_daily_spend").eq("id", tenantId).single()
```

Para jobs de secuencia (`call`, `whatsapp`, etc.), se ejecutan dos queries a Supabase
innecesarias. Bajo carga con 5 workers concurrentes, son 10 queries simultáneas de circuit
breaker por cada ronda de procesamiento.

Adicionalmente, la verificación en `worker.js` usa `console.error` (línea 29) pero no loguea
en `orchestration_logs`, perdiendo trazabilidad. La verificación en `orchestrator.ts` sí
loguea (líneas 178-183).

**Fix:** Eliminar la verificación de worker.js o moverla a una función compartida que evite
la doble query.

---

### DA-1-005: enqueueLeadStep silencia errores de Redis — jobs perdidos sin notificación

- **Archivo**: `src/lib/core/queue/lead-sequence-queue.ts:106-110`
- **Severidad**: High
- **Esfuerzo**: S

**Descripción:**
```typescript
} catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[QUEUE_BYPASS] Redis down/error: ${errMsg}`);
    return `fallback-${Date.now()}`;
}
```

Si Redis está caído o el enqueue falla, la función devuelve un ID ficticio
`fallback-TIMESTAMP` y continúa sin error. El caller (`queueStep` en orchestrator.ts:870)
no verifica el valor de retorno y asume que el job fue encolado.

**Consecuencia:** El siguiente paso de la secuencia se "encola" silenciosamente pero nunca
se ejecuta. El lead queda congelado sin ningún indicador de error. Dado que Redis/Upstash
puede tener outages momentáneos, este escenario no es teórico.

**Fix:** Propagar el error en lugar de silenciarlo, o al menos loguear en orchestration_logs:
```typescript
} catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[QUEUE_ERROR] Failed to enqueue job for lead ${data.leadId}: ${errMsg}`);
    // Opción 1: propagar para que BullMQ reintente el job actual
    throw error;
    // Opción 2: persistir en BD como FAILED para reintento manual
}
```

---

### DA-1-006: WhatsAppAIProcessor crea un new OpenAI() por request — sin singleton

- **Archivo**: `src/lib/core/processors/WhatsAppAIProcessor.ts:107, 337`
- **Severidad**: Medium
- **Esfuerzo**: S

**Descripción:**
```typescript
// línea 107 (en parallel fetch de embeddings):
const openai = new OpenAI({ apiKey });

// línea 337 (para completions):
const openai = new OpenAI({ apiKey });
```

Dos instancias `new OpenAI()` por request de WhatsApp. El cliente de OpenAI SDK tiene
internamente un pool de conexiones HTTP (usando `node-fetch` o `undici`). Crear una nueva
instancia por request descarta el pool de conexiones y overhead de TLS handshake.

Con alto volumen de mensajes WhatsApp concurrentes (webhook), esto aumenta la latencia de
respuesta y el número de conexiones abiertas a api.openai.com.

Adicionalmente: el `openai` de la línea 107 se usa solo para embeddings (KnowledgeBase) y
el de la línea 337 para completions — se podrían reutilizar el mismo cliente si el apiKey
es el mismo (que lo es, derivado del mismo `activeVariant.api_key`).

**Fix:** Crear singleton por apiKey o reutilizar la misma instancia dentro del scope de la
función `generateAIWhatsAppResponse`.

---

### DA-1-007: Compliance.ts — isWithinLegalWindow no verifica domingo (working_days bug)

- **Archivo**: `src/lib/core/compliance.ts:95-117`
- **Severidad**: Medium
- **Esfuerzo**: S

**Descripción:**
`isWorkingDay` (línea 122-126) verifica si el día actual está en `workingDays`. El default
en `executeRetrySequenceStep` es:
```typescript
const tzRules = config.timezone_rules || { start: "09:00", end: "20:00", working_days: [1,2,3,4,5] };
```

Si `timezone_rules` está undefined (tenant sin config), el default excluye sábado (6) y
domingo (0). **Correcto.**

Pero en `isWithinLegalWindow` (línea 95), el check de sábado con cap a 14h aplica
`dayOfWeek === 6` sin verificar si el sábado está en `workingDays`. Si el config dice
`working_days: [1,2,3,4,5]` (sin sábado), pero `isWithinLegalWindow` recibe una hora
de sábado a las 11:00 dentro del rango 9-20, devuelve `true` (dentro de la ventana). Sin
embargo, `isWorkingDay` con `working_days: [1,2,3,4,5]` devuelve `false` para sábado.

La conjunción en `buildComplianceDecision`:
```typescript
if (inWindow && inWorkingDay) { canExecuteNow: true }
```
Significa que si es sábado fuera de los `working_days`, `inWorkingDay = false` y no ejecuta
— correcto. El bug es que `isWithinLegalWindow` devuelve `true` de forma engañosa para un
día no laboral, lo que confunde si se usa directamente sin pasar por `buildComplianceDecision`.

**Riesgo real:** Si alguien usa `isWithinLegalWindow` directamente (no via
`buildComplianceDecision`), puede ejecutar en días no laborales.

---

### DA-1-008: feature-flags — isFeatureEnabled devuelve false si DB falla (fail-closed peligroso)

- **Archivo**: `src/lib/core/feature-flags.ts:18-20`
- **Severidad**: Medium
- **Esfuerzo**: S

**Descripción:**
```typescript
if (error || !data) return false;
return data.is_enabled;
```

Si Supabase está temporalmente caído o hay un timeout, `isFeatureEnabled` devuelve `false`.
`handleNewLead` (orchestrator.ts:115-116):
```typescript
const isNativeEnabled = await isFeatureEnabled(tenantId, "native_orchestrator");
if (!isNativeEnabled) return;
```

Si la BD tiene un fallo transitorio, TODOS los leads nuevos que lleguen durante ese período
son descartados silenciosamente — `handleNewLead` hace early return sin log ni reintento.

**Impacto:** Con 3000-4000 leads/mes y un fallo de BD de 5 minutos, se perderían ~10 leads
sin procesar. No hay log de "feature flag lookup failed" ni cola de leads pendientes.

**Fix:** Distinguir entre "flag desactivado" y "error al leer":
```typescript
const { data, error } = await supabase...;
if (error) {
    console.error("[FEATURE_FLAGS] DB error reading flag, defaulting to enabled:", error);
    return true; // fail-open para no perder leads
}
if (!data) return false; // flag no existe = desactivado
return data.is_enabled;
```

---

## Diagrama de flujo de un job tipo (ASCII)

```
Lead nuevo entra (Zoho polling / WhatsApp webhook)
    │
    ▼
ZohoPollingProcessor.run()
    │
    ├─ upsert lead (onConflict: tenant_id, id_lead_externo)
    │   [DA-1 NOTE: upsert no detecta secuencia ya activa — F-02-010]
    │
    └─ orchestrator.handleNewLead(leadId, tenantId)
            │
            ├─ isFeatureEnabled("native_orchestrator")  ← [DA-1-008: falla si DB caída]
            │
            ├─ getSupabaseServerClient()  ← [DA-1-002: instancia 1 de N]
            ├─ fetch lead (select *)
            ├─ getOrchestratorConfigForTenant()
            ├─ entry_filters check
            │
            └─ executeSequenceStep(lead, tenantId, sequence, 0, config)
                    │
                    ├─ getSupabaseServerClient()  ← [DA-1-002: instancia 2 de N]
                    ├─ circuit breaker check (spend limit)  ← [DA-1-004: doble check]
                    ├─ checkPacing()  ← getSupabaseServerClient() instancia 3
                    ├─ fetch freshLead  ← getSupabaseServerClient() instancia 4
                    ├─ shouldStopSequence()  ← getSupabaseServerClient() instancia 5
                    ├─ fetch lastMsg (inbound)  ← getSupabaseServerClient() instancia 6
                    ├─ buildComplianceDecision(phone, country, timezone_rules)
                    │
                    ├─ COMPLIANCE OK → ejecuta step 0 (call/whatsapp/etc.)
                    │
                    └─ queueStep(lead, tenantId, step-1, 1, config, delayMs)
                            │
                            └─ enqueueLeadStep(job, delayMs)  [lead-sequence-queue.ts]
                                    │
                                    ├─ [DA-1-005: si Redis falla → silencio, job perdido]
                                    │
                                    └─ BullMQ add(jobId: "lead-X-step-1", delay: 97200000)
                                            │
                                            │  [27 horas después...]
                                            │
                                    ┌───────▼──────────────────────┐
                                    │  BullMQ Worker (worker.js)   │
                                    │  concurrency: 5              │
                                    └───────┬──────────────────────┘
                                            │
                                    ┌───────▼──────────────────────────────────────────┐
                                    │  worker.js:25-31                                 │
                                    │  Circuit breaker check #2  [DA-1-004]           │
                                    └───────┬──────────────────────────────────────────┘
                                            │
                                    ┌───────▼──────────────────────────────────────────┐
                                    │  worker.js:56-63                                 │
                                    │  action === "call" → executeSequenceStep(job.data)│
                                    │                                    ↑              │
                                    │  BUG F-02-001: job.data es       │              │
                                    │  LeadSequenceJob, no Lead        │              │
                                    │                                    │              │
                                    │  Crash en sequence.length ────────┘              │
                                    │  (TypeError: Cannot read length of "sequence")   │
                                    │                                                  │
                                    │  → throw err → BullMQ retry (max 3)              │
                                    │  → 3 fallos → removeOnFail (500)                │
                                    │  → JOB ELIMINADO SILENCIOSAMENTE  [F-02-002]    │
                                    │  → Lead congelado en step-0 para siempre        │
                                    └──────────────────────────────────────────────────┘
```

---

## Áreas grises / preguntas para deep audit posterior con runtime

1. **¿`getSupabaseServerClient()` tiene memoization interna?** Si devuelve siempre el mismo
   singleton, DA-1-002 es Medium en lugar de High. Si crea una nueva instancia por llamada,
   es High urgente.

2. **¿Cuántos jobs fallidos hay actualmente en Redis?** Con `REDIS_URL` accesible, ejecutar
   `redis-cli LLEN bull:lead_sequence_queue:failed` para cuantificar el daño real de
   F-02-001. Si hay >0 con acción "call/whatsapp", confirma el bug activo en producción.

3. **¿`tenant_orchestrator_config.timezone_rules.end` está configurado como "21:00" o
   "20:00"?** La spec dice 9am-9pm (21:00). El código tiene comment "9:00 - 20:00".
   Si el valor real en BD es "20:00", los leads tienen una hora menos de ventana.

4. **¿`CRMFactory.getProvider` con `tenantConfig = { crm: ... }` funciona correctamente
   o requiere el config completo del tenant?** `CRMExportProcessor` construye un
   `tenantConfig` parcial para obtener el proveedor. Si el factory necesita campos del
   config que no están en ese objeto parcial, puede fallar silenciosamente.

5. **¿Hay instancias del worker en producción aparte del proceso standalone `worker.js`?**
   Si alguna ruta Next.js también instancia el orchestrator y llama `setupWatchdogCron`,
   habría dos instancias del cron corriendo simultáneamente (BullMQ acepta jobId duplicado
   en repeat jobs — solo una instancia gana, pero hay overhead).

6. **¿El RETRY_SEQUENCE action llega al worker?** No está en el handler de worker.js
   (actions verificadas: "call", "whatsapp", "ai_agent", "zoho", "APPOINTMENT_REMINDER").
   `RETRY_SEQUENCE` no tiene handler explícito → el job se procesa pero ningún `if` lo
   captura → cae al final del callback sin hacer nada (no hay else/default). Job "completed"
   sin ejecutar nada. Esto es un finding nuevo a verificar en runtime.

---

**Status:** DONE_WITH_CONCERNS

**Summary:** 18 findings del quick scan profundizados con callstacks, datos exactos de
línea, y escenarios de fallo concretos. 8 nuevos findings DA-1-001 a DA-1-008 identificados.
El bug F-02-001 (worker signature mismatch) es la causa raíz de que el flujo multi-día
esté completamente roto en producción. DA-1-005 (enqueueLeadStep silencia errores de Redis)
es un segundo vector de pérdida de jobs silenciosa que complementa F-02-002. DA-1-008
(fail-closed de feature flags) puede causar pérdida de leads en outages de BD.

**Concerns:** No fue posible verificar en runtime el estado actual de la cola Redis (jobs
fallidos acumulados), la implementación interna de `getSupabaseServerClient`, ni si el
action "RETRY_SEQUENCE" tiene handler en el worker (área gris #6 — finding pendiente de
confirmación). Tampoco se auditaron los archivos fuera del perímetro declarado
(`src/lib/integrations/`, `src/lib/actions/orchestrator-config.ts`, `src/lib/services/`).
