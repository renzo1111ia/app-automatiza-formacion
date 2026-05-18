-- ============================================================
-- ESDEN ANALYTICS DASHBOARD
-- Version: 1.1.0
-- ============================================================

-- Enable UUID extension (already active in Supabase, safe to run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- NOTE: The legacy data structure has been removed.
-- Data is now managed via the 9-table normalized schema:
-- lead, llamadas, agendamientos, lead_cualificacion, lead_programas, etc.
