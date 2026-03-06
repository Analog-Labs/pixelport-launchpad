# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Previous Phase: Phase 0 — Foundation ✅

**Status:** Complete. Phase 0.9 dry-run PASSED (12-step Inngest pipeline, ~7 min end-to-end).

---

## Previous Phase: Phase 1 — Chief of Staff Alive ✅

**Status:** Complete (gate passed 2026-03-05).
**Duration:** March 3–5, 2026

### Phase 1 Gate Assessment

**PASSED** — with planned deferrals.

**Proven end-to-end flow:**
1. User signs up → onboarding wizard (company URL, goals, agent personalization)
2. Website auto-scan extracts brand profile during onboarding
3. `POST /api/tenants` triggers Inngest provisioning (~6.5 min)
4. Droplet created → Docker CE → OpenClaw → agents configured → SOUL.md populated
5. User connects Slack → OAuth → Inngest activates Socket Mode on droplet
6. User DMs agent → bot responds ✅

**Tested with 2 tenants:**
- sanchal@analog.one (Vidacious) — droplet at 137.184.193.239
- sr@ziffyhomes.com — droplet at 137.184.17.111

**15 bugs fixed across 4 sessions** (see `docs/pixelport-project-status.md` §8)

**Deferred to Phase 2:**
- 1.C4: Mem0 per-tenant integration (depends on Mem0 API key / startup program)
- 1.I2: Chat SSE streaming (Slack is primary channel; dashboard chat ships as-is)
- 1.C5: PostHog (redesigned as user-facing integration)

### Completed Items

**Founder Track (Lovable Frontend)**
- [x] 1.F1: Onboarding widget — 3-step flow
- [x] 1.F2: Dashboard Home — agent status card, pending approvals, recent activity
- [x] 1.F3: Chat widget (persistent sidebar) + full-page chat view
- [x] 1.F4: Agent personalization UI
- [x] 1.F5: Connections page

**CTO Track (Backend + Infra)**
- [x] 1.C1: Tenant creation endpoint (Codex Slice 5)
- [x] 1.C2: Chat API streaming SSE + message history (Codex Slice 6)
- [x] 1.C3: Slack OAuth flow + webhook (Codex Slice 7)
- [x] 1.C6: AgentMail per-tenant inbox (in provisioning workflow)
- [x] 1.C7: Website auto-scan (Codex Slice 8)
- [x] 1.C8: Slack activation workflow (Codex Slice 9)

**Integration (CTO + Founder)**
- [x] 1.I1: Onboarding → POST /api/tenants
- [x] 1.I1b: Scan API in onboarding
- [x] 1.I3: Dashboard status polling
- [x] 1.I4: Connections page → Slack OAuth

---

## Current Phase: Phase 2 — Dynamic Chief + Real Dashboard Data

**Target:** Weeks 6–9 (March 10 – April 4, 2026)
**Goal:** 1 persistent Chief agent per tenant (dynamic sub-agents), dashboard pages populated with real data

### Architecture Pivot (2026-03-05)
- **Killed** SPARK + SCOUT as permanent provisioned agents
- **Kept** only 1 persistent agent per tenant: the Chief of Staff
- Chief dynamically spawns sub-agents using OpenClaw's native `sessions_spawn`
- Dashboard pages show **real data** populated by the Chief (no mock data)
- Chief auto-starts research after onboarding → populates vault, competitors, content ideas

---

### Carry-Forward from Phase 1

| Item | Owner | Status |
|------|-------|--------|
| Mem0 per-tenant integration | CTO + Codex | ✅ Endpoint built (session 9). Needs MEM0_API_KEY to activate. |
| Chat WebSocket/SSE bridge | CTO + Codex | Deferred to Phase 3 (Slack is primary channel) |
| PostHog user-facing integration | CTO + Codex | ✅ Redesigned as tenant integration (session 10). Old `api/analytics/track.ts` deleted. New: `api/lib/integrations/adapters/posthog.ts` + generic framework. |

---

### CTO + Codex Track (Backend)

