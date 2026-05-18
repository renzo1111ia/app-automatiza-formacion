-- ================================================================
-- CONVERSATIONS INBOX — MIGRATION
-- Adds the native messaging table for WhatsApp conversations
-- ================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    lead_id UUID REFERENCES lead(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'TEMPLATE', 'SYSTEM_LOG', 'IMAGE', 'DOCUMENT')),
    content TEXT NOT NULL,
    sent_by TEXT, -- ID or Name (`Agente IA`, `Automático`, `Asesor Humano`)
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'READ', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Performance indices for quick chat loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_lead ON chat_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id, created_at DESC);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_chat_messages" ON chat_messages;
CREATE POLICY "service_role_all_chat_messages" ON chat_messages FOR ALL USING (true);
