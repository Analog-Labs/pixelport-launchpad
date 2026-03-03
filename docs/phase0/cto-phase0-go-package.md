# CTO Phase 0 — Go Package

**Date:** 2026-03-02
**From:** Founder (Sanchal)
**To:** CTO (Claude Code) + Codex
**Status:** ✅ APPROVED — Phase 0 plan approved with adjustments below. Execute immediately.

---

## 1. Your Phase 0 Plan Is Approved

I've reviewed the full Phase 0 execution plan (Supabase schema, API contracts, LiteLLM config, 4 Codex slices). The plan is solid. Proceed with the adjustments listed in Section 3.

---

## 2. Shared Resources — Live Now

### Repository Access

| Resource | Status |
|----------|--------|
| **Lovable project** | ✅ Created — "PixelPort Launchpad" |
| **GitHub repo** | ✅ Live — CTO has read/write access |
| **Vercel** | ✅ Connected — deploying from repo |
| **Supabase** | ✅ Provisioned via Lovable Cloud |

### Supabase Credentials (CTO: Fill These From Founder DM)

> **IMPORTANT:** Founder will send these via secure DM. Do NOT store in repo or commit to git.

```
SUPABASE_PROJECT_URL=<founder will provide>
SUPABASE_SERVICE_ROLE_KEY=<founder will provide>
SUPABASE_DB_CONNECTION_STRING=<founder will provide>
```

**Where to find these (for founder reference):**
- Project URL → Supabase Dashboard → Settings → API → Project URL
- Service role key → Supabase Dashboard → Settings → API → `service_role` (secret key)
- DB connection string → Supabase Dashboard → Settings → Database → Connection string → URI tab

---

## 3. Adjustments to Phase 0 Plan

### Adjustment 1: LiteLLM Model List — Update to Current Models

The config.yaml in your plan references `gpt-4o` and `claude-sonnet`. Update to match our actual production models:

```yaml
model_list:
  # Primary model (what Growth Swarm runs)
  - model_name: gpt-5.2-codex
    litellm_params:
      model: openai/gpt-5.2-codex
      api_key: os.environ/OPENAI_API_KEY

  # Fallback model
  - model_name: gemini-2.5-flash
    litellm_params:
      model: google/gemini-2.5-flash
      api_key: os.environ/GEMINI_API_KEY

  # Budget-friendly option for sub-agents / trial users
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  # Anthropic option (for BYO key customers)
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
```

Keep `gpt-4o-mini` as a budget fallback option and `claude-sonnet` for BYO key customers. But the default tenant config should route to `gpt-5.2-codex` primary with `gemini-2.5-flash` fallback.

### Adjustment 2: Trial Budget — Make Configurable

The $20 trial cap is confirmed as the starting default, but make it configurable per-tenant:

- Store budget cap in the `tenants.settings` JSONB field (e.g., `settings.trial_budget_usd`)
- Default: `20` (USD) for 14-day trial
- When creating the LiteLLM team, read from tenant settings, don't hardcode
- This way we can adjust per-tenant later without code changes

```sql
-- Example settings JSONB structure
{
  "trial_budget_usd": 20,
  "report_cadence": "daily",
  "timezone": "America/New_York"
}
```

### Adjustment 3: Provisioning — Prefer cloud-init Over SSH

For Slice 4 (provisioning script), prefer DO API + cloud-init for initial droplet setup rather than SSH post-boot:

- Use cloud-init user-data script to:
  - Install Docker
  - Pull OpenClaw image (pinned version tag)
  - Create directory structure (`/opt/openclaw/workspace-*`)
  - Write `openclaw.json` from template
  - Write `SOUL.md` from parameterized template
  - Write `.env` with LiteLLM URL + key + AgentMail key
  - Start OpenClaw container
- Only use SSH as a fallback verification step (health check)
- Reason: Our Growth Swarm experience showed SSH can be finicky from containers

### Adjustment 4: Onboarding Data — Flexible JSONB, No Hardcoded Goals

The `onboarding_data` JSONB field should be schema-free:

- Do NOT hardcode goal categories (no enums for goals)
- Luna (the Chief of Staff agent) will dynamically suggest goals based on the website scan
- The onboarding chat stores whatever key-value pairs the conversation produces
- Frontend just sends the raw onboarding conversation data to the API
- Example structure (but not enforced):

```json
{
  "company_url": "https://example.com",
  "company_name": "Example Corp",
  "scan_results": {
    "detected_industry": "SaaS",
    "detected_competitors": ["CompA", "CompB"],
    "detected_social": {"linkedin": "...", "x": "..."}
  },
  "goals": [
    {"goal": "Increase LinkedIn engagement", "priority": "high"},
    {"goal": "Weekly competitor monitoring", "priority": "medium"}
  ],
  "brand_voice_notes": "Professional but approachable",
  "agent_name": "Luna",
  "agent_tone": "casual"
}
```

