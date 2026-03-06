-- Migration: 007_integrations_framework.sql
-- Purpose: Generic integrations table for all OAuth + API key connections
-- Part of Phase 3: Integration Framework

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Service identity
  service TEXT NOT NULL,                    -- 'x' | 'linkedin' | 'posthog' | 'ga4' | 'hubspot' | ...
  auth_type TEXT NOT NULL DEFAULT 'oauth',  -- 'oauth' | 'api_key'

  -- Account info (from OAuth response or user input)
  account_id TEXT,                          -- Platform user/org ID
  account_name TEXT,                        -- Display name (e.g., "@vidacious", "Acme Corp Page")

  -- Encrypted credentials (AES-256-CBC, format: ivHex:encryptedHex)
  access_token TEXT,                        -- Encrypted OAuth access token (or encrypted API key for api_key auth)
  refresh_token TEXT,                       -- Encrypted OAuth refresh token (null for api_key)
  token_expires_at TIMESTAMPTZ,             -- When access_token expires (null = never)

  -- OAuth metadata
  scopes TEXT[] DEFAULT '{}',               -- Granted scopes

  -- Service-specific metadata (e.g., PostHog project_id, GA4 property_id)
  metadata JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false, -- True after full activation
  status TEXT NOT NULL DEFAULT 'connected', -- connected | active | expired | revoked | error
  error_message TEXT,                       -- Last error (for status='error')
  last_used_at TIMESTAMPTZ,                -- Last time agent used this integration

  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One connection per service per tenant
  UNIQUE(tenant_id, service)
);

-- Index for agent lookups (by tenant_id from agent_api_key → tenants → integrations)
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_service ON integrations(tenant_id, service);

-- Row Level Security (same pattern as slack_connections)
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on integrations" ON integrations;
CREATE POLICY "Service role full access on integrations"
  ON integrations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at trigger (reuses existing update_updated_at function)
DROP TRIGGER IF EXISTS trg_integrations_updated_at ON integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Check constraints for enum-like columns
ALTER TABLE integrations ADD CONSTRAINT chk_integrations_auth_type
  CHECK (auth_type IN ('oauth', 'api_key'));
ALTER TABLE integrations ADD CONSTRAINT chk_integrations_status
  CHECK (status IN ('connected', 'active', 'expired', 'revoked', 'error'));

COMMENT ON TABLE integrations IS 'Generic integration connections (OAuth + API key). One connection per service per tenant.';
