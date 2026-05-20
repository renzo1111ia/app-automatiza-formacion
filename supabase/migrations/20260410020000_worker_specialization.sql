-- 1. Create Advisor-Program relation for specialization
CREATE TABLE IF NOT EXISTS advisor_programas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advisor_id UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(advisor_id, programa_id)
);

-- Index for scheduler performance
CREATE INDEX IF NOT EXISTS idx_advisor_programas_programa ON advisor_programas(programa_id);

-- 2. Expand Lead Qualification for deep analysis
ALTER TABLE lead_cualificacion
ADD COLUMN IF NOT EXISTS calificacion_score INTEGER, -- 1-10
ADD COLUMN IF NOT EXISTS objeciones TEXT,
ADD COLUMN IF NOT EXISTS analisis_profundo JSONB;

COMMENT ON COLUMN lead_cualificacion.analisis_profundo IS 'Análisis detallado generado por el Worker IA (interés, presupuesto, perfil)';

-- 3. Add status to appointments to support watchdog
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS watchdog_processed BOOLEAN DEFAULT FALSE;
