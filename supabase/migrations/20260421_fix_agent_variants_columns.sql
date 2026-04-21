-- FIX AI AGENT VARIANTS SCHEMA
-- Adds missing columns for Knowledge Base and custom API Keys

ALTER TABLE ai_agent_variants 
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS knowledge_base_id TEXT,
ADD COLUMN IF NOT EXISTS model_provider TEXT DEFAULT 'OPENAI',
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gpt-4o';

-- Comments
COMMENT ON COLUMN ai_agent_variants.api_key IS 'Secret API Key for the specific model provider (overrides system default)';
COMMENT ON COLUMN ai_agent_variants.knowledge_base_id IS 'ID of the Knowledge Base assigned to this agent variant (e.g. from MindDB/RAG)';
COMMENT ON COLUMN ai_agent_variants.model_provider IS 'LLM Provider: OPENAI, ANTHROPIC, GEMINI';
COMMENT ON COLUMN ai_agent_variants.model_name IS 'Specific model ID, e.g. gpt-4o, claude-3-5-sonnet-20240620';

-- Reload schema cache (not strictly necessary via SQL but good for context)
NOTIFY pgrst, 'reload schema';
