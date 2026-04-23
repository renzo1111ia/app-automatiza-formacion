import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MAX_LINES = 10;

// Reusing connection pattern from lead-sequence-queue.ts
function createRedisConnection(): IORedis {
    return new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            return Math.min(times * 50, 2000);
        }
    });
}

const redis = createRedisConnection();

export class ChatMemoryService {
    /**
     * Adds a new message to the sliding window (Redis List)
     * Keeps only the last 10 lines.
     */
    static async addMessage(leadId: string, role: 'user' | 'assistant', content: string) {
        const key = `chat_memory:${leadId}`;
        const entry = JSON.stringify({ role, content, timestamp: new Date().toISOString() });

        try {
            // Push to the end
            await redis.rpush(key, entry);
            // Trim to keep only the last MAX_LINES
            await redis.ltrim(key, -MAX_LINES, -1);
            // Expire after 24 hours of inactivity
            await redis.expire(key, 86400); 
        } catch (error) {
            console.error(`❌ [REDIS_MEMORY] Error adding message for ${leadId}:`, error);
        }
    }

    /**
     * Retrieves the last 10 lines of conversation
     */
    static async getRecentContext(leadId: string): Promise<Array<{ role: string, content: string }>> {
        const key = `chat_memory:${leadId}`;
        try {
            const lines = await redis.lrange(key, 0, -1);
            return lines.map(line => {
                const parsed = JSON.parse(line);
                return { role: parsed.role, content: parsed.content };
            });
        } catch (error) {
            console.error(`❌ [REDIS_MEMORY] Error fetching context for ${leadId}:`, error);
            return [];
        }
    }

    /**
     * Clears the memory for a lead
     */
    static async clearMemory(leadId: string) {
        const key = `chat_memory:${leadId}`;
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`❌ [REDIS_MEMORY] Error clearing memory for ${leadId}:`, error);
        }
    }
}
