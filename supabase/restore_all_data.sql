-- RESTAURACIÓN DE DATOS ESDEN - VERSIÓN FINAL LIMPIA
-- Este script inserta los datos rescatados sin errores de sintaxis.

BEGIN;

-- 1. Desactivar RLS temporalmente
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead DISABLE ROW LEVEL SECURITY;

-- 2. Restaurar Inquilinos (Tenants)
INSERT INTO public.tenants (id, name, client_email, config) VALUES
('f9782efc-1938-4f79-8df6-7d849d701c52', 'demo admin', 'admin1@gmail.com', '{"is_admin": true}'),
('47e84fa2-73f3-4e23-9267-1e49d4442f70', 'CLIENTE 1', 'usuario2@gmail.com', '{"username": "esden", "whatsapp": {"wabaId": "1269604455298809"}}')
ON CONFLICT (id) DO NOTHING;

-- 3. Restaurar Asesores (Advisors)
INSERT INTO public.advisors (id, tenant_id, name, email) VALUES
('8d0024a4-07f1-4460-989e-f5eb390cbd9d', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'LORENA CABRERA', 'lcabrera@esden.es'),
('e8f78c27-f8ff-4d88-bdbf-f914e267f550', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'CAROLINA DE LA ROSA', 'cdelarosa@esden.es')
ON CONFLICT (id) DO NOTHING;

-- 4. Restaurar Agentes IA
INSERT INTO public.ai_agents (id, tenant_id, name, type) VALUES
('2fdee4d8-4024-44e5-9c12-69ad8cc3fdc8', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'agente principal', 'QUALIFY')
ON CONFLICT (id) DO NOTHING;

-- 5. Restaurar Variantes de Agentes (Prompts)
INSERT INTO public.ai_agent_variants (id, agent_id, tenant_id, prompt_text, is_active, model_name, metrics, dynamic_variables, tracked_variables, automation_rules, crm_config) VALUES
('d046ccac-d1ea-4d13-a8a6-170c910b1fdf', '2fdee4d8-4024-44e5-9c12-69ad8cc3fdc8', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'PROMPT VIRGINIA - EDITAR MANUALMENTE EN DASHBOARD', true, 'gpt-4.1-mini', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 6. Restaurar Agentes de Voz
INSERT INTO public.voice_agents (id, tenant_id, name, status, provider, provider_agent_id, voice_id, retell_llm_id, prompt_text_retell, retell_llm_config) VALUES
('93713c59-208b-45f2-a977-b73fe43dffca', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'Clinica Revitalis', 'ACTIVE', 'RETELL', 'agent_0404137219f8d18be5c97d585b', 'custom_voice_70a92192d492aff6546689b2ce', 'llm_7697236d06ac713b36e5e9259dc4', 'PROMPT MARIA - EDITAR MANUALMENTE', '{"model": "gpt-4.1-mini"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 7. Restaurar Leads
INSERT INTO public.lead (id, tenant_id, nombre, telefono, pais, metadata) VALUES
('6a02c14c-c5db-47fb-8857-99a28d3ee6ec', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'Bea', '34717771303', 'Spain', '{"USER_NAME": "Beatriz"}'::jsonb),
('adcf5c82-43af-4906-8d9a-94b8487fe937', '47e84fa2-73f3-4e23-9267-1e49d4442f70', 'renzo', '59177349252', 'Bolivia', '{"USER_NAME": "Renzo"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 8. Reactivar RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;

COMMIT;
