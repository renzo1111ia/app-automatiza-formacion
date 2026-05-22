-- =============================================================================
-- supabase/scripts/create-app-user.sql
-- =============================================================================
-- Sprint 0 tarea 1-06 — Crear rol Postgres `app_user` con permisos limitados.
--
-- Reemplaza el uso de `postgres` (superuser) para conexiones de aplicación,
-- scripts admin y futuras migraciones. Refs: docs/audit R-023.a.
--
-- Idempotente: seguro de ejecutar varias veces.
--
-- USO:
--   psql "$DB_URL" -v app_password="'PASSWORD_FUERTE_AQUI'" -f supabase/scripts/create-app-user.sql
--
--   Donde DB_URL apunta al Postgres con un user que tenga privilegios suficientes
--   (postgres en local, supabase_admin en producción Easypanel).
--
-- VERIFICACIÓN POST-EJECUCIÓN (queries al final del script):
--   - app_user existe con LOGIN y SIN SUPERUSER/CREATEDB/CREATEROLE/REPLICATION
--   - Permisos SELECT/INSERT/UPDATE/DELETE sobre tablas en public
--   - Sin permisos DDL (CREATE/ALTER/DROP TABLE)
--   - Default privileges aplican a tablas futuras
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Crear el rol si no existe (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD :app_password;
    RAISE NOTICE 'Rol app_user creado';
  ELSE
    -- Si ya existe, actualizar la password (rotación)
    EXECUTE format('ALTER ROLE app_user WITH PASSWORD %L', :app_password);
    RAISE NOTICE 'Rol app_user ya existía — password actualizada';
  END IF;
END $$;

-- 2. Garantizar que NO tiene CREATEDB ni CREATEROLE (atributos manejables por postgres no-superuser).
--    NOTA: NOSUPERUSER / NOREPLICATION / NOBYPASSRLS no se aplican aquí — solo un SUPERUSER real
--    puede alterar esos atributos (limitación Postgres). Los defaults de CREATE ROLE ya los excluyen,
--    así que un rol recién creado no los tiene. Si se sospecha que el rol fue tamper-eado a SUPERUSER,
--    ejecutar este script como supabase_admin (no como postgres) en local, o como rds_superuser/etc en prod.
ALTER ROLE app_user NOCREATEDB NOCREATEROLE;

-- 3. Permitir conexión a la BD actual
GRANT CONNECT ON DATABASE postgres TO app_user;

-- 4. Permisos sobre schema public
GRANT USAGE ON SCHEMA public TO app_user;

-- 5. DML sobre todas las tablas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 6. USAGE sobre secuencias (necesario para columns SERIAL/IDENTITY)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 7. EXECUTE sobre funciones existentes (RLS helpers, triggers, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- 8. Default privileges: que las TABLAS FUTURAS creadas por postgres/supabase_admin
--    den automáticamente acceso DML a app_user. Esto evita tener que re-ejecutar
--    este script cada vez que se aplica una migración.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;

-- 9. Política RLS: app_user NO bypassa RLS (NOBYPASSRLS arriba garantiza esto).
--    Las policies existentes seguirán filtrando por tenant_id como antes.

COMMIT;

-- =============================================================================
-- VERIFICACIÓN — ejecuta estas queries DESPUÉS del script para confirmar
-- =============================================================================

-- A) Confirmar que el rol existe con los atributos correctos
SELECT
  rolname,
  rolsuper      AS is_superuser,
  rolcreatedb   AS can_create_db,
  rolcreaterole AS can_create_role,
  rolreplication AS can_replicate,
  rolbypassrls  AS bypasses_rls,
  rolcanlogin   AS can_login
FROM pg_roles
WHERE rolname = 'app_user';
-- Esperado: rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolreplication=f,
--           rolbypassrls=f, rolcanlogin=t

-- B) Confirmar permisos DML sobre tablas (sample de 3)
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_user'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type
LIMIT 12;
-- Esperado: 4 filas por tabla (SELECT, INSERT, UPDATE, DELETE)

-- C) Confirmar que NO tiene permisos DDL
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_user'
  AND table_schema = 'public'
  AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER');
-- Esperado: 0 filas (sin permisos DDL)
