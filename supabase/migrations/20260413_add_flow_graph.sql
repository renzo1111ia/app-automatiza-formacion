-- ADD FLOW_GRAPH TO ORCHESTRATOR CONFIG
-- This stores the visual graph structure (nodes/edges) from React Flow

ALTER TABLE public.tenant_orchestrator_config
ADD COLUMN IF NOT EXISTS flow_graph JSONB DEFAULT '{}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.tenant_orchestrator_config.flow_graph IS 'Stores the React Flow graph structure (nodes and edges) for the neural logic editor.';
