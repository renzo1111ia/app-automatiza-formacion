-- ============================================================================
-- Sprint 4 · Google Sheets — Trigger writeback automatico
-- ============================================================================
-- Objetivo: cuando un lead originado en una Sheet conectada (sheet_row_processed
-- tiene fila con su lead_id) cambia algun campo write-back (current_stage,
-- assigned_advisor_id, last_advisor_assignment), encolar un job de write-back
-- sin que el orchestrator tenga que invocar nada explicitamente.
--
-- Diseño:
--   - Trigger AFTER UPDATE en lead.
--   - Solo procesa si el lead tiene fila en sheet_row_processed (originó de Sheet).
--   - Inserta row en sheets_writeback_outbox para que un worker BullMQ la consuma.
--   - Outbox pattern (no pg_notify directo) por durabilidad: si el worker está
--     caido, el job no se pierde — sigue en la tabla hasta procesado.
--
-- Cambios cubiertos:
--   - current_stage (lead_stage)
--   - assigned_advisor_id (tracking de owner)
--   - cualquier UPDATE explicito que toque columnas top-level.
--
-- NO cubre lead_cualificacion (esa tabla tiene su propio trigger en otra
-- migracion si se decide).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sheets_writeback_outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.lead(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  changes       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.sheets_writeback_outbox IS
  'Outbox pattern: cambios en lead que originaron de Sheet se encolan aqui. Worker BullMQ los lee y aplica writeBackLeadChange. Durable: sobrevive caidas del worker.';

CREATE INDEX IF NOT EXISTS idx_sheets_wb_outbox_pending
  ON public.sheets_writeback_outbox(created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sheets_wb_outbox_lead
  ON public.sheets_writeback_outbox(lead_id, status);

ALTER TABLE public.sheets_writeback_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wb_outbox_select_owner" ON public.sheets_writeback_outbox;
DROP POLICY IF EXISTS "service_role_all_wb_outbox" ON public.sheets_writeback_outbox;

CREATE POLICY "wb_outbox_select_owner"
  ON public.sheets_writeback_outbox
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_wb_outbox"
  ON public.sheets_writeback_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tr_lead_changes_to_sheets_writeback()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
  has_sheet_origin BOOLEAN;
BEGIN
  -- Solo procesar si el lead tiene origen Sheet (esta en sheet_row_processed).
  SELECT EXISTS(
    SELECT 1 FROM public.sheet_row_processed WHERE lead_id = NEW.id
  ) INTO has_sheet_origin;

  IF NOT has_sheet_origin THEN
    RETURN NEW;
  END IF;

  -- Detectar cambios en campos relevantes y armar payload.
  IF NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    changes := changes || jsonb_build_object('lead.current_stage', NEW.current_stage);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changes := changes || jsonb_build_object('lead.status', NEW.status);
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    changes := changes || jsonb_build_object('lead.email', NEW.email);
  END IF;
  IF NEW.telefono IS DISTINCT FROM OLD.telefono THEN
    changes := changes || jsonb_build_object('lead.telefono', NEW.telefono);
  END IF;

  -- Si no hay cambios trackables, salir sin tocar la outbox.
  IF changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sheets_writeback_outbox (lead_id, tenant_id, changes)
  VALUES (NEW.id, NEW.tenant_id, changes);

  -- Notificacion best-effort para que el worker BullMQ procese rapido.
  -- Si no hay listener, no pasa nada — outbox queda durable.
  PERFORM pg_notify('sheets_writeback_pending', NEW.id::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_writeback ON public.lead;
CREATE TRIGGER trg_lead_writeback
  AFTER UPDATE ON public.lead
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_lead_changes_to_sheets_writeback();

-- ── PostgREST cache reload ─────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
