-- Migration to add retell_llm_config to support multi-prompt (states)
ALTER TABLE public.voice_agents 
ADD COLUMN IF NOT EXISTS retell_llm_config JSONB DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.voice_agents.retell_llm_config IS 'Stores the full Retell LLM configuration including states, general_prompt, and tools.';
