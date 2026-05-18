-- ================================================================
-- ESDEN ORCHESTRATOR v3.0 — MIGRATION MASTER
-- Run this in your Supabase SQL Editor (complete schema)
-- ================================================================

-- ─── FASE 1: Tenant Orchestrator Config ──────────────────────────

CREATE TABLE IF NOT EXISTS tenant_orchestrator_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    config JSONB NOT NULL DEFAULT '{
        "timezone_rules": {
            "start": "09:00",
            "end": "20:00",
            "working_days": [1,2,3,4,5],
            "phone_prefix_map": {
                "+34": "Europe/Madrid",
                "+56": "America/Santiago",
                "+52": "America/Mexico_City",
                "+57": "America/Bogota",
                "+51": "America/Lima",
                "+54": "America/Argentina/Buenos_Aires",
                "+598": "America/Montevideo",
                "+595": "America/Asuncion",
                "+591": "America/La_Paz"
            }
        },
        "sequence": [
            { "step": 1, "action": "call",      "agents": [], "delay_hours": 0 },
            { "step": 2, "action": "whatsapp",  "template": "", "delay_hours": 0 },
            { "step": 3, "action": "call",      "agents": [], "delay_hours": 27 }
        ],
        "ab_testing": {
            "enabled": false,
            "split": 0.5
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_orchestrator_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_config_access" ON tenant_orchestrator_config 
    FOR ALL USING (true);

-- ─── FASE 4: Calendario Nativo ────────────────────────────────────

-- Asesores / Vendedores del cliente
CREATE TABLE IF NOT EXISTS advisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disponibilidad semanal recurrente (no instancias, horarios)
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advisor_id UUID REFERENCES advisors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom,1=Lun...6=Sab
    start_time TIME NOT NULL,    -- ej: '09:00'
    end_time TIME NOT NULL,      -- ej: '20:00'
    slot_duration_minutes INT DEFAULT 30
);

-- Citas asignadas (instancias reales)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES advisors(id),
    lead_id UUID REFERENCES lead(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
    notes TEXT,
    agent_used TEXT,       -- Retell Agent ID que cualificó al lead
    ab_variant TEXT,       -- 'A' o 'B'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advisors_access" ON advisors FOR ALL USING (true);
CREATE POLICY "slots_access" ON availability_slots FOR ALL USING (true);
CREATE POLICY "appointments_access" ON appointments FOR ALL USING (true);

-- ─── FASE 5: A/B Orchestration Logs ──────────────────────────────

CREATE TABLE IF NOT EXISTS orchestration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES lead(id) ON DELETE SET NULL,
    workflow_id UUID,
    step_number INT,
    action_type TEXT,               -- 'CALL', 'WHATSAPP', 'AI_AGENT', etc.
    agent_used TEXT,                -- ID del agente Retell/LLM
    ab_variant TEXT,                -- 'A', 'B', o NULL si no hay A/B
    result TEXT DEFAULT 'PENDING',  -- 'SUCCESS', 'FAILED', 'SKIPPED', 'QUEUED'
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orchestration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_access" ON orchestration_logs FOR ALL USING (true);

-- ─── Índices para performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_tenant ON orchestration_logs(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_lead ON orchestration_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_advisor ON appointments(advisor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_advisor_day ON availability_slots(advisor_id, day_of_week);

-- ─── Seed: ESDEN Pilot Config ────────────────────────────────────
-- Insertar config base para el tenant de ESDEN (si existe)
-- (Ajusta el tenant_id al real de ESDEN en tu Supabase)
-- INSERT INTO tenant_orchestrator_config (tenant_id, config) 
-- VALUES ('YOUR-ESDEN-TENANT-UUID', '{}') ON CONFLICT DO NOTHING;
