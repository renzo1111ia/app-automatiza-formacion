"use server";

// ── Retell AgentResponse schema (from GET /list-agents and GET /get-agent docs) ──
interface RetellAgentResponse {
  agent_id: string;
  version: number;
  is_published?: boolean;
  agent_name?: string | null;
  voice_id?: string;
  language?: string;
  last_modification_timestamp?: number;
  response_engine?: {
    type: "retell-llm" | "custom-llm" | "conversation-flow";
    llm_id?: string;
    llm_websocket_url?: string;
    conversation_flow_id?: string;
    version?: number;
  };
}

interface RetellPhoneNumber {
  phone_number: string;
  phone_number_pretty?: string;
  nickname?: string;
}

interface RetellVoiceResponse {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender: "male" | "female";
  accent: string;
  preview_audio_url?: string;
}

/**
 * Fetches agents and phone numbers from Retell using the provided API Key.
 * Endpoint: GET /list-agents  (returns AgentResponse array, default limit=1000)
 * The AgentResponse already includes response_engine.llm_id and voice_id,
 * so the UI can pre-populate those fields without an extra get-agent call.
 */
export async function syncRetellResources(apiKey: string) {
  if (!apiKey) return { success: false, error: "API Key is required for sync" };

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // 1. Fetch Agents — limit=1000 is the max per docs (default)
    const agentsRes = await fetch("https://api.retellai.com/list-agents?limit=1000", { headers });
    if (!agentsRes.ok) {
      const err = await agentsRes.text();
      throw new Error(`Error fetching agents: ${err}`);
    }
    const allAgents: RetellAgentResponse[] = await agentsRes.json();

    // 1.1 De-duplicate by agent_name, keeping ONLY the latest version
    const latestAgentsMap = new Map<string, RetellAgentResponse>();
    for (const a of allAgents) {
      const key = a.agent_name || a.agent_id;
      const existing = latestAgentsMap.get(key);
      // If we don't have this agent yet, or this version is newer, update map
      if (!existing || a.version > (existing.version || 0)) {
        latestAgentsMap.set(key, a);
      }
    }
    const filteredAgents = Array.from(latestAgentsMap.values());

    // 2. Fetch Phone Numbers
    const numbersRes = await fetch("https://api.retellai.com/list-phone-numbers", { headers });
    if (!numbersRes.ok) {
      const err = await numbersRes.text();
      throw new Error(`Error fetching phone numbers: ${err}`);
    }
    const numbers: RetellPhoneNumber[] = await numbersRes.json();

    // 3. Fetch Voices
    const voicesRes = await fetch("https://api.retellai.com/list-voices?limit=1000", { headers });
    let voices: RetellVoiceResponse[] = [];
    if (voicesRes.ok) {
      const rawVoices = await voicesRes.json();
      if (Array.isArray(rawVoices)) {
        voices = rawVoices;
      } else if (rawVoices && Array.isArray(rawVoices.voices)) {
        voices = rawVoices.voices;
      } else if (rawVoices && Array.isArray(rawVoices.data)) {
        voices = rawVoices.data;
      }
    }

    // Si la API no devuelve voces o hubo un problema de parseo, forzamos las de fallback
    if (voices.length === 0) {
      console.warn("No voices fetched from API, using fallback voices");
      voices = [
        {
          voice_id: "11labs-Adrian",
          voice_name: "Adrian",
          provider: "11labs",
          gender: "male",
          accent: "American",
          preview_audio_url: "",
        },
        {
          voice_id: "11labs-Rachel",
          voice_name: "Rachel",
          provider: "11labs",
          gender: "female",
          accent: "American",
          preview_audio_url: "",
        },
        {
          voice_id: "openai-Alloy",
          voice_name: "Alloy",
          provider: "openai",
          gender: "male",
          accent: "Neutral",
          preview_audio_url: "",
        },
        {
          voice_id: "openai-Nova",
          voice_name: "Nova",
          provider: "openai",
          gender: "female",
          accent: "Neutral",
          preview_audio_url: "",
        },
        {
          voice_id: "11labs-Antoni",
          voice_name: "Antoni",
          provider: "11labs",
          gender: "male",
          accent: "American",
          preview_audio_url: "",
        },
        {
          voice_id: "11labs-Domi",
          voice_name: "Domi",
          provider: "11labs",
          gender: "female",
          accent: "American",
          preview_audio_url: "",
        },
        {
          voice_id: "cartesia-es-MX-1",
          voice_name: "Cartesia Mexico",
          provider: "cartesia",
          gender: "female",
          accent: "Mexican",
          preview_audio_url: "",
        },
        {
          voice_id: "cartesia-es-ES-1",
          voice_name: "Cartesia Spain",
          provider: "cartesia",
          gender: "male",
          accent: "Spanish",
          preview_audio_url: "",
        },
      ] as RetellVoiceResponse[];
    }

    return {
      success: true,
      data: {
        agents: filteredAgents.map((a) => ({
          id: a.agent_id,
          name: a.agent_name || a.agent_id,
          llm_id: a.response_engine?.llm_id || null,
          voice_id: a.voice_id || null,
          language: a.language || "es-ES",
          is_published: a.is_published ?? false,
          version: a.version ?? 0,
        })),
        numbers: numbers.map((n) => {
          const display = n.nickname || n.phone_number_pretty || n.phone_number;
          const label =
            display !== n.phone_number ? `${display} (${n.phone_number})` : n.phone_number;
          return { id: n.phone_number, name: label };
        }),
        voices: voices.map((v: RetellVoiceResponse) => ({
          id: v.voice_id,
          name: v.voice_name,
          provider: v.provider,
          gender: v.gender,
          accent: v.accent,
          preview_url: v.preview_audio_url,
        })),
      },
    };
  } catch (error: unknown) {
    console.error("Retell Sync Error:", error);

    // Fallback for demo mode or invalid API key (e.g. key_REPLACE_ME)
    if (apiKey === "key_REPLACE_ME" || (error instanceof Error && error.message.includes("401"))) {
      return {
        success: true,
        data: {
          agents: [],
          numbers: [],
          voices: [
            {
              id: "11labs-Adrian",
              name: "Adrian",
              provider: "11labs",
              gender: "male",
              accent: "American",
              preview_url: "",
            },
            {
              id: "11labs-Rachel",
              name: "Rachel",
              provider: "11labs",
              gender: "female",
              accent: "American",
              preview_url: "",
            },
            {
              id: "openai-Alloy",
              name: "Alloy",
              provider: "openai",
              gender: "male",
              accent: "Neutral",
              preview_url: "",
            },
            {
              id: "openai-Nova",
              name: "Nova",
              provider: "openai",
              gender: "female",
              accent: "Neutral",
              preview_url: "",
            },
            {
              id: "11labs-Antoni",
              name: "Antoni",
              provider: "11labs",
              gender: "male",
              accent: "American",
              preview_url: "",
            },
            {
              id: "11labs-Domi",
              name: "Domi",
              provider: "11labs",
              gender: "female",
              accent: "American",
              preview_url: "",
            },
            {
              id: "cartesia-es-MX-1",
              name: "Cartesia Mexico",
              provider: "cartesia",
              gender: "female",
              accent: "Mexican",
              preview_url: "",
            },
            {
              id: "cartesia-es-ES-1",
              name: "Cartesia Spain",
              provider: "cartesia",
              gender: "male",
              accent: "Spanish",
              preview_url: "",
            },
          ],
        },
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Retrieves full details of a specific Retell agent.
 * Endpoint: GET /get-agent/{agent_id}
 * AgentResponse fields per official docs: agent_id, version, is_published,
 * agent_name, voice_id, language, last_modification_timestamp, response_engine
 */
export async function getRetellAgent(apiKey: string, agentId: string, version?: number) {
  if (!apiKey || !agentId) return { success: false, error: "API Key and Agent ID are required" };

  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const url =
      version !== undefined
        ? `https://api.retellai.com/get-agent/${agentId}?version=${version}`
        : `https://api.retellai.com/get-agent/${agentId}`;

    // 1. Get Agent — agentId confirmed as path param per official docs
    const agentRes = await fetch(url, { headers });
    if (!agentRes.ok) throw new Error(`Failed to fetch agent from Retell (${agentRes.status})`);
    const agent = await agentRes.json();

    // Per official docs: llm_id sits under response_engine for retell-llm agents
    const llmId = agent.response_engine?.llm_id || agent.llm_id;
    let prompt = "";

    // 2. Fetch LLM to get the general_prompt and full config
    let llmConfig = null;
    if (llmId) {
      const llmRes = await fetch(`https://api.retellai.com/get-retell-llm/${llmId}`, { headers });
      if (llmRes.ok) {
        llmConfig = await llmRes.json();
        prompt = llmConfig.general_prompt || "";
      }
    }

    return {
      success: true,
      data: {
        // Explicit mapping of AgentResponse schema fields
        agent_id: agent.agent_id,
        version: agent.version,
        is_published: agent.is_published ?? false,
        agent_name: agent.agent_name || null,
        voice_id: agent.voice_id || "",
        language: agent.language || "es-ES",
        last_modification_timestamp: agent.last_modification_timestamp,
        // Response engine
        llm_id: llmId || null,
        response_engine_type: agent.response_engine?.type || null,
        // Prompt (fetched separately from LLM)
        prompt,
        // Full configuration for states/multi-prompt
        llm_config: llmConfig,
        // Pass through full agent for any other consumers
        _raw: agent,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Fetches all available voices from Retell.
 */
export async function listRetellVoices(apiKey: string) {
  if (!apiKey) return { success: false, error: "API Key is required" };

  try {
    const res = await fetch("https://api.retellai.com/list-voices?limit=1000", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch voices from Retell (${res.status})`);
    const voices: RetellVoiceResponse[] = await res.json();
    return {
      success: true,
      data: voices.map((v: RetellVoiceResponse) => ({
        id: v.voice_id,
        name: v.voice_name,
        provider: v.provider,
        gender: v.gender,
        accent: v.accent,
        preview_url: v.preview_audio_url,
      })),
    };
  } catch (error: unknown) {
    if (apiKey === "key_REPLACE_ME" || (error instanceof Error && error.message.includes("401"))) {
      return {
        success: true,
        data: [
          {
            id: "11labs-Adrian",
            name: "Adrian",
            provider: "11labs",
            gender: "male",
            accent: "American",
            preview_url: "",
          },
          {
            id: "11labs-Rachel",
            name: "Rachel",
            provider: "11labs",
            gender: "female",
            accent: "American",
            preview_url: "",
          },
          {
            id: "openai-Alloy",
            name: "Alloy",
            provider: "openai",
            gender: "male",
            accent: "Neutral",
            preview_url: "",
          },
          {
            id: "openai-Nova",
            name: "Nova",
            provider: "openai",
            gender: "female",
            accent: "Neutral",
            preview_url: "",
          },
          {
            id: "11labs-Antoni",
            name: "Antoni",
            provider: "11labs",
            gender: "male",
            accent: "American",
            preview_url: "",
          },
          {
            id: "11labs-Domi",
            name: "Domi",
            provider: "11labs",
            gender: "female",
            accent: "American",
            preview_url: "",
          },
          {
            id: "cartesia-es-MX-1",
            name: "Cartesia Mexico",
            provider: "cartesia",
            gender: "female",
            accent: "Mexican",
            preview_url: "",
          },
          {
            id: "cartesia-es-ES-1",
            name: "Cartesia Spain",
            provider: "cartesia",
            gender: "male",
            accent: "Spanish",
            preview_url: "",
          },
        ],
      };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Updates an agent's prompt in Retell.
 */
export async function updateRetellAgentPrompt(apiKey: string, llmId: string, prompt: string) {
  if (!apiKey || !llmId) return { success: false, error: "Missing config" };

  try {
    const res = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ general_prompt: prompt }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Retell update failed: ${err}`);
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Updates an existing Retell agent's metadata (name, voice, language, etc.).
 * Only includes fields that are explicitly provided — Retell applies partial patches.
 * Endpoint: PATCH /update-agent/{agent_id}
 *
 * Use this when the user edits an agent's name, voice_id, language, or description
 * in the dashboard. For prompt changes, use updateRetellAgentPrompt (on the LLM).
 */
export async function updateRetellAgent(
  apiKey: string,
  agentId: string,
  patch: {
    agent_name?: string;
    voice_id?: string;
    language?: string;
    version_description?: string;
    voice_temperature?: number;
    voice_speed?: number;
    volume?: number;
    responsiveness?: number;
    interruption_sensitivity?: number;
    enable_backchannel?: boolean;
    backchannel_frequency?: number;
    backchannel_words?: string[];
    ambient_sound?: string;
    webhook_url?: string;
    max_call_duration?: number;
    begin_message_delay_ms?: number;
  }
) {
  if (!apiKey || !agentId) {
    return { success: false, error: "API Key and Agent ID are required" };
  }

  // Build a clean patch body — omit empty/undefined values to avoid unintended resets
  const body: Record<string, unknown> = {};
  if (patch.agent_name !== undefined && patch.agent_name !== "") body.agent_name = patch.agent_name;
  if (patch.voice_id !== undefined && patch.voice_id !== "") body.voice_id = patch.voice_id;
  if (patch.language !== undefined && patch.language !== "") body.language = patch.language;
  if (patch.version_description !== undefined) body.version_description = patch.version_description;
  if (patch.voice_temperature !== undefined) body.voice_temperature = patch.voice_temperature;
  if (patch.voice_speed !== undefined) body.voice_speed = patch.voice_speed;
  if (patch.volume !== undefined) body.volume = patch.volume;
  if (patch.responsiveness !== undefined) body.responsiveness = patch.responsiveness;
  if (patch.interruption_sensitivity !== undefined)
    body.interruption_sensitivity = patch.interruption_sensitivity;
  if (patch.enable_backchannel !== undefined) body.enable_backchannel = patch.enable_backchannel;
  if (patch.backchannel_frequency !== undefined)
    body.backchannel_frequency = patch.backchannel_frequency;
  if (patch.backchannel_words !== undefined) body.backchannel_words = patch.backchannel_words;
  if (patch.ambient_sound !== undefined && patch.ambient_sound !== "")
    body.ambient_sound = patch.ambient_sound;
  if (patch.webhook_url !== undefined && patch.webhook_url !== "")
    body.webhook_url = patch.webhook_url;
  if (patch.max_call_duration !== undefined) body.max_call_duration = patch.max_call_duration;
  if (patch.begin_message_delay_ms !== undefined)
    body.begin_message_delay_ms = patch.begin_message_delay_ms;

  if (Object.keys(body).length === 0) {
    return { success: true, data: null }; // Nothing to patch
  }

  try {
    const res = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Retell agent update failed: ${err}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Creates a new Retell LLM (response engine) with an initial prompt.
 * Must be called before createRetellAgent since an agent requires a llm_id.
 * Endpoint: POST /create-retell-llm
 */
export async function createRetellLLM(apiKey: string, prompt: string) {
  if (!apiKey) return { success: false, error: "API Key is required" };

  try {
    const res = await fetch("https://api.retellai.com/create-retell-llm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        general_prompt: prompt || "",
        model: "gpt-4.1-mini",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Retell LLM creation failed: ${err}`);
    }

    const data = await res.json();
    return { success: true, data: { llm_id: data.llm_id, ...data } };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Creates a new agent in Retell.
 * Requires a response_engine with a llm_id (created via createRetellLLM first).
 * Endpoint: POST /create-agent
 */
export async function createRetellAgent(
  apiKey: string,
  params: {
    llm_id: string;
    agent_name: string;
    voice_id: string;
    language?: string;
    version_description?: string;
  }
) {
  if (!apiKey || !params.llm_id || !params.voice_id) {
    return { success: false, error: "API Key, LLM ID and voice_id are required" };
  }

  try {
    const body = {
      response_engine: { type: "retell-llm", llm_id: params.llm_id },
      agent_name: params.agent_name,
      voice_id: params.voice_id,
      language: params.language || "es-ES",
      ...(params.version_description && { version_description: params.version_description }),
      // Sensible call quality defaults
      normalize_for_speech: true,
      enable_backchannel: true,
      responsiveness: 0.9,
      end_call_after_silence_ms: 300000,
    };

    const res = await fetch("https://api.retellai.com/create-agent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Retell agent creation failed: ${err}`);
    }

    const data = await res.json();
    return {
      success: true,
      data: { agent_id: data.agent_id, llm_id: params.llm_id, voice_id: data.voice_id, ...data },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Binds a Retell agent to a phone number for outbound calls.
 * Uses the modern outbound_agents array (not deprecated outbound_agent_id).
 * Endpoint: PATCH /update-phone-number/{phone_number}
 */
export async function bindAgentToPhoneNumber(
  apiKey: string,
  phoneNumber: string,
  agentId: string,
  options?: { also_inbound?: boolean; nickname?: string }
) {
  if (!apiKey || !phoneNumber || !agentId) {
    return { success: false, error: "API Key, phone number and agent ID are required" };
  }

  try {
    const body: Record<string, unknown> = {
      // Use modern weighted agents array (weight must be > 0 and total = 1)
      outbound_agents: [{ agent_id: agentId, weight: 1 }],
    };

    if (options?.also_inbound) {
      body.inbound_agents = [{ agent_id: agentId, weight: 1 }];
    }

    if (options?.nickname) {
      body.nickname = options.nickname;
    }

    const res = await fetch(
      `https://api.retellai.com/update-phone-number/${encodeURIComponent(phoneNumber)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Retell phone bind failed: ${err}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
