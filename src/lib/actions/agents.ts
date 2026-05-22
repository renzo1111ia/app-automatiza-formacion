"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import type { AIAgent, AIAgentVariant, Database } from "@/types/database";
import { ModelNameSchema } from "@/lib/schemas/ai-agents";

/**
 * Fetches all AI Agents for the active tenant.
 */
export async function getAIAgents() {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No hay un cliente seleccionado." };

  const { data, error } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AIAgent[] };
}

/**
 * Fetches all variants for a specific agent.
 * Note: Variants are linked via agent_id; RLS should handle tenant isolation.
 */
export async function getAgentVariants(agentId: string) {
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("ai_agent_variants")
    .select("*")
    .eq("agent_id", agentId)
    .order("version_label", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AIAgentVariant[] };
}

/**
 * Saves a new or existing agent.
 * Ensures the mandatory tenant_id is injected for proper data isolation.
 */
export async function saveAIAgent(agent: Partial<AIAgent>) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No hay una sesión de cliente activa." };

  const agentData = {
    ...agent,
    tenant_id: tenantId,
  };

  // We use a safe cast to avoid inference issues with generic Supabase client
  // while avoiding the use of 'any' to satisfy lint rules.
  const { data, error } = await supabase
    .from("ai_agents")
    // @ts-expect-error - Supabase inference issue with table keys
    .upsert(agentData as Database["public"]["Tables"]["ai_agents"]["Insert"])
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AIAgent };
}

/**
 * Saves a prompt variant.
 */
export async function saveAgentVariant(variant: Partial<AIAgentVariant>) {
  const supabase = await getAdminSupabaseClient();

  // 2-35: validar model_name contra whitelist en el boundary (Server Action).
  if (variant.model_name !== undefined && variant.model_name !== null) {
    const parsed = ModelNameSchema.safeParse(variant.model_name);
    if (!parsed.success) {
      return {
        success: false,
        error: `Modelo inválido "${variant.model_name}". Modelos permitidos: ${ModelNameSchema.options.join(", ")}`,
      };
    }
  }

  // Clean up variant data to remove metadata fields that shouldn't be upserted
  // but keep fields like api_key, knowledge_base_id and model info
  const {
    id: _id,
    created_at: _created_at,
    updated_at: _updated_at,
    metrics: _metrics,
    ...cleanVariant
  } = variant;
  void _id;
  void _created_at;
  void _updated_at;
  void _metrics;

  // We explicitly include the ID if it exists, otherwise use onConflict
  const dataToUpsert = variant.id
    ? { id: variant.id, ...(cleanVariant as Partial<AIAgentVariant>) }
    : (cleanVariant as Partial<AIAgentVariant>);

  const { data, error } = await supabase
    .from("ai_agent_variants")
    // @ts-expect-error - Supabase inference issue with table keys
    .upsert(dataToUpsert as Database["public"]["Tables"]["ai_agent_variants"]["Insert"], {
      onConflict: "agent_id,is_variant_b",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[ACTIONS] Error saving agent variant:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as AIAgentVariant };
}

/**
 * Deletes an AI agent.
 */
export async function deleteAIAgent(agentId: string) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No hay una sesión de cliente activa." };

  const { error } = await supabase
    .from("ai_agents")
    .delete()
    .eq("id", agentId)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Fetches all advisors for the active tenant.
 */
export async function getAdvisors() {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No hay un cliente seleccionado." };

  const { data, error } = await supabase
    .from("advisors")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
