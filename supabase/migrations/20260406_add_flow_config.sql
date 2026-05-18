-- Add flow_config to ai_agents table for the visual flow builder
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.ai_agents.flow_config IS 'Stores the visual chatbot flow configuration for the agent.';
