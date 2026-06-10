-- BUG-SEC RLS-001 — Aislamiento multi-tenant en lectura para rol `authenticated`.
--
-- Contexto (detectado 10-06-2026 en review adversarial del plan Sprint 6, verificado en VPS + local):
--   `base_schema.sql` (DO block líneas 430-452) crea, para ~21 tablas multi-tenant, una política
--   `authenticated_read_* USING (true)` que permite a CUALQUIER usuario `authenticated` leer filas
--   de CUALQUIER tenant (no filtra tenant_id). Verificado en pg_policies de VPS y local: qual = true.
--
--   Vector de explotación CONFIRMADO: varios componentes CLIENTE leen estas tablas con la ANON key
--   filtrando por tenant_id EN EL CLIENTE (controlable por el atacante):
--     - src/app/dashboard/costs/page.tsx  → chat_messages, llamadas
--     - src/app/dashboard/logs/page.tsx   → orchestration_logs (join lead)
--     - src/components/agents/AIAgentInbox.tsx → Realtime channels sobre chat_summaries/leads
--   Como la RLS es permisiva, un usuario autenticado puede pedir datos de OTRO tenant. IDOR multi-tenant.
--
-- Fix: re-asentar las políticas `authenticated_read_*` con el patrón de aislamiento YA validado en el
--   proyecto (migración 20260609100000 campaigns/tenant_holidays):
--       tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
--   El rol admin sigue haciendo BYPASS de RLS (no se ve afectado). El rol service_role mantiene su
--   política `service_role_all_* USING (true)` (backend de confianza). Solo se restringe `authenticated`.
--
-- Nota tipos: `chat_messages.tenant_id` es TEXT (resto UUID) → cast `id::text` para esa tabla.
-- 100% idempotente (DROP POLICY IF EXISTS + CREATE). Converge entornos ya desplegados (VPS) y fresh.

-- =============================================================================
-- Tablas multi-tenant con tenant_id UUID → patrón estándar
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
  -- Solo tablas con columna `tenant_id` UUID directa (verificado en information_schema).
  -- EXCLUIDAS por NO tener tenant_id directo (lo heredan vía FK, requieren join — seguimiento aparte):
  --   availability_slots, lead_events.
  uuid_tables TEXT[] := ARRAY[
    'advisors', 'agendamientos', 'ai_agent_logs', 'appointments',
    'conversaciones_whatsapp', 'intentos', 'intentos_llamadas', 'lead', 'lead_cualificacion',
    'lead_programas', 'llamadas', 'notificaciones', 'orchestration_graphs', 'system_logs',
    'voice_agents', 'workflows'
  ];
BEGIN
  FOREACH tbl IN ARRAY uuid_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON public.%I', tbl, tbl);
      EXECUTE format(
        'CREATE POLICY "authenticated_read_%I" ON public.%I FOR SELECT TO authenticated '
        'USING (tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()))',
        tbl, tbl
      );
    ELSE
      RAISE NOTICE 'Tabla % ausente — skip RLS reconciliation', tbl;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- chat_messages — tenant_id es TEXT, cast id::text
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "authenticated_read_chat_messages" ON public.chat_messages;
    CREATE POLICY "authenticated_read_chat_messages" ON public.chat_messages
      FOR SELECT TO authenticated
      USING (tenant_id IN (SELECT id::text FROM public.tenants WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