- [x] 2.B1: Architecture pivot — remove SPARK/SCOUT, dynamic sub-agent model
- [x] 2.B2: Database schema (agent_tasks, vault_sections, competitors tables + agent_api_key)
- [x] 2.B3: Agent auth helper (`authenticateAgentRequest()` — X-Agent-Key header)
- [x] 2.B4: Provisioning update — 1-agent config, sub-agent settings, vault seeding, SOUL.md rewrite
- [x] 2.B5: Agent write API — `/api/agent/tasks`, `/api/agent/vault`, `/api/agent/competitors`
- [x] 2.B6: Dashboard read API — `/api/tasks`, `/api/vault`, `/api/competitors`
- [x] 2.B7: Content approval API — `/api/tasks/approve`, `/api/tasks/reject`
- [x] 2.B8: Database migration applied to Supabase (006_phase2_schema.sql)
- [x] 2.B9: E2E test — new tenant provisioning with Phase 2 changes (ALL PASS)
- [x] 2.B10: Secrets management system (`~/.pixelport/secrets.env` — local, secure, Codex-accessible)
- [x] 2.B11: Image generation integration — `/api/agent/generate-image` (OpenAI DALL-E 3 / gpt-image-1, extensible)
- [x] 2.B12: Mem0 per-tenant integration — `/api/agent/memory` (GET/POST/DELETE, tenant-scoped via user_id)
- [ ] 2.B13: Chat WebSocket bridge (carry-forward from 1.I2) — deferred to Phase 3
- [x] 2.B14: PostHog server-side tracking — ~~`/api/analytics/track`~~ → Redesigned as tenant integration in Phase 3 (session 10)
- [ ] 2.B15: Inngest approval workflow — deferred to Phase 3 (scheduling engine)

### Founder + Lovable Track (Frontend)

- [x] 2.F1: Content Pipeline page — reads `GET /api/tasks?task_type=draft_content`, approve/reject actions
- [x] 2.F2: Content Calendar page — monthly grid wired to `GET /api/tasks?scheduled_for=true`
- [x] 2.F3: Knowledge Vault page — 5 collapsible sections, inline editing via `PUT /api/vault/:key`
- [x] 2.F4: Competitor Intelligence page — card grid wired to `GET /api/competitors`
- [x] 2.F5: Dashboard Home updates — 4-stat grid, onboarding checklist, Work Feed + Team Roster, Quick Actions
- [ ] 2.F6: Chat WebSocket UI — real-time agent chat (when 2.B13 is ready)
- [ ] 2.F7: Performance page — KPI tracking + agent metrics

### Integration (CTO + Founder)

- [x] 2.I1: Wire Content Pipeline page → tasks API
- [x] 2.I2: Wire Knowledge Vault → vault API
- [x] 2.I3: Wire Competitor Intelligence → competitors API
- [x] 2.I4: Wire Dashboard Home → tasks API (work feed + team roster)
- [ ] 2.I5: Wire Chat widget → WebSocket bridge

---

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Mem0 API key | Mem0 endpoint activation | Founder signs up at mem0.ai + adds key to Vercel env |
| PostHog API key | PostHog endpoint activation | Founder signs up at posthog.com + adds key to Vercel env |

### Notes

- **Frontend track complete (2026-03-05, session 7):** Founder built all 5 dashboard pages + global dark theme in Lovable. All pages wired to real APIs.
- **Phase 2 deferred items built (session 9):** Image gen, Mem0, PostHog endpoints all built. Awaiting API keys for Mem0 + PostHog activation.
- **Codex MCP integration (session 8):** Codex CLI v0.111.0 integrated via MCP. GPT-5.4 xhigh reasoning. Dual QA pattern established.
- **Codex MCP diagnostic (2026-03-05, session 10):** Native `codex` MCP is being used by Claude Code and completed at least one QA run successfully. `codex-cli` still responds to `ping` but its `review` and `codex` commands fail immediately, so prefer native `codex` MCP for QA until that wrapper is fixed.
- **Project root moved (session 9):** Claude Code project root moved from `growth-swarm/` to `pixelport-launchpad/` (git repo). Enables worktree isolation for Codex parallel tasks.
- **APIs consumed by frontend:** Dashboard Home: `GET /api/connections`, `GET /api/tasks?limit=10`, `GET /api/tenants/status`. Content Pipeline: `GET /api/tasks?task_type=draft_content`, `POST /api/tasks/approve`, `POST /api/tasks/reject`. Calendar: `GET /api/tasks?scheduled_for=true&sort=scheduled_for&order=asc`. Vault: `GET /api/vault`, `PUT /api/vault/:key`. Competitors: `GET /api/competitors`. Connections: `GET /api/connections`.
- **Architecture pivot (2026-03-05):** Founder locked decision to kill permanent sub-agents. Chief uses OpenClaw native `sessions_spawn` for dynamic sub-agents. Simplifies provisioning, reduces idle LLM cost.
- **Agent API key pattern:** Per-tenant `agent_api_key` (prefix `ppk-`) stored in tenants table, injected as `PIXELPORT_API_KEY` in droplet `.env`. Chief authenticates via `X-Agent-Key` header.
- **Dashboard data flow:** Chief → `/api/agent/*` (writes) → Supabase → `/api/tasks/*`, `/api/vault/*`, `/api/competitors/*` (reads) → Lovable dashboard
- **Loading states:** Dashboard pages show "[Agent name] is working on this..." until Chief populates data.
- **Integration wiring pattern (from Phase 1):** CTO proposes changes to Lovable-managed frontend files, founder reviews and applies. Do NOT modify `src/` files directly without founder approval.
- **DO droplet quota:** 1 slot available. Use `/api/debug/test-provision?cleanup=true` after each test to free the slot.
- **Vercel build cost discipline:** Docs-only changes auto-skipped. Batch code pushes. Target <$5/day.
- **Secrets management:** All API keys stored locally at `~/.pixelport/secrets.env`. CTO reads via `~/.pixelport/get-secret.sh VAR_NAME`. Usage logged to `~/.pixelport/usage.log`.
- **Test tenant (Phase 2):** TestCo Phase2 — droplet `142.93.195.23` (ID `556101720`), agent_api_key `ppk-f633202f-...`

