-- Sprint 2 Phase 06: seed sección "integrations" en help_sections.
-- Idempotente (UPSERT por key).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'help_sections'
  ) THEN
    RAISE NOTICE 'help_sections table missing — skipping seed';
    RETURN;
  END IF;

  INSERT INTO public.help_sections (slug, title, content_md, audience, updated_at)
  VALUES (
    'integrations',
    'Integraciones CRM',
    E'## Conectar HubSpot o Zoho\n\n1. Ir a **Ajustes → Integraciones → CRM**.\n2. Click **Conectar** en el provider que prefieras.\n3. Aprobar la app en el portal del CRM (full-page redirect).\n4. Volverás al dashboard con la card en estado **Conectado**.\n\n## Política de escritura\n\n- **append_only** (default): el dashboard SOLO escribe campos vacíos en el CRM. Datos manuales del rep comercial nunca se pisan.\n- **overwrite_with_audit**: permite sobrescribir SOLO los campos listados, con audit trail completo. Útil para corregir typos en email/teléfono masivamente.\n\n## Solo 1 CRM activo por tenant\n\nDesconecta el actual antes de conectar otro. El historial de audit se preserva aunque desconectes.\n\n## ¿Algo falla?\n\n- Click **Test connection** en la card para ver si el CRM responde.\n- Si ves estado "Error", revisa logs del servidor (Easypanel) y reconecta.\n',
    'admin',
    NOW()
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    content_md = EXCLUDED.content_md,
    audience = EXCLUDED.audience,
    updated_at = NOW();
END $$;

NOTIFY pgrst, 'reload schema';
