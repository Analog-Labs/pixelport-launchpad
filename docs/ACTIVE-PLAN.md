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

**UI Track (Founder with Lovable)**
- [x] 1.F1: Onboarding widget — 3-step flow
- [x] 1.F2: Dashboard Home — agent status card, pending approvals, recent activity
- [x] 1.F3: Chat widget (persistent sidebar) + full-page chat view
- [x] 1.F4: Agent personalization UI
- [x] 1.F5: Connections page

**Technical Lead Track (Backend + Infra)**
- [x] 1.C1: Tenant creation endpoint (Codex Slice 5)
- [x] 1.C2: Chat API streaming SSE + message history (Codex Slice 6)
- [x] 1.C3: Slack OAuth flow + webhook (Codex Slice 7)
- [x] 1.C6: AgentMail per-tenant inbox (in provisioning workflow)
- [x] 1.C7: Website auto-scan (Codex Slice 8)
- [x] 1.C8: Slack activation workflow (Codex Slice 9)

**Integration (Technical Lead + Founder approval)**
- [x] 1.I1: Onboarding → POST /api/tenants
- [x] 1.I1b: Scan API in onboarding
- [x] 1.I3: Dashboard status polling
- [x] 1.I4: Connections page → Slack OAuth

---

## Previous Phase: Phase 2 — Dynamic Chief + Real Dashboard Data ✅

**Status:** Substantially complete. Deferred items carried into Phase 3.
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
| Mem0 per-tenant integration | Technical Lead | ✅ Endpoint built (session 9). Needs MEM0_API_KEY to activate. |
| Chat WebSocket/SSE bridge | Technical Lead | Deferred to Phase 3 (Slack is primary channel) |
| PostHog user-facing integration | Technical Lead | ✅ Redesigned as tenant integration (session 10). Old `api/analytics/track.ts` deleted. New: `api/lib/integrations/adapters/posthog.ts` + generic framework. |

---

### Technical Lead Track

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

### Frontend Track

Founder may keep using Lovable for visual/UI-only work. Technical Lead owns repo-side functional frontend changes.

- [x] 2.F1: Content Pipeline page — reads `GET /api/tasks?task_type=draft_content`, approve/reject actions
- [x] 2.F2: Content Calendar page — monthly grid wired to `GET /api/tasks?scheduled_for=true`
- [x] 2.F3: Knowledge Vault page — 5 collapsible sections, inline editing via `PUT /api/vault/:key`
- [x] 2.F4: Competitor Intelligence page — card grid wired to `GET /api/competitors`
- [x] 2.F5: Dashboard Home updates — 4-stat grid, onboarding checklist, Work Feed + Team Roster, Quick Actions
- [ ] 2.F6: Chat WebSocket UI — real-time agent chat (when 2.B13 is ready)
- [ ] 2.F7: Performance page — KPI tracking + agent metrics

### Integration (Technical Lead + Founder approval)

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
- **Frontend ownership model (2026-03-06):** Founder may still use Lovable for visual/UI-only work, but Technical Lead now owns repo-side functional frontend changes, auth behavior, data wiring, and integration logic.
- **DO droplet quota:** 1 slot available. Use `/api/debug/test-provision?cleanup=true` after each test to free the slot.
- **Vercel build cost discipline:** Docs-only changes auto-skipped. Batch code pushes. Target <$5/day.
- **Secrets management:** All API keys stored locally at `~/.pixelport/secrets.env`. Technical Lead reads via `~/.pixelport/get-secret.sh VAR_NAME`. Usage logged to `~/.pixelport/usage.log`.
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

### UI / Product Track (Parallel)

Founder may continue UI exploration in Lovable. Technical Lead owns implementation of functional behavior behind these surfaces.

