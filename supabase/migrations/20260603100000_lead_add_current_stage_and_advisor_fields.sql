-- Sprint 4 (BUG-4-04 / BUG-4-05) — Alinear tabla `lead` con el codigo.
--
-- Contexto: orchestrator.ts, leads-repository.ts, handoff.ts, api/leads/ingest,
-- el trigger trg_lead_writeback (20260527000002) y src/types/database.ts usan
-- columnas que NUNCA se crearon en ninguna migracion:
--   - current_stage         (etapa del pipeline agentico, LeadStageEnum)
--   - assigned_advisor_id    (advisor asignado en round-robin tras cualificar)
--   - last_advisor_assignment(timestamp de la ultima asignacion)
--
-- Verificado 03-06-2026: ausentes en local Y en VPS (no era migracion sin
-- aplicar — eran columnas fantasma). La tabla solo tenia `status`
-- (PENDING/QUALIFIED/REJECTED/CLIENTE) y `advisor_id`.
--
-- `status` (ciclo de vida administrativo) y `current_stage` (etapa pipeline IA)
-- son dimensiones INDEPENDIENTES — no se sustituyen, coexisten. Esta migracion
-- crea current_stage y hace backfill por correlacion con status.
--
-- Idempotente (IF NOT EXISTS) para que reset/re-apply no fallen.

-- ── 1. current_stage ────────────────────────────────────────────────────────
ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS current_stage TEXT NOT NULL DEFAULT 'QUALIFICATION';

-- CHECK alineado con LeadStageEnum (src/lib/schemas/_base.ts).
-- Se anade por separado para poder backfillear antes de validar filas viejas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_current_stage_check'
  ) THEN
    -- Backfill por correlacion status -> stage ANTES de activar el CHECK.
    UPDATE public.lead SET current_stage = CASE status
      WHEN 'PENDING'   THEN 'QUALIFICATION'
      WHEN 'QUALIFIED' THEN 'SCHEDULING'
      WHEN 'CLIENTE'   THEN 'COMPLETED'
      WHEN 'REJECTED'  THEN 'DROPPED'
      ELSE 'QUALIFICATION'
    END
    WHERE current_stage = 'QUALIFICATION';  -- solo filas en el default recien anadido

    ALTER TABLE public.lead
      ADD CONSTRAINT lead_current_stage_check
      CHECK (current_stage IN (
        'QUALIFICATION', 'SCHEDULING', 'COMPLETED', 'DROPPED', 'UNREACHABLE'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_current_stage
  ON public.lead(tenant_id, current_stage);

COMMENT ON COLUMN public.lead.current_stage IS
  'Etapa del pipeline agentico (LeadStageEnum: QUALIFICATION/SCHEDULING/COMPLETED/DROPPED/UNREACHABLE). Independiente de status (ciclo de vida administrativo). BUG-4-04 Sprint 4.';

-- ── 2. assigned_advisor_id + last_advisor_assignment ────────────────────────
-- Usadas por orchestrator.handleNewLead (round-robin advisor). `advisor_id`
-- preexistente queda como esta (compat); assigned_advisor_id es el campo que
-- escribe el orquestador tras cualificar.
ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS assigned_advisor_id UUID
    REFERENCES public.advisors(id) ON DELETE SET NULL;

ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS last_advisor_assignment TIMESTAMPTZ;

COMMENT ON COLUMN public.lead.assigned_advisor_id IS
  'Advisor asignado por el orquestador en round-robin tras cualificar (orchestrator.ts). BUG-4-05 Sprint 4.';
COMMENT ON COLUMN public.lead.last_advisor_assignment IS
  'Timestamp de la ultima asignacion de advisor. BUG-4-05 Sprint 4.';

-- ── 3. Recargar el schema cache de PostgREST ────────────────────────────────
NOTIFY pgrst, 'reload schema';
