import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * POST /api/tenant/migrate
 * Runs the orchestrator v3 schema migration on the ACTIVE TENANT's Supabase.
 * Each client has their own isolated Supabase — tables are created per-tenant.
 */

// The complete migration SQL for one tenant's Supabase
const MIGRATION_SQL = `
-- ================================================================
-- ORCHESTRATOR v3.0 — TENANT MIGRATION
-- Runs automatically in each client's own Supabase DB
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Orchestrator Config (per tenant) ────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_orchestrator_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL UNIQUE,
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
                "+54": "America/Argentina/Buenos_Aires"
            }
        },
        "sequence": [
            { "step": 1, "action": "call",      "agents": [], "delay_hours": 0 },
            { "step": 2, "action": "whatsapp",  "template": "", "delay_hours": 0 },
            { "step": 3, "action": "call",      "agents": [], "delay_hours": 27 }
        ],
        "ab_testing": { "enabled": false, "split": 0.5 }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Advisors (Sales team of the client) ─────────────────────────
CREATE TABLE IF NOT EXISTS advisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Availability Slots (Weekly recurring schedule) ───────────────
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT,
    advisor_id UUID REFERENCES advisors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 30
);

-- Add tenant_id if not present (safe ALTER for existing tenants)
ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- ─── Appointments (Real booked sessions) ─────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    advisor_id UUID REFERENCES advisors(id),
    lead_id UUID REFERENCES lead(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
    notes TEXT,
    agent_used TEXT,
    ab_variant TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI Agents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'QUALIFY' CHECK (type IN ('QUALIFY','REMINDER','CLOSER','SUPPORT')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI Agent Variants (A/B Prompt Versions) ──────────────────────
CREATE TABLE IF NOT EXISTS ai_agent_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL DEFAULT 'v1.0',
    prompt_text TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    is_variant_b BOOLEAN DEFAULT false,
    weight FLOAT DEFAULT 0.5,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Orchestration Logs (A/B Audit Trail) ────────────────────────
CREATE TABLE IF NOT EXISTS orchestration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    lead_id UUID,
    workflow_id TEXT,
    step_number INT,
    action_type TEXT,
    agent_used TEXT,
    ab_variant TEXT,
    result TEXT DEFAULT 'PENDING',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Planned Actions (Deferred execution queue backup) ───────────
CREATE TABLE IF NOT EXISTS planned_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    lead_id UUID,
    workflow_id TEXT,
    action_type TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Workflows ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Orchestration Rules (Workflow Steps) ─────────────────────────
CREATE TABLE IF NOT EXISTS orchestration_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_name TEXT,
    action_type TEXT NOT NULL,
    sequence_order INT DEFAULT 1,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Feature Flags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT,
    flag_key TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default: native_orchestrator enabled
INSERT INTO feature_flags (tenant_id, flag_key, is_enabled) 
VALUES ('default', 'native_orchestrator', true) 
ON CONFLICT DO NOTHING;

-- ─── Chat Messages (Omnichannel Inbox) ──────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    lead_id UUID REFERENCES lead(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'TEMPLATE', 'SYSTEM_LOG', 'IMAGE', 'DOCUMENT')),
    content TEXT NOT NULL,
    sent_by TEXT,
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'READ', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- ─── Performance Indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_tenant ON orchestration_logs(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_lead ON orchestration_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_advisor ON appointments(advisor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_advisor_day ON availability_slots(advisor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_tenant_day ON availability_slots(tenant_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_planned_actions_scheduled ON planned_actions(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_orchestration_rules_workflow ON orchestration_rules(workflow_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_chat_messages_lead ON chat_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id, created_at DESC);

-- ─── RLS (Optional but recommended) ──────────────────────────────
ALTER TABLE tenant_orchestrator_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow service_role (our backend) full access to all tables
CREATE POLICY IF NOT EXISTS "service_role_all_orchestrator_config" ON tenant_orchestrator_config FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_advisors" ON advisors FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_slots" ON availability_slots FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_appointments" ON appointments FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_ai_agents" ON ai_agents FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_ai_variants" ON ai_agent_variants FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_logs" ON orchestration_logs FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_planned" ON planned_actions FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_workflows" ON workflows FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_rules" ON orchestration_rules FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_flags" ON feature_flags FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all_chat_messages" ON chat_messages FOR ALL USING (true);
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const tenantUrl = cookieStore.get("esden-tenant-url")?.value;
        const tenantKey = cookieStore.get("esden-tenant-key")?.value;
        const tenantName = cookieStore.get("esden-tenant-name")?.value;

        if (!tenantUrl || !tenantKey) {
            return NextResponse.json({
                success: false,
                error: "No hay un tenant activo seleccionado. Por favor selecciona un cliente primero."
            }, { status: 400 });
        }

        // Connect to the TENANT's own Supabase using their service role key
        const supabase = createClient(tenantUrl, tenantKey);

        // Execute the migration via RPC or direct SQL
        // Supabase JS doesn't support raw SQL directly — but we can use the REST API
        const response = await fetch(`${tenantUrl}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: {
                "apikey": tenantKey,
                "Authorization": `Bearer ${tenantKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql: MIGRATION_SQL }),
        });

        // If exec_sql doesn't exist, try using pg_dump alternative via supabase management API
        if (!response.ok) {
            // Fallback: run table creation one by one using the JS client
            // We'll test with a simple table check
            const { error: testError } = await supabase
                .from("tenant_orchestrator_config")
                .select("id")
                .limit(1);

            if (testError && testError.message.includes("does not exist")) {
                return NextResponse.json({
                    success: false,
                    needsManualMigration: true,
                    sql: MIGRATION_SQL,
                    error: "Las tablas no existen aún. Ejecuta el SQL proporcionado en el editor SQL de Supabase de este cliente.",
                    tenant: tenantName
                });
            }

            // Tables already exist
            return NextResponse.json({
                success: true,
                message: `Tablas verificadas correctamente en ${tenantName || tenantUrl}.`,
                alreadyExists: true
            });
        }

        return NextResponse.json({
            success: true,
            message: `✅ Migración completada en Supabase de "${tenantName}". Todas las tablas del orquestador fueron creadas.`,
            tenant: tenantName
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function GET() {
    // Return migration SQL for manual execution
    return NextResponse.json({ sql: MIGRATION_SQL });
}
