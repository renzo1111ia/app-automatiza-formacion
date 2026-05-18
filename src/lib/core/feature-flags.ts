import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * FEATURE FLAGS Utility
 * Allows for "Shadow Deployment" and granular feature control per tenant.
 */
export async function isFeatureEnabled(tenantId: string, flagKey: string): Promise<boolean> {
    const supabase = await getSupabaseServerClient();
    
    const { data, error } = await (supabase
        .from("feature_flags" as any) as any)
        .select("is_enabled")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`) // Check tenant or global
        .eq("flag_key", flagKey)
        .order("tenant_id", { ascending: false }) // Tenant-specific takes precedence
        .limit(1)
        .single();

    if (error || !data) return false;
    return data.is_enabled;
}

/**
 * ORCHESTRATOR TYPES
 */
export type LeadAction = "CALL" | "WHATSAPP" | "WAIT";

export interface OrchestrationStep {
    id: string;
    step_name: string;
    action_type: LeadAction;
    config: any;
    sequence_order: number;
}