The point: the schema is whatever the AI onboarding conversation produces. Don't constrain it.

### Adjustment 5: No Changes Needed

Everything else in your plan is approved as-is:
- ✅ Schema design (6 tables + indexes + RLS)
- ✅ API contract routes
- ✅ Inngest 12-step provisioning workflow
- ✅ 4-slice Codex breakdown and dependency ordering
- ✅ Monorepo structure (Lovable frontend + `api/` directory)
- ✅ Verification gate (0.9 dry-run)

---

## 4. Execution Order — Confirmed

```
IMMEDIATE (no blockers):
└── Codex Slice 1: LiteLLM on Railway → deploy + verify health

AFTER FOUNDER SENDS SUPABASE CREDENTIALS:
├── Codex Slice 2: Supabase migrations (all 6 tables + indexes + RLS)
├── Codex Slice 3: API bridge (api/ directory + auth middleware + routes)
└── Codex Slice 4: Provisioning script + Inngest workflow

FINAL:
└── 0.9 Dry-run gate (test tenant end-to-end)
```

### CTO Action Items

| # | Action | Blocker | Priority |
|---|--------|---------|----------|
| 1 | Send Codex Slice 1 (LiteLLM) to Codex immediately | None | 🔴 Now |
| 2 | Finalize Codex Slices 2-4 with adjustments above | None (writing only) | 🔴 Now |
| 3 | Wait for Supabase credentials from founder | Founder DM | 🟡 Today |
| 4 | Send Codex Slices 2-4 to Codex once credentials received | Slice 1 + credentials | 🟡 This week |
| 5 | Run 0.9 dry-run gate | All slices complete | 🟢 End of week |

---

## 5. Coordination Protocol

### What Founder Is Building in Parallel (Lovable)

While CTO/Codex build backend:
- Landing page (no backend dependency)
- Supabase Auth flow (signup → login → dashboard redirect) — CHANGED from Clerk
- Dashboard shell (sidebar nav, empty states, placeholder cards)

### How We Stay in Sync

1. **Schema**: Approved as proposed (with adjustments above). CTO runs migrations. If schema needs changes later, CTO proposes → founder reviews → CTO executes.

2. **API contracts**: CTO documents final API contracts after implementing. Share the doc so founder can build Lovable pages against them.

3. **Repo**: CTO pushes all backend code to `api/` directory in the shared repo. Don't touch Lovable-generated frontend files outside `api/`.

4. **Environment variables**: CTO documents which env vars Vercel needs (Supabase keys, LiteLLM URL, etc.). Founder configures in Vercel dashboard.

5. **Status updates**: After each Codex slice completes, update `docs/pixelport-project-status.md` with completion status.

---

## 6. Responses to CTO Q&A (2026-02-28)

For the record, confirming all 9 CTO Q&A decisions are locked:

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| Q1 | Inngest hosting | Inngest Cloud free tier | No self-hosting |
| Q2 | LiteLLM deployment | Railway or Render (~$5-10/mo) | CTO picks, prefer Railway |
| Q3 | Supabase schema ownership | CTO proposes → founder reviews → CTO executes | Schema approved with adjustments above |
| Q4 | API structure | Vercel API routes in monorepo (`api/` directory) | Confirmed |
| Q5 | OpenClaw version for new tenants | CTO picks latest stable at launch | Not pinned to 2026.2.24 |
| Q6 | Repo structure | Monorepo (Lovable frontend + `api/` backend) | Confirmed — repo is live |
| Q7 | Mem0 pricing | Start with free tier | Founder will upgrade if needed, not a CTO concern |
| Q8 | Trial LLM budget | $20 per trial user via LiteLLM | Make configurable (see Adjustment 2) |
| Q9 | Decision log count | Skip | Not important |

---

## 7. Files CTO Should Create

### In the shared GitHub repo:

