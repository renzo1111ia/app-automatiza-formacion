-- ============================================================================
-- Rename `segmentation` → `segmentacion` in public.lead
-- ============================================================================
-- The frontend and all business logic throughout the codebase (inbox.ts,
-- AIAgentInbox.tsx, QualificationProcessor.ts, interpreter.ts, etc.)
-- consistently use the Spanish word "segmentacion".
-- The original schema migration created the column as "segmentation" (English).
-- This migration renames it to align with the rest of the codebase and
-- avoid silent write failures when updating via update({ segmentacion: ... }).
-- ============================================================================

ALTER TABLE public.lead
  RENAME COLUMN segmentation TO segmentacion;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
