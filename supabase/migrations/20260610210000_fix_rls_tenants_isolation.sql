-- BUG-SEC RLS-002 — cerrar leak cross-tenant en la tabla `tenants`.
--
-- `tenants` tenia `authenticated_read_tenants USING (true)` → cualquier usuario authenticated
-- leia supabase_anon_key / client_email / config de TODOS los tenants vía GET /rest/v1/tenants.
--
-- VERIFICADO CON LOGIN REAL (PostgREST, no psql) 10-06-2026:
--   - Con la policy OPEN: usuario real ve los 2 tenants (LEAK confirmado).
--   - Tras cerrarla (solo queda filtro auth_user_id = auth.uid()): ve SOLO su tenant (1),
--     y sigue viendo sus 29 leads + 18 llamadas (el subquery de aislamiento del resto NO se rompe).
--   El simulacro psql previo daba 0 por diferencia GUC vs sesion real — NO era fiable; por eso
--   se exigio verificacion con login real antes de tocar.
--
-- Fix: reemplazar la policy OPEN por una que solo deja ver la fila propia (o admin).
-- Idempotente. Converge VPS + local. base_schema.sql ya nace correcto para fresh installs.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tenants') THEN
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
    CREATE POLICY "authenticated_read_tenants" ON public.tenants
      FOR SELECT TO authenticated
      USING (auth_user_id = auth.uid()
             OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'is_admin'), 'false') = 'true');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