---

## Current Phase: Phase 3 — Integration Framework + Social Publishing

**Target:** March 2026 (Sessions 10–12+)
**Goal:** Generic integration framework, first 4 integrations (PostHog, GA4, X, LinkedIn), social publishing + metrics

**Full plan:** `.claude/plans/synthetic-inventing-cocoa.md`

### Session 10: Integration Framework — COMPLETE ✅

- [x] 3.F1: Delete `api/analytics/track.ts` (replaced by tenant PostHog integration)
- [x] 3.F2: Database migration `007_integrations_framework.sql` — applied to Supabase
- [x] 3.F3: Shared utilities — `crypto.ts`, `oauth-state.ts`, `registry.ts`, `token-manager.ts`
- [x] 3.F4: Generic OAuth endpoints — `install.ts`, `callback.ts`, `disconnect.ts`
- [x] 3.F5: API key connection endpoint — `connect.ts` (with extra fields support)
- [x] 3.F6: Updated `GET /api/connections` — queries both tables + includes registry catalog
- [x] 3.F7: Agent proxy — `POST /api/agent/integrations` (dynamic adapter dispatch)
- [x] 3.F8: Agent capabilities — `GET /api/agent/capabilities`
- [x] 3.F9: Inngest `activate-integration.ts` (generic token validation + activation)
- [x] 3.F10: PostHog adapter (`adapters/posthog.ts`) — 4 actions (traffic, funnels, events, HogQL)
- [x] 3.F11: 2 Codex QA rounds — all high/medium findings fixed
- [x] 3.F12: TypeScript compiles clean

### Session 11: X + LinkedIn Adapters + Social Publishing — PENDING

- [ ] 3.S1: X adapter (`adapters/x.ts`) — mentions, engagement, post, followers
- [ ] 3.S2: LinkedIn adapter (`adapters/linkedin.ts`) — page analytics, post, followers
- [ ] 3.S3: Social publishing migration (`008_phase3_social.sql`)
- [ ] 3.S4: Publishing endpoints (`api/agent/publish.ts`, `api/social/posts.ts`, etc.)
- [ ] 3.S5: Inngest scheduled publishing function
- [ ] 3.S6: E2E test with real OAuth flow

### Session 12: GA4 + Metrics/Reporting — PENDING

- [ ] 3.M1: GA4 adapter (`adapters/ga4.ts`) — traffic, pageviews, referrals, conversions
- [ ] 3.M2: Metrics endpoints (`api/agent/metrics-snapshot.ts`, `api/social/metrics.ts`)
- [ ] 3.M3: Weekly report Inngest cron + endpoint
- [ ] 3.M4: SOUL.md template update for integration awareness

### Founder Track (Parallel)

- [ ] 3.FE1: Rebuild Connections page as dynamic grid (reads from registry API)
- [ ] 3.FE2: Build Social Publishing page + Calendar enhancements
- [ ] 3.FE3: Build Performance page with charts

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| PostHog Personal API Key + Project ID | E2E test of PostHog integration | Founder provides from PostHog dashboard |
| Mem0 API key | Mem0 endpoint activation | Founder signs up at mem0.ai + adds key to Vercel env |
| Supabase Auth URL config still falls back to `http://localhost:3000` | Google login on frontend | Founder/CTO updates Supabase Authentication -> URL Configuration |
| X Developer App credentials | X integration (Session 11) | Founder registers at developer.x.com |
| LinkedIn App credentials | LinkedIn integration (Session 11) | Founder registers at developer.linkedin.com |
| Google OAuth credentials | GA4 integration (Session 12) | Founder configures at Google Cloud Console |

---

### Notes

- **Auth redirect hardening (2026-03-06, session 11):** Frontend auth now uses a shared canonical app URL helper and Supabase PKCE flow. Repo code no longer relies on arbitrary browser origins or hash-fragment tokens, but Supabase Auth dashboard settings still need to point at the production domain for Google login to complete.

---

## What Comes After Phase 3

**Phase 4: Dashboard Polish + Trust (Weeks 13–16)**
- Performance page, agent detail page
- API keys management, budget controls, brand voice enforcement
- Audit log, team management + RBAC, Stripe billing

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
