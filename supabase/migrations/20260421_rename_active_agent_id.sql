-- Migration: Rename active_agent_id to ai_agent_id in lead table
-- This ensures consistency between the inbox and the orchestrator

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead' AND column_name = 'active_agent_id') THEN
        ALTER TABLE "public"."lead" RENAME COLUMN "active_agent_id" TO "ai_agent_id";
    END IF;

    -- Also check if ai_agent_id exists if active_agent_id didn't (maybe it was never created)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead' AND column_name = 'ai_agent_id') THEN
        ALTER TABLE "public"."lead" ADD COLUMN "ai_agent_id" UUID REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL;
    END IF;
END $$;
