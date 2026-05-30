import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FeatureFlag } from "@/types/database";

/**
 * FEATURE FLAGS Utility
 * Allows for "Shadow Deployment" and granular feature control per tenant.
 */
export async function isFeatureEnabled(tenantId: string, flagKey: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();

  // Supabase TS inference narrows to never with .or() + .single(); explicit cast required.
  const { data, error } = (await supabase
    .from("feature_flags")
    .select("is_enabled")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`) // Check tenant or global
    .eq("flag_key", flagKey)
    .order("tenant_id", { ascending: false }) // Tenant-specific takes precedence
    .limit(1)
    .single()) as { data: Pick<FeatureFlag, "is_enabled"> | null; error: unknown };

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
  config: Record<string, unknown>;
  sequence_order: number;
}
