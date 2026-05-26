import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { createLogger } from "@/lib/utils/logger";

/**
 * LEAD SEQUENCE QUEUE (BullMQ + Upstash Redis)
 *
 * Sprint 3 phase-02 Observabilidad (4-03): logs estructurados Pino en lifecycle
 * de Redis connection, enqueue, worker completion/failure. Cubre DA-1-005 (catch
 * silencioso) y permite filtrar logs por `tenant_id` / `lead_id` en producción.
 */

const log = createLogger("queue.lead-sequence");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createRedisConnection(): IORedis {
  const isTLS = REDIS_URL.startsWith("rediss://");

  try {
    const url = new URL(REDIS_URL);
    const client = new IORedis({
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      maxRetriesPerRequest: null,
      ...(isTLS && { tls: {} }),
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    client.on("ready", () => {
      log.info("Redis connection ready", { host: url.hostname });
    });

    client.on("error", (err) => {
      log.warn("Redis connection issue", { error: err.message, host: url.hostname });
    });

    return client;
  } catch {
    const fallback = new IORedis({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    fallback.on("error", () => {});
    return fallback;
  }
}

export const connection = createRedisConnection();

// ─── Queue Definition ──────────────────────────────────────────────

export const LEAD_QUEUE_NAME = "lead_sequence_queue";

export interface LeadSequenceJob {
  leadId: string;
  tenantId: string;
  workflowId?: string;
  step?: number;
  action:
    | "call"
    | "whatsapp"
    | "ai_agent"
    | "zoho"
    | "CRM_SYNC"
    | "ZOHO_POLLING"
    | "QUALIFY_ANALYSIS"
    | "WATCHDOG_SCAN"
    | "APPOINTMENT_REMINDER"
    | "RETRY_SEQUENCE";
  appointmentId?: string;
  agentId?: string;
  template?: string;
  abVariant?: "A" | "B";
  transcript?: string;
  callId?: string;
}

let leadQueue: Queue<LeadSequenceJob> | null = null;

export function getLeadQueue(): Queue<LeadSequenceJob> {
  if (!leadQueue) {
    leadQueue = new Queue<LeadSequenceJob>(LEAD_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return leadQueue;
}

/**
 * Enqueues a lead sequence step with optional delay.
 *
 * Sprint 0 tarea 1-02 (DA-1-005): los errores Redis se PROPAGAN al caller.
 * Antes había un catch silencioso que retornaba un ID ficticio (`fallback-${Date.now()}`)
 * y el caller creía que el job estaba encolado. Resultado: jobs perdidos sin ningún
 * rastro en logs, leads atascados en producción.
 *
 * Política actual:
 *   - log estructurado con contexto (leadId, tenantId, stepIndex, action, jobName)
 *     pero SIN PII del lead (sin nombre, teléfono, email).
 *   - re-throw para que el caller decida (worker re-queue, webhook retry, etc.).
 *   - NO retornar ID ficticio. El tipo de retorno garantiza un jobId real.
 */
export async function enqueueLeadStep(data: LeadSequenceJob, delayMs = 0): Promise<string> {
  const queue = getLeadQueue();
  const jobName = `lead-${data.leadId}-step-${data.step}`;

  try {
    const job = await queue.add(jobName, data, {
      delay: delayMs,
      jobId: jobName,
    });

    log.info("Job enqueued", {
      jobName,
      tenant_id: data.tenantId,
      lead_id: data.leadId,
      action: data.action,
      step: data.step,
      delayMin: Math.round(delayMs / 1000 / 60),
    });
    return job.id || jobName;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // DA-1-005 fix (Sprint 0): log estructurado con contexto + re-throw.
    // NO retornar ID ficticio: el caller debe enterarse del fallo.
    log.error("enqueueLeadStep FAILED — job LOST without retry", {
      jobName,
      tenant_id: data.tenantId,
      lead_id: data.leadId,
      action: data.action,
      step: data.step,
      delayMs,
      error: errMsg,
    });
    throw error instanceof Error
      ? error
      : new Error(`enqueueLeadStep failed for ${jobName}: ${errMsg}`);
  }
}

export async function enqueueQualificationAnalysis(data: {
  leadId: string;
  tenantId: string;
  transcript: string;
  callId: string;
}) {
  try {
    const queue = getLeadQueue();
    await queue.add(
      `qual-${data.leadId}-${data.callId}`,
      {
        ...data,
        action: "QUALIFY_ANALYSIS",
      },
      {
        jobId: `qual-${data.leadId}-${data.callId}`,
      }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error("Qualification analysis could not be queued", {
      tenant_id: data.tenantId,
      lead_id: data.leadId,
      callId: data.callId,
      error: errMsg,
    });
  }
}

export async function setupWatchdogCron() {
  try {
    const queue = getLeadQueue();
    await queue.add(
      "watchdog_scan",
      {
        action: "WATCHDOG_SCAN",
        leadId: "system",
        tenantId: "system",
      },
      {
        repeat: { pattern: "*/15 * * * *" },
        jobId: "watchdog_cron",
      }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn("Could not setup watchdog cron", { error: errMsg });
  }
}

export async function setupZohoCron() {
  try {
    const queue = getLeadQueue();
    await queue.add(
      "zoho_polling",
      {
        action: "ZOHO_POLLING",
        leadId: "system",
        tenantId: "system",
      },
      {
        repeat: { pattern: "*/10 * * * *" },
        jobId: "zoho_cron",
      }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn("Could not setup Zoho cron", { error: errMsg });
  }
}

export function createLeadWorker(
  processor: (job: Job<LeadSequenceJob>) => Promise<void>
): Worker<LeadSequenceJob> {
  const worker = new Worker<LeadSequenceJob>(LEAD_QUEUE_NAME, processor, {
    connection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    log.info("Worker job completed", {
      jobId: job.id,
      tenant_id: job.data.tenantId,
      lead_id: job.data.leadId,
      action: job.data.action,
      duration_ms: job.processedOn && job.timestamp ? job.processedOn - job.timestamp : undefined,
    });
  });

  worker.on("failed", (job, err) => {
    log.error("Worker job failed", {
      jobId: job?.id,
      tenant_id: job?.data.tenantId,
      lead_id: job?.data.leadId,
      action: job?.data.action,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on("stalled", (jobId) => {
    log.warn("Worker job stalled", { jobId });
  });

  return worker;
}
