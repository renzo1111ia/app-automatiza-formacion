-- BUG-SEC RLS-001 (parte 2) — cerrar agujeros RESIDUALES de lectura cross-tenant.
--
-- La migración 20260610193500 cerró las 17 tablas con `tenant_id` UUID directo.
-- Auditoría completa posterior (10-06-2026) detectó 3 tablas que SEGUÍAN con
-- `authenticated_read_* USING (true)` porque no tienen `tenant_id` directo o se
-- omitieron: `campanas`, `availability_slots`, `lead_events`.
--
-- Verificado: `campanas` tiene 8 filas de 2 tenants → leak cross-tenant real.
--             `availability_slots` se relaciona al tenant vía advisor_id → advisors.tenant_id.
--             `lead_events` se relaciona al tenant vía lead_id → lead.tenant_id.
--
-- NOTA sobre `tenants`: queda FUERA de esta migración a propósito. Tiene SELECT OPEN y
-- expone supabase_anon_key/client_email/config de todos los tenants (leak grave), PERO
-- un simulacro confirmó que cerrar su política OPEN rompe el subquery
-- `SELECT id FROM tenants WHERE auth_user_id = auth.uid()` que usan TODAS las demás
-- políticas (dependencia de evaluación → todos verían 0 filas). Requiere fix arquitectónico
-- dedicado (vista security-definer o función). Documentado en
-- plans/.../reports/security-hardening-vps-20260610.md como seguimiento BUG-SEC-RLS-002.
--
-- 100% idempotente. Converge VPS + fresh.

-- =============================================================================
-- campanas — tenant_id UUID directo (patrón estándar)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='campanas') THEN
    ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated_read_campanas" ON public.campanas;
    CREATE POLICY "authenticated_read_campanas" ON public.campanas
      FOR SELECT TO authenticated
      USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- availability_slots — sin tenant_id; se filtra vía advisor_id → advisors.tenant_id
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='availability_slots') THEN
    ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated_read_availability_slots" ON public.availability_slots;
    CREATE POLICY "authenticated_read_availability_slots" ON public.availability_slots
      FOR SELECT TO authenticated
      USING (advisor_id IN (
        SELECT a.id FROM public.advisors a
        WHERE a.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
      ));
  END IF;
END $$;

-- =============================================================================
-- lead_events — sin tenant_id; se filtra vía lead_id → lead.tenant_id
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='lead_events') THEN
    ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated_read_lead_events" ON public.lead_events;
    CREATE POLICY "authenticated_read_lead_events" ON public.lead_events
      FOR SELECT TO authenticated
      USING (lead_id IN (
        SELECT l.id FROM public.lead l
        WHERE l.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
