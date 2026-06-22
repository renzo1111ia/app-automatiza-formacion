import OpenAI from "openai";
import { createLogger } from "@/lib/utils/logger";
import { isLiteLLMConfigured } from "./litellm-client";

const log = createLogger("llm.client");

/**
 * Devuelve un cliente OpenAI-compatible para los call sites ASYNC no-críticos
 * (fact-extractor, ai-analysis, ai-rescue) del Sprint 8.
 *
 * Si el proxy LiteLLM está configurado (LITELLM_BASE_URL + LITELLM_API_KEY) y
 * no está forzado a OFF, el cliente apunta al proxy vía `baseURL`. Esto:
 *   - Preserva NATIVAMENTE `tools`, `tool_choice` y `response_format` (a diferencia
 *     de reescribir con fetch) → no rompe el JSON de fact-extractor/ai-analysis.
 *   - Habilita cost tracking centralizado (LiteLLM_SpendLogs = fuente canónica €).
 *   - Es reversible: `LITELLM_FORCE_DOWN=true` simula proxy caído para el caos
 *     test sin tocar el contenedor (red-team Sprint 8 V9). En ese caso, y cuando
 *     el proxy no está configurado, el cliente va DIRECTO al provider con la
 *     `apiKey` del tenant — el flujo no se interrumpe.
 *
 * IMPORTANTE: NO se usa en la ruta caliente (WhatsApp/widget) — esos mantienen el
 * SDK directo en Sprint 8 para no introducir el SPOF del gateway (red-team V1/V7).
 *
 * @param apiKey  API key del provider del tenant (fallback directo y auth al proxy).
 */
export function getLLMClient(apiKey: string): OpenAI {
  const forceDown = process.env.LITELLM_FORCE_DOWN === "true";

  if (isLiteLLMConfigured() && !forceDown) {
    const baseURL = process.env.LITELLM_BASE_URL!.replace(/\/+$/, "");
    log.debug("Cliente LLM async vía proxy LiteLLM", { baseURL });
    return new OpenAI({
      // El proxy autentica con su master/virtual key, no con la del tenant.
      apiKey: process.env.LITELLM_API_KEY!,
      baseURL,
    });
  }

  // Proxy no configurado o forzado OFF → SDK directo con la key del tenant.
  log.debug("Cliente LLM async directo al provider (proxy no activo)");

  const trimmedKey = apiKey?.trim() || "";
  let baseURL = undefined;
  if (trimmedKey.startsWith("sk-or-v1")) {
    baseURL = "https://openrouter.ai/api/v1";
  }

  return new OpenAI({ apiKey: trimmedKey, baseURL });
}
