-- Migration: 20260417_system_logs_table
-- Description: Creates a table to persist system events, API logs, and errors.

CREATE TABLE IF NOT EXISTS public.system_logs (
    id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source      text        NOT NULL, -- 'ORCHESTRATOR', 'API', 'RESCUE', 'WHATSAPP'
    level       text        NOT NULL, -- 'INFO', 'WARN', 'ERROR'
    message     text        NOT NULL,
    metadata    jsonb       DEFAULT '{}'::jsonb,
    error_code  text,
    created_at  timestamp with time zone DEFAULT now(),
    CONSTRAINT system_logs_pkey PRIMARY KEY (id)
);

-- Index for fast retrieval by tenant and time
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_date ON public.system_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level       ON public.system_logs(level);

-- RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_system_logs" 
    ON public.system_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
