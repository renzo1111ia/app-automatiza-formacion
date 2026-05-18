import Redis from "ioredis";

/**
 * SWEEP QUEUE SERVICE
 * Handles delayed leads and batch processing.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export class SweepQueue {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            // Retry strategy to avoid crashing on start
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                return delay;
            }
        });

        // CRITICAL: Prevent unhandled error events
        this.redis.on('error', (err) => {
            console.warn(`[SWEEP_QUEUE] Redis Issue: ${err.message}`);
        });
    }

    /**
     * Enqueues a lead for a specific action at a specific time.
     */
    public async enqueue(
        leadId: string,
        tenantId: string,
        actionType: "CALL" | "WHATSAPP",
        scheduledAt: Date
    ) {
        try {
            const payload = JSON.stringify({ leadId, tenantId, actionType });
            const score = scheduledAt.getTime();

            await this.redis.zadd("sweep_queue:pending", score, payload);
            console.log(`[SWEEP QUEUE] Lead ${leadId} queued for ${actionType} at ${scheduledAt.toISOString()}`);
        } catch (error: any) {
            console.warn(`[SWEEP_QUEUE_BYPASS] Could not enqueue lead: ${error.message}`);
        }
    }

    /**
     * "Sweeps" the queue for actions that are ready to be executed.
     */
    public async sweep() {
        try {
            const now = Date.now();
            
            // Get all items with score <= now
            const items = await this.redis.zrangebyscore("sweep_queue:pending", "-inf", now);

            if (items.length === 0) return;

            console.log(`[SWEEP QUEUE] Found ${items.length} ready actions. Processing...`);

            for (const item of items) {
                try {
                    const { leadId, tenantId, actionType } = JSON.parse(item);
                    
                    // Logic to be implemented in worker
                    
                    // Remove from queue after processing
                    await this.redis.zrem("sweep_queue:pending", item);
                } catch (err) {
                    console.error("[SWEEP QUEUE] Error processing item:", err);
                }
            }
        } catch (error: any) {
            console.warn(`[SWEEP_QUEUE_OFFLINE] Cannot sweep: ${error.message}`);
        }
    }
}

export const sweepQueue = new SweepQueue();
