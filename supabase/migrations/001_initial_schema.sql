-- PixelPort Phase 0 — Initial Schema
-- Created: 2026-03-02
-- 6 tables: tenants, agents, content_items, approvals, api_keys, sessions_log

-- Ensure gen_random_uuid is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- TABLE 1: tenants
-- One row per paying customer. Central to everything.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,         -- Clerk organization ID (auth identity)
  name TEXT NOT NULL,                         -- Company name (e.g., "Acme Corp")
  slug TEXT UNIQUE NOT NULL,                  -- URL-safe identifier (e.g., "acme-corp")
  plan TEXT NOT NULL DEFAULT 'trial',         -- trial | starter | growth | enterprise
  status TEXT NOT NULL DEFAULT 'provisioning', -- provisioning | active | suspended | cancelled

  -- Infrastructure references
  droplet_id TEXT,                            -- DigitalOcean droplet ID
  droplet_ip TEXT,                            -- Droplet IP address
  gateway_token TEXT,                         -- OpenClaw gateway auth token
  litellm_team_id TEXT,                       -- LiteLLM team ID (for budget isolation)
  agentmail_inbox TEXT,                       -- AgentMail inbox address

  -- Flexible data fields
  onboarding_data JSONB DEFAULT '{}',         -- Schema-free: whatever AI onboarding produces
  settings JSONB DEFAULT '{"trial_budget_usd": 20, "report_cadence": "daily", "timezone": "America/New_York"}',

  -- Timestamps
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tenants
CREATE INDEX IF NOT EXISTS idx_tenants_clerk_org ON tenants(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- =============================================================================
-- TABLE 2: agents
-- Per-tenant agent configurations. Each tenant has 1+ agents.
-- =============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,                     -- OpenClaw agent ID (e.g., "main", "content", "growth")
  display_name TEXT NOT NULL DEFAULT 'Luna',  -- User-facing name
  role TEXT NOT NULL DEFAULT 'chief_of_staff', -- chief_of_staff | content | research
  avatar_url TEXT,                            -- Custom avatar image URL
  tone TEXT DEFAULT 'professional',           -- professional | casual | friendly | custom
  model TEXT DEFAULT 'gpt-5.2-codex',         -- Primary LLM model
  fallback_model TEXT DEFAULT 'gemini-2.5-flash', -- Fallback model
  soul_template_version TEXT,                 -- Tracks which SOUL.md version is deployed
  is_visible BOOLEAN DEFAULT TRUE,            -- Whether user sees this agent (false for sub-agents)
  settings JSONB DEFAULT '{}',                -- Agent-specific settings
  status TEXT NOT NULL DEFAULT 'provisioning', -- provisioning | active | paused | error
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each tenant can only have one agent per agent_id
  UNIQUE(tenant_id, agent_id)
);

