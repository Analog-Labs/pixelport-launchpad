# Codex Slice 1 — LiteLLM on Railway

**Priority:** 🔴 Immediate — Zero blockers
**Assigned to:** Codex
**Depends on:** Nothing (can start now)
**Estimated time:** 1-2 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes. The agent handles marketing tasks: content creation, competitor monitoring, social posting, and reporting.

**Where does LiteLLM fit?** LiteLLM is the central LLM gateway. Every AI model call from every customer's agent routes through this single LiteLLM instance. It provides:
- **Per-tenant budget caps** — each customer has a spending limit (e.g., $20 for trial users)
- **Multi-provider routing** — switch between OpenAI, Google, Anthropic without changing agent code
- **Usage metering** — track how much each customer spends on AI calls
- **BYO key support** — enterprise customers can bring their own API keys

**How this connects to other slices:**
- Slice 2 (Supabase Schema) stores tenant records including `litellm_team_id`
- Slice 3 (API Bridge) creates endpoints that manage LiteLLM teams/keys
- Slice 4 (Provisioning) injects the LiteLLM URL + key into each customer's agent

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md`
- Go Package (founder-approved plan): `docs/phase0/cto-phase0-go-package.md`
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

Deploy a LiteLLM proxy instance on Railway that:
1. Routes AI model calls to multiple providers (OpenAI, Google, Anthropic)
2. Supports per-tenant budget isolation via LiteLLM Teams API
3. Passes health checks
4. Is configured for PixelPort's specific model lineup

---

## Deliverables

### File 1: `infra/litellm/config.yaml`

Create the LiteLLM configuration file:

```yaml
# LiteLLM Proxy Configuration for PixelPort
# Deployed on Railway — routes all tenant AI calls through this gateway

model_list:
  # Primary model (what customer agents run by default)
  - model_name: gpt-5.2-codex
    litellm_params:
      model: openai/gpt-5.2-codex
      api_key: os.environ/OPENAI_API_KEY

  # Fallback model (if primary is down or rate-limited)
  - model_name: gemini-2.5-flash
    litellm_params:
      model: google/gemini-2.5-flash
      api_key: os.environ/GEMINI_API_KEY

  # Budget-friendly option (for sub-agents and trial users)
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  # Anthropic option (for BYO key customers)
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  # Enable detailed spend tracking per team/key
  max_budget: 1000  # Global safety cap (USD)
  budget_duration: "30d"

general_settings:
  # Master key for admin operations (creating teams, keys, etc.)
  master_key: os.environ/LITELLM_MASTER_KEY

  # Database for tracking spend, teams, keys
  database_url: os.environ/LITELLM_DATABASE_URL

  # Enable the admin UI
  ui_access_token: os.environ/LITELLM_UI_TOKEN
```

### File 2: `infra/litellm/railway.toml`

Railway deployment configuration:

```toml
[build]
# Use the official LiteLLM Docker image
dockerfilePath = "infra/litellm/Dockerfile"

[deploy]
# Health check endpoint
healthcheckPath = "/health"
healthcheckTimeout = 30

# Railway will set PORT automatically
# LiteLLM listens on port 4000 by default
```

### File 3: `infra/litellm/Dockerfile`

```dockerfile
# Pin explicit version — never use :latest
FROM ghcr.io/berriai/litellm:main-v1.63.2

# Copy our config
COPY config.yaml /app/config.yaml

# LiteLLM default port
EXPOSE 4000

# Start LiteLLM proxy with our config
CMD ["--config", "/app/config.yaml", "--port", "4000"]
```

**Important:** The version tag `main-v1.63.2` is a starting point. Before deploying, check the latest stable release at https://github.com/BerryAI/litellm/releases and use the most recent stable tag. Never use `:latest`.

### File 4: `infra/litellm/.env.example`

Document required environment variables (DO NOT include actual values):

```bash
# LiteLLM Environment Variables
# Copy this to .env and fill in real values
# NEVER commit .env to git

# Admin key for LiteLLM management API
LITELLM_MASTER_KEY=sk-your-master-key-here

# LiteLLM needs a database to track spend and teams
# Railway provides a Postgres add-on, use that connection string
LITELLM_DATABASE_URL=postgresql://user:pass@host:5432/litellm

# UI access (optional, for admin dashboard)
LITELLM_UI_TOKEN=your-ui-token-here

# === LLM Provider API Keys ===

# OpenAI (for gpt-5.2-codex and gpt-4o-mini)
OPENAI_API_KEY=sk-your-openai-key

# Google (for gemini-2.5-flash fallback)
GEMINI_API_KEY=your-gemini-key

# Anthropic (for claude-sonnet BYO key support)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

---

## Deployment Steps (Railway)

1. **Create Railway project:**
   - Go to https://railway.app
   - Create new project → "Deploy from GitHub repo" or "Empty project"
   - If using GitHub: connect the `Analog-Labs/pixelport-launchpad` repo and set the root directory to `infra/litellm/`
   - If empty project: use the Dockerfile deployment

