-- SQL Snippet: Promover un usuario a Super Admin (Developer)
-- Ejecutar en el SQL Editor de Supabase

-- Reemplazar 'tu_email@ejemplo.com' con tu email de inicio de sesión:
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true, "is_admin": true, "admin": true}'::jsonb
WHERE email = 'admin@test.com';

-- Verificar que se aplicó correctamente:
SELECT id, email, raw_app_meta_data 
FROM auth.users 
WHERE email = 'admin@test.com';
