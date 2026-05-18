-- ============================================================
-- ESDEN Analytics Dashboard — TRACKED VARIABLES (Autonomous Memory)
-- ============================================================

-- 1. Add tracked_variables to variants
-- This stores the list of keys the AI should look for in conversations.
ALTER TABLE public.ai_agent_variants 
ADD COLUMN IF NOT EXISTS tracked_variables JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ai_agent_variants.tracked_variables IS 'List of keys to autonomously extract from conversations, e.g. ["nombre", "presupuesto", "ciudad"].';
