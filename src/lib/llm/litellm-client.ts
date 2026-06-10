import { createLogger } from "@/lib/utils/logger";
import { emergencyFallbackChat } from "./emergency-fallback";

const log = createLogger("llm.litellm");

export interface LiteLLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  user?: string; // Usado para el tracking del tenant ID
  [key: string]: unknown; // Para tool_calls u otras opciones avanzadas
}

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || "http://localhost:4000";
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || "sk-1234";

/**
 * Cliente proxy para interactuar con LiteLLM.
 * Incluye un fallback a OpenAI directo si el Gateway falla.
 */
export async function proxyChatCompletion(req: LiteLLMRequest) {
  try {
    const response = await fetch(`${LITELLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LITELLM_API_KEY}`,
      },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    log.error("Fallo de conexión con LiteLLM Proxy, saltando al fallback de emergencia", { error });
    return emergencyFallbackChat(req);
  }
}
