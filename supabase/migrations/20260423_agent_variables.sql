-- ============================================================
-- ESDEN Analytics Dashboard — AI AGENT VARIABLES
-- Version: 1.0.0
-- ============================================================

-- 1. Add dynamic_variables to variants
ALTER TABLE public.ai_agent_variants 
ADD COLUMN IF NOT EXISTS dynamic_variables JSONB DEFAULT '[]'::jsonb;

-- 2. Add model_name and api_key to variants if they don't exist (found in processor but not in migration)
ALTER TABLE public.ai_agent_variants 
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gpt-4o',
ADD COLUMN IF NOT EXISTS api_key TEXT;

-- 3. Update existing variants metadata if needed
COMMENT ON COLUMN public.ai_agent_variants.dynamic_variables IS 'List of dynamic variables keys available for the prompt, e.g. ["nombre_sede", "precio_especial"].';

-- 4. Enable RLS for the new columns is implicit as the table already has it.
