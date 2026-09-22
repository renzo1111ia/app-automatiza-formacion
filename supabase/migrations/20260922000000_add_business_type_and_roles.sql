-- Migration: Multi-Rol y Business Type
-- 1. Añadir columna business_type a la tabla tenants si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tenants' 
      AND column_name = 'business_type'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN business_type text DEFAULT 'general';
  END IF;
END $$;

-- 2. Migrar business_type de los tenants existentes a partir de su config JSON
UPDATE public.tenants
SET business_type = COALESCE(NULLIF(config->>'business_type', ''), 'general')
WHERE business_type IS NULL OR business_type = 'general';

-- 3. Crear índice para optimizar filtrado por tipo de negocio
CREATE INDEX IF NOT EXISTS idx_tenants_business_type ON public.tenants(business_type);

-- 4. Actualizar política RLS en public.tenants:
-- - Super Admin (is_super_admin=true, is_admin=true, admin=true en app_metadata): ve TODOS los clientes
-- - Tenant Admin (auth_user_id = auth.uid()): ve ÚNICAMENTE su propio tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
    CREATE POLICY "authenticated_read_tenants" ON public.tenants
      FOR SELECT TO authenticated
      USING (
        auth_user_id = auth.uid()
        OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'is_super_admin'), 'false') = 'true'
        OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'is_admin'), 'false') = 'true'
        OR COALESCE(((auth.jwt() -> 'app_metadata') ->> 'admin'), 'false') = 'true'
      );
  END IF;
END $$;
