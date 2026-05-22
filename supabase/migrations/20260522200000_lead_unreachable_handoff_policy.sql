-- ============================================================================
-- Sprint 1 NEW-13 — Política handoff unificada (Bea correcciones V1)
-- ============================================================================
--
-- Origen: docs/Docs-entrega-clienta/Correcciones_aclaraciones Bea V1.pdf
--   §"Escalado a Humanos (Handoff)":
--   > "Por llamada fallida o lead con número no válido NO se pasa a cliente para que
--   > ellos continúen en seguimiento. Si número no válido, se tipifica en CRM del
--   > cliente y en base de datos interna como tal, si es llamada fallida se harán
--   > reintentos por WhatsApp y llamada hasta completar número de intentos
--   > establecido, y si no se consigue contacto se descartará lead y se tipificará
--   > como 'ilocalizable'."
--
-- ADR completo: docs/adr/0014-politica-handoff-humano.md
--
-- Cambios:
--   1) Columna lead.unreachable_reason TEXT NULL — motivo del descarte (NULL = no
--      está unreachable). Valores: 'invalid_phone', 'max_attempts_exceeded',
--      'user_requested_stop'. Sin CHECK constraint para permitir extensión futura.
--   2) Columna lead.contact_attempts INTEGER NOT NULL DEFAULT 0 — contador de
--      intentos de contacto (llamada + whatsapp) realizados. Incrementa cada vez
--      que executeSequenceStep o executeRetrySequenceStep procesa un step de
--      contacto. Cuando supera tenant.config.max_contact_attempts (default 5) el
--      lead pasa a UNREACHABLE.
--   3) Índice parcial idx_lead_unreachable para queries del dashboard que muestran
--      leads ilocalizables (filtros tipo "ver todos los UNREACHABLE del mes").
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS unreachable_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.lead.unreachable_reason IS
  'Motivo del descarte del lead como ilocalizable. NULL = activo. Valores típicos: invalid_phone, max_attempts_exceeded, user_requested_stop. Lo setea src/lib/core/handoff.ts:handleUnreachable. NEW-13 Sprint 1.';

COMMENT ON COLUMN public.lead.contact_attempts IS
  'Contador de intentos de contacto realizados por el orquestador (llamada + whatsapp). Cuando supera tenant.config.max_contact_attempts (default 5) el lead pasa a current_stage=UNREACHABLE y tipo_lead=ilocalizable. NEW-13 Sprint 1.';

-- Índice parcial para queries de dashboard "ilocalizables del mes" — sólo indexa
-- rows con unreachable_reason poblado (la mayoría serán NULL, no inflar índice).
CREATE INDEX IF NOT EXISTS idx_lead_unreachable
  ON public.lead (tenant_id, unreachable_reason)
  WHERE unreachable_reason IS NOT NULL;
