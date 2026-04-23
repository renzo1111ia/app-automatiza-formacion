-- ============================================================
-- ESDEN Analytics Dashboard — KNOWLEDGE BASE & CHAT MEMORY
-- Version: 1.0.0
-- ============================================================

-- 1. Enable PGVector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Base Embeddings Table
-- Consolidates Qdrant functionality into PostgreSQL
CREATE TABLE IF NOT EXISTS public.knowledge_base_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_id TEXT, -- Original filename or ID in MinIO
    content TEXT NOT NULL, -- Text chunk
    embedding vector(1536), -- Default for openai text-embedding-3-small
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for semantic search (Cosine distance)
CREATE INDEX IF NOT EXISTS idx_kb_embeddings_vector ON public.knowledge_base_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_kb_embeddings_tenant_id ON public.knowledge_base_embeddings(tenant_id);

-- 3. Chat Summaries Table
-- Long-term memory storage
CREATE TABLE IF NOT EXISTS public.chat_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_lead_id ON public.chat_summaries(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_tenant_id ON public.chat_summaries(tenant_id);

-- 4. RLS Policies
ALTER TABLE public.knowledge_base_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.knowledge_base_embeddings;
CREATE POLICY "Tenant Isolation" ON public.knowledge_base_embeddings 
FOR ALL TO authenticated 
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid) 
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Tenant Isolation" ON public.chat_summaries;
CREATE POLICY "Tenant Isolation" ON public.chat_summaries 
FOR ALL TO authenticated 
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid) 
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 5. Semantic Search Function
CREATE OR REPLACE FUNCTION match_knowledge_base (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base_embeddings kb
  WHERE kb.tenant_id = p_tenant_id
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
