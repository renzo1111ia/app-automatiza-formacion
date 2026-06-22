"use server";

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { FactExtractionService } from "@/lib/services/fact-extractor";
import { AIAgent, AIAgentVariant } from "@/types/database";
import OpenAI from "openai";

/**
 * SIMULATOR ACTION
 * Handles a test chat session without persistent lead creation (or uses a temporary one).
 */
export async function testAgentVariables(params: {
  agentId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  currentVariables: Record<string, string | number | boolean>;
}) {
  const TEST_LEAD_ID = "00000000-0000-4000-8000-000000000000";
  try {
    const { agentId, message, history, currentVariables } = params;
    const supabase = await getAdminSupabaseClient();

    // 1. Fetch Agent & Variant
    const { data: agent } = (await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", agentId)
      .single()) as { data: AIAgent | null };
    const { data: variant } = (await supabase
      .from("ai_agent_variants")
      .select("*")
      .eq("agent_id", agentId)
      .eq("is_variant_b", false)
      .single()) as { data: AIAgentVariant | null };

    if (!agent || !variant) throw new Error("Agente no encontrado");

    // Ensure test lead exists in DB
    await supabase.from("lead").upsert({
      id: TEST_LEAD_ID,
      tenant_id: agent.tenant_id,
      nombre: "Simulador",
      apellido: "Test Lead",
      telefono: "+34000000000",
    });

    // 2. Prepare Context with current variables
    let context = variant.prompt_text || "";
    Object.entries(currentVariables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, "g");
        context = context.replace(regex, value.toString());
      }
    });

    // 3. Get AI Response
    const rawApiKey = variant.api_key || process.env.OPENAI_API_KEY;
    const apiKey = rawApiKey?.trim() || "";

    let baseURL = undefined;
    if (apiKey.startsWith("sk-or-v1")) {
      baseURL = "https://openrouter.ai/api/v1";
    }

    const openai = new OpenAI({ apiKey, baseURL });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: context },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    let modelName = variant.model_name || "gpt-4o";
    if (modelName === "gpt-4.1") modelName = "gpt-4o";
    if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";

    const schedulingTools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "check_availability",
          description: "Consulta los huecos libres para agendar una cita en un día concreto.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
            },
            required: ["date"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "book_appointment",
          description: "Reserva una cita firme para el usuario en una hora disponible.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
              time: { type: "string", description: "Hora en formato HH:MM" },
            },
            required: ["date", "time"],
          },
        },
      },
    ];

    let completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature:
        ((variant as unknown as Record<string, unknown>).temperature as number | undefined) || 0.7,
      tools: schedulingTools,
    });

    const choice = completion.choices[0];
    let aiResponse = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls;

    const executedTools: { name: string; args: unknown; result: unknown }[] = [];

    if (toolCalls && toolCalls.length > 0) {
      messages.push(choice.message);

      const { checkAvailability, createAppointment } = await import("@/lib/actions/scheduling");

      for (const tc of toolCalls) {
        if (tc.type === "function") {
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch (e) {
            console.error("Error parsing tool arguments", e);
          }

          let resultStr = "";
          let resultData = null;

          if (tc.function.name === "check_availability") {
            const res = await checkAvailability(agent.tenant_id, args.date);
            if (res.success) {
              resultData = res;
              resultStr = `Disponibilidad para ${args.date}: configuración: ${JSON.stringify(res.config)}, slots ocupados: ${JSON.stringify(res.busy_slots)}`;
            } else {
              resultStr = `Error: ${res.error}`;
            }
          } else if (tc.function.name === "book_appointment") {
            const res = await createAppointment({
              lead_id: TEST_LEAD_ID,
              scheduled_at: `${args.date}T${args.time}:00.000Z`,
              status: "CONFIRMED",
            });
            if (res.success) {
              resultData = res.data;
              resultStr = `Cita agendada correctamente para ${args.date} a las ${args.time}.`;
            } else {
              resultStr = `Error agendando cita: ${res.error}`;
            }
          }

          executedTools.push({ name: tc.function.name, args, result: resultData });

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultStr,
          });
        }
      }

      completion = await openai.chat.completions.create({
        model: modelName,
        messages,
        temperature: 0.7,
        tools: schedulingTools,
      });

      aiResponse = completion.choices[0]?.message?.content || "";
    }

    // 4. Extract Variables (Facts)
    const trackedVars = (variant.tracked_variables as string[]) || [];
    let newExtractedData = {};

    if (trackedVars.length > 0) {
      // Reconstruct full dialogue from history
      const fullDialogue = history
        .map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.content}`)
        .concat(`User: ${message}\nAI: ${aiResponse}`)
        .join("\n\n");

      // Simulate extraction
      const extractionResult = await FactExtractionService.extractFromDialogue(
        TEST_LEAD_ID,
        fullDialogue,
        trackedVars,
        apiKey!
      );
      if (extractionResult) {
        newExtractedData = extractionResult;
      }
    }

    return {
      success: true,
      response: aiResponse,
      extracted: newExtractedData,
      executedTools,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[TEST ACTION] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Persiste una sesión del simulador (mensajes + variables capturadas) en BD.
 * La tabla `simulator_sessions` aún no está en los tipos generados de Supabase,
 * por eso se castea el builder a un tipo mínimo en vez de usar `any` (política no-any).
 */
type SimulatorSessionsTable = {
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  select: (cols: string) => {
    eq: (
      col: string,
      val: string
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export async function saveSimulatorSession(params: {
  tenantId: string;
  agentId: string;
  sessionName: string;
  messages: unknown[];
  variablesCaptured: Record<string, unknown>;
}) {
  try {
    const supabase = await getAdminSupabaseClient();
    const table = supabase.from("simulator_sessions") as unknown as SimulatorSessionsTable;
    const { error } = await table.insert({
      tenant_id: params.tenantId,
      agent_id: params.agentId,
      session_name: params.sessionName,
      messages: params.messages,
      variables_captured: params.variablesCaptured,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error("[SAVE SESSION] Error:", err);
    return { success: false, error: err.message };
  }
}

export async function getTestAppointments() {
  const TEST_LEAD_ID = "00000000-0000-4000-8000-000000000000";
  try {
    const supabase = await getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("lead_id", TEST_LEAD_ID)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getSimulatorSessions(tenantId: string) {
  try {
    const supabase = await getAdminSupabaseClient();
    const table = supabase.from("simulator_sessions") as unknown as SimulatorSessionsTable;
    const { data, error } = await table
      .select("*, ai_agents(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}
