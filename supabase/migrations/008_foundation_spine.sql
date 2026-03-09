-- PixelPort Foundation Spine
-- Created: 2026-03-08
-- Changes:
--   1. Add command_records ledger table
--   2. Add command_events audit table
--   3. Add workspace_events ingest table

-- =============================================================================
-- 1. command_records — durable control-plane command ledger
-- =============================================================================
CREATE TABLE IF NOT EXISTS command_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  requested_by_user_id TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard',

  command_type TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  target_entity_type TEXT,
  target_entity_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,

  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,

  dispatched_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_command_records_tenant ON command_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_command_records_tenant_status ON command_records(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_command_records_created ON command_records(created_at);

-- =============================================================================
-- 2. command_events — append-only command lifecycle audit
-- =============================================================================
CREATE TABLE IF NOT EXISTS command_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  command_id UUID NOT NULL REFERENCES command_records(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  status TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  message TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_events_command ON command_events(command_id);
CREATE INDEX IF NOT EXISTS idx_command_events_tenant ON command_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_command_events_occurred ON command_events(occurred_at);

-- =============================================================================
-- 3. workspace_events — additive runtime ingest surface
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  command_id UUID REFERENCES command_records(id) ON DELETE SET NULL,

  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  agent_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_events_tenant ON workspace_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspace_events_command ON workspace_events(command_id);
CREATE INDEX IF NOT EXISTS idx_workspace_events_entity ON workspace_events(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workspace_events_occurred ON workspace_events(occurred_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS trg_command_records_updated_at ON command_records;
CREATE TRIGGER trg_command_records_updated_at
  BEFORE UPDATE ON command_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY (service-role access through Vercel API)
-- =============================================================================
ALTER TABLE command_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on command_records" ON command_records;
CREATE POLICY "Service role full access on command_records"
  ON command_records FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on command_events" ON command_events;
CREATE POLICY "Service role full access on command_events"
  ON command_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on workspace_events" ON workspace_events;
CREATE POLICY "Service role full access on workspace_events"
  ON workspace_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE command_records IS 'Durable command ledger for structured dashboard and API actions.';
COMMENT ON TABLE command_events IS 'Append-only audit trail for command lifecycle changes.';
COMMENT ON TABLE workspace_events IS 'Runtime-originated additive event ingest from tenant workspaces.';

COMMENT ON COLUMN command_records.idempotency_key IS 'Tenant-scoped idempotency key to prevent duplicate command dispatch.';
COMMENT ON COLUMN workspace_events.event_id IS 'Tenant-scoped runtime event id used for ingest deduplication.';
