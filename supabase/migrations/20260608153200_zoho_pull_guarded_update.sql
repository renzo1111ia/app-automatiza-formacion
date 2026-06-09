-- ============================================================================
-- Sprint 5 · Zoho CRM — RPC de UPDATE de lead con guard anti-bucle
-- ============================================================================
-- Objetivo: el procesador de pull (event-processor.ts) necesita actualizar un
-- lead ya sincronizado desde Zoho SIN que el trigger trg_lead_zoho_writeback
-- re-encole un writeback (bucle infinito). El guard se basa en
-- `app.zoho_pull_in_progress = 'true'` seteado DENTRO de la misma transacción.
--
-- supabase-js NO puede ejecutar `SET LOCAL ...` + UPDATE de forma atómica en la
-- misma transacción. Esta función plpgsql lo hace: setea el flag LOCAL (solo
-- vive dentro de su transacción) y luego actualiza los campos writeback del lead.
--
-- Whitelist de columnas: solo current_stage, status, email, telefono, pais,
-- nombre, apellido (campos que el mapping puede tocar). Cualquier otra clave del
-- JSONB se ignora — evita inyección de columnas arbitrarias vía service_role.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.zoho_pull_update_lead(
  p_lead_id   UUID,
  p_tenant_id UUID,
  p_changes   JSONB
)
RETURNS VOID AS $$
BEGIN
  -- GUARD ANTI-BUCLE: vive solo dentro de esta transacción. El trigger
  -- tr_lead_changes_to_zoho_writeback lo lee con current_setting(..., true) y
  -- hace RETURN NEW sin encolar writeback.
  PERFORM set_config('app.zoho_pull_in_progress', 'true', true);

  UPDATE public.lead SET
    current_stage = COALESCE((p_changes ->> 'current_stage')::text, current_stage),
    status        = COALESCE((p_changes ->> 'status')::text, status),
    email         = COALESCE((p_changes ->> 'email')::text, email),
    telefono      = COALESCE((p_changes ->> 'telefono')::text, telefono),
    pais          = COALESCE((p_changes ->> 'pais')::text, pais),
    nombre        = COALESCE((p_changes ->> 'nombre')::text, nombre),
    apellido      = COALESCE((p_changes ->> 'apellido')::text, apellido),
    updated_at    = NOW()
  WHERE id = p_lead_id
    AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.zoho_pull_update_lead(UUID, UUID, JSONB) IS
  'Actualiza un lead desde el pull Zoho con guard anti-bucle (SET LOCAL app.zoho_pull_in_progress=true en la misma transacción). Whitelist de columnas writeback. Llamado vía supabase.rpc() por event-processor.ts.';

-- service_role y authenticated pueden ejecutarla (RLS del lead sigue aplicando
-- para authenticated; el worker usa service_role).
GRANT EXECUTE ON FUNCTION public.zoho_pull_update_lead(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.zoho_pull_update_lead(UUID, UUID, JSONB) TO authenticated;

-- ── PostgREST cache reload ─────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
