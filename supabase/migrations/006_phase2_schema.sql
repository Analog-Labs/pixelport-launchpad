-- PixelPort Phase 2 — Architecture Pivot Schema
-- Created: 2026-03-05
-- Changes:
--   1. Add agent_api_key to tenants (Chief → Vercel API auth)
--   2. New table: agent_tasks (all sub-agent work: content, research, analysis)
--   3. New table: vault_sections (knowledge vault — 5 sections per tenant)
--   4. New table: competitors (competitor profiles discovered by Chief)

-- =============================================================================
-- 1. Add agent_api_key to tenants
-- Per-tenant API key for Chief agent → Vercel API authentication.
-- Injected into droplet .env as PIXELPORT_API_KEY.
-- =============================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS agent_api_key TEXT UNIQUE;

COMMENT ON COLUMN tenants.agent_api_key IS 'Per-tenant API key for agent → Vercel API auth. Injected into droplet .env as PIXELPORT_API_KEY.';

-- =============================================================================
-- 2. agent_tasks — Tracks ALL sub-agent work
-- Powers: Content Pipeline, Calendar, Live Work Feed, Dashboard Home
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Agent context
  agent_role TEXT NOT NULL,                      -- e.g., "Content Writer", "Market Researcher", "Competitor Analyst"
  agent_model TEXT,                              -- LLM model used (e.g., "gpt-5.2-codex", "gpt-4o-mini")

  -- Task details
  task_type TEXT NOT NULL,                       -- draft_content | research | competitor_analysis | strategy | report
  task_description TEXT NOT NULL,                -- Human-readable description of the task
  task_input JSONB DEFAULT '{}',                 -- Input data/parameters for the task
  task_output JSONB DEFAULT '{}',                -- Output/results from the task

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | running | completed | failed | cancelled

  -- Approval workflow (for content tasks)
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_status TEXT DEFAULT 'none',           -- none | pending | approved | rejected | revision_requested
  approved_by TEXT,                              -- User ID who approved/rejected
  approved_at TIMESTAMPTZ,
  approval_feedback TEXT,                        -- Rejection reason or revision notes

  -- Scheduling (for content calendar)
  scheduled_for TIMESTAMPTZ,                     -- When content is scheduled to publish
  platform TEXT,                                 -- linkedin | x | instagram | email | blog

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant ON agent_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_status ON agent_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_approval ON agent_tasks(tenant_id, requires_approval, approval_status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_type ON agent_tasks(tenant_id, task_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_scheduled ON agent_tasks(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks(created_at);

-- =============================================================================
-- 3. vault_sections — Knowledge Vault (5 sections per tenant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS vault_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  section_key TEXT NOT NULL,                     -- company_profile | brand_voice | icp | competitors | products
  section_title TEXT NOT NULL,                   -- Human-readable title
  content TEXT DEFAULT '',                       -- Markdown content
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | populating | ready
  last_updated_by TEXT DEFAULT 'system',         -- 'agent' | 'user' | 'system' | 'scan'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One section per key per tenant
  UNIQUE(tenant_id, section_key)
);

-- Indexes for vault_sections
CREATE INDEX IF NOT EXISTS idx_vault_sections_tenant ON vault_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vault_sections_tenant_key ON vault_sections(tenant_id, section_key);

-- =============================================================================
-- 4. competitors — Competitor profiles discovered by Chief
-- =============================================================================
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  company_name TEXT NOT NULL,
  website_url TEXT,
  summary TEXT,                                  -- Brief description of the competitor
  recent_activity TEXT,                          -- Latest news/moves
  threat_level TEXT DEFAULT 'medium',            -- low | medium | high
  analysis JSONB DEFAULT '{}',                   -- Detailed analysis data (strengths, weaknesses, positioning)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for competitors
CREATE INDEX IF NOT EXISTS idx_competitors_tenant ON competitors(tenant_id);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- =============================================================================
DROP TRIGGER IF EXISTS trg_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER trg_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_vault_sections_updated_at ON vault_sections;
CREATE TRIGGER trg_vault_sections_updated_at
  BEFORE UPDATE ON vault_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_competitors_updated_at ON competitors;
CREATE TRIGGER trg_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (same pattern as existing tables)
DROP POLICY IF EXISTS "Service role full access on agent_tasks" ON agent_tasks;
CREATE POLICY "Service role full access on agent_tasks"
  ON agent_tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on vault_sections" ON vault_sections;
CREATE POLICY "Service role full access on vault_sections"
  ON vault_sections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on competitors" ON competitors;
CREATE POLICY "Service role full access on competitors"
  ON competitors FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE agent_tasks IS 'All sub-agent work: content drafts, research, analysis. Powers Content Pipeline, Calendar, Work Feed.';
COMMENT ON TABLE vault_sections IS 'Knowledge Vault — 5 sections per tenant populated by Chief agent and editable by user.';
COMMENT ON TABLE competitors IS 'Competitor profiles discovered by Chief research sub-agents.';

COMMENT ON COLUMN agent_tasks.agent_role IS 'Role of the sub-agent that performed this task (e.g., Content Writer, Market Researcher).';
COMMENT ON COLUMN agent_tasks.task_type IS 'Task category: draft_content, research, competitor_analysis, strategy, report.';
COMMENT ON COLUMN agent_tasks.approval_status IS 'Content approval state: none (no approval needed), pending, approved, rejected, revision_requested.';
COMMENT ON COLUMN vault_sections.section_key IS 'One of: company_profile, brand_voice, icp, competitors, products.';
COMMENT ON COLUMN vault_sections.status IS 'Population state: pending (empty), populating (agent working), ready (content available).';
COMMENT ON COLUMN competitors.threat_level IS 'Competitive threat assessment: low, medium, high.';