- [ ] 3.FE1: Rebuild Connections page as dynamic grid (reads from registry API)
- [ ] 3.FE2: Build Social Publishing page + Calendar enhancements
- [ ] 3.FE3: Build Performance page with charts

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| PostHog Personal API Key + Project ID | E2E test of PostHog integration | Founder provides from PostHog dashboard |
| Mem0 API key | Mem0 endpoint activation | Founder signs up at mem0.ai + adds key to Vercel env |
| AGENTMAIL_API_KEY in Vercel | Automatic tenant inbox creation and inbox-backed onboarding promises | Founder adds key to Vercel env |
| GEMINI_API_KEY in Vercel | Explicit Gemini-backed web search for fresh tenants | Founder adds key to Vercel env |
| OpenClaw browser tool timeout on tenant droplets | Reliable browser-assisted agent work on fresh tenants | Technical Lead investigation and/or upstream OpenClaw fix |
| X Developer App credentials | X integration (Session 11) | Founder registers at developer.x.com |
| LinkedIn App credentials | LinkedIn integration (Session 11) | Founder registers at developer.linkedin.com |
| Google OAuth credentials | GA4 integration (Session 12) | Founder configures at Google Cloud Console |

---

### Notes

- **Operating model changed (2026-03-06):** Codex is now the Technical Lead and primary owner of repo implementation across frontend, backend, infra, and integrations. Founder approves major product, architecture, and UX decisions. CTO is now an occasional QA/reviewer rather than a routine gate.
- **Auth redirect hardening (2026-03-06, session 11):** Frontend auth now uses a shared canonical app URL helper and Supabase PKCE flow. Repo code no longer relies on arbitrary browser origins or hash-fragment tokens, and the live Supabase Auth URL configuration was updated to allow the production callback flow.
- **Tenant state fix (2026-03-06, session 11):** Dashboard/onboarding gating no longer trusts stale `pixelport_*` localStorage across users. Frontend now fetches the real tenant via `/api/tenants/me`, clears tenant state on sign-out/account switch, and only shows provisioning placeholders when a real tenant is actually provisioning.
- **Onboarding testability fix (2026-03-06, session 11):** Duplicate company names are now allowed across different accounts by auto-generating a unique tenant slug for infra. Slack connect is hidden/disabled until provisioning is complete, so onboarding no longer suggests pre-provisioning integrations.
- **Auto-bootstrap fix (2026-03-06, session 11):** OpenClaw onboarding research now starts through `POST /hooks/agent` during provisioning. Added `POST /api/tenants/bootstrap` as a replay endpoint for already-active tenants, and the dashboard home page now requests bootstrap once when an active tenant has no real backend work yet.
- **Architecture issue documented (2026-03-06, session 11):** `api/chat.ts` still targets the nonexistent REST path `POST /openclaw/chat`. Dashboard chat remains a separate WebSocket bridge task; do not treat the current REST chat route as production-ready.
- **Production QA audit (2026-03-06, session 12):** Fresh production onboarding is currently broken by an OpenClaw config bug: `buildOpenClawConfig()` writes the same token to `gateway.auth.token` and `hooks.token`, which crash-loops `openclaw-gateway` on fresh droplets and leaves tenants stuck in `provisioning`. The same audit also confirmed a protected child-route deep-link regression (`/dashboard/content` and `/dashboard/connections` hard loads fall back to `/dashboard` after flashing `/onboarding`), raw markdown still rendering in the Knowledge Vault UI, and chat remaining a simulated frontend with no `/api/chat` traffic. Full evidence: `docs/qa/dashboard-onboarding-debug-audit-2026-03-06.md`.
- **QA hotfix bundle implemented locally (2026-03-06, session 13):** Provisioning now derives a distinct OpenClaw hooks token from `gateway_token` without a schema migration, bootstrap replay uses the derived hook auth, protected dashboard redirects preserve the originally requested child route, and the Knowledge Vault now renders markdown with `react-markdown` plus Tailwind Typography. `npx tsc --noEmit` passes. Production re-validation is still required after deploy.
- **Provisioning recovery + runtime compatibility fix (2026-03-06, session 14):** Existing active droplets created before hook support can now be repaired in place during `POST /api/tenants/bootstrap` via SSH if the first bootstrap attempt returns `405`. Fresh droplets now write a `2026.2.24`-compatible hooks block, use `tools.profile: 'full'` instead of the invalid `group:all` allowlist, and switch the OpenClaw LiteLLM transport from `openai-responses` to `openai-completions`.
- **LiteLLM deploy dependency documented (2026-03-06, session 14):** Live canary testing on the `Vidacious` droplet proved that OpenClaw `2026.2.24` still injects unsupported params like `store` into LiteLLM requests. The repo now sets `litellm_settings.drop_params: true` in `infra/litellm/config.yaml`, but end-to-end onboarding bootstrap will remain blocked until the Railway LiteLLM service is redeployed with that config.
- **Debug handoff prepared (2026-03-06, session 15):** Founder approved a simpler fresh-tenant canary that keeps LiteLLM/Railway but moves new tenants to general `gpt-5.4` with `gpt-4o-mini` fallback over the OpenAI Responses API path. Execution brief: `docs/qa/debug-pixel-fix-gpt54-responses-2026-03-06.md`.
- **Fresh-tenant runtime canary validated (2026-03-06, session 16):** LiteLLM was redeployed on Railway with the `gpt-5.4` alias live, Vercel was redeployed with the new-tenant provisioning/runtime config, and a brand-new production tenant canary (`vidacious-ai-2`) completed successfully end to end. Live result: tenant `active`, 6 task rows, 5 competitor rows, all 5 vault sections `ready`, real dashboard activity, protected child-route hard loads still stable, and Vault markdown rendering confirmed on live content.
- **Residual runtime notes (2026-03-06, session 16):** The canary also showed three follow-up hardening items: Vercel does not currently expose `GEMINI_API_KEY`, so explicit Gemini web-search config is not emitted to fresh droplets; OpenClaw browser tooling is still unavailable inside the tenant container; and the generated SOUL template still uses `source /opt/openclaw/.env`, which logs a shell warning under OpenClaw exec even though onboarding now completes.
- **Operating model transition + runtime hardening validated (2026-03-06, session 17):** Live docs now reflect the new governance model: Founder approves major product/architecture/UX decisions, Codex is the Technical Lead for repo implementation, and CTO is an occasional QA/reviewer. Fresh-tenant provisioning now builds a Chromium-enabled OpenClaw image on each droplet from the pinned `ghcr.io/openclaw/openclaw:2026.2.24` base tag, and the generated SOUL template now uses POSIX-safe `. /opt/openclaw/.env` instead of `source`.
- **Fresh tenants after browser-image hardening (2026-03-06, session 17):** Two new production canaries validated the updated provisioning path. `vidacious-ai-3` (`206.189.180.152`) and `vidacious-ai-4` (`165.227.200.246`) both reached `active`, wrote real backend rows, preserved protected child-route hard loads, and rendered formatted Vault markdown on live content.
- **Browser runtime status after hardening (2026-03-06, session 17):** The old `No supported browser found` failure is fixed. Chromium is present in-container, the OpenClaw browser control service now boots, profile directories are writable, and `http://127.0.0.1:18791/` returns `401 Unauthorized` from the authenticated service. However, the in-agent `browser` tool still times out on OpenClaw `2026.2.24`, and `node /app/openclaw.mjs browser start` reports `Chrome extension relay is running, but no tab is connected`. Treat this as a separate runtime/upstream limitation, not a provisioning-image bug.
- **Current env-gated gaps (2026-03-06, session 17):** `GEMINI_API_KEY` and `AGENTMAIL_API_KEY` are both currently missing from the live Vercel environment. Gemini-backed explicit search config remains disabled for fresh tenants, and AgentMail inbox auto-creation is skipped.

---

## What Comes After Phase 3

**Phase 4: Dashboard Polish + Trust (Weeks 13–16)**
- Performance page, agent detail page
- API keys management, budget controls, brand voice enforcement
- Audit log, team management + RBAC, Stripe billing

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
