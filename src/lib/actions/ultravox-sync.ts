import { ultravoxBridge } from "../integrations/ultravox";

/**
 * ULTRAVOX RESOURCE SYNC
 * Fetches available voices and models from Ultravox API.
 */

export async function syncUltravoxResources(apiKey: string) {
    if (!apiKey) return { success: false, error: "API Key is required for Ultravox sync" };

    try {
        const headers = {
            "X-API-Key": apiKey,
            "Content-Type": "application/json"
        };

        // 1. Fetch Voices
        const voicesRes = await fetch("https://api.ultravox.ai/v1/voices", { headers });
        if (!voicesRes.ok) {
            // fallback to hardcoded common voices if API fails or doesn't exist
            console.warn("Ultravox Voices API failed, using fallbacks.");
        }
        const voicesData = voicesRes.ok ? await voicesRes.json() : { results: [
            { voiceId: "terrence", name: "Terrence (Male)" },
            { voiceId: "sarah", name: "Sarah (Female)" },
            { voiceId: "mark", name: "Mark (Male)" },
            { voiceId: "jessica", name: "Jessica (Female)" }
        ]};

        // 2. Fetch Models
        const modelsRes = await fetch("https://api.ultravox.ai/v1/models", { headers });
        const modelsData = modelsRes.ok ? await modelsRes.json() : { results: [
            { modelId: "fixie-ai/ultravox-70b", name: "Ultravox 70B (High Quality)" },
            { modelId: "fixie-ai/ultravox-8b", name: "Ultravox 8B (Fast)" },
            { modelId: "gpt-4o-realtime", name: "GPT-4o Realtime" }
        ]};

        return {
            success: true,
            data: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                voices: (voicesData.results || []).map((v: any) => ({
                    id: v.voiceId || v.id,
                    name: v.name || v.voiceId
                })),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                models: (modelsData.results || []).map((m: any) => ({
                    id: m.modelId || m.id,
                    name: m.name || m.modelId
                }))
            }
        };

    } catch (error: unknown) {
        console.error("Ultravox Sync Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Fetches the list of persistent agents from Ultravox.
 */
export async function listUltravoxAgents(apiKey: string) {
    if (!apiKey) return { success: false, error: "API Key is required" };
    try {
        const data = await ultravoxBridge.listAgents({ apiKey });
        return { success: true, data: data.results || [] };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Fetches the transcript (messages) for a specific call.
 */
export async function getUltravoxCallTranscript(apiKey: string, callId: string) {
    if (!apiKey || !callId) return { success: false, error: "API Key and Call ID are required" };
    try {
        const data = await ultravoxBridge.getCallTranscript(callId, { apiKey });
        return { success: true, data: data.results || [] };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Fetches the recording URL for a specific call.
 */
export async function getUltravoxCallRecording(apiKey: string, callId: string) {
    if (!apiKey || !callId) return { success: false, error: "API Key and Call ID are required" };
    try {
        const data = await ultravoxBridge.getCallRecording(callId, { apiKey });
        return { success: true, data: data.recordingUrl || null };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Creates a new persistent agent in Ultravox.
 */
export async function createUltravoxAgent(apiKey: string, params: { name: string, systemPrompt: string, voice?: string, model?: string }) {
    if (!apiKey) return { success: false, error: "API Key is required" };
    try {
        const data = await ultravoxBridge.createAgent(params, { apiKey });
        return { success: true, data };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Updates an existing persistent agent in Ultravox.
 */
export async function updateUltravoxAgent(apiKey: string, agentId: string, params: { name?: string, systemPrompt?: string, voice?: string, model?: string }) {
    if (!apiKey || !agentId) return { success: false, error: "API Key and Agent ID are required" };
    try {
        const data = await ultravoxBridge.updateAgent(agentId, params, { apiKey });
        return { success: true, data };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Lists calls for a specific agent.
 */
export async function listUltravoxCalls(apiKey: string, agentId?: string) {
    if (!apiKey) return { success: false, error: "API Key is required" };
    try {
        const data = await ultravoxBridge.listCalls({ agentId, limit: 50 }, { apiKey });
        return { success: true, data: data.results || [] };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
