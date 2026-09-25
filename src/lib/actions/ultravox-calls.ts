"use server";

import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { ultravoxBridge } from "@/lib/integrations/ultravox";

export interface UltravoxCallItem {
  callId: string;
  agentId?: string;
  agentName: string;
  created: string;
  ended?: string;
  durationSeconds: number;
  status: string;
  endReason?: string;
  shortSummary?: string;
  summary?: string;
  recordingUrl?: string;
  callerId?: string;
  dialedNumber?: string;
  variables: Record<string, any>;
  rawCall?: any;
}

export interface CallMessageItem {
  ordinal: number;
  role: "agent" | "user" | "system" | "tool";
  text: string;
  timestamp?: string;
  toolName?: string;
  toolArguments?: any;
  toolResult?: any;
}

export interface CallDetailResult {
  call: UltravoxCallItem;
  messages: CallMessageItem[];
  metadata: Record<string, any>;
  initialState: Record<string, any>;
}

/**
 * Normalizes and extracts captured variables from Ultravox call payload
 */
function extractCapturedVariables(call: any): Record<string, any> {
  const vars: Record<string, any> = {};

  // 1. Check metadata & templateContext
  const meta = call.metadata || call.systemMetadata || call.templateContext || {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined && v !== null && v !== "" && typeof v !== "object") {
      vars[k] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(vars, v);
    }
  }

  // 2. Check initialState
  const init = call.initialState || {};
  for (const [k, v] of Object.entries(init)) {
    if (v !== undefined && v !== null && v !== "") {
      vars[k] = v;
    }
  }

  // 3. Check requestContext
  const reqCtx = call.requestContext || {};
  for (const [k, v] of Object.entries(reqCtx)) {
    if (v !== undefined && v !== null && v !== "") {
      vars[k] = v;
    }
  }

  // 4. Check sipDetails
  if (call.sipDetails) {
    if (call.sipDetails.callerId) vars["caller_phone"] = call.sipDetails.callerId;
    if (call.sipDetails.dialedNumber) vars["dialed_phone"] = call.sipDetails.dialedNumber;
  }

  // 5. Intelligent regex variable extraction from summary if structured
  // e.g., "Nombre: Juan", "RUT: 12345678-9", "Repuesto: Filtro", "Empresa: Minera X"
  if (call.summary && typeof call.summary === "string") {
    const lines = call.summary.split("\n");
    for (const line of lines) {
      const match = line.match(/^[-*•]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s_]{2,25}):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
        const val = match[2].trim();
        if (!vars[key] && val.length < 150) {
          vars[key] = val;
        }
      }
    }
  }

  return vars;
}

/**
 * Calculates duration in seconds between start and end or duration string
 */
