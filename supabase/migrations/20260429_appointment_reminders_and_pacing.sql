-- Migration: Appointment Reminders, Pacing and Advisor Specialization
-- Target: Main Supabase instance

-- 1. Update advisors table with specialties and handled lead types
ALTER TABLE advisors 
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}', -- Courses or programs
ADD COLUMN IF NOT EXISTS handled_lead_types TEXT[] DEFAULT '{}'; -- "nuevo", "ilocalizable", etc.

-- 2. Update tenant_orchestrator_config with reminder and pacing settings
-- Since it's a JSONB column, we don't need to alter the table, but we should define the structure
-- We'll add a 'scheduling' and 'pacing' section to the JSONB default

-- 3. Add reminder fields to appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMPTZ;

-- 4. Update ClientConfig structure in types (done in next step)

-- 5. Add slot size to availability_slots if missing (it already has slot_duration_minutes)
