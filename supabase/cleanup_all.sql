-- LIMPIEZA TOTAL DE TABLAS - ESDEN DASHBOARD
-- Este script borra todas las tablas creadas para permitir una reinstalación limpia.

BEGIN;

DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.lead_events CASCADE;
DROP TABLE IF EXISTS public.dynamic_kpis CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.lead_audit_logs CASCADE;
DROP TABLE IF EXISTS public.ai_agent_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.availability_slots CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.knowledge_base CASCADE;
DROP TABLE IF EXISTS public.web_widgets CASCADE;
DROP TABLE IF EXISTS public.lead CASCADE;
DROP TABLE IF EXISTS public.voice_agents CASCADE;
DROP TABLE IF EXISTS public.ai_agent_variants CASCADE;
DROP TABLE IF EXISTS public.ai_agents CASCADE;
DROP TABLE IF EXISTS public.orchestration_graphs CASCADE;
DROP TABLE IF EXISTS public.workflows CASCADE;
DROP TABLE IF EXISTS public.programas CASCADE;
DROP TABLE IF EXISTS public.advisors CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

COMMIT;
