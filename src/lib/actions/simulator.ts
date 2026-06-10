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

    // 2. Prepare Context with current variables
    let context = variant.prompt_text || "";
    Object.entries(currentVariables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, "g");
        context = context.replace(regex, value.toString());
      }
    });

    // 3. Get AI Response
    const apiKey = variant.api_key || process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: context },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    let modelName = variant.model_name || "gpt-4o";
    if (modelName === "gpt-4.1") modelName = "gpt-4o";
    if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature:
        ((variant as unknown as Record<string, unknown>).temperature as number | undefined) || 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || "";

    // 4. Extract Variables (Facts)
    const trackedVars = (variant.tracked_variables as string[]) || [];
    let newExtractedData = {};

    if (trackedVars.length > 0) {
      // Simulate extraction
      const extractionResult = await FactExtractionService.extractFromDialogue(
        "test-lead-id",
        `User: ${message}\nAI: ${aiResponse}`,
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
    return { success: false, error: err.message };
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
