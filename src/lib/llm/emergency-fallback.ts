import { createLogger } from "@/lib/utils/logger";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LiteLLMRequest } from "./litellm-client";

const log = createLogger("llm.emergency");

/**
 * Fallback de emergencia directo a OpenAI si el proxy LiteLLM
 * se cae o está inaccesible temporalmente.
 */
const fallbackClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function emergencyFallbackChat(req: LiteLLMRequest) {
  log.warn("🚨 Usando fallback directo de EMERGENCIA a OpenAI", { model: req.model });

  // Forzamos el uso de un modelo OpenAI conocido si era otra cosa
  const safeModel = req.model?.includes("gpt-4o") ? req.model : "gpt-4o-mini";

  try {
    const completion = await fallbackClient.chat.completions.create({
      model: safeModel,
      messages: req.messages as ChatCompletionMessageParam[],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.max_tokens,
      user: req.user,
    });

    return completion;
  } catch (err) {
    log.error("❌ El fallback de emergencia también falló", { error: err });
    throw err;
  }
}
