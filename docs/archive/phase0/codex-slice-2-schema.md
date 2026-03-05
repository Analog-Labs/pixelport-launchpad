# Codex Slice 2 — Supabase Schema

**Status:** ✅ COMPLETED (2026-03-02)
**Assigned to:** Codex

> **POST-DEPLOYMENT UPDATE (2026-03-03):** Auth provider changed from Clerk to Supabase Auth. Migration 002 (`supabase/migrations/002_clerk_to_supabase_auth.sql`) renames `clerk_org_id` to `supabase_user_id` (UUID type). All `clerk_org_id` references in this doc reflect the original schema — see migration 002 for the current column name.

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes. The agent handles marketing tasks: content creation, competitor monitoring, social posting, and reporting.

**Where does the database fit?** Supabase (PostgreSQL) is the central data store for the PixelPort web application. It stores:
- **Tenant records** — each paying customer, their plan, status, and configuration
- **Agent configurations** — per-tenant agent settings (name, avatar, tone, model)
- **Content pipeline** — content items created by agents, with approval workflows
- **API keys** — BYO (Bring Your Own) LLM keys for enterprise customers
- **Session logs** — agent activity tracking for analytics

**How this connects to other slices:**
- Slice 1 (LiteLLM) is the LLM gateway — tenant records store the `litellm_team_id`
- Slice 3 (API Bridge) creates endpoints that read/write these tables
- Slice 4 (Provisioning) uses the `tenants` table to track provisioning status

**Key Go Package adjustments:**
- Trial budget is configurable per-tenant via `tenants.settings` JSONB (`{"trial_budget_usd": 20}`)
- Onboarding data is schema-free JSONB — no hardcoded goal categories
- `onboarding_data` stores whatever the AI onboarding conversation produces

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md`
- Go Package: `docs/phase0/cto-phase0-go-package.md`
- Project coordination: `docs/project-coordination-system.md`

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Clone:** `git clone https://github.com/Analog-Labs/pixelport-launchpad.git`
- All work happens in this monorepo — no other repos needed
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## What You're Building

Create a single SQL migration file that sets up all 6 tables needed for PixelPort Phase 0, with proper indexes, foreign keys, Row-Level Security (RLS), and default values.

---

## Deliverable

### File: `supabase/migrations/001_initial_schema.sql`

```sql
-- PixelPort Phase 0 — Initial Schema
-- Created: 2026-03-XX
-- 6 tables: tenants, agents, content_items, approvals, api_keys, sessions_log

-- =============================================================================
-- TABLE 1: tenants
-- One row per paying customer. Central to everything.
-- =============================================================================
CREATE TABLE tenants (
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
CREATE INDEX idx_tenants_clerk_org ON tenants(clerk_org_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_plan ON tenants(plan);

-- =============================================================================
-- TABLE 2: agents
-- Per-tenant agent configurations. Each tenant has 1+ agents.
-- =============================================================================
CREATE TABLE agents (
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
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_status ON agents(status);

-- =============================================================================
-- TABLE 3: content_items
-- Content pipeline — items created by agents for human approval.
-- =============================================================================
CREATE TABLE content_items (
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
CREATE INDEX idx_content_tenant ON content_items(tenant_id);
CREATE INDEX idx_content_status ON content_items(status);
CREATE INDEX idx_content_type ON content_items(content_type);
CREATE INDEX idx_content_scheduled ON content_items(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- =============================================================================
-- TABLE 4: approvals
-- Inngest-powered approval queue. Human approves/rejects content.
-- =============================================================================
CREATE TABLE approvals (
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
CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_content ON approvals(content_item_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_inngest ON approvals(inngest_event_id) WHERE inngest_event_id IS NOT NULL;

-- =============================================================================
-- TABLE 5: api_keys
-- BYO (Bring Your Own) LLM API keys for enterprise customers.
-- Keys are encrypted at rest.
-- =============================================================================
CREATE TABLE api_keys (
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
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);

-- =============================================================================
-- TABLE 6: sessions_log
-- Agent activity tracking. Each row = one meaningful agent action.
-- =============================================================================
CREATE TABLE sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,                   -- message | task_complete | error | content_created | approval_decided
  summary TEXT,                               -- Human-readable description of what happened
  metadata JSONB DEFAULT '{}',                -- Event-specific data

  -- LLM usage tracking
  tokens_used INT DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,         -- Cost in USD (6 decimal places for precision)
  model_used TEXT,                            -- Which model was used

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sessions_log
CREATE INDEX idx_sessions_tenant ON sessions_log(tenant_id);
CREATE INDEX idx_sessions_type ON sessions_log(event_type);
CREATE INDEX idx_sessions_created ON sessions_log(created_at);

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

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- Defense-in-depth. Primary auth is Clerk JWT in application layer.
-- RLS ensures database-level isolation even if application layer is bypassed.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service_role key)
-- These policies allow the service role full access while enabling RLS for other roles

-- Tenants: service role has full access
CREATE POLICY "Service role full access on tenants"
  ON tenants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Agents: service role has full access
CREATE POLICY "Service role full access on agents"
  ON agents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Content items: service role has full access
CREATE POLICY "Service role full access on content_items"
  ON content_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Approvals: service role has full access
CREATE POLICY "Service role full access on approvals"
  ON approvals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- API keys: service role has full access
CREATE POLICY "Service role full access on api_keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Sessions log: service role has full access
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
```

