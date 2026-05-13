import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

/**
 * LEAD SEQUENCE QUEUE (BullMQ + Upstash Redis)
 */

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
            }
        });

        // 🟢 CONFIRMATION LOG: This will show in Dokploy logs
        client.on('ready', () => {
            console.log(`[REDIS] ✅ READY - Connection established to ${url.hostname}`);
        });

        client.on('error', (err) => {
            console.warn(`[REDIS_QUEUE] Connection Issue: ${err.message}`);
        });

        return client;
    } catch {
        const fallback = new IORedis({
            host: "localhost",
            port: 6379,
            maxRetriesPerRequest: null,
            lazyConnect: true 
        });
        fallback.on('error', () => {}); 
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
    action: "call" | "whatsapp" | "ai_agent" | "zoho" | "CRM_SYNC" | "ZOHO_POLLING" | "QUALIFY_ANALYSIS" | "WATCHDOG_SCAN" | "APPOINTMENT_REMINDER" | "RETRY_SEQUENCE"; 
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
 */
export async function enqueueLeadStep(
    data: LeadSequenceJob,
    delayMs = 0
): Promise<string> {
    try {
        const queue = getLeadQueue();
        const jobName = `lead-${data.leadId}-step-${data.step}`;
        
        const job = await queue.add(jobName, data, {
            delay: delayMs,
            jobId: jobName,
        });

        console.log(`[QUEUE] Enqueued ${jobName} with delay ${Math.round(delayMs / 1000 / 60)}min`);
        return job.id || jobName;
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[QUEUE_BYPASS] Redis down/error: ${errMsg}`);
        return `fallback-${Date.now()}`;
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
        await queue.add(`qual-${data.leadId}-${data.callId}`, {
            ...data,
            action: "QUALIFY_ANALYSIS"
        }, {
            jobId: `qual-${data.leadId}-${data.callId}`
        });
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[QUEUE_ERROR] Analysis could not be queued: ${errMsg}`);
    }
}

export async function setupWatchdogCron() {
    try {
        const queue = getLeadQueue();
        await queue.add("watchdog_scan", { 
            action: "WATCHDOG_SCAN", 
            leadId: "system", 
            tenantId: "system" 
        }, {
            repeat: { pattern: "*/15 * * * *" },
            jobId: "watchdog_cron"
        });
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("[QUEUE] Could not setup watchdog cron:", errMsg);
    }
}

export async function setupZohoCron() {
    try {
        const queue = getLeadQueue();
        await queue.add("zoho_polling", { 
            action: "ZOHO_POLLING", 
            leadId: "system", 
            tenantId: "system" 
        }, {
            repeat: { pattern: "*/10 * * * *" },
            jobId: "zoho_cron"
        });
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("[QUEUE] Could not setup Zoho cron:", errMsg);
    }
}

export function createLeadWorker(
    processor: (job: Job<LeadSequenceJob>) => Promise<void>
): Worker<LeadSequenceJob> {
    const worker = new Worker<LeadSequenceJob>(
        LEAD_QUEUE_NAME,
        processor,
        {
            connection,
            concurrency: 5,
        }
    );

    worker.on("completed", (job) => {
        console.log(`[WORKER] ✅ Job ${job.id} completed: ${job.data.leadId}`);
    });

    worker.on("failed", (job, err) => {
        console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
    });

    return worker;
}
