-- ============================================================
-- ESDEN Analytics — ADD METADATA TO LEAD
-- Fixes missing column that prevents AI facts from being saved.
-- ============================================================

ALTER TABLE public.lead 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN public.lead.metadata IS 'Stores structured data captured by AI agents (e.g., goals, country, phone, motivations).';
