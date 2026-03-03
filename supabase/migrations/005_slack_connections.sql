-- Slice 7: Slack OAuth connection storage

CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT,
  bot_token TEXT NOT NULL,
  bot_user_id TEXT,
  installer_user_id TEXT,
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_connections_tenant
  ON slack_connections(tenant_id);

CREATE INDEX IF NOT EXISTS idx_slack_connections_team
  ON slack_connections(team_id);

ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on slack_connections" ON slack_connections;
CREATE POLICY "Service role full access on slack_connections"
  ON slack_connections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_slack_connections_updated_at ON slack_connections;
CREATE TRIGGER trg_slack_connections_updated_at
  BEFORE UPDATE ON slack_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE slack_connections IS 'Slack workspace OAuth connections. One workspace per tenant.';
