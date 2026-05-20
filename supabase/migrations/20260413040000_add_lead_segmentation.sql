-- ADD SEGMENTATION TO LEAD
-- This allows categorizing leads within the inbox

ALTER TABLE lead 
ADD COLUMN IF NOT EXISTS segmentacion TEXT;

-- Index for filtering by segment
CREATE INDEX IF NOT EXISTS idx_lead_segmentacion ON lead(segmentacion);
