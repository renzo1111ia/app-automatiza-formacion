ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false; ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true; NOTIFY pgrst, 'reload schema';
