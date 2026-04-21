"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { AIAgent, AIAgentVariant } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";

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
    const supabase = (await getAdminSupabaseClient()) as unknown as SupabaseClient;
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
        tenant_id: tenantId
    };

    const { data, error } = await supabase
        .from("ai_agents")
        .upsert(agentData as any)
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
    
    // Clean up variant data to remove metadata fields that shouldn't be upserted
    // but keep fields like api_key, knowledge_base_id and model info
    const cleanVariant = { ...variant };
    delete (cleanVariant as any).id;
    delete (cleanVariant as any).created_at;
    delete (cleanVariant as any).updated_at;
    delete (cleanVariant as any).metrics;
    
    // We explicitly include the ID if it exists, otherwise use onConflict
    const dataToUpsert = variant.id 
        ? { id: variant.id, ...cleanVariant } 
        : cleanVariant;

    const { data, error } = await supabase
        .from("ai_agent_variants")
        .upsert(dataToUpsert as any, { 
            onConflict: 'agent_id,is_variant_b',
            ignoreDuplicates: false 
        })
        .select()
        .single();

    if (error) {
        console.error("[ACTIONS] Error saving agent variant:", error);
        return { success: false, error: error.message };
    }
    return { success: true, data: data as AIAgentVariant };
}
