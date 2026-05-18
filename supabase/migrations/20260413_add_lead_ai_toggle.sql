-- ADD AI TOGGLE TO LEADS
-- This allows enabling/disabling the AI agent for a specific conversation

ALTER TABLE lead 
ADD COLUMN IF NOT EXISTS is_ai_enabled BOOLEAN DEFAULT true;

-- Index for performance in filtering agents
CREATE INDEX IF NOT EXISTS idx_lead_ai_enabled ON lead(is_ai_enabled);
