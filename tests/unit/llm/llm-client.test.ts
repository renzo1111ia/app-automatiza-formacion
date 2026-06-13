/**
 * Tests del selector de cliente LLM async (getLLMClient) — Sprint 8 Phase 02.
 *
 * Verifica la decisión proxy-vs-directo y el flag de caos test LITELLM_FORCE_DOWN.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Captura de los argumentos del constructor de OpenAI.
const { ctorSpy } = vi.hoisted(() => ({ ctorSpy: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    constructor(opts: unknown) {
      ctorSpy(opts);
    }
  },
}));

import { getLLMClient } from "@/lib/llm/llm-client";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  ctorSpy.mockReset();
  delete process.env.LITELLM_BASE_URL;
  delete process.env.LITELLM_API_KEY;
  delete process.env.LITELLM_FORCE_DOWN;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("getLLMClient — routing proxy vs directo", () => {
  it("usa el proxy (baseURL + key del proxy) cuando está configurado", () => {
    process.env.LITELLM_BASE_URL = "http://litellm-proxy:4000";
    process.env.LITELLM_API_KEY = "sk-proxy-key";

    getLLMClient("sk-tenant-key");

    const opts = ctorSpy.mock.calls[0][0];
    expect(opts.baseURL).toBe("http://litellm-proxy:4000");
    expect(opts.apiKey).toBe("sk-proxy-key"); // key del proxy, NO la del tenant
  });

  it("normaliza barras finales del baseURL", () => {
    process.env.LITELLM_BASE_URL = "http://litellm-proxy:4000/";
    process.env.LITELLM_API_KEY = "sk-proxy-key";

    getLLMClient("sk-tenant-key");

    expect(ctorSpy.mock.calls[0][0].baseURL).toBe("http://litellm-proxy:4000");
  });

  it("va DIRECTO con la key del tenant si el proxy no está configurado", () => {
    getLLMClient("sk-tenant-key");

    const opts = ctorSpy.mock.calls[0][0];
    expect(opts.apiKey).toBe("sk-tenant-key");
    expect(opts.baseURL).toBeUndefined();
  });

  it("LITELLM_FORCE_DOWN=true fuerza directo aunque el proxy esté configurado (caos test)", () => {
    process.env.LITELLM_BASE_URL = "http://litellm-proxy:4000";
    process.env.LITELLM_API_KEY = "sk-proxy-key";
    process.env.LITELLM_FORCE_DOWN = "true";

    getLLMClient("sk-tenant-key");

    const opts = ctorSpy.mock.calls[0][0];
    expect(opts.apiKey).toBe("sk-tenant-key");
    expect(opts.baseURL).toBeUndefined();
  });
});
