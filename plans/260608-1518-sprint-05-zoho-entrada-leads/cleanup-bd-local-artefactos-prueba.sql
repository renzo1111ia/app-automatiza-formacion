-- ============================================================================
-- Limpieza de artefactos de prueba en la BD LOCAL (Sprint 5 Zoho)
-- ============================================================================
-- SOLO para la BD de desarrollo local. NO ejecutar en staging ni prod.
-- Idempotente: se puede correr varias veces sin error.
--
-- Cómo aplicar (PowerShell, con la connection string de .env.local):
--   psql "<DATABASE_URL_local>" -f plans/260608-1518-sprint-05-zoho-entrada-leads/cleanup-bd-local-artefactos-prueba.sql
--
-- Qué borra:
--   1. La conexión de pull Zoho de prueba + su integración OAuth real (a9a6a772).
--   2. Los leads de prueba antiguos con pais NULL (Pedro/Lucia/Carlos) que se
--      crearon antes del fix de deriveCountryFromPhone (BUG-5-04).
-- ============================================================================

BEGIN;

-- 1. Conexión de pull Zoho de prueba (referencia la integración por id).
DELETE FROM public.zoho_sync_connections
WHERE integration_id = 'a9a6a772-649e-4bc9-b7f0-030754f2521b';

-- 2. Integración OAuth real de prueba (tokens cifrados de la cuenta test .eu).
DELETE FROM public.integrations
WHERE id = 'a9a6a772-649e-4bc9-b7f0-030754f2521b';

-- 3. Leads de prueba viejos con pais NULL (creados antes del fix de país).
--    Ajusta el filtro si quieres conservar alguno. Por seguridad, solo borra los
--    que vinieron de zoho_crm y no tienen país (los nuevos sí lo traen).
DELETE FROM public.lead
WHERE pais IS NULL
  AND origen = 'zoho_crm';

COMMIT;

-- Verificación rápida (descomenta para revisar antes de COMMIT):
-- SELECT id, nombre, pais, origen FROM public.lead WHERE origen = 'zoho_crm';
-- SELECT id, crm_type FROM public.integrations WHERE crm_type = 'zoho';
