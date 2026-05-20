-- Migration: Add optional filters to advisors
-- Created at: 2026-05-04

ALTER TABLE IF EXISTS public.advisors 
ADD COLUMN IF NOT EXISTS origins text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS campaigns text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS countries text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS courses text[] DEFAULT '{}';

-- Optional: Add comments for clarity
COMMENT ON COLUMN public.advisors.origins IS 'List of lead origins this advisor can handle';
COMMENT ON COLUMN public.advisors.campaigns IS 'List of specific campaigns this advisor is assigned to';
COMMENT ON COLUMN public.advisors.countries IS 'List of lead countries this advisor handles';
COMMENT ON COLUMN public.advisors.courses IS 'List of specific courses/programs the advisor specializes in';