-- Indexes for agents
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- =============================================================================
-- TABLE 3: content_items
-- Content pipeline — items created by agents for human approval.
-- =============================================================================
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Content details
  title TEXT NOT NULL,
  body TEXT,                                  -- Main content text
  content_type TEXT NOT NULL DEFAULT 'post',  -- post | article | email | image | video | thread
  platform TEXT,                              -- linkedin | x | instagram | email | blog
  media_urls TEXT[] DEFAULT '{}',             -- Array of media attachment URLs
  metadata JSONB DEFAULT '{}',                -- Platform-specific metadata

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | pending_review | approved | rejected | published | archived
  scheduled_for TIMESTAMPTZ,                  -- When to publish (null = not scheduled)
  published_at TIMESTAMPTZ,                   -- When actually published
  published_url TEXT,                         -- URL where content was published

  -- Tracking
  brief_id TEXT,                              -- Links to the content brief that spawned this
  revision_count INT DEFAULT 0,
  feedback TEXT,                              -- Human feedback on content

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for content_items
CREATE INDEX IF NOT EXISTS idx_content_tenant ON content_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_scheduled ON content_items(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- =============================================================================
-- TABLE 4: approvals
-- Inngest-powered approval queue. Human approves/rejects content.
-- =============================================================================
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,

  -- Approval state
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected | revision_requested
  decided_by TEXT,                            -- Clerk user ID who decided
  decided_at TIMESTAMPTZ,
  feedback TEXT,                              -- Reason for rejection or revision notes

  -- Inngest correlation
  inngest_event_id TEXT,                      -- For waitForEvent correlation in Inngest workflows

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for approvals
CREATE INDEX IF NOT EXISTS idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_content ON approvals(content_item_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_inngest ON approvals(inngest_event_id) WHERE inngest_event_id IS NOT NULL;

-- =============================================================================
-- TABLE 5: api_keys
-- BYO (Bring Your Own) LLM API keys for enterprise customers.
-- Keys are encrypted at rest.
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  provider TEXT NOT NULL,                     -- openai | anthropic | google
  key_alias TEXT NOT NULL,                    -- Human-friendly name (e.g., "Production OpenAI")
  encrypted_key TEXT NOT NULL,                -- Encrypted API key (application-layer encryption)
  key_hint TEXT,                              -- Last 4 chars for display (e.g., "...ab3f")
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One key per provider per tenant
  UNIQUE(tenant_id, provider)
);

-- Indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- =============================================================================
-- TABLE 6: sessions_log
-- Agent activity tracking. Each row = one meaningful agent action.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,                   -- message | task_complete | error | content_created | approval_decided
  summary TEXT,                               -- Human-readable description of what happened
  metadata JSONB DEFAULT '{}',                -- Event-specific data

  -- LLM usage tracking
  tokens_used INT DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,          -- Cost in USD (6 decimal places for precision)
  model_used TEXT,                            -- Which model was used

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sessions_log
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions_log(created_at);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_content_items_updated_at ON content_items;
CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_approvals_updated_at ON approvals;
CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON api_keys;
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- Defense-in-depth. Primary auth is Clerk JWT in application layer.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
DROP POLICY IF EXISTS "Service role full access on tenants" ON tenants;
CREATE POLICY "Service role full access on tenants"
  ON tenants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on agents" ON agents;
CREATE POLICY "Service role full access on agents"
  ON agents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on content_items" ON content_items;
CREATE POLICY "Service role full access on content_items"
  ON content_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on approvals" ON approvals;
CREATE POLICY "Service role full access on approvals"
  ON approvals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on api_keys" ON api_keys;
CREATE POLICY "Service role full access on api_keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on sessions_log" ON sessions_log;
CREATE POLICY "Service role full access on sessions_log"
  ON sessions_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS (for documentation)
-- =============================================================================
COMMENT ON TABLE tenants IS 'PixelPort customer accounts. One row per paying customer.';
COMMENT ON TABLE agents IS 'Per-tenant agent configurations. Each tenant has 1+ agents.';
COMMENT ON TABLE content_items IS 'Content pipeline items created by agents for human approval.';
COMMENT ON TABLE approvals IS 'Inngest-powered approval queue for content items.';
COMMENT ON TABLE api_keys IS 'BYO LLM API keys for enterprise customers (encrypted at rest).';
COMMENT ON TABLE sessions_log IS 'Agent activity tracking for analytics and debugging.';

COMMENT ON COLUMN tenants.onboarding_data IS 'Schema-free JSONB. Stores whatever the AI onboarding conversation produces. No hardcoded goal categories.';
COMMENT ON COLUMN tenants.settings IS 'Tenant settings including trial_budget_usd, report_cadence, timezone. Configurable per-tenant.';
COMMENT ON COLUMN agents.soul_template_version IS 'Tracks which SOUL.md template version is deployed to this agent.';
COMMENT ON COLUMN approvals.inngest_event_id IS 'Correlation ID for Inngest waitForEvent pattern in approval workflows.';
COMMENT ON COLUMN api_keys.encrypted_key IS 'Application-layer encrypted. Decrypted only in API routes, never exposed to client.';
