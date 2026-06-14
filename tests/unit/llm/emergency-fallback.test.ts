/**
 * Tests del fallback de emergencia LiteLLM → SDK directo (Sprint 8, red-team V1).
 *
 * GARANTIZA que el fallback preserva `tools`, `tool_choice` y `response_format`.
 * Descartarlos rompía silenciosamente el agendado de WhatsApp (tool calls) y el
 * parsing JSON de fact-extractor/ai-analysis (response_format: json_object).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Captura de los argumentos pasados al SDK de OpenAI.
// `vi.hoisted` garantiza que createMock existe antes de que el factory de
// vi.mock (que se eleva al top) y el `new OpenAI()` a nivel de módulo lo usen.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => {
  return {
    default: class {
      chat = { completions: { create: createMock } };
    },
  };
});

import { emergencyFallbackChat } from "@/lib/llm/emergency-fallback";

const sampleTools = [
  {
    type: "function" as const,
    function: { name: "book_appointment", parameters: { type: "object", properties: {} } },
  },
];

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: "cmpl-test", choices: [], usage: {} });
});

describe("emergencyFallbackChat — preservación de capacidades (red-team V1)", () => {
  it("propaga tools y tool_choice al SDK", async () => {
    await emergencyFallbackChat({
      model: "gpt-4o",
      messages: [{ role: "user", content: "agenda una cita" }],
      tools: sampleTools,
      tool_choice: "auto",
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0][0];
    expect(args.tools).toEqual(sampleTools);
    expect(args.tool_choice).toBe("auto");
  });

  it("propaga response_format (json_object)", async () => {
    await emergencyFallbackChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "extrae los datos" }],
      response_format: { type: "json_object" },
    });

    const args = createMock.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: "json_object" });
  });

  it("propaga el array messages completo, incluyendo roles tool", async () => {
    const messages = [
      { role: "system", content: "eres un agente" },
      { role: "user", content: "hola" },
      { role: "assistant", content: "", tool_calls: [{ id: "t1", type: "function", function: { name: "x", arguments: "{}" } }] },
      { role: "tool", content: "resultado", tool_call_id: "t1" },
    ];

    await emergencyFallbackChat({ model: "gpt-4o", messages });

    const args = createMock.mock.calls[0][0];
    expect(args.messages).toHaveLength(4);
    expect(args.messages[3].role).toBe("tool");
  });

  it("respeta modelos OpenAI tal cual (no los reescribe)", async () => {
    await emergencyFallbackChat({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    expect(createMock.mock.calls[0][0].model).toBe("gpt-4o");
  });

  it("cae a gpt-4o para modelos no-OpenAI (Claude) preservando tools", async () => {
    await emergencyFallbackChat({
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "agenda" }],
      tools: sampleTools,
    });

    const args = createMock.mock.calls[0][0];
    expect(args.model).toBe("gpt-4o");
    expect(args.tools).toEqual(sampleTools);
  });

  it("no envía campos avanzados cuando no se pasan (request mínimo)", async () => {
    await emergencyFallbackChat({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    const args = createMock.mock.calls[0][0];
    expect("tools" in args).toBe(false);
    expect("tool_choice" in args).toBe(false);
    expect("response_format" in args).toBe(false);
  });
});
