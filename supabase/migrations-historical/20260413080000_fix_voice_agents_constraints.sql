-- Migration to fix voice_agents and voice_agent_variants constraints for upsert
-- This ensures that 'provider_agent_id' is unique per tenant, allowing ON CONFLICT updates.

-- 1. Clean up duplicate voice_agents (if any) keeping the latest one
DELETE FROM public.voice_agents a
USING public.voice_agents b
WHERE a.id < b.id 
  AND a.tenant_id = b.tenant_id 
  AND a.provider_agent_id = b.provider_agent_id;

-- 2. Add UNIQUE constraint to voice_agents
-- We use (tenant_id, provider_agent_id) to support multitenancy properly
ALTER TABLE public.voice_agents 
ADD CONSTRAINT voice_agents_tenant_provider_unique UNIQUE (tenant_id, provider_agent_id);

-- 3. Clean up duplicate voice_agent_variants (if any) keeping the latest one
DELETE FROM public.voice_agent_variants a
USING public.voice_agent_variants b
WHERE a.id < b.id 
  AND a.agent_id = b.agent_id 
  AND a.version_label = b.version_label 
  AND a.is_variant_b = b.is_variant_b;

-- 4. Add UNIQUE constraint to voice_agent_variants
ALTER TABLE public.voice_agent_variants 
ADD CONSTRAINT voice_agent_variants_composite_unique UNIQUE (agent_id, version_label, is_variant_b);

COMMENT ON CONSTRAINT voice_agents_tenant_provider_unique ON public.voice_agents IS 
'Enables upsert operations by ensuring a provider agent ID is unique within a tenant.';

COMMENT ON CONSTRAINT voice_agent_variants_composite_unique ON public.voice_agent_variants IS 
'Enables upsert operations by ensuring agent variants are unique by agent, label, and A/B type.';
