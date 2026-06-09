// Sprint 5 - Cola BullMQ zoho_lead_queue + worker (event-driven).
//
// Patrón alineado con src/lib/integrations/sheets/queue.ts: reusa la conexión
// Redis existente, logs estructurados, dedup por jobId, removeOnComplete (BUG-4-09).
//
// Diferencia vs Sheets: aquí encolamos UN job por lead-evento (zoho_lead_id),
// no por connection. El webhook llama enqueueZohoLeadEvent() una vez por id
// recibido; el jobId = "zoho-lead-{integration_id}-{zoho_lead_id}" deduplica
// re-entregas del mismo evento dentro de la ventana de delay.
//
// El worker se arranca on-demand (lazy). NO arrancar en cada request del API.

import { Queue, Worker, Job } from "bullmq";
import { connection } from "@/lib/core/queue/lead-sequence-queue";
import { createLogger } from "@/lib/utils/logger";
import { ZohoPullJob, ZohoPullJobSchema } from "./types";
import { processZohoLeadEvent } from "./event-processor";

const log = createLogger("queue.zoho-lead");

export const ZOHO_LEAD_QUEUE = "zoho_lead_queue";

let queueInstance: Queue<ZohoPullJob> | null = null;
let workerInstance: Worker<ZohoPullJob> | null = null;

export function getZohoLeadQueue(): Queue<ZohoPullJob> {
  if (!queueInstance) {
    queueInstance = new Queue<ZohoPullJob>(ZOHO_LEAD_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        // BUG-4-09: con jobId fijo para deduplicar re-entregas del webhook en
        // ráfaga, removeOnComplete libera el jobId al terminar — si no, el 2º
        // evento sobre el mismo lead nunca se procesaría (BullMQ rechaza
        // re-encolar un jobId que aún existe en Redis).
        removeOnComplete: true,
        removeOnFail: { count: 200 },
      },
    });
  }
  return queueInstance;
}

/**
 * Encola un job de procesamiento de evento Zoho. Dedup por jobId =
 * "zoho-lead-{integration_id}-{zoho_lead_id}". Se espera UN id en
 * `data.zoho_lead_ids` (el webhook itera y encola uno por id). Si llegan varios,
 * el jobId usa el primero (caso reconcile encola con array completo y trigger
 * distinto → jobId por integración).
 */
export async function enqueueZohoLeadEvent(data: ZohoPullJob, delayMs = 0): Promise<string> {
  ZohoPullJobSchema.parse(data);
  const queue = getZohoLeadQueue();

  const ids = data.zoho_lead_ids ?? [];
  const jobId =
    ids.length === 1
      ? `zoho-lead-${data.integration_id}-${ids[0]}`
      : `zoho-${data.trigger}-${data.integration_id}-${ids.length || "all"}`;

  try {
    const job = await queue.add(jobId, data, { delay: delayMs, jobId });
    log.info("zoho-lead job enqueued", {
      tenant_id: data.tenant_id,
      integration_id: data.integration_id,
      lead_count: ids.length,
      trigger: data.trigger,
      delayMs,
    });
    return job.id || jobId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("enqueueZohoLeadEvent FAILED", {
      tenant_id: data.tenant_id,
      integration_id: data.integration_id,
      error: msg,
    });
    throw err instanceof Error ? err : new Error(`enqueueZohoLeadEvent: ${msg}`);
  }
}

/**
 * Arranca el worker (idempotente). Llamar desde un entrypoint dedicado (worker
 * process). NO arrancar en cada request del API.
 */
export function startZohoLeadWorker(): Worker<ZohoPullJob> {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker<ZohoPullJob>(
    ZOHO_LEAD_QUEUE,
    async (job: Job<ZohoPullJob>) => {
      const start = Date.now();
      log.info("zoho-lead job START", {
        job_id: job.id,
        tenant_id: job.data.tenant_id,
        integration_id: job.data.integration_id,
        lead_count: job.data.zoho_lead_ids?.length ?? 0,
        trigger: job.data.trigger,
        attempt: job.attemptsMade + 1,
      });

      const result = await processZohoLeadEvent(job.data);

      log.info("zoho-lead job DONE", {
        job_id: job.id,
        tenant_id: job.data.tenant_id,
        integration_id: job.data.integration_id,
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        durationMs: Date.now() - start,
      });

      return result;
    },
    { connection, concurrency: 2 }
  );

  workerInstance.on("failed", (job, err) => {
    log.error("zoho-lead job FAILED", {
      job_id: job?.id,
      tenant_id: job?.data?.tenant_id,
      integration_id: job?.data?.integration_id,
      attempt: (job?.attemptsMade ?? 0) + 1,
      error: err?.message,
    });
  });

  log.info("zoho-lead worker started", { queue: ZOHO_LEAD_QUEUE, concurrency: 2 });
  return workerInstance;
}

/** Para tests/teardown. */
export async function stopZohoLeadWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
