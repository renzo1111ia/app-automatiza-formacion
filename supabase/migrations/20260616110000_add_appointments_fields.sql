-- Migration to add missing fields to the appointments table

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS agent_used TEXT,
ADD COLUMN IF NOT EXISTS ab_variant TEXT,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS watchdog_processed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure schema cache is refreshed
NOTIFY pgrst, 'reload schema';
