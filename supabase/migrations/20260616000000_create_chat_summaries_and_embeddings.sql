-- Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chat_summaries table
CREATE TABLE IF NOT EXISTS public.chat_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.lead(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_lead_summary UNIQUE (lead_id)
);

-- Create knowledge_base_embeddings table
CREATE TABLE IF NOT EXISTS public.knowledge_base_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    knowledge_base_id UUID REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT ALL ON TABLE public.chat_summaries TO postgres;
GRANT ALL ON TABLE public.chat_summaries TO service_role;
GRANT ALL ON TABLE public.chat_summaries TO authenticated;
GRANT ALL ON TABLE public.chat_summaries TO anon;

GRANT ALL ON TABLE public.knowledge_base_embeddings TO postgres;
GRANT ALL ON TABLE public.knowledge_base_embeddings TO service_role;
GRANT ALL ON TABLE public.knowledge_base_embeddings TO authenticated;
GRANT ALL ON TABLE public.knowledge_base_embeddings TO anon;

-- RLS
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_embeddings ENABLE ROW LEVEL SECURITY;

-- Service role policies (idempotent)
DROP POLICY IF EXISTS "service_role_all_chat_summaries" ON public.chat_summaries;
CREATE POLICY "service_role_all_chat_summaries" ON public.chat_summaries FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_knowledge_base_embeddings" ON public.knowledge_base_embeddings;
CREATE POLICY "service_role_all_knowledge_base_embeddings" ON public.knowledge_base_embeddings FOR ALL USING (true);

-- Authenticated select policies (tenant-isolated) (idempotent)
DROP POLICY IF EXISTS "authenticated_read_chat_summaries" ON public.chat_summaries;
CREATE POLICY "authenticated_read_chat_summaries" ON public.chat_summaries
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_knowledge_base_embeddings" ON public.knowledge_base_embeddings;
CREATE POLICY "authenticated_read_knowledge_base_embeddings" ON public.knowledge_base_embeddings
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));

-- Create RPC match_knowledge_base function for semantic search
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding vector,
  match_threshold float,
  match_count int,
  p_tenant_id UUID,
  p_knowledge_base_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbe.id,
    kbe.content,
    kbe.metadata,
    1 - (kbe.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base_embeddings kbe
  WHERE kbe.tenant_id = p_tenant_id
    AND (p_knowledge_base_ids IS NULL OR kbe.knowledge_base_id = ANY(p_knowledge_base_ids))
    AND 1 - (kbe.embedding <=> query_embedding) > match_threshold
  ORDER BY kbe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute on RPC
GRANT EXECUTE ON FUNCTION public.match_knowledge_base TO postgres;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base TO service_role;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base TO anon;

NOTIFY pgrst, 'reload schema';
