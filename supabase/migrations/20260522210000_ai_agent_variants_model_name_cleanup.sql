-- Sprint 1 · Tarea 2-35
-- Limpia valores legacy/inválidos en ai_agent_variants.model_name antes de
-- que la whitelist ModelNameSchema (Zod, src/lib/schemas/ai-agents.ts) sea
-- enforced en el boundary (Server Action saveAgentVariant).
--
-- Política: cualquier model_name fuera de la whitelist actual se reescribe a
-- 'gpt-4o-mini' (default seguro, económico). El admin puede ajustar después.
--
-- Whitelist sincronizada con src/lib/schemas/ai-agents.ts ModelNameSchema.
-- Mantener ambas listas en sync cada vez que se añada un modelo (ver ADR).

DO $$
BEGIN
    UPDATE public.ai_agent_variants
    SET model_name = 'gpt-4o-mini'
    WHERE model_name IS NOT NULL
      AND model_name NOT IN (
        -- OpenAI
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.5-preview',
        -- Anthropic
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307',
        'claude-3-opus-20240229',
        -- Google Gemini
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash'
      );

    IF FOUND THEN
        RAISE NOTICE 'ai_agent_variants: model_name legacy values normalized to gpt-4o-mini';
    END IF;
END $$;
