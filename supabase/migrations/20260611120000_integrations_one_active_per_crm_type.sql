-- ============================================================================
-- Sprint 5 · Fix BUG-5-08 — una integración activa por (tenant, crm_type)
-- ============================================================================
-- El índice `idx_integrations_one_active_per_tenant` (migración 20260524100000)
-- enforzaba UNIQUE(tenant_id) WHERE is_active = true, es decir: UN SOLO canal de
-- integración activo por tenant en total.
--
-- Eso rompe el modelo de entrada de leads multi-fuente: un tenant necesita poder
-- tener Google Sheets + Zoho + HubSpot activos a la vez (son canales de entrada
-- INDEPENDIENTES, no CRMs mutuamente excluyentes). Con el constraint viejo, al
-- conectar Zoho mientras Google Sheets estaba activo, el callback OAuth fallaba
-- con: "duplicate key value violates unique constraint
-- idx_integrations_one_active_per_tenant" → error persist_failed en la UI.
--
-- Fix: el límite pasa a ser UNA integración activa por (tenant_id, crm_type).
-- Así cada tipo de canal puede estar activo a la vez, pero sigue sin permitir
-- duplicados activos del mismo tipo (p. ej. dos Zoho activos a la vez).
--
-- Idempotente.
-- ============================================================================

-- Quitar el índice viejo (1 activa por tenant en total).
DROP INDEX IF EXISTS public.idx_integrations_one_active_per_tenant;

-- Nuevo: 1 activa por (tenant, tipo de CRM/canal).
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_one_active_per_tenant_crm
  ON public.integrations(tenant_id, crm_type)
  WHERE is_active = true;

COMMENT ON INDEX public.idx_integrations_one_active_per_tenant_crm IS
  'Enforza máximo 1 integración activa por (tenant, crm_type). Permite Sheets + Zoho + HubSpot activos a la vez, pero no duplicados activos del mismo tipo (fix BUG-5-08, 11-06-2026).';

NOTIFY pgrst, 'reload schema';
