-- =============================================================================
-- SPRINT 5.7 — Output WhatsApp (Meta WABA Integration)
-- Migration: 20260615_002_sprint_5_7_waba_integration.sql
-- Created: 2026-06-15
-- =============================================================================
-- Tables created:
--   1. waba_configurations    → WABA credentials per tenant
--   2. whatsapp_templates     → Templates synced from Meta Cloud API
--   3. whatsapp_message_logs  → Delivery log per sent message
--   4. whatsapp_message_outbox→ Outbound queue (for rate-limited sending)
--   5. whatsapp_opt_out       → Opt-out blacklist (GDPR / LOPD)
-- All tables have RLS with strict tenant isolation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. waba_configurations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waba_configurations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  waba_id         TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  display_name    TEXT,
  -- Access token stored encrypted — application layer must handle KMS rotation
  access_token    TEXT NOT NULL,
  webhook_verify_token TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only one active WABA config per tenant
  CONSTRAINT uq_waba_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_waba_configurations_tenant ON waba_configurations(tenant_id);

-- ---------------------------------------------------------------------------
-- 2. whatsapp_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_id         TEXT NOT NULL,           -- Template ID from Meta
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,           -- e.g. MARKETING, UTILITY, AUTHENTICATION
  language        TEXT NOT NULL DEFAULT 'es', -- BCP-47 language code
  status          TEXT NOT NULL DEFAULT 'PENDING', -- APPROVED, PENDING, REJECTED, PAUSED
  -- Full components JSON as returned by Meta API
  components      JSONB NOT NULL DEFAULT '[]',
  -- Human-readable variable mapping: { "1": "nombre", "2": "fecha_cita" }
  variable_mapping JSONB NOT NULL DEFAULT '{}',
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_meta_tenant UNIQUE (tenant_id, meta_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status  ON whatsapp_templates(tenant_id, status);

-- ---------------------------------------------------------------------------
-- 3. whatsapp_message_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES lead(id) ON DELETE SET NULL,
  template_id     UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  phone_to        TEXT NOT NULL,
  -- message_sid: ID returned by Meta on send
  message_sid     TEXT,
  -- Status lifecycle: queued → sent → delivered → read | failed
  status          TEXT NOT NULL DEFAULT 'queued',
  error_message   TEXT,
  error_code      TEXT,
  -- Full payload sent (for debugging / audit)
  payload         JSONB,
  -- Timestamps for delivery tracking
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_tenant    ON whatsapp_message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_lead      ON whatsapp_message_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status    ON whatsapp_message_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_logs_message_sid ON whatsapp_message_logs(message_sid) WHERE message_sid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. whatsapp_message_outbox
-- ---------------------------------------------------------------------------
-- Outbound queue for rate-limited sending (avoids Meta 429 errors).
-- The outbox processor (cron or inline) picks up 'pending' rows and moves
-- them to 'processing' → 'done' | 'failed'.
CREATE TABLE IF NOT EXISTS whatsapp_message_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES lead(id) ON DELETE SET NULL,
  template_id     UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  phone_to        TEXT NOT NULL,
  -- Resolved components after variable mapping
  components      JSONB NOT NULL DEFAULT '[]',
  template_name   TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'es',
  -- Queue status
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,
  last_error      TEXT,
  -- Optional scheduled time for future sends
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_tenant   ON whatsapp_message_outbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_status   ON whatsapp_message_outbox(status, scheduled_at)
  WHERE status IN ('pending', 'processing');

-- ---------------------------------------------------------------------------
-- 5. whatsapp_opt_out
-- ---------------------------------------------------------------------------
-- GDPR/LOPD compliant opt-out blacklist.
-- Numbers stored normalized (E.164 without +).
CREATE TABLE IF NOT EXISTS whatsapp_opt_out (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone           TEXT NOT NULL,
  reason          TEXT,                   -- e.g. 'user_request', 'webhook_stop'
  opted_out_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Allow re-opt-in: soft delete pattern
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_opt_out_phone_tenant UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_opt_out_phone ON whatsapp_opt_out(tenant_id, phone) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  -- waba_configurations
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_waba_configurations_updated_at') THEN
    CREATE TRIGGER trg_waba_configurations_updated_at
      BEFORE UPDATE ON waba_configurations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- whatsapp_templates
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_templates_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_templates_updated_at
      BEFORE UPDATE ON whatsapp_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- whatsapp_message_logs
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wa_message_logs_updated_at') THEN
    CREATE TRIGGER trg_wa_message_logs_updated_at
      BEFORE UPDATE ON whatsapp_message_logs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- whatsapp_message_outbox
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wa_outbox_updated_at') THEN
    CREATE TRIGGER trg_wa_outbox_updated_at
      BEFORE UPDATE ON whatsapp_message_outbox
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) — tenant isolation
-- ---------------------------------------------------------------------------

ALTER TABLE waba_configurations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_opt_out        ENABLE ROW LEVEL SECURITY;

-- Helper: extract tenant_id from JWT claims (same pattern as other tables in this project)
-- Assumes JWT has a custom claim: { "tenant_id": "<uuid>" }

-- waba_configurations
CREATE POLICY "waba_configurations_tenant_isolation"
  ON waba_configurations
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- whatsapp_templates
CREATE POLICY "whatsapp_templates_tenant_isolation"
  ON whatsapp_templates
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- whatsapp_message_logs
CREATE POLICY "whatsapp_message_logs_tenant_isolation"
  ON whatsapp_message_logs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- whatsapp_message_outbox
CREATE POLICY "whatsapp_message_outbox_tenant_isolation"
  ON whatsapp_message_outbox
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- whatsapp_opt_out
CREATE POLICY "whatsapp_opt_out_tenant_isolation"
  ON whatsapp_opt_out
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Service role bypass (needed for server-side operations with service_role key)
CREATE POLICY "waba_configurations_service_role"
  ON waba_configurations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "whatsapp_templates_service_role"
  ON whatsapp_templates FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "whatsapp_message_logs_service_role"
  ON whatsapp_message_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "whatsapp_message_outbox_service_role"
  ON whatsapp_message_outbox FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "whatsapp_opt_out_service_role"
  ON whatsapp_opt_out FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE waba_configurations IS
  'Sprint 5.7: WABA credentials per tenant. One active config per tenant.';

COMMENT ON TABLE whatsapp_templates IS
  'Sprint 5.7: WhatsApp templates synced from Meta Cloud API. variable_mapping maps parameter index to lead field name.';

COMMENT ON TABLE whatsapp_message_logs IS
  'Sprint 5.7: Delivery audit log for every WhatsApp message sent. Updated via Meta delivery webhooks.';

COMMENT ON TABLE whatsapp_message_outbox IS
  'Sprint 5.7: Outbound queue. Processor dequeues rows respecting Meta rate limits (429 handling).';

COMMENT ON TABLE whatsapp_opt_out IS
  'Sprint 5.7: GDPR/LOPD opt-out blacklist. Checked before every outbound send.';
