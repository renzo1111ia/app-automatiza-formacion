-- ================================================================
-- FIX: Add missing columns to appointments table
-- Run this in the Supabase SQL Editor (Production)
-- ================================================================

-- Add missing core columns
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS advisor_id UUID REFERENCES advisors(id),
    ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30,
    ADD COLUMN IF NOT EXISTS agent_used TEXT,
    ADD COLUMN IF NOT EXISTS ab_variant TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS watchdog_processed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Backfill status for existing rows that have NULL
UPDATE appointments SET status = 'PENDING' WHERE status IS NULL;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(tenant_id, status);
