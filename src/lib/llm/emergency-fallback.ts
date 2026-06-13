import { createLogger } from "@/lib/utils/logger";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions";
import type { ResponseFormatJSONObject, ResponseFormatJSONSchema } from "openai/resources/shared";
import type { LiteLLMRequest } from "./litellm-client";

const log = createLogger("llm.emergency");

/**
 * Fallback de emergencia directo al SDK del provider si el proxy LiteLLM
 * se cae, está colgado o no está configurado.
 *
 * CRÍTICO (red-team Sprint 8 V1): este fallback DEBE preservar `tools`,
 * `tool_choice` y `response_format`. La ruta caliente de WhatsApp depende de
 * tool calls (book/cancel/reschedule appointment); fact-extractor y ai-analysis
 * dependen de `response_format: json_object`. Descartar esos campos rompía el
 * agendado y el parsing JSON silenciosamente.
 */
const fallbackClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Mapea el modelo solicitado a un modelo OpenAI de fallback equivalente.
 *
 * El SDK directo cargado aquí es OpenAI. Para modelos no-OpenAI (Claude/Gemini)
 * no hay SDK directo en esta capa, así que se cae a un equivalente OpenAI
 * razonable preservando capacidades (tools/JSON). Se registra que el provider
 * original no estaba disponible para visibilidad en Sentry/logs.
 */
function resolveFallbackModel(requestedModel: string | undefined): {
  model: string;
  providerSwitched: boolean;
} {
  const m = (requestedModel || "").toLowerCase();

  // Modelos OpenAI conocidos → se respetan tal cual.
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) {
    return { model: requestedModel as string, providerSwitched: false };
  }

  // Claude / Gemini / cualquier otro → equivalente OpenAI capaz (soporta tools + JSON).
  // gpt-4o es el más cercano en capacidad a sonnet/gemini-pro para no degradar
  // la calidad del agendado en una caída.
  return { model: "gpt-4o", providerSwitched: true };
}

export async function emergencyFallbackChat(req: LiteLLMRequest) {
  const { model: safeModel, providerSwitched } = resolveFallbackModel(req.model);

  log.warn("🚨 Usando fallback directo de EMERGENCIA al SDK del provider", {
    requestedModel: req.model,
    fallbackModel: safeModel,
    providerSwitched,
  });

  // Extraer campos avanzados del request (vienen vía el index signature de
  // LiteLLMRequest). Se propagan tal cual al SDK de OpenAI.
  const tools = req.tools as ChatCompletionTool[] | undefined;
  const toolChoice = req.tool_choice as ChatCompletionToolChoiceOption | undefined;
  const responseFormat = req.response_format as
    | ResponseFormatJSONObject
    | ResponseFormatJSONSchema
    | undefined;

  try {
    const completion = await fallbackClient.chat.completions.create({
      model: safeModel,
      // messages completo, incluyendo roles `tool` de rondas previas.
      messages: req.messages as ChatCompletionMessageParam[],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.max_tokens,
      user: req.user,
      // Preservar capacidades avanzadas — sin esto se rompe agendado / JSON.
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    });

    return completion;
  } catch (err) {
    log.error("❌ El fallback de emergencia también falló", { error: err });
    throw err;
  }
}
