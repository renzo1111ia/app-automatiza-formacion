-- Add unique constraint to ai_agent_variants to support upsert by agent and variant type
ALTER TABLE ai_agent_variants 
ADD CONSTRAINT unique_agent_variant UNIQUE (agent_id, is_variant_b);
