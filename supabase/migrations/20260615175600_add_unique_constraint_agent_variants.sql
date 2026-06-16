-- Add unique constraint to ai_agent_variants to support upsert by agent and variant type (is_variant_b)
-- Idempotent: drop first if exists, then recreate
ALTER TABLE "public"."ai_agent_variants"
DROP CONSTRAINT IF EXISTS unique_agent_variant;

ALTER TABLE "public"."ai_agent_variants"
ADD CONSTRAINT unique_agent_variant UNIQUE (agent_id, is_variant_b);