2. **Add a Postgres database:**
   - In Railway dashboard: New → Database → PostgreSQL
   - Copy the `DATABASE_URL` from the database service
   - Set it as `LITELLM_DATABASE_URL` in the LiteLLM service environment

3. **Set environment variables:**
   - `LITELLM_MASTER_KEY` — generate a secure random key (e.g., `sk-pixelport-$(openssl rand -hex 16)`)
   - `LITELLM_DATABASE_URL` — from the Postgres add-on
   - `OPENAI_API_KEY` — from OpenAI dashboard
   - `GEMINI_API_KEY` — from Google AI Studio
   - `ANTHROPIC_API_KEY` — from Anthropic Console
   - `LITELLM_UI_TOKEN` — generate a secure random token

4. **Deploy and verify:**
   - Railway auto-deploys on push
   - Check deployment logs for successful startup
   - Health check: `GET /health` should return 200

---

## Verification Checklist

After deployment, verify ALL of these:

### 1. Health Check
```bash
LITELLM_URL="https://your-railway-url.railway.app"
curl -s "$LITELLM_URL/health" | jq .
# Expected: {"status": "healthy", ...}
```

### 2. Create a Test Team (simulates a PixelPort tenant)
```bash
curl -s -X POST "$LITELLM_URL/team/new" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "team_alias": "test-tenant-001",
    "max_budget": 20,
    "budget_duration": "30d",
    "models": ["gpt-5.2-codex", "gemini-2.5-flash", "gpt-4o-mini"]
  }' | jq .
# Expected: team_id returned
```

### 3. Generate a Virtual Key for the Team
```bash
curl -s -X POST "$LITELLM_URL/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "<team_id_from_above>",
    "key_alias": "test-key-001"
  }' | jq .
# Expected: API key returned (starts with sk-)
```

### 4. Route a Test Completion
```bash
curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer <virtual_key_from_above>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in exactly 3 words"}],
    "max_tokens": 20
  }' | jq .
# Expected: valid completion response
# Note: Use gpt-4o-mini for test to minimize cost
```

### 5. Verify Budget Metering
```bash
curl -s "$LITELLM_URL/team/info" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -G -d "team_id=<team_id_from_above>" | jq '.spend'
# Expected: non-zero spend amount reflecting the test completion
```

### 6. Cleanup
```bash
# Delete test key
curl -s -X POST "$LITELLM_URL/key/delete" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keys": ["<virtual_key_from_above>"]}'

# Delete test team
curl -s -X POST "$LITELLM_URL/team/delete" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"team_ids": ["<team_id_from_above>"]}'
```

---

## Success Criteria

All of these must be true:
- [ ] `infra/litellm/config.yaml` committed to repo with 4 models configured
- [ ] `infra/litellm/railway.toml` committed to repo
- [ ] `infra/litellm/Dockerfile` committed to repo with pinned version tag
- [ ] `infra/litellm/.env.example` committed to repo (no real secrets)
- [ ] LiteLLM deployed to Railway and accessible via HTTPS
- [ ] `GET /health` returns 200
- [ ] Can create team with budget cap
- [ ] Can generate virtual key scoped to team
- [ ] Can route a completion through virtual key
- [ ] Budget metering shows spend after test completion
- [ ] Test team and key cleaned up

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add a new "Last Session" entry:
   - Date, who worked (Codex), what was done (be specific: include Railway URL, health check result, test outcomes)
   - What's next (Slice 2 awaiting Supabase credentials)
   - Any blockers or observations

2. **Update `docs/ACTIVE-PLAN.md`** — check off:
   - `[x] 0.6: LiteLLM deployed to Railway, health check passes`

3. **Feedback for CTO** — In your SESSION-LOG entry, include a section called "Feedback & Observations" with:
   - Any issues you encountered during deployment
   - Suggestions for improvement
   - Anything that surprised you or seems worth discussing
   - Questions about the broader architecture if any came up

4. **Commit and push** all changes to the monorepo.

5. **Report back to CTO** with:
   - Railway deployment URL
   - Health check status
   - Test results (team creation, key generation, completion routing, budget metering)
   - Any concerns or recommendations

---

## Rollback Plan

If deployment fails:
1. Check Railway logs for error messages
2. Verify all environment variables are set correctly
3. Check if the LiteLLM Docker image tag exists
4. Try a known-good older version tag
5. If Railway has issues, document the error and report to CTO — we can try Render as an alternative

---

## Important Reminders

- **Never commit secrets** (.env files, API keys, tokens) to git
- **Always pin Docker image versions** — never use `:latest`
- **Railway Hobby plan** (~$5-7/mo) is sufficient for our initial load
- The LiteLLM instance is shared across ALL PixelPort tenants — isolation is via Teams API, not separate instances
- This is the foundation that all other slices depend on — take care to verify thoroughly
