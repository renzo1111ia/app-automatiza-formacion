-- AI AGENTS MANAGEMENT
-- Supports Multi-Agent Orchestration with A/B Prompt Testing

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'QUALIFY', -- QUALIFY, REMINDER, CLOSER, etc.
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_agent_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL, -- e.g., 'v1.0', 'v2.1'
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_variant_b BOOLEAN DEFAULT false, -- If true, it's the 'B' version in A/B test
    weight FLOAT DEFAULT 0.5, -- 0.0 to 1.0 distribution weight
    metrics JSONB DEFAULT '{}', -- Store success rates, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_variants ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenants can only see their own agents" 
ON ai_agents FOR ALL 
USING (tenant_id = (SELECT id FROM tenants WHERE id = ai_agents.tenant_id));

CREATE POLICY "Tenants can only see their own agent variants"
ON ai_agent_variants FOR ALL
USING (agent_id IN (SELECT id FROM ai_agents));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ai_agent_variants_updated_at BEFORE UPDATE ON ai_agent_variants FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Seed data for initial testing (if needed, but usually handled by UI)
