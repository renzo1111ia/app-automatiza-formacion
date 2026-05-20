-- SQL: Add trigger_node_id to orchestration_rules
-- This allows the system to identify which trigger node initiated a sequence.

ALTER TABLE public.orchestration_rules 
ADD COLUMN IF NOT EXISTS trigger_node_id UUID;

-- Index for performance when routing webhooks
CREATE INDEX IF NOT EXISTS idx_rules_trigger_node ON public.orchestration_rules(trigger_node_id);

COMMENT ON COLUMN public.orchestration_rules.trigger_node_id IS 'ID of the node in the visual graph that triggers this sequence step.';
