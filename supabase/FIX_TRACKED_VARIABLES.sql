-- ============================================================
-- FIX: TRACKED VARIABLES — ESDEN DASHBOARD
-- Asegura que todas las variantes activas tengan los 
-- tracked_variables correctos para REGLA_APLICADA, 
-- MOTIVO_DESCARTE, QA_HANDLED, QA_TOPIC y el resto.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- PASO 1: Ver el estado actual (diagnóstico)
SELECT 
    id, 
    is_active,
    jsonb_array_length(tracked_variables::jsonb) AS num_tracked_vars,
    tracked_variables
FROM public.ai_agent_variants
ORDER BY is_active DESC, updated_at DESC;

-- ============================================================
-- PASO 2: Actualizar TODAS las variantes activas que tengan
-- tracked_variables vacío o nulo.
-- ============================================================
UPDATE public.ai_agent_variants
SET 
    tracked_variables = '[
        "USER_NAME",
        "ID_LEAD",
        "USER_COUNTRY",
        "USER_PHONE",
        "CURSE_NAME",
        "USER_AGE",
        "USER_ESTUDIES",
        "USER_PROFESION",
        "USER_MOTIVATIONS",
        "REGLA_APLICADA",
        "RESUMEN_CONVERSACION",
        "QUALIFIED",
        "ESTADO",
        "MOTIVO_DESCARTE",
        "CONVERSATION_STATUS",
        "QA_HANDLED",
        "QA_TOPIC",
        "SCHEDULED_CALL_CONFIRMED",
        "YEARS_EXPERIENCIE",
        "FECHA_AGENDA"
    ]'::jsonb,
    updated_at = NOW()
WHERE 
    is_active = true
    AND (
        tracked_variables IS NULL 
        OR tracked_variables = '[]'::jsonb 
        OR jsonb_array_length(tracked_variables::jsonb) = 0
    );

-- ============================================================
-- PASO 3: Forzar actualización en TODAS las variantes activas
-- (independientemente de si ya tenían variables o no),
-- para garantizar que las 4 variables clave están incluidas.
-- ============================================================
UPDATE public.ai_agent_variants
SET 
    tracked_variables = (
        -- Merge: mantén las existentes + añade las que falten
        SELECT jsonb_agg(DISTINCT v)
        FROM (
            SELECT jsonb_array_elements_text(
                COALESCE(tracked_variables, '[]'::jsonb)
            ) AS v
            UNION
            SELECT unnest(ARRAY[
                'USER_NAME', 'ID_LEAD', 'USER_COUNTRY', 'USER_PHONE',
                'CURSE_NAME', 'USER_AGE', 'USER_ESTUDIES', 'USER_PROFESION',
                'USER_MOTIVATIONS', 'REGLA_APLICADA', 'RESUMEN_CONVERSACION',
                'QUALIFIED', 'ESTADO', 'MOTIVO_DESCARTE', 'CONVERSATION_STATUS',
                'QA_HANDLED', 'QA_TOPIC', 'SCHEDULED_CALL_CONFIRMED',
                'YEARS_EXPERIENCIE', 'FECHA_AGENDA'
            ])
        ) sub
    ),
    updated_at = NOW()
WHERE is_active = true;

-- PASO 4: Verificar resultado final
SELECT 
    id, 
    is_active,
    jsonb_array_length(tracked_variables::jsonb) AS num_tracked_vars,
    tracked_variables
FROM public.ai_agent_variants
WHERE is_active = true;
