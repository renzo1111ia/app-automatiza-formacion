-- ============================================================================
-- Sprint 0 tarea 1-18: RLS hardening tabla `public.tenants`
-- ============================================================================
--
-- ANTES (migration 20260101000000_initial_tenants.sql):
--   - SELECT/INSERT/UPDATE/DELETE policies con `USING (true)` y
--     `WITH CHECK (true)` → cualquier usuario autenticado podía leer y
--     modificar TODOS los tenants. Finding DA-2-010.
--
-- AHORA:
--   - SELECT: solo si `auth_user_id = auth.uid()` (cliente ve su propio tenant)
--     O si el caller tiene `app_metadata.is_admin = true` (admin ve todos).
--   - INSERT/UPDATE/DELETE: SOLO admins (los CRUD de tenant son operaciones
--     de gestión, no de cliente final). El gate adicional `assertAdminAccess`
--     en `src/lib/actions/tenant.ts` (tarea 1-17) refuerza esto desde la app.
--   - service_role bypassa RLS automáticamente (jobs internos, webhooks).
--
-- La detección de admin se hace leyendo el JWT actual:
--   auth.jwt() -> 'app_metadata' ->> 'is_admin' = 'true'
-- Esto va atado a 1-16 (is_admin vive en app_metadata, NO en user_metadata).
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- ============================================================================

-- Asegura RLS activado (no-op si ya estaba)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop policies tautológicas legacy
DROP POLICY IF EXISTS "Allow authenticated read" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.tenants;

-- Drop policies de esta migration por si se re-corre
DROP POLICY IF EXISTS "tenants_select_owner_or_admin" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_admin_only" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_admin_only" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete_admin_only" ON public.tenants;

-- Helper inline: ¿el caller es admin? Lee app_metadata.is_admin del JWT.
-- No se crea como función SECURITY DEFINER para evitar complejidad; cada
-- policy lo evalúa en línea.

CREATE POLICY "tenants_select_owner_or_admin"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "tenants_insert_admin_only"
  ON public.tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "tenants_update_admin_only"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  )
  WITH CHECK (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );

CREATE POLICY "tenants_delete_admin_only"
  ON public.tenants
  FOR DELETE
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
  );
