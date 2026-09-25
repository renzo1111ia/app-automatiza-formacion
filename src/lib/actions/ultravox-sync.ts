"use server";

import { ultravoxBridge } from "../integrations/ultravox";

/**
 * ULTRAVOX RESOURCE SYNC
 * Fetches available voices and models from Ultravox API.
 */

export async function getUltravoxAgent(apiKey: string, agentId: string) {
  if (!apiKey || !agentId) return { success: false, error: "API Key and Agent ID are required" };
  try {
    const data = await ultravoxBridge.getAgent(agentId, { apiKey });
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function syncUltravoxResources(apiKey: string) {
  if (!apiKey) return { success: false, error: "API Key is required for Ultravox sync" };

  try {
    const headers = {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    };

    // 1. Fetch Voices (try /api/voices first, then /v1/voices)
    let voicesData: any = { results: [] };
    try {
      const res = await fetch("https://api.ultravox.ai/api/voices", { headers });
      if (res.ok) {
        voicesData = await res.json();
      } else {
        const resV1 = await fetch("https://api.ultravox.ai/v1/voices", { headers });
        if (resV1.ok) voicesData = await resV1.json();
      }
    } catch {
      // fallback handled below
    }

    const defaultVoices = [
      { id: "terrence", name: "Terrence (Male)" },
      { id: "sarah", name: "Sarah (Female)" },
      { id: "mark", name: "Mark (Male)" },
      { id: "jessica", name: "Jessica (Female)" },
    ];

    const voiceList: { id: string; name: string }[] = [];
    const seenVoices = new Set<string>();

    const rawVoices = voicesData.results || voicesData.voices || (Array.isArray(voicesData) ? voicesData : []);
    for (const v of rawVoices) {
      const id = v.voiceId || v.id || v.name;
      const name = v.name || v.description || v.voiceId || id;
      if (id && !seenVoices.has(id)) {
        seenVoices.add(id);
        voiceList.push({ id, name });
      }
    }

    // 2. Fetch Models (try /api/models first, then /v1/models)
    let modelsData: any = { results: [] };
    try {
      const res = await fetch("https://api.ultravox.ai/api/models", { headers });
      if (res.ok) {
        modelsData = await res.json();
      } else {
        const resV1 = await fetch("https://api.ultravox.ai/v1/models", { headers });
        if (resV1.ok) modelsData = await resV1.json();
      }
    } catch {
      // fallback handled below
    }

    const defaultModels = [
      { id: "fixie-ai/ultravox-70b", name: "Ultravox 70B (High Quality)" },
      { id: "fixie-ai/ultravox-8b", name: "Ultravox 8B (Fast)" },
      { id: "gpt-4o-realtime", name: "GPT-4o Realtime" },
      { id: "fixie-ai/ultravox-v0.4", name: "Ultravox v0.4" },
    ];

    const modelList: { id: string; name: string }[] = [];
    const seenModels = new Set<string>();

    const rawModels = modelsData.results || modelsData.models || (Array.isArray(modelsData) ? modelsData : []);
    for (const m of rawModels) {
      const id = m.modelId || m.id || m.name;
      const name = m.name || m.modelId || id;
      if (id && !seenModels.has(id)) {
        seenModels.add(id);
        modelList.push({ id, name });
      }
    }

    // Add defaults if missing
    for (const dv of defaultVoices) {
      if (!seenVoices.has(dv.id)) {
        seenVoices.add(dv.id);
        voiceList.push(dv);
      }
    }
    for (const dm of defaultModels) {
      if (!seenModels.has(dm.id)) {
        seenModels.add(dm.id);
        modelList.push(dm);
      }
    }

    // 3. Inspect existing agents in Ultravox to discover custom voices (e.g. ElevenLabs voices like 'sofiia')
    try {
      const agentsRes = await ultravoxBridge.listAgents({ apiKey });
      const agentsList = agentsRes.results || agentsRes.agents || (Array.isArray(agentsRes) ? agentsRes : []);
      for (const a of agentsList) {
        const v = a.callTemplate?.voice || a.voice;
        if (v && !seenVoices.has(v)) {
          seenVoices.add(v);
          voiceList.unshift({ id: v, name: a.callTemplate?.voice_name || a.voice_name || v });
        }
        const m = a.callTemplate?.model || a.model;
        if (m && !seenModels.has(m)) {
          seenModels.add(m);
          modelList.unshift({ id: m, name: m });
        }
      }
    } catch {
      // non-blocking
    }

    return {
      success: true,
      data: {
        voices: voiceList,
        models: modelList,
      },
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
export async function createUltravoxAgent(
  apiKey: string,
  params: { name: string; systemPrompt: string; voice?: string; model?: string }
) {
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
export async function updateUltravoxAgent(
  apiKey: string,
  agentId: string,
  params: { name?: string; systemPrompt?: string; voice?: string; model?: string }
) {
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
