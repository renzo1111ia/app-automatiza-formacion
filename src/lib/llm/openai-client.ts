import OpenAI from "openai";

/**
 * Creates a configured OpenAI client.
 * Automatically handles OpenRouter API keys if detected (starting with 'sk-or-v1-').
 */
export function getOpenAIClient(apiKey: string) {
  const isOpenRouter = apiKey?.startsWith("sk-or-v1-");
  return new OpenAI({
    apiKey,
    baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
    defaultHeaders: isOpenRouter
      ? {
          "HTTP-Referer": "https://automatizaformacion.com",
          "X-Title": "Automatiza Formacion",
        }
      : undefined,
  });
}
