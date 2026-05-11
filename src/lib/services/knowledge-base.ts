import { getSupabaseServerClient } from "@/lib/supabase/server";

export class KnowledgeBaseService {
    /**
     * Semantic search using PGVector match_knowledge_base RPC
     */
    static async search(tenantId: string, queryEmbedding: number[], threshold = 0.5, count = 5, knowledgeBaseIds?: string[]) {
        const supabase = await getSupabaseServerClient();

        // Using unknown cast to bypass RPC type definition issues in legacy schemas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpcArgs: any = {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: count,
            p_tenant_id: tenantId,
        };

        // Only add p_knowledge_base_ids if it's a non-empty array
        if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
            rpcArgs.p_knowledge_base_ids = knowledgeBaseIds;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown, error: any }>)('match_knowledge_base', rpcArgs);

            if (error) {
                // Check if it's a schema cache issue
                if (error.message?.includes("function") && error.message?.includes("match_knowledge_base")) {
                    console.warn("[KNOWLEDGE BASE] match_knowledge_base function not found in cache. This is a known Supabase issue. Proceeding with empty results.");
                    return [];
                }
                console.error('❌ [PGVECTOR_SEARCH] Error:', error.message);
                return [];
            }

            return data as Array<{ id: string, content: string, metadata: Record<string, unknown>, similarity: number }>;
        } catch (err) {
            console.error('[KNOWLEDGE BASE] Fatal error in search:', err);
            return [];
        }
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = (error as any).message;
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

        // Manual upsert logic to avoid ON CONFLICT constraint missing in DB
        const { data: existing } = await (supabase.from('chat_summaries' as unknown as string) as unknown as { select: (s: string) => { eq: (f: string, v: string) => { maybeSingle: () => Promise<{ data: unknown, error: unknown }> } } })
            .select('id')
            .eq('lead_id', leadId)
            .maybeSingle();

        if (existing) {
            const { error } = await (supabase.from('chat_summaries' as unknown as string) as unknown as { update: (d: unknown) => { eq: (f: string, v: string) => Promise<{ error: unknown }> } })
                .update({
                    summary: updatedSummary,
                    last_interaction_at: new Date().toISOString()
                })
                .eq('lead_id', leadId);
            if (error) console.error('❌ [CHAT_SUMMARY_UPDATE] Error:', (error as unknown as { message: string }).message);
        } else {
            const { error } = await (supabase.from('chat_summaries' as unknown as string) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> })
                .insert({
                    tenant_id: tenantId,
                    lead_id: leadId,
                    summary: updatedSummary,
                    last_interaction_at: new Date().toISOString()
                });
            if (error) console.error('❌ [CHAT_SUMMARY_INSERT] Error:', (error as unknown as { message: string }).message);
        }
    }
}