---

## How to Run the Migration

### Option A: Supabase CLI (preferred)
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project (founder will provide project ref)
supabase link --project-ref <project-ref>

# Run the migration
supabase db push
```

### Option B: Direct SQL (if CLI not available)
1. Go to Supabase Dashboard → SQL Editor
2. Paste the entire migration file
3. Run it

### Option C: Supabase Migration System
```bash
# Create migration (already done — file exists at supabase/migrations/001_initial_schema.sql)
# Push to remote
supabase db push
```

---

## Verification Checklist

After running the migration, verify ALL of these:

### 1. All Tables Exist
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: agents, api_keys, approvals, content_items, sessions_log, tenants
```

### 2. Foreign Key Constraints Work
```sql
-- This should FAIL (no matching tenant)
INSERT INTO agents (tenant_id, agent_id, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'Test');
-- Expected: ERROR foreign key violation
```

### 3. Unique Constraints Work
```sql
-- Insert a test tenant
INSERT INTO tenants (clerk_org_id, name, slug)
VALUES ('org_test123', 'Test Corp', 'test-corp');

-- This should FAIL (duplicate clerk_org_id)
INSERT INTO tenants (clerk_org_id, name, slug)
VALUES ('org_test123', 'Test Corp 2', 'test-corp-2');
-- Expected: ERROR unique violation
```

### 4. Default Settings Include trial_budget_usd
```sql
SELECT settings FROM tenants WHERE slug = 'test-corp';
-- Expected: {"trial_budget_usd": 20, "report_cadence": "daily", "timezone": "America/New_York"}
```

### 5. Onboarding Data is Flexible JSONB
```sql
UPDATE tenants SET onboarding_data = '{
  "company_url": "https://example.com",
  "goals": [{"goal": "Increase engagement", "priority": "high"}],
  "anything_else": "totally free-form"
}' WHERE slug = 'test-corp';

SELECT onboarding_data FROM tenants WHERE slug = 'test-corp';
-- Expected: the exact JSON we just inserted (no schema enforcement)
```

### 6. RLS is Enabled
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'tenants', 'agents', 'content_items', 'approvals', 'api_keys', 'sessions_log'
);
-- Expected: all rows show rowsecurity = true
```

### 7. Indexes Exist
```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;
-- Expected: all idx_* indexes listed
```

### 8. Cleanup Test Data
```sql
DELETE FROM tenants WHERE slug = 'test-corp';
```

---

## Success Criteria

All of these must be true:
- [ ] `supabase/migrations/001_initial_schema.sql` committed to repo
- [ ] Migration runs without errors on the Supabase project
- [ ] All 6 tables exist: tenants, agents, content_items, approvals, api_keys, sessions_log
- [ ] Foreign key constraints work (agent → tenant, content → tenant, etc.)
- [ ] Unique constraints work (clerk_org_id, slug, tenant+agent_id, tenant+provider)
- [ ] Default settings JSONB includes `trial_budget_usd: 20`
- [ ] `onboarding_data` accepts arbitrary JSONB (no schema enforcement)
- [ ] RLS enabled on all 6 tables
- [ ] Service role policies created for all tables
- [ ] `updated_at` triggers work on all tables with `updated_at` column
- [ ] All indexes created
- [ ] Test data cleaned up

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add a new "Last Session" entry:
   - Date, who worked (Codex), what was done (be specific: migration ran, all 6 tables created, verification passed)
   - What's next (Slice 3: API Bridge)
   - Any blockers or observations

2. **Update `docs/ACTIVE-PLAN.md`** — check off:
   - `[x] 0.8: Supabase schema migrated (6 tables + indexes + RLS)`

3. **Feedback for CTO** — In your SESSION-LOG entry, include a "Feedback & Observations" section:
   - Any issues with the migration
   - Suggestions for schema improvements
   - Anything that surprised you or seems worth discussing
   - Questions about the broader architecture

4. **Commit and push** all changes to the monorepo.

---

## Rollback Plan

If migration fails:
1. Check the SQL Editor error message
2. If partial: drop all created tables and re-run
```sql
DROP TABLE IF EXISTS sessions_log, api_keys, approvals, content_items, agents, tenants CASCADE;
```
3. Fix the issue in the migration file and re-run

---

## Important Reminders

- **Supabase credentials are secrets** — never commit them to git
- The migration file DOES go in git (it's schema, not data)
- RLS is defense-in-depth — primary auth is Clerk JWT verification in the API layer
- `onboarding_data` is intentionally schema-free — Luna (the AI) dynamically generates fields during onboarding
- `settings.trial_budget_usd` must be configurable — it's read during LiteLLM team creation (Slice 4)
