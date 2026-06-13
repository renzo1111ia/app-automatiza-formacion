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

// El proxy LiteLLM es OPCIONAL: si LITELLM_BASE_URL / LITELLM_API_KEY no están
// configuradas, el cliente va directo al fallback (SDK del provider). NUNCA se
// usan defaults inseguros (la default `sk-1234` de los tutoriales de LiteLLM
// daría acceso total a quien la conozca — ver red-team Sprint 8 V10).
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL?.trim() || null;
const LITELLM_API_KEY = process.env.LITELLM_API_KEY?.trim() || null;

// Timeout del fetch al proxy. Un proxy vivo pero colgado (deadlock de pool
// Postgres) dejaría el fetch pendiente indefinidamente sin AbortController,
// colgando el worker (red-team V1). 15s cubre completions largas sin colgar.
const LITELLM_TIMEOUT_MS = 15_000;

/** True si el proxy LiteLLM está configurado vía env vars. */
export function isLiteLLMConfigured(): boolean {
  return Boolean(LITELLM_BASE_URL && LITELLM_API_KEY);
}

/**
 * Cliente proxy para interactuar con LiteLLM.
 * Incluye un fallback al SDK directo del provider si el Gateway falla o no
 * está configurado.
 */
export async function proxyChatCompletion(req: LiteLLMRequest) {
  // Proxy no configurado → directo al fallback sin intentar conexión inútil.
  if (!isLiteLLMConfigured()) {
    log.debug("LiteLLM Proxy no configurado, usando SDK directo del provider");
    return emergencyFallbackChat(req);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LITELLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${LITELLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LITELLM_API_KEY}`,
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LiteLLM Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    log.error("Fallo de conexión con LiteLLM Proxy, saltando al fallback de emergencia", { error });
    return emergencyFallbackChat(req);
  } finally {
    clearTimeout(timeout);
  }
}
