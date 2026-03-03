-- Slice 6: Chat streaming persistence
-- Adds chat sessions + chat message history tables.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT,
  agent_id TEXT NOT NULL DEFAULT 'main',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_last_message
  ON chat_sessions(tenant_id, last_message_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on chat_sessions" ON chat_sessions;
CREATE POLICY "Service role full access on chat_sessions"
  ON chat_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  agent_id TEXT NOT NULL DEFAULT 'main',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_session_created
  ON chat_messages(tenant_id, session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_recent
  ON chat_messages(tenant_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on chat_messages" ON chat_messages;
CREATE POLICY "Service role full access on chat_messages"
  ON chat_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE chat_sessions IS 'Chat sessions that group conversations per tenant and agent.';
COMMENT ON TABLE chat_messages IS 'Persisted user and assistant chat messages per tenant session.';
