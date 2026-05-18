-- Expand Programas table for Scaling and Dynamic Context
ALTER TABLE programas 
ADD COLUMN IF NOT EXISTS presentacion TEXT,
ADD COLUMN IF NOT EXISTS objetivos TEXT,
ADD COLUMN IF NOT EXISTS precio TEXT,
ADD COLUMN IF NOT EXISTS becas_financiacion TEXT,
ADD COLUMN IF NOT EXISTS metodologia TEXT,
ADD COLUMN IF NOT EXISTS beneficios TEXT,
ADD COLUMN IF NOT EXISTS practicas TEXT,
ADD COLUMN IF NOT EXISTS fechas_inicio TEXT,
ADD COLUMN IF NOT EXISTS requisitos_cualificacion TEXT;

-- Index for lead deduplication performance
CREATE INDEX IF NOT EXISTS idx_lead_tenant_phone ON lead (tenant_id, telefono);
CREATE INDEX IF NOT EXISTS idx_lead_tenant_email ON lead (tenant_id, email);

COMMENT ON COLUMN programas.presentacion IS 'Presentación o intro del curso para el agente';
COMMENT ON COLUMN programas.requisitos_cualificacion IS 'Requisitos mínimos para calificar a este curso específico';
