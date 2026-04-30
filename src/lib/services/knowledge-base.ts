import { getSupabaseServerClient } from "@/lib/supabase/server";

export class KnowledgeBaseService {
    /**
     * Semantic search using PGVector match_knowledge_base RPC
     */
    static async search(tenantId: string, queryEmbedding: number[], threshold = 0.5, count = 5, knowledgeBaseIds?: string[]) {
        const supabase = await getSupabaseServerClient();

        // Using unknown cast to bypass RPC type definition issues in legacy schemas
        const { data, error } = await (supabase.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown, error: unknown }>)('match_knowledge_base', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: count,
            p_tenant_id: tenantId,
            p_knowledge_base_ids: knowledgeBaseIds && knowledgeBaseIds.length > 0 ? knowledgeBaseIds : null
        });

        if (error) {
            console.error('❌ [PGVECTOR_SEARCH] Error:', (error as unknown as { message: string }).message);
            return [];
        }

        return data as Array<{ id: string, content: string, metadata: Record<string, unknown>, similarity: number }>;
    }

    /**
     * Saves a text chunk with its embedding into PostgreSQL
     */
    static async addEmbedding(tenantId: string, content: string, embedding: number[], metadata: Record<string, unknown> = {}, knowledgeBaseId?: string) {
        const supabase = await getSupabaseServerClient();

        // Using unknown cast to bypass 'never' type in dynamic tables
        const { error } = await (supabase.from('knowledge_base_embeddings' as unknown as string) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> })
            .insert({
                tenant_id: tenantId,
                content,
                embedding,
                metadata,
                knowledge_base_id: knowledgeBaseId
            });

        if (error) {
            const msg = (error as unknown as { message: string }).message;
            console.error('❌ [PGVECTOR_ADD] Error:', msg);
            throw new Error(msg);
        }
    }

    /**
     * Saves multiple text chunks with their embeddings in a single transaction
     */
    static async addEmbeddingsBatch(tenantId: string, items: Array<{ content: string, embedding: number[], metadata: Record<string, unknown>, knowledgeBaseId?: string }>) {
        if (items.length === 0) return;
        
        const supabase = await getSupabaseServerClient();

        const { error } = await (supabase.from('knowledge_base_embeddings' as unknown as string) as unknown as { insert: (d: unknown[]) => Promise<{ error: unknown }> })
            .insert(items.map(item => ({
                tenant_id: tenantId,
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata,
                knowledge_base_id: item.knowledgeBaseId
            })));

        if (error) {
            const msg = (error as unknown as { message: string }).message;
            console.error('❌ [PGVECTOR_ADD_BATCH] Error:', msg);
            throw new Error(msg);
        }
    }
}

export class ChatSummaryService {
    /**
     * Gets the current summary for a lead
     */
    static async getSummary(leadId: string) {
        const supabase = await getSupabaseServerClient();

        // Using unknown cast to bypass 'never' type
        const { data, error } = await (supabase.from('chat_summaries' as unknown as string) as unknown as { select: (s: string) => { eq: (f: string, v: string) => { maybeSingle: () => Promise<{ data: unknown, error: unknown }> } } })
            .select('summary')
            .eq('lead_id', leadId)
            .maybeSingle();

        if (error) {
            console.error('❌ [CHAT_SUMMARY_GET] Error:', (error as unknown as { message: string }).message);
            return null;
        }

        return (data as unknown as { summary: string } | null)?.summary || null;
    }

    /**
     * Appends a message to the consolidated conversation log
     */
    static async appendMessage(tenantId: string, leadId: string, role: string, content: string) {
        const supabase = await getSupabaseServerClient();
        const currentSummary = await this.getSummary(leadId) || "";
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = `[${timestamp}] ${role}: ${content}\n`;
        const updatedSummary = currentSummary + newMessage;

        const { error } = await (supabase.from('chat_summaries' as unknown as string) as unknown as { upsert: (d: unknown, options: unknown) => Promise<{ error: unknown }> })
            .upsert({
                tenant_id: tenantId,
                lead_id: leadId,
                summary: updatedSummary,
                last_interaction_at: new Date().toISOString()
            }, { onConflict: 'lead_id' });

        if (error) {
            console.error('❌ [CHAT_SUMMARY_APPEND] Error:', (error as unknown as { message: string }).message);
        }
    }
}
