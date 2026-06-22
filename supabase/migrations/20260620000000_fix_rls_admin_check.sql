DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
    CREATE POLICY "authenticated_read_tenants" ON public.tenants
      FOR SELECT TO authenticated
      USING (
        auth_user_id = auth.uid()
        OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'is_admin'), 'false') = 'true'
        OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'admin'), 'false') = 'true'
      );
  END IF;
END $$;
