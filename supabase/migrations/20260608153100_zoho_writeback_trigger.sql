-- ============================================================================
-- Sprint 5 · Zoho CRM — Trigger writeback automático + guard anti-bucle
-- ============================================================================
-- Objetivo: cuando un lead originado en Zoho (tiene fila en zoho_lead_synced)
-- cambia un campo writeback (current_stage, status, email, telefono), encolar
-- un job de write-back en zoho_writeback_outbox para que un worker BullMQ lo
-- envíe de vuelta a Zoho. Outbox pattern (durable): si el worker está caído,
-- el job no se pierde — sigue en la tabla hasta procesado.
--
-- GUARD ANTI-BUCLE CRÍTICO
-- ------------------------
-- El pull (webhook Zoho -> UPDATE lead) NO debe re-encolar writeback, o se
-- crearía un bucle infinito: pull actualiza lead -> trigger encola writeback ->
-- writeback actualiza Zoho -> Zoho notifica modificación -> pull re-procesa...
--
-- Mitigación: el procesador de pull ejecuta `SET LOCAL app.zoho_pull_in_progress
-- = 'true'` ANTES de hacer el UPDATE del lead. Este trigger comprueba ese flag
-- con `current_setting('app.zoho_pull_in_progress', true)` (el 2º arg `true` =
-- missing_ok, devuelve NULL/'' si no está seteado) y, si es 'true', hace
-- RETURN NEW sin encolar. El SET LOCAL solo vive dentro de la transacción del
-- pull, así que los UPDATE normales (UI/agentes) sí encolan writeback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.zoho_writeback_outbox (
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

COMMENT ON TABLE public.zoho_writeback_outbox IS
  'Outbox pattern: cambios en lead originados en Zoho se encolan aquí. Worker BullMQ los lee y los escribe en Zoho. Durable: sobrevive caídas del worker. El trigger respeta el guard anti-bucle app.zoho_pull_in_progress.';

CREATE INDEX IF NOT EXISTS idx_zoho_wb_outbox_pending
  ON public.zoho_writeback_outbox(created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_zoho_wb_outbox_lead
  ON public.zoho_writeback_outbox(lead_id, status);

ALTER TABLE public.zoho_writeback_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zoho_wb_outbox_select_owner" ON public.zoho_writeback_outbox;
DROP POLICY IF EXISTS "service_role_all_zoho_wb_outbox" ON public.zoho_writeback_outbox;

CREATE POLICY "zoho_wb_outbox_select_owner"
  ON public.zoho_writeback_outbox
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

CREATE POLICY "service_role_all_zoho_wb_outbox"
  ON public.zoho_writeback_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tr_lead_changes_to_zoho_writeback()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
  has_zoho_origin BOOLEAN;
BEGIN
  -- GUARD ANTI-BUCLE: si el cambio viene del propio pull Zoho, NO encolar.
  -- El procesador de pull setea `SET LOCAL app.zoho_pull_in_progress = 'true'`
  -- dentro de su transacción antes de actualizar el lead.
  IF current_setting('app.zoho_pull_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Solo procesar si el lead tiene origen Zoho (está en zoho_lead_synced).
  SELECT EXISTS(
    SELECT 1 FROM public.zoho_lead_synced WHERE lead_id = NEW.id
  ) INTO has_zoho_origin;

  IF NOT has_zoho_origin THEN
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

  INSERT INTO public.zoho_writeback_outbox (lead_id, tenant_id, changes)
  VALUES (NEW.id, NEW.tenant_id, changes);

  -- Notificación best-effort para que el worker BullMQ procese rápido.
  -- Si no hay listener, no pasa nada — la outbox queda durable.
  PERFORM pg_notify('zoho_writeback_pending', NEW.id::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_lead_zoho_writeback ON public.lead;
CREATE TRIGGER trg_lead_zoho_writeback
  AFTER UPDATE ON public.lead
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_lead_changes_to_zoho_writeback();

-- ── PostgREST cache reload ─────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
