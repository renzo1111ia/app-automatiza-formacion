-- ============================================================================
-- Sprint 5 · Fix BUG-5-06 — constraint UNIQUE (tenant_id, crm_type) en integrations
-- ============================================================================
-- Bug preexistente desde Sprint 2 (migración 20260522220003_integrations_table):
-- la tabla `integrations` solo tenía un índice PARCIAL
-- `idx_integrations_tenant_crm ... WHERE is_active = true`. El OAuth start hace
--   upsert(..., { onConflict: "tenant_id,crm_type" })
-- y un índice parcial NO sirve como destino de ON CONFLICT salvo que el predicado
-- coincida exactamente, por lo que el upsert fallaba ("no unique or exclusion
-- constraint matching the ON CONFLICT specification").
--
-- Modelo de datos: un tenant tiene como mucho UNA integración por tipo de CRM
-- (activa o no). Añadimos el constraint UNIQUE total que el upsert necesita y
-- retiramos el índice parcial, ya redundante (el constraint crea su propio
-- índice sobre (tenant_id, crm_type)).
--
-- Idempotente: usa IF NOT EXISTS / IF EXISTS para poder aplicarse sobre entornos
-- donde el constraint ya se creó a mano durante las pruebas locales del Sprint 5.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_integrations_tenant_crm'
      AND conrelid = 'public.integrations'::regclass
  ) THEN
    ALTER TABLE public.integrations
      ADD CONSTRAINT uq_integrations_tenant_crm UNIQUE (tenant_id, crm_type);
  END IF;
END $$;

-- El índice parcial queda cubierto por el índice del constraint para los lookups
-- de upsert/ON CONFLICT. Lo eliminamos para no mantener dos índices solapados.
DROP INDEX IF EXISTS public.idx_integrations_tenant_crm;
