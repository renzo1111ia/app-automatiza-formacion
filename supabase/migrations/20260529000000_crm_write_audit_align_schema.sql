-- ============================================================================
-- Sprint 4 · Alineamiento schema crm_write_audit (SQL ↔ Zod) — R-014
-- ============================================================================
-- El schema SQL original (20260524100000) tenía columnas granulares por celda:
--   provider, lead_id, field_name, old_value, new_value, write_policy, actor_id
--
-- El schema Zod (src/lib/schemas/integrations.ts:94) usa modelo por operación:
--   integration_id, crm_type, operation, local_entity, local_entity_id,
--   crm_entity_id, payload_hash, result, error_message, write_policy
--
-- Resultado: CrmWriteAuditRepository.create() insertaba payload Zod en columnas
-- SQL distintas → INSERT 400 silencioso.
--
-- Solución híbrida (decisión 29-05-2026): ALTER TABLE añade los campos Zod
-- como NULLABLE manteniendo los campos SQL originales también NULLABLE.
-- Zod actúa como guardián: valida payload completo antes del INSERT.
--
-- Casos de uso cubiertos:
--   - HubSpot/Zoho (Sprint 2): rellena campos Zod (operation/result/payload_hash).
--     Campos SQL granulares quedan NULL.
--   - Sheets writeback (Sprint 4): rellena campos SQL (field_name/old_value/new_value)
--     + Zod básicos (integration_id/crm_type='google_sheets'/operation='update'/result).
--
-- Idempotente. Solo añade columnas + index nuevo. NO altera datos existentes.
-- ============================================================================

-- ── 1. Columnas Zod nuevas (todas NULLABLE para compat con filas SQL pre-existentes) ──

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS crm_type TEXT
    CHECK (crm_type IN ('hubspot', 'zoho', 'google_sheets', 'salesforce', 'gohighlevel', 'activecampaign'));

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS operation TEXT
    CHECK (operation IN ('create', 'update', 'delete', 'upsert'));

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS local_entity TEXT;

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS local_entity_id UUID;

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS crm_entity_id TEXT;

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS result TEXT
    CHECK (result IN ('success', 'error', 'skipped', 'deferred'));

ALTER TABLE public.crm_write_audit
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ── 2. Aflojar NOT NULL en campos SQL granulares ─────────────────────────────
-- Antes eran NOT NULL (modelo por celda obligatorio). Ahora son opcionales
-- porque el modelo por operación (Zod) no los necesita.

ALTER TABLE public.crm_write_audit
  ALTER COLUMN provider DROP NOT NULL;

ALTER TABLE public.crm_write_audit
  ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE public.crm_write_audit
  ALTER COLUMN field_name DROP NOT NULL;

ALTER TABLE public.crm_write_audit
  ALTER COLUMN new_value DROP NOT NULL;

-- ── 3. Comentarios actualizados ──────────────────────────────────────────────

COMMENT ON COLUMN public.crm_write_audit.crm_type IS
  'Tipo de CRM destino (alineado con integrations.crm_type). Requerido por Zod.';

COMMENT ON COLUMN public.crm_write_audit.operation IS
  'Tipo de operación: create | update | delete | upsert. Requerido por Zod.';

COMMENT ON COLUMN public.crm_write_audit.local_entity IS
  'Entidad local AF sobre la que se opera (lead, appointment, qualification, program).';

COMMENT ON COLUMN public.crm_write_audit.local_entity_id IS
  'ID local de la entidad AF (UUID interno).';

COMMENT ON COLUMN public.crm_write_audit.crm_entity_id IS
  'ID en el sistema CRM externo tras la operación (puede ser NULL si la op aún no devolvió ID).';

COMMENT ON COLUMN public.crm_write_audit.payload_hash IS
  'SHA-256 del payload enviado al CRM. Permite detectar duplicados de op idéntica.';

COMMENT ON COLUMN public.crm_write_audit.result IS
  'Resultado de la operación: success | error | skipped | deferred.';

COMMENT ON COLUMN public.crm_write_audit.error_message IS
  'Mensaje de error si result=error.';

COMMENT ON COLUMN public.crm_write_audit.field_name IS
  'Modelo granular (Sheets writeback): nombre del campo modificado (lead.current_stage, etc.). NULL para operaciones por payload (HubSpot/Zoho).';

COMMENT ON COLUMN public.crm_write_audit.old_value IS
  'Modelo granular (Sheets writeback): valor anterior del campo. NULL si no se conocía.';

COMMENT ON COLUMN public.crm_write_audit.new_value IS
  'Modelo granular (Sheets writeback): valor nuevo del campo. NULL para operaciones por payload.';

-- ── 4. Índices para queries habituales ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_crm_write_audit_local_entity
  ON public.crm_write_audit(tenant_id, local_entity, local_entity_id, created_at DESC)
  WHERE local_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_write_audit_payload_hash
  ON public.crm_write_audit(payload_hash)
  WHERE payload_hash IS NOT NULL;

-- ── 5. PostgREST cache reload ────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
