-- ADD MODEL SELECTION TO AI AGENT VARIANTS
-- Allows A/B testing different LLM models

ALTER TABLE ai_agent_variants 
ADD COLUMN IF NOT EXISTS model_provider TEXT DEFAULT 'OPENAI',
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gpt-4o',
ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Comment explaining the column usage
COMMENT ON COLUMN ai_agent_variants.model_provider IS 'LLM Provider: OPENAI, ANTHROPIC, GEMINI';
COMMENT ON COLUMN ai_agent_variants.model_name IS 'Specific model ID, e.g., gpt-4o, claude-3-5-sonnet-20240620';
COMMENT ON COLUMN ai_agent_variants.api_key IS 'Secret API Key for the specific model provider';
