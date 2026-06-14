/**
 * Tests de traceLLMUsage — observabilidad LLM metadata-only (Sprint 8 Phase 03).
 *
 * Verifica que: (1) es no-op sin config y nunca lanza, (2) cuando está
 * configurado emite trace + generation SIN input/output (política PII red-team V2).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { traceSpy, generationSpy } = vi.hoisted(() => {
  const generationSpy = vi.fn((_arg?: Record<string, unknown>) => {});
  const traceSpy = vi.fn((_arg?: Record<string, unknown>) => ({ generation: generationSpy }));
  return { traceSpy, generationSpy };
});

vi.mock("langfuse", () => ({
  Langfuse: class {
    trace = traceSpy;
  },
}));

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  traceSpy.mockClear();
  generationSpy.mockClear();
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("traceLLMUsage — metadata-only sin PII", () => {
  it("es no-op y no lanza cuando Langfuse no está configurado", async () => {
    const { traceLLMUsage } = await import("@/lib/observability/langfuse-client");
    expect(() =>
      traceLLMUsage({ agentName: "fact-extractor", model: "gpt-4o-mini", usage: null })
    ).not.toThrow();
    expect(traceSpy).not.toHaveBeenCalled();
  });

  it("emite trace + generation con tokens pero SIN input/output cuando está configurado", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";

    const { traceLLMUsage } = await import("@/lib/observability/langfuse-client");
    traceLLMUsage({
      tenantId: "tenant-123",
      agentName: "ai-analysis",
      model: "gpt-4o-mini",
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      latencyMs: 350,
    });

    expect(traceSpy).toHaveBeenCalledTimes(1);
    const traceArg = (traceSpy.mock.calls[0]![0] ?? {}) as { tags?: string[] };
    expect(traceArg.tags).toContain("tenant:tenant-123");

    expect(generationSpy).toHaveBeenCalledTimes(1);
    const genArg = (generationSpy.mock.calls[0]![0] ?? {}) as Record<string, unknown>;
    expect(genArg.model).toBe("gpt-4o-mini");
    expect(genArg.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120 });
    // Garantía PII: jamás se envía input/output crudo.
    expect("input" in genArg).toBe(false);
    expect("output" in genArg).toBe(false);
  });
});
