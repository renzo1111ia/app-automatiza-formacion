// Sprint 1 — Bloque 2.3 (tarea 2-16) Repository AI agents + variants + voice agents.

import type {
  AiAgent,
  CreateAiAgent,
  UpdateAiAgent,
  AiAgentVariant,
  CreateAiAgentVariant,
  UpdateAiAgentVariant,
  VoiceAgent,
} from "@/lib/schemas/ai-agents";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";

export class AiAgentsRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<AiAgent>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as AiAgent[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<AiAgent>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as AiAgent) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateAiAgent): Promise<RepoResult<AiAgent>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await supabase
        .from("ai_agents")
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as AiAgent, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(id: string, tenantId: string, data: UpdateAiAgent): Promise<RepoResult<AiAgent>> {
    try {
      const supabase = await getAdminSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated, error } = await supabase
        .from("ai_agents")
        .update(data)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as AiAgent, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async delete(id: string, tenantId: string): Promise<RepoResult<{ id: string }>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { error } = await supabase
        .from("ai_agents")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: { id }, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class AiAgentVariantsRepository {
  async findByAgent(agentId: string): Promise<RepoListResult<AiAgentVariant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("ai_agent_variants")
        .select("*")
        .eq("agent_id", agentId)
        .order("version_label", { ascending: true });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as AiAgentVariant[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findActiveVariant(agentId: string): Promise<RepoResult<AiAgentVariant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("ai_agent_variants")
        .select("*")
        .eq("agent_id", agentId)
        .eq("is_active", true)
        .eq("is_variant_b", false)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as AiAgentVariant) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async upsert(
    data: CreateAiAgentVariant | (UpdateAiAgentVariant & { id?: string })
  ): Promise<RepoResult<AiAgentVariant>> {
    try {
      const supabase = await getAdminSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await supabase
        .from("ai_agent_variants")
        .upsert(data, { onConflict: "agent_id,is_variant_b", ignoreDuplicates: false })
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: result as AiAgentVariant, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class VoiceAgentsRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<VoiceAgent>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("voice_agents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as VoiceAgent[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }
}

export const aiAgentsRepository = new AiAgentsRepository();
export const aiAgentVariantsRepository = new AiAgentVariantsRepository();
export const voiceAgentsRepository = new VoiceAgentsRepository();
