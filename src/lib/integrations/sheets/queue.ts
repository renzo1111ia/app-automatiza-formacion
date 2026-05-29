// Sprint 4 - Cola BullMQ sheets-pull + worker.
//
// Patron alineado con lead-sequence-queue: reusa la conexion Redis existente,
// logs estructurados Pino, dedup por jobId, propagacion de errores al caller.
//
// El worker se arranca on-demand (lazy) la primera vez que se referencia
// startSheetsPullWorker(). En entornos sin Redis (CI/tests) la cola devuelve
// errores controlados sin tirar el proceso.

import { Queue, Worker, Job } from "bullmq";
import { connection } from "@/lib/core/queue/lead-sequence-queue";
import { createLogger } from "@/lib/utils/logger";
import { SheetPullJob, SheetPullJobSchema } from "./types";
import { processSheetPullJob } from "./pull-processor";

const log = createLogger("queue.sheets-pull");

export const SHEETS_PULL_QUEUE = "sheets_pull_queue";

let queueInstance: Queue<SheetPullJob> | null = null;
let workerInstance: Worker<SheetPullJob> | null = null;

export function getSheetsPullQueue(): Queue<SheetPullJob> {
  if (!queueInstance) {
    queueInstance = new Queue<SheetPullJob>(SHEETS_PULL_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return queueInstance;
}

/**
 * Encola un pull job. Dedup: jobId = sheet_connection_id (asi multiples
 * notificaciones Drive dentro de la ventana de delay solo procesan una vez).
 */
export async function enqueueSheetPull(data: SheetPullJob, delayMs = 0): Promise<string> {
  SheetPullJobSchema.parse(data);
  const queue = getSheetsPullQueue();
  const jobId = `sheet-${data.sheet_connection_id}`;

  try {
    const job = await queue.add(jobId, data, {
      delay: delayMs,
      jobId,
    });
    log.info("sheets-pull job enqueued", {
      tenant_id: data.tenant_id,
      sheet_connection_id: data.sheet_connection_id,
      trigger: data.trigger,
      delayMs,
    });
    return job.id || jobId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("enqueueSheetPull FAILED", {
      tenant_id: data.tenant_id,
      sheet_connection_id: data.sheet_connection_id,
      error: msg,
    });
    throw err instanceof Error ? err : new Error(`enqueueSheetPull: ${msg}`);
  }
}

/**
 * Arranca el worker (idempotente). Llamar desde un entrypoint dedicado
 * (worker process) o desde un module-level init en dev. NO arrancar en cada
 * request del API (memory leak + duplicacion de jobs procesados).
 */
export function startSheetsPullWorker(): Worker<SheetPullJob> {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker<SheetPullJob>(
    SHEETS_PULL_QUEUE,
    async (job: Job<SheetPullJob>) => {
      const start = Date.now();
      log.info("sheets-pull job START", {
        job_id: job.id,
        tenant_id: job.data.tenant_id,
        sheet_connection_id: job.data.sheet_connection_id,
        trigger: job.data.trigger,
        attempt: job.attemptsMade + 1,
      });

      const result = await processSheetPullJob(job.data);

      log.info("sheets-pull job DONE", {
        job_id: job.id,
        tenant_id: job.data.tenant_id,
        sheet_connection_id: job.data.sheet_connection_id,
        rows_total: result.rowsTotal,
        rows_new: result.rowsNew,
        rows_skipped: result.rowsSkipped,
        leads_created: result.leadsCreated,
        warnings: result.warnings,
        durationMs: Date.now() - start,
      });

      return result;
    },
    { connection, concurrency: 2 }
  );

  workerInstance.on("failed", (job, err) => {
    log.error("sheets-pull job FAILED", {
      job_id: job?.id,
      tenant_id: job?.data?.tenant_id,
      sheet_connection_id: job?.data?.sheet_connection_id,
      attempt: (job?.attemptsMade ?? 0) + 1,
      error: err?.message,
    });
  });

  log.info("sheets-pull worker started", { queue: SHEETS_PULL_QUEUE, concurrency: 2 });
  return workerInstance;
}

/** Para tests/teardown. */
export async function stopSheetsPullWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
