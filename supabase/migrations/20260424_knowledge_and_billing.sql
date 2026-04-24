-- Migration for Spend Limits and Knowledge Base
-- Target: Main Supabase instance

-- 1. Update tenants table with spend limits
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS daily_spend_limit NUMERIC DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS current_daily_spend NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_spend_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    file_key TEXT NOT NULL, -- MinIO/S3 Key
    file_url TEXT,
    content_hash TEXT, -- For versioning/invalidation
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS for Knowledge Base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can only access their own knowledge base" 
ON knowledge_base 
FOR ALL 
USING (tenant_id::text = current_setting('app.current_tenant', true));

-- 4. Function to reset daily spend (should be called by a cron job)
CREATE OR REPLACE FUNCTION reset_daily_spend() 
RETURNS void AS $$
BEGIN
    UPDATE tenants 
    SET current_daily_spend = 0.00, 
        last_spend_reset_at = NOW() 
    WHERE last_spend_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
