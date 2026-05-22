// Sprint 1 — Bloque 2.3 (tarea 2-17) Repository KB + chat memory.

import type {
  KnowledgeItem,
  CreateKnowledgeItem,
  KnowledgeEmbedding,
  CreateKnowledgeEmbedding,
  ChatMessage,
  CreateChatMessage,
} from "@/lib/schemas/knowledge-base";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";

export class KnowledgeBaseRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<KnowledgeItem>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as KnowledgeItem[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<KnowledgeItem>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as KnowledgeItem) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateKnowledgeItem): Promise<RepoResult<KnowledgeItem>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("knowledge_base") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as KnowledgeItem, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async delete(id: string, tenantId: string): Promise<RepoResult<{ id: string }>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { error } = await supabase
        .from("knowledge_base")
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

export class KnowledgeEmbeddingsRepository {
  async create(
    tenantId: string,
    data: CreateKnowledgeEmbedding
  ): Promise<RepoResult<KnowledgeEmbedding>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("knowledge_base_embeddings") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as KnowledgeEmbedding, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class ChatMessagesRepository {
  async findByLead(leadId: string, tenantId: string): Promise<RepoListResult<ChatMessage>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as ChatMessage[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateChatMessage): Promise<RepoResult<ChatMessage>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("chat_messages") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as ChatMessage, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async clearByLead(leadId: string, tenantId: string): Promise<RepoResult<{ leadId: string }>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId);
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: { leadId }, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export const knowledgeBaseRepository = new KnowledgeBaseRepository();
export const knowledgeEmbeddingsRepository = new KnowledgeEmbeddingsRepository();
export const chatMessagesRepository = new ChatMessagesRepository();
