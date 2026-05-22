import { describe, it, expect } from "vitest";
import { ModelNameSchema, AiAgentVariantSchema } from "@/lib/schemas/ai-agents";

describe("ModelNameSchema (whitelist 2-35)", () => {
  it("acepta modelos OpenAI conocidos", () => {
    expect(ModelNameSchema.safeParse("gpt-4o").success).toBe(true);
    expect(ModelNameSchema.safeParse("gpt-4o-mini").success).toBe(true);
    expect(ModelNameSchema.safeParse("gpt-4.1").success).toBe(true);
    expect(ModelNameSchema.safeParse("gpt-4.1-mini").success).toBe(true);
  });

  it("acepta modelos Anthropic Claude", () => {
    expect(ModelNameSchema.safeParse("claude-3-5-sonnet-20241022").success).toBe(true);
    expect(ModelNameSchema.safeParse("claude-3-5-haiku-20241022").success).toBe(true);
  });

  it("acepta modelos Google Gemini", () => {
    expect(ModelNameSchema.safeParse("gemini-1.5-pro").success).toBe(true);
    expect(ModelNameSchema.safeParse("gemini-2.0-flash").success).toBe(true);
  });

  it("rechaza modelos invalidos", () => {
    expect(ModelNameSchema.safeParse("gpt-99").success).toBe(false);
    expect(ModelNameSchema.safeParse("gpt-4").success).toBe(false); // sin sufijo no esta whitelisted
    expect(ModelNameSchema.safeParse("").success).toBe(false);
    expect(ModelNameSchema.safeParse(123).success).toBe(false);
  });
});

describe("AiAgentVariantSchema", () => {
  it("acepta variant minima con model whitelist", () => {
    const v = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      agent_id: "550e8400-e29b-41d4-a716-446655440001",
      version_label: "v1",
      prompt_text: "Eres un agente",
      is_active: true,
      is_variant_b: false,
      weight: 1,
      metrics: null,
      model_name: "gpt-4o-mini",
    };
    expect(AiAgentVariantSchema.safeParse(v).success).toBe(true);
  });

  it("rechaza variant con model_name fuera de whitelist", () => {
    const v = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      agent_id: "550e8400-e29b-41d4-a716-446655440001",
      version_label: "v1",
      prompt_text: "Eres un agente",
      is_active: true,
      is_variant_b: false,
      weight: 1,
      metrics: null,
      model_name: "modelo-inventado",
    };
    expect(AiAgentVariantSchema.safeParse(v).success).toBe(false);
  });
});