function computeDurationSeconds(call: any): number {
  if (call.duration) {
    if (typeof call.duration === "number") return Math.round(call.duration);
    const parsed = parseInt(String(call.duration).replace("s", ""), 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (call.created && call.ended) {
    const start = new Date(call.created).getTime();
    const end = new Date(call.ended).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Math.round((end - start) / 1000);
    }
  }
  return 0;
}

/**
 * Fetches all Ultravox calls for the currently active tenant
 */
async function resolveUltravoxApiKey(): Promise<string | null> {
  try {
    const tenant = await getActiveTenantConfig();
    const key = (tenant?.config as any)?.ultravox?.api_key;
    if (key) return key;
  } catch {
    // cookie or SSR context not present
  }
  return process.env.ULTRAVOX_API_KEY || null;
}

/**
 * Fetches all Ultravox calls for the currently active tenant
 */
export async function fetchUltravoxLeadCalls(params?: {
  agentId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  calls: UltravoxCallItem[];
  total: number;
  apiKeyFound: boolean;
  error?: string;
}> {
  try {
    const apiKey = await resolveUltravoxApiKey();

    if (!apiKey) {
      return {
        success: false,
        calls: [],
        total: 0,
        apiKeyFound: false,
        error: "No se ha configurado la API Key de Ultravox en la configuración del Tenant.",
      };
    }

    const limit = params?.limit || 100;
    const rawData = await ultravoxBridge.listCalls(
      { agentId: params?.agentId, limit },
      { apiKey }
    );

    const rawList = rawData.results || rawData.calls || (Array.isArray(rawData) ? rawData : []);

    const calls: UltravoxCallItem[] = rawList.map((c: any) => {
      const vars = extractCapturedVariables(c);
      return {
        callId: String(c.callId || c.id || ""),
        agentId: c.agentId || c.agent?.agentId || undefined,
        agentName: c.agent?.name || c.agentName || "Agente Ultravox",
        created: c.created || c.startTime || new Date().toISOString(),
        ended: c.ended || c.endTime || undefined,
        durationSeconds: computeDurationSeconds(c),
        status: String(c.status || (c.ended ? "completed" : "in-progress")),
        endReason: c.endReason ? String(c.endReason) : undefined,
        shortSummary: c.shortSummary || (c.summary ? c.summary.slice(0, 160) + "..." : ""),
        summary: c.summary || c.shortSummary || "",
        recordingUrl: c.recordingUrl || undefined,
        callerId: c.sipDetails?.callerId || vars["caller_phone"] || undefined,
        dialedNumber: c.sipDetails?.dialedNumber || vars["dialed_phone"] || undefined,
        variables: vars,
        rawCall: JSON.parse(JSON.stringify(c || {})),
      };
    });

    return JSON.parse(
      JSON.stringify({
        success: true,
        calls,
        total: rawData.total || calls.length,
        apiKeyFound: true,
      })
    );
  } catch (err: any) {
    console.error("[fetchUltravoxLeadCalls] Error:", err);
    return {
      success: false,
      calls: [],
      total: 0,
      apiKeyFound: true,
      error: err?.message || "Error al conectar con la API de Ultravox",
    };
  }
}

/**
 * Fetches full detail and transcript messages for a specific call
 */
export async function fetchUltravoxCallDetail(callId: string): Promise<{
  success: boolean;
  data?: CallDetailResult;
  error?: string;
}> {
  try {
    const apiKey = await resolveUltravoxApiKey();

    if (!apiKey) {
      return { success: false, error: "API Key de Ultravox no configurada." };
    }

    // 1. Fetch single call detail
    const callRes = await fetch(`https://api.ultravox.ai/api/calls/${callId}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!callRes.ok) {
      throw new Error(`Error ${callRes.status} al obtener detalle de la llamada`);
    }
    const c = await callRes.json();

    // 2. Fetch transcript messages
    let messagesList: CallMessageItem[] = [];
    try {
      const msgRes = await fetch(`https://api.ultravox.ai/api/calls/${callId}/messages`, {
        headers: { "X-API-Key": apiKey },
        cache: "no-store",
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const rawMsgs = msgData.results || msgData.messages || (Array.isArray(msgData) ? msgData : []);
        messagesList = rawMsgs.map((m: any, idx: number) => {
          let role: "agent" | "user" | "system" | "tool" = "agent";
          if (m.role === "MESSAGE_ROLE_USER" || m.role === "user") role = "user";
          else if (m.role === "MESSAGE_ROLE_AGENT" || m.role === "agent") role = "agent";
          else if (m.role === "MESSAGE_ROLE_TOOL_CALL" || m.role === "tool") role = "tool";
          else if (m.role === "MESSAGE_ROLE_SYSTEM") role = "system";

          return {
            ordinal: m.ordinal ?? idx,
            role,
            text: String(m.text || m.content || (m.toolName ? `Tool: ${m.toolName}` : "")),
            timestamp: m.created || m.timestamp || undefined,
            toolName: m.toolName || m.invocation?.name || undefined,
            toolArguments: m.toolArguments || m.invocation?.arguments || undefined,
            toolResult: m.toolResult || m.invocation?.result || undefined,
          };
        });
      }
    } catch (e) {
      console.warn("[fetchUltravoxCallDetail] Could not fetch messages:", e);
    }

    const vars = extractCapturedVariables(c);
    const callItem: UltravoxCallItem = {
      callId: String(c.callId || c.id || ""),
      agentId: c.agentId || c.agent?.agentId || undefined,
      agentName: c.agent?.name || c.agentName || "Agente Ultravox",
      created: c.created || c.startTime || new Date().toISOString(),
      ended: c.ended || c.endTime || undefined,
      durationSeconds: computeDurationSeconds(c),
      status: String(c.status || (c.ended ? "completed" : "in-progress")),
      endReason: c.endReason ? String(c.endReason) : undefined,
      shortSummary: c.shortSummary || (c.summary ? c.summary.slice(0, 160) + "..." : ""),
      summary: c.summary || c.shortSummary || "",
      recordingUrl: c.recordingUrl || undefined,
      callerId: c.sipDetails?.callerId || vars["caller_phone"] || undefined,
      dialedNumber: c.sipDetails?.dialedNumber || vars["dialed_phone"] || undefined,
      variables: vars,
      rawCall: JSON.parse(JSON.stringify(c || {})),
    };

    return JSON.parse(
      JSON.stringify({
        success: true,
        data: {
          call: callItem,
          messages: messagesList,
          metadata: c.metadata || {},
          initialState: c.initialState || {},
        },
      })
    );
  } catch (err: any) {
    console.error("[fetchUltravoxCallDetail] Error:", err);
    return { success: false, error: err?.message || "Error al cargar la llamada" };
  }
}
