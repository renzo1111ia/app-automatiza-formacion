-- Migration: 20260417_dynamic_inactivity_fields
-- Description: Adds tracking for active agent and inactivity retries on leads.

ALTER TABLE lead 
ADD COLUMN IF NOT EXISTS active_agent_id UUID REFERENCES ai_agents(id),
ADD COLUMN IF NOT EXISTS inactivity_sent_count INT DEFAULT 0;

COMMENT ON COLUMN lead.active_agent_id IS 'ID of the AI agent currently engaging with the lead';
COMMENT ON COLUMN lead.inactivity_sent_count IS 'How many inactivity messages have been sent for the current active agent';