```
api/
  lib/
    auth.ts              ← Supabase Auth JWT verification + tenant resolution
    supabase.ts          ← Supabase client (service role)
    gateway.ts           ← OpenClaw gateway proxy helper
  tenants/
    me.ts                ← GET /api/tenants/me
    onboarding.ts        ← POST /api/tenants/me/onboarding
    status.ts            ← GET /api/tenants/me/status
  agents/
    index.ts             ← GET /api/agents
    [id].ts              ← GET/PATCH /api/agents/:id
  content/
    index.ts             ← GET /api/content
    [id].ts              ← GET/PATCH + approve/reject/revision
  approvals/
    index.ts             ← GET /api/approvals
    [id]/decide.ts       ← POST /api/approvals/:id/decide
  chat.ts                ← POST /api/chat (gateway proxy)
  settings/
    index.ts             ← GET/PATCH /api/settings
    api-keys.ts          ← CRUD for BYO LLM keys
    budget.ts            ← GET/PATCH budget
  inngest/
    client.ts            ← Inngest client setup
    functions/
      provision-tenant.ts ← 12-step provisioning workflow

infra/
  litellm/
    config.yaml          ← LiteLLM proxy config (updated models)
    railway.toml         ← Railway deployment config
  provisioning/
    cloud-init.yaml      ← DO Droplet bootstrap template
    openclaw-template.json ← Per-tenant OpenClaw config template
    soul-template.md     ← Parameterized SOUL.md (from master plan Appendix B)

supabase/
  migrations/
    001_initial_schema.sql ← All tables, indexes, RLS
```

### In the growth-swarm/docs repo (Codex instructions):

```
docs/
  cto-instructions-phase0-litellm.md       ← Codex Slice 1
  cto-instructions-phase0-schema.md        ← Codex Slice 2
  cto-instructions-phase0-api-bridge.md    ← Codex Slice 3
  cto-instructions-phase0-provisioning.md  ← Codex Slice 4
```

---

## 8. Verification Gate (0.9)

Phase 0 is complete when ALL of these pass:

| Check | Criteria |
|-------|----------|
| LiteLLM | `GET /health` returns 200; create team, generate key, route test completion, verify metering |
| Supabase | All 6 tables exist, constraints work, can insert/query test data |
| API Bridge | Each endpoint responds with valid data, Supabase Auth works |
| Provisioning | Inngest workflow: droplet boots → OpenClaw starts → gateway responds → agent sends test message → LiteLLM routes call → budget deducts → AgentMail inbox works → marked active |
| Cleanup | Test droplet destroyed, test data removed |

**Gate passes when all 5 checks succeed.** Report results to founder.

---

## 9. What NOT to Do

- ❌ Do NOT touch Lovable-generated frontend files (components, pages, styles)
- ❌ Do NOT deploy to the custom domain (pixelport.ai) — we'll attach that later
- ❌ Do NOT build Mem0 integration yet (Phase 1)
- ❌ Do NOT build PostHog setup yet (Phase 1)
- ❌ Do NOT build Slack OAuth flow yet (Phase 1)
- ⚠️ Growth Swarm droplet is in maintenance mode — but CAN be modified if needed for validation or testing PixelPort patterns. Log any changes in SESSION-LOG.md.
- ❌ Do NOT use `:latest` Docker tags — always pin explicit version

---

## 10. Why We Use Both Railway AND Vercel

This came up as a question — clarifying for the record:

**Vercel** hosts the web application — the Lovable frontend pages AND the API routes (serverless functions that run when someone hits `/api/agents`, `/api/content`, etc.). Think of it as "where our website lives." Already connected.

**Railway** hosts LiteLLM — a Docker container that runs 24/7 as a persistent process. It's the gateway that all AI model calls route through for budget caps, multi-provider routing, and metering. Vercel can't run always-on Docker containers. Railway can, for ~$5-7/month.

**Summary:** Vercel = website + API. Railway = LLM routing gateway. They talk to each other but serve different purposes. Both are needed.

---

## 11. Project Coordination System (NEW)

We've adopted a 4-file coordination system so all agents can work async and pick up where others left off. **CTO must follow this protocol:**

### Files to Read at Session Start
1. `CLAUDE.md` (project constitution, ~80 lines)
2. `docs/SESSION-LOG.md` (what happened last, what's next)
3. `docs/ACTIVE-PLAN.md` (current phase checklist)

### Files to Update at Session End
1. `docs/SESSION-LOG.md` — add a new "Last Session" entry with: date, who worked, what was done, what's next, blockers, decisions
2. `docs/ACTIVE-PLAN.md` — check off completed items, add new blockers

### Decision Protocol
- Implementation details within your scope → proceed, log in SESSION-LOG.md
- Anything that affects product, architecture, or other agents → ask founder first, present options in plain language
- All decisions → eventually logged in `docs/pixelport-project-status.md` decisions table

Full coordination system docs: `docs/project-coordination-system.md`

---

## Summary

**You're unblocked.** Repo access is live. Schema is approved. All 9 Q&A decisions are confirmed. Project coordination system is in place — read `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md` at the start of every session, update them at the end. Send Codex Slice 1 now. Supabase credentials coming via DM today. Let's build.

---

*End of CTO Phase 0 Go Package*
