import { Langfuse } from "langfuse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("observability.langfuse");

const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || "https://us.cloud.langfuse.com";

let langfuseClient: Langfuse | null = null;

if (LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY) {
  langfuseClient = new Langfuse({
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
    baseUrl: LANGFUSE_BASE_URL,
  });
  log.info("Langfuse client initialized successfully");
} else {
  log.warn("Langfuse API keys are missing. Tracing is disabled.");
}

export const langfuse = langfuseClient;

export function getLangfuseClient() {
  return langfuseClient;
}

export interface LLMUsageTrace {
  tenantId?: string;
  agentName: string; // ej. "fact-extractor", "ai-analysis", "ai-rescue"
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  latencyMs?: number;
  /** Marcador opcional sin PII (ej. "via-proxy" | "direct"). */
  route?: string;
}

/**
 * Emite un trace de USO LLM a Langfuse con SOLO metadata — sin input/output.
 *
 * POLÍTICA PII (red-team Sprint 8 V2): NO se envían inputs/outputs crudos a
 * Langfuse. Los transcripts de WhatsApp/voz y los system prompts traen PII de
 * leads (DNI/NIE, teléfonos LatAm, emails) que el masking por regex (ver
 * pii-mask.ts) NO cubre de forma fiable. Solo emitimos metadata: modelo, tokens,
 * latencia, tenant_id, agente. Da observabilidad de coste/uso sin riesgo RGPD.
 * El tracing con payload real queda diferido a Langfuse self-hosted + masking
 * validado a mano (decisión Bea, ADR-024).
 *
 * Best-effort: no-op si Langfuse no está configurado; nunca lanza.
 */
export function traceLLMUsage(t: LLMUsageTrace): void {
  const client = getLangfuseClient();
  if (!client) return;

  try {
    const trace = client.trace({
      name: `llm:${t.agentName}`,
      // tenant_id como tag + metadata para filtrado server-side (no es PII de lead).
      tags: t.tenantId ? [`tenant:${t.tenantId}`] : undefined,
      metadata: { tenantId: t.tenantId, route: t.route },
    });

    trace.generation({
      name: t.agentName,
      model: t.model,
      // SIN input/output — solo recuento de tokens y latencia.
      usage: t.usage
        ? {
            promptTokens: t.usage.prompt_tokens ?? 0,
            completionTokens: t.usage.completion_tokens ?? 0,
            totalTokens: t.usage.total_tokens ?? 0,
          }
        : undefined,
      metadata: t.latencyMs != null ? { latencyMs: t.latencyMs } : undefined,
    });
  } catch (err) {
    // La observabilidad nunca debe romper el flujo de negocio.
    log.warn("No se pudo emitir trace a Langfuse", { error: err });
  }
}
