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

- **Tooling verification (2026-03-07, session 20):** The three PixelPort Codex skills are present and usable from `~/.codex/skills/`, and the DigitalOcean MCP wrapper script itself launches cleanly. However, the active Codex MCP registry in the desktop session still exposes only `playwright`; repo-local `.mcp.json` entries for `github` and `digitalocean` are not attached to the current model session yet, so those two MCPs are not usable here until the registry/auth path is fixed.
- **MCP follow-up (2026-03-07, session 21):** GitHub MCP is now attached far enough to attempt startup, but it still fails in the active session because `GITHUB_PERSONAL_ACCESS_TOKEN` is not set. DigitalOcean MCP is working and returned live account metadata successfully.
- **MCP re-check (2026-03-07, session 22):** GitHub MCP and DigitalOcean MCP both responded successfully in the active Codex session. GitHub `get_me` returned authenticated user `sanchalr`, and DigitalOcean `droplet-list` returned live droplet data including active droplet `555041719` in `sgp1`.
- **MCP fix (2026-03-07, session 23):** Codex desktop now uses the actual global MCP registry in `~/.codex/config.toml` for both servers. GitHub MCP was switched from the broken remote HTTP attempt to a local official `github-mcp-server` binary launched through `tools/mcp/github-mcp.sh`, which reuses the machine's existing `gh` auth. A fresh isolated `codex exec` agent confirmed both GitHub MCP and DigitalOcean MCP come up and answer live requests. The three PixelPort skills remain usable and unchanged.
- **Playwright MCP fix (2026-03-08, session 33):** Diagnosed the recurring local Playwright MCP issue as stale shared-browser state under `~/Library/Caches/ms-playwright/mcp-chrome`, added repo wrapper `tools/mcp/playwright-mcp.sh` to launch a pinned `@playwright/mcp@0.0.68` with `--isolated --headless`, updated `~/.codex/config.toml` to use it, cleared the stale local Playwright processes, restored the missing `tools/mcp/github-mcp.sh` wrapper, and re-verified in a fresh `codex exec` session that `github`, `digitalocean`, and `playwright` all start cleanly and Playwright can open `https://example.com`.
- **QA policy (2026-03-09, session 40):** Real-world QA is now standardized in `docs/qa-policy.md`. Medium/high runtime-backed work should prefer fresh-tenant canaries with real public company inputs, and integration QA may explicitly request founder-provided access for Slack, socials, analytics, or inbox systems when needed.
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

**Status:** Old Phase 3 execution sequence remains paused. The approved foundation replacement slice is merged, deployed, production-validated, and the fresh-tenant command-dispatch gate has passed. The first real dashboard command flow is now merged and live on production, the tenant-wide single-active Vault refresh guard is deployed, and the stale non-terminal Vault refresh recovery hardening is now also merged, deployed, and production-smoked. The bootstrap persistence and truthfulness fix is now also merged, deployed, and production-smoked. Broader command-backed UX should still wait for the next founder-approved build brief.
**Target:** March 2026 (Sessions 10–12+)
**Goal:** Generic integration framework, first 4 integrations (PostHog, GA4, X, LinkedIn), social publishing + metrics

**Full plan:** `.claude/plans/synthetic-inventing-cocoa.md`

### Approved Replacement Track — Foundation Spine (session 35)

- [x] 3.R1: Additive migration `008_foundation_spine.sql` — `command_records`, `command_events`, `workspace_events`
- [x] 3.R2: Command ledger APIs — `POST /api/commands`, `GET /api/commands`, `GET /api/commands/:id`
- [x] 3.R3: Additive runtime event ingest — `POST /api/agent/workspace-events`
- [x] 3.R4: Provisioning/bootstrap scaffolds `SOUL.md`, `TOOLS.md`, `AGENTS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, and the `pixelport/` workspace namespace
- [x] 3.R5: Validation passed — `npx tsc --noEmit`, targeted `npx eslint`, `npm test`, mocked route smoke
- [x] 3.R6: Claude CTO review on branch `codex/foundation-spine`
- [x] 3.R7: Merge/deploy after approval, apply remote migration `008_foundation_spine.sql`, and run same-session production smoke
- [x] 3.R8: Run a fresh-tenant command-dispatch canary to determine whether the current hook reachability issue is only a stale old-tenant problem or a real fresh-tenant provisioning/runtime bug

### Next Approved Build — First Real Dashboard Command Flow

- [x] 3.C1: Execute [2026-03-09-vault-refresh-command-v1.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-command-v1.md) on branch `codex/vault-refresh-command-v1`
- [x] 3.C2: Add a section-level `Refresh with Chief` action to the Knowledge Vault page using the existing command spine
- [x] 3.C3: Keep the final truth update on the existing live vault path while surfacing section-level command progress
- [x] 3.C4: Validate one real fresh-tenant vault refresh end to end before expanding command-backed UX anywhere else
- [x] 3.C5: Merge/deploy the approved Vault refresh flow and run same-session production smoke
- [x] 3.C6: Ship the founder-approved tenant-wide single-active Vault refresh guard after production overlap smoke exposed a second-command ledger mismatch
- [x] 3.C7: Execute [2026-03-09-vault-refresh-recovery.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-recovery.md) on branch `codex/vault-refresh-recovery` and validate stale non-terminal Vault refresh recovery on the real QA tenant
- [x] 3.C8: Complete CTO review for `codex/vault-refresh-recovery`, merge to `main`, deploy, and run same-session production smoke after approval

### Current High-Risk Fix — Bootstrap Persistence And Truthfulness

- [x] 3.C9: Execute [2026-03-10-bootstrap-persistence-truth.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-bootstrap-persistence-truth.md) on branch `codex/bootstrap-persistence-truth`
- [x] 3.C10: Validate the bootstrap persistence/truth fix on a real fresh tenant and confirm partial output stays `accepted` until durable rows exist
- [x] 3.C11: Complete CTO review for `codex/bootstrap-persistence-truth`, then merge to `main`, deploy, and run same-session production smoke after approval

### Current Branch Under Review — Slack Chief Online

- [x] 3.C12: Audit recovered branch `codex/slack-chief-online` from `1ed362e` and confirm the diff remains Slack-only
- [x] 3.C13: Keep tenant creation, provisioning, droplet bootstrap, durable bootstrap truth, and existing dashboard read truth frozen while finishing the Slack branch
- [x] 3.C14: Add any remaining Slack-only hardening/tests, then rerun targeted Slack tests plus `npx tsc --noEmit`
- [x] 3.C15: Prepare review artifacts:
  - [2026-03-10-slack-chief-online.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-slack-chief-online.md)
  - [2026-03-10-slack-chief-online.md](/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-10-slack-chief-online.md)
  - [2026-03-10-slack-chief-online-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-slack-chief-online-cto-prompt.md)
- [x] 3.C16: Get CTO review for `codex/slack-chief-online` and apply the one required pre-merge best-effort welcome-DM fix
- [x] 3.C17: After CTO approval, merge/deploy and run controlled production Slack QA on stable tenant `bootstrap-truth-qa-20260310054029`

### Current High-Risk Build — Native Memory Foundation

- [x] 3.C18: Start execution from `main` on branch `codex/memory-foundation` using the recovered approved memory brief
- [x] 3.C19: Re-verify the live `vidacious-4` baseline on droplet `137.184.56.1` and confirm the validated OpenClaw `2026.3.2` `memorySearch` path
- [x] 3.C20: Implement repo-side native-memory defaults, provisioning config emission, workspace scaffold changes, and Mem0 graceful degradation
- [x] 3.C21: Run targeted memory tests plus `npx tsc --noEmit`
- [x] 3.C22: Repair live tenant `vidacious-4`, reindex, and prove what is actually searchable before freezing the shipped memory layout
- [x] 3.C23: Run one fresh-tenant native-memory canary with FK-safe cleanup, then prepare final CTO review handoff
- [x] 3.C24: Merge to `main`, sync Inngest, and run same-session production smoke for native memory plus Mem0 graceful degradation

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
| DigitalOcean token lacks droplet delete scope | Post-canary droplet cleanup and cost control for disposable runtime tests | Founder updates DO token scope or deletes disposable canary droplets manually |
| Browser tool intentionally disabled for new-tenant runtime configs | Browser-assisted workflows are intentionally deprioritized; keep disabled until a dedicated re-enable canary is approved | Founder + Technical Lead re-enable decision |
| X Developer App credentials | X integration (Session 11) | Founder registers at developer.x.com |
| LinkedIn App credentials | LinkedIn integration (Session 11) | Founder registers at developer.linkedin.com |
| Google OAuth credentials | GA4 integration (Session 12) | Founder configures at Google Cloud Console |

### Live Notes

- **Commit/deploy + live tenant runtime upgrade completed (2026-03-13, session 63):** Shipped commit `29213c4` to `main`, Vercel deployment for that commit completed successfully, and Inngest was re-registered (`PUT /api/inngest` => `modified:true`). Then upgraded live Slack-integrated tenant `vidacious-4` (`6c6ae22c-d682-4af6-83ff-79913d267aea`, droplet `557399795` / `137.184.56.1`) in place from `pixelport-openclaw:2026.3.2-chromium` to `ghcr.io/openclaw/openclaw:2026.3.11` after pre-swap config validation on the new image. Post-upgrade checks passed: container `healthy`, `/health` returned `{\"ok\":true,\"status\":\"live\"}`, logs showed gateway listening and Slack socket reconnect, and `openclaw channels status --json` reported Slack `running:true`. Founder-led Slack QA is the next release-confidence step.
- **OpenClaw two-step canary gate passed for runtime simplification + `2026.3.11` default (2026-03-13, session 62):** Ran the approved canary sequence using the simplified no-Chromium runtime path. Step 1 (`ghcr.io/openclaw/openclaw:2026.3.2`, no custom build) produced an active tenant with bootstrap accepted, dashboard truth endpoints returning `200`, live runtime image `ghcr.io/openclaw/openclaw:2026.3.2`, browser blocked by policy (`tools.deny: ["browser"]`), and config validation passing for both current `acp.dispatch.enabled=false` and an ACP-enabled profile variant. Step 2 repeated the same checks on `ghcr.io/openclaw/openclaw:2026.3.11` and passed equivalently (`openclaw --version` reported `2026.3.11`; config validate passed for ACP-false and ACP-enabled profile variants). Memory CLI behavior (`openclaw memory status/search`) remained unchanged between versions (`unable to open database file` in both canaries), so the upgrade does not regress that known caveat. Recommendation from this gate: `upgrade default now` (already pinned in code), keep Growth Swarm excluded, and treat browser re-enable as a separate future canary. Full evidence: `docs/qa/2026-03-13-openclaw-runtime-simplification-canary.md`.
- **OpenClaw runtime simplification + `2026.3.11` default landed in code (2026-03-13, session 61):** Provisioning no longer builds a custom Chromium layer on droplets. `buildCloudInit()` now pulls a resolved runtime image directly (`OPENCLAW_RUNTIME_IMAGE` override when set, otherwise `OPENCLAW_IMAGE`), and the default `OPENCLAW_IMAGE` is now `ghcr.io/openclaw/openclaw:2026.3.11`. Generated agent config now explicitly denies `browser` (`tools.deny: ["browser"]`). `infra/openclaw-browser/Dockerfile` was deleted outright to remove dead-path confusion, and infra templates were synced. Existing active tenants are unchanged unless explicitly reprovisioned/recovered, and Growth Swarm remains excluded. The approved two-step canary gate was executed in session 62 and passed.
- **Final stale Phase 0 branch retired (2026-03-12, session 60):** Old branch `codex/phase0-slices-3-4` was re-checked before deletion and confirmed to be obsolete, not hidden pending work. It was `behind 190 / ahead 4` versus `main`, contained only the original March 3 Phase 0 slice commits, and its diff against current `main` would rewind large parts of the later shipped product rather than add missing changes. The remote and local branch were both deleted. Result: the repo branch list now reflects a clean shipped state with current work living on `main`.
- **Cleanup follow-up shipped successfully and removed the deploy-skip hazard (2026-03-12, session 59):** The first cleanup commit on `main` removed the merged remote release branches and the stray local `.playwright-cli/` artifact, but its new `ignoreCommand` logic caused a failed Vercel deployment on commit `45f1430`. The safe follow-up on `3937b16` removed `ignoreCommand` from `vercel.json` entirely, GitHub/Vercel reported the new deployment `success`, and quick public reachability checks still returned the expected responses (`/` -> `200`, `/api/inngest` -> `405`). Result: release-branch clutter is cleaned up, the stray local Playwright artifact is gone, and the repo no longer risks skipping or failing production deploys because of custom ignore-shell logic.
- **Repo hygiene cleanup prepared after the native-memory release (2026-03-12, session 58):** Branch `codex/repo-cleanup` updates `vercel.json` so the ignore rule compares `VERCEL_GIT_PREVIOUS_SHA` to `HEAD` instead of only `HEAD^..HEAD`, which prevents stacked docs commits from suppressing a real production deploy while still skipping true docs-only pushes. The same cleanup also removes the stray local `.playwright-cli/` artifact from the founder workspace and deletes the already-merged remote release branches (`bootstrap-persistence-truth`, `command-dispatch-timeout`, `foundation-spine`, `fresh-tenant-command-dispatch`, `memory-foundation`, `phase0-slices-1-2`, `slack-channel-debug`, `slack-chief-online`, `vault-refresh-command-v1`, `vault-refresh-recovery`). Old unmerged historical branch `codex/phase0-slices-3-4` is intentionally left alone for now.
- **Native memory foundation merged, deployed, and production-smoked (2026-03-12, session 57):** `codex/memory-foundation` was fast-forwarded into `main` and initially landed at `eaf536a`, but Vercel skipped the production build because the repo `ignoreCommand` only compares `HEAD^..HEAD` and the top commit in that push was docs-only. A no-op `vercel.json` formatting commit `8709e50` was then pushed to force the real deploy, and GitHub/Vercel reported deployment `success` at `https://vercel.com/sanchalrs-projects/pixelport-launchpad/9RtV8LqB4ajevk74hkZri1yJLV2S`. Same-session production smoke on tenant `vidacious-4` confirmed backend truth (`memory_native_enabled=true`, `memory_mem0_enabled=false`, `agent_tasks=5`, `competitors=4`, `vault_sections=5`, all `ready`), healthy droplet runtime on `137.184.56.1`, the expected `memorySearch` config and scaffold files, live `openclaw memory search` hits from both `MEMORY.md` and `memory/active-priorities.md`, and the new production `/api/agent/memory` graceful-degradation behavior (`GET` disabled payloads, `POST` 409 `mem0_disabled` instead of raw `500`). The earlier disposable canary remains the proof that fresh tenants inherit native memory, with the already-documented caveat that it proved indexing/inheritance rather than full task/competitor/workspace-event completeness.
- **Native memory foundation branch is CTO-approved and pushed (2026-03-12, session 55):** CTO review approved `codex/memory-foundation` after two small pre-commit fixes. `.playwright-cli/` is now ignored, the bundled out-of-scope `api/inngest/index.ts` `INNGEST_SERVE_HOST` support is explicitly documented, commit `a6b29af` was created (`feat: add native memory foundation`), and the branch is pushed to `origin/codex/memory-foundation`. The branch is now ready for merge/deploy execution plus same-session production smoke.
- **Native memory foundation is ready for CTO review (2026-03-12, sessions 53-54):** Branch `codex/memory-foundation` now has repo-side native-memory defaults, provisioning fail-fast env/config emission, native-memory scaffold/guidance, and Mem0 graceful degradation validated locally with focused `vitest` coverage plus `npx tsc --noEmit`. Live repair on tenant `vidacious-4` (`6c6ae22c-d682-4af6-83ff-79913d267aea`, droplet `557399795` / `137.184.56.1`) now proves native memory is searchable from both layers: `openclaw memory search "Pixie Vidacious video ads"` returned `MEMORY.md` and `memory/business-context.md`, while `openclaw memory search "Canonical status snapshot recorded 5 tasks created"` returned `memory/active-priorities.md`. Fresh canary `linear-memory-canary-r2` (`267c3eac-5824-4f8b-a3e6-777b4d26f933`, former droplet `557679536` / `167.172.155.156`) also showed the validated `memorySearch` config, native-memory scaffold, `MEMORY_OPENAI_API_KEY` present, `MEM0_API_KEY` absent, and successful search hits from both `MEMORY.md` and `memory/active-priorities.md` before cleanup. The canary's truthful backend state at capture time was `vault_sections=5`, `agent_tasks=0`, `competitors=0`, `workspace_events=0`, so it proved memory inheritance/indexing but not broader dashboard write completeness in the local runtime. The disposable canary has now been cleaned up with the FK-safe DB order, the auth user deleted, and the droplet deletion verified by DigitalOcean `404`. Result: this memory slice is ready for CTO review; do not merge before approval.
- **Slack channel policy fix merged, deployed, and production-smoked (2026-03-11, session 51):** Founder approved `codex/slack-channel-debug` at `7202c36`, the branch was fast-forwarded into `main`, and GitHub/Vercel reported the production deployment `success` for target URL `https://vercel.com/sanchalrs-projects/pixelport-launchpad/6zyqSS8epF3M6dU3zUdg2mqeUozz`. Same-session production smoke on active tenant `vidacious-4` confirmed the debug/control-plane truth (`GET /api/debug/slack-status` returned one active Analog row for `TS7V7KT35`), the droplet Slack config still contained `groupPolicy: "open"`, Socket Mode remained connected, and the droplet session store still contained the real invited-channel reply in `#vidacious-new-registrations` on channel `C0A9C605ELD`. Result: the Slack-only invited-channel failure on the current active tenant is fixed and codified in production.
- **Slack channel reply fix validated on branch `codex/slack-channel-debug` (2026-03-11, session 50):** Active tenant `vidacious-4` (`6c6ae22c-d682-4af6-83ff-79913d267aea`, droplet `557399795` / `137.184.56.1`) now shows exactly one active Analog Slack row with the full 13-scope install set. Live runtime inspection proved the current `2026.3.2` droplet was defaulting `channels.slack.groupPolicy` to `allowlist` when that field was omitted, which blocked invited-channel traffic even though DM and Socket Mode were healthy. Branch `codex/slack-channel-debug` now makes `groupPolicy: "open"` explicit in Slack activation/config verification and adds focused regression coverage. Local validation passed (`vitest` Slack suite + `npx tsc --noEmit`). A direct production config correction on the target droplet hot-reloaded cleanly, and both the founder-provided screenshot and the droplet session store proved live replies in private channel `#vidacious-new-registrations` (`C0A9C605ELD`). This supersedes the old collision theory for the current active tenant after the old Analog rows were manually removed. Next gate is CTO review; do not merge before approval.
- **Slack chief online merged, deployed, and production-QA'd with one remaining workspace-collision issue (2026-03-10, session 49):** `codex/slack-chief-online` was approved at `cc68614`, merged to `main` as `3b6b401`, and deployed successfully on Vercel. Same-session production smoke on tenant `bootstrap-truth-qa-20260310054029` confirmed the production install URL, 13-scope callback row, truthful `activating -> active` dashboard state, and final droplet Slack config on `142.93.117.18`. Direct DM behavior passed in the real Analog workspace. However, invited-channel behavior did not isolate cleanly to the new QA tenant: old active Analog-linked tenants `vidacious` and `vidacious-1` are still present in `slack_connections` for the same workspace `TS7V7KT35`, and the test channel reply came from the older `Florence by Pocodot` app instead of the newly activated Pixel tenant. Result: the Slack release shipped, but shared-workspace invited-channel routing remains an open Slack-only follow-up that must not be “fixed” by deactivating old rows or changing routing strategy without a separate founder-approved decision.
- **CTO-required Slack activation fix applied (2026-03-10, session 48):** CTO review returned `APPROVED with 1 required fix`: make the Slack welcome DM step fully best-effort so Slack network errors or non-JSON responses cannot fail the `activate-slack` Inngest function after `mark-slack-active`. The branch now wraps `send-slack-welcome-dm` in `try/catch`, logs thrown DM failures, returns a non-fatal error payload, and includes a focused regression test proving activation still succeeds when Slack returns HTML instead of JSON. Required revalidation passed: `npx vitest run src/test/slack-activation.test.ts` and `npx tsc --noEmit`. `codex/slack-chief-online` now satisfies the CTO review gate; the remaining step is merge/deploy plus the planned founder-led production Slack QA on `bootstrap-truth-qa-20260310054029`.
- **Slack chief online branch is ready for CTO review; live Slack QA is deferred to post-deploy production (2026-03-10, session 47):** The Slack continuation session pivoted away from the abandoned local `vercel dev` + `localtunnel` path. `codex/slack-chief-online` was re-audited from commit `1ed362e`, and the branch diff still stayed inside the approved Slack slice with `api/inngest/functions/provision-tenant.ts` and the other frozen provisioning/bootstrap/dashboard-truth files untouched. The only new code hardening in session 47 was Slack install/callback redirect normalization for multi-value `x-forwarded-proto` headers, covered by focused route tests. Targeted validation passed: `npx vitest run src/test/slack-connection.test.ts src/test/slack-install-route.test.ts src/test/slack-callback-route.test.ts src/test/connections-route.test.ts src/test/slack-activation.test.ts src/pages/dashboard/Connections.test.tsx` and `npx tsc --noEmit`. The review-ready branch tip is now pushed on `origin/codex/slack-chief-online` with commits `6b9ba1d` and `e4af10c`. Review artifacts are ready at `docs/build-briefs/2026-03-10-slack-chief-online.md`, `docs/qa/2026-03-10-slack-chief-online.md`, and `docs/build-briefs/2026-03-10-slack-chief-online-cto-prompt.md`. Next gate is CTO review; merge/deploy and founder-led production Slack QA on stable tenant `bootstrap-truth-qa-20260310054029` must wait until after approval.
- **Slack rescue completed without touching the frozen provisioning baseline (2026-03-10, session 46):** Broken Slack thread `019cd686-bfed-79d2-8bda-2e2813097f5a` was converted into a clean branch handoff instead of a feature continuation. Full dirty state was checkpointed on `codex/slack-rescue` as commit `1b7883a` (`chore: checkpoint slack rescue state`). Only Slack-scoped files were then restored onto `codex/slack-chief-online` and committed there as `664010a` (`feat: recover slack chief online flow`). The dirty provisioning diff in `api/inngest/functions/provision-tenant.ts` was explicitly classified as out-of-scope contamination because it removed `SLACK_APP_TOKEN` from the droplet env file while the Slack activation path still depends on that env var for Socket Mode. Result: the broken fresh-tenant/provisioning failure was contamination, not a Slack-required baseline change. No merge, deploy, or fresh-tenant reprovisioning was performed in the rescue session. The next Slack execution session should start from `codex/slack-chief-online` and keep tenant creation, provisioning, droplet bootstrap, durable bootstrap truth, and existing dashboard read truth frozen unless a specific Slack necessity is proven first.
- **Bootstrap truth fix shipped to production (2026-03-10, session 45):** Branch `codex/bootstrap-persistence-truth` was approved by Claude CTO, committed as `5fb577a`, merged to `main` as `63d4585`, deployed on Vercel as `dpl_95ZcsYCvVvbkduyDcYUm9FFUv9Vy`, and production-smoked on `https://pixelport-launchpad.vercel.app`. The fix now uses injected runtime env vars directly in generated `TOOLS.md`, derives bootstrap completion from durable backend truth (`tasks >= 1`, `competitors >= 1`, `vault_ready = 5/5`), and prevents single-write false completion. Controlled QA tenant `bootstrap-truth-qa-20260310054029` (`39a234b7-3ca5-4668-af9f-b188f2e5ec34`) still showed the intended final production truth after deploy: tenant `active`, bootstrap `completed`, `tasks=5`, `competitors=4`, `vault_ready=5/5`, with live API responses matching Supabase exactly. `analog-2` was not repaired in this release and must stay a separate approval step.

---

### Notes

- **QA rule update for Slack/post-provision features (2026-03-10, session 47):** Fresh tenants are now reserved for onboarding, provisioning, or bootstrap changes. Post-provision feature work such as Slack should prefer stable completed QA tenants unless a reproduced bug proves fresh provisioning is directly relevant.
- **Next command-dispatch gate (2026-03-09, planning):** Because the current timeout was observed on an older test tenant and the founder is willing to discard old test tenants, the next execution session should validate a brand-new tenant first. New brief: `docs/build-briefs/2026-03-09-fresh-tenant-command-dispatch-canary.md`. Only if the fresh-tenant canary fails should Codex spend time fixing provisioning/runtime reachability.
- **Fresh-tenant command-dispatch gate passed (2026-03-09, session 38):** Brand-new production tenant `pixelport-fresh-command-20260309055402` (`650e3d26-1100-48b2-b77d-157d9efb73c5`, droplet `556921894` / `142.93.121.149`) reached `active`, exposed the public gateway on `18789`, completed bootstrap, and successfully ran a dashboard-originated command canary end to end. `POST /api/commands`, `GET /api/commands`, `GET /api/commands/:id`, and correlated `workspace_events` all behaved correctly, and the runtime wrote the canary artifact under `pixelport/runtime/snapshots/fresh-command-canary.json`. Result: the old `vidacious-ai-4` timeout is stale/disposable test-tenant drift, not a fresh-tenant production bug. No code change or CTO review was required.
- **Vault refresh command v1 shipped to production (2026-03-09, sessions 41-42):** The Knowledge Vault now has live section-level `Refresh with Chief`, typed `vault_refresh` creation through the existing ledger, and final truth writes through the existing live vault path. Fresh-tenant validation first passed on `vault-refresh-qa-20260309` (`1e45c138-0eca-4f08-a93e-ca817dced78b`, droplet `556931113` / `198.199.80.171`) using command `c69be644-fd37-4047-9883-512f90ff1637`. After merge, production smoke exposed a Vercel import bug and then a same-tenant overlap bug; both were fixed on `main`. Production now uses `api/lib/vault-contract.ts` for server-safe imports, and `vault_refresh` is guarded to one active command per tenant with additive `reuse_reason: "active_command_type"`. Live production smoke confirmed that a new cross-section refresh request reuses the existing active command instead of creating another row, and the Vault page disables all refresh buttons while that tenant-wide refresh is active. Remaining hardening gap: stale non-terminal command recovery for old stuck command rows.
- **Vault refresh stale recovery implemented and validated on branch (2026-03-09, session 43):** Branch `codex/vault-refresh-recovery` now classifies stale non-terminal `vault_refresh` rows using real command timestamps, correlated `workspace_events`, and current `vault_sections` truth; exposes additive `stale` metadata on `GET /api/commands` and `GET /api/commands/:id`; and auto-repairs stale rows in `POST /api/commands` before the existing tenant-wide reuse decision. Real QA validation on `vault-refresh-qa-20260309` repaired the old stuck `brand_voice` command `2a351c7d-15b4-42f7-aca7-11b171072fa8`, emitted `command_events.event_type = "stale_recovered"`, created new retry command `638686d1-a31b-4d9f-9d5d-99e506d0300f`, and completed that new command successfully while preserving tenant-wide `reuse_reason: "active_command_type"` for a second concurrent refresh request. Adjacent authenticated reads remained healthy. Remaining step: CTO review via `docs/build-briefs/2026-03-09-vault-refresh-recovery-cto-prompt.md` before merge.
- **Vault refresh stale recovery shipped to production (2026-03-09, session 44):** After Claude CTO approval, branch `codex/vault-refresh-recovery` was pushed, merged into `main` as `13f3d81`, deployed on Vercel as `dpl_89X7zuMu124Fj5wrSGLDsTw1Nbut`, and smoke-tested on the live alias `https://pixelport-launchpad.vercel.app`. Production smoke on the real QA tenant confirmed that `GET /api/commands?command_type=vault_refresh` and `GET /api/commands/:id` now both expose the additive `stale` field, a real live `products` refresh created command `93c2a749-da91-43ee-9d99-eaeb296a427c`, a second concurrent refresh request reused that active command with `reuse_reason: "active_command_type"`, the live UI disabled all refresh buttons only during the healthy active run and re-enabled them after completion, correlated `workspace_events` reached `command.completed`, and adjacent authenticated reads stayed healthy. Because the real stale `brand_voice` row had already been auto-repaired during branch QA, the production smoke validated the shipped API shape, unblocked retry path, and guard preservation rather than re-creating a new stale row on production.
- **CTO architecture review approved (2026-03-08):** Claude CTO approved the replacement architecture and first foundation slice, with additive-rollout conditions: keep existing `/api/agent/*` and `/api/tasks/*` paths untouched in the first implementation session, keep the new command ledger and `workspace-events` ingest additive, and treat the bootstrap prompt-surface refresh as `SOUL.md` + `TOOLS.md` + `AGENTS.md` + `HEARTBEAT.md` + `BOOTSTRAP.md` work rather than directory scaffolding alone.
- **Foundation spine implementation complete (2026-03-09, session 35):** The approved additive replacement slice is now implemented on branch `codex/foundation-spine`. It adds the command ledger migration/API spine, the `workspace-events` ingest endpoint, the full workspace prompt-surface bootstrap scaffolding, and matching schema/test updates without touching the protected existing `/api/agent/*`, `/api/tasks/*`, or current dashboard read paths. Next gate is Claude CTO review using `docs/build-briefs/2026-03-08-foundation-slice-cto-prompt.md`.
- **CTO implementation review approved (2026-03-09, session 35):** Claude CTO returned `Verdict: APPROVED` for the foundation slice and found no blocking code issues. The only required follow-up before merge is process: the reviewed working-tree diff must be committed to `codex/foundation-spine` so the approved implementation actually exists on the review branch.
- **Architecture replacement briefs drafted (2026-03-08, session 34):** The previous Supabase-canonical runtime/admin direction is now formally under redesign. New briefs exist at `docs/build-briefs/2026-03-08-workspace-canonical-architecture.md`, `docs/build-briefs/2026-03-08-foundation-slice.md`, and `docs/build-briefs/2026-03-08-workspace-canonical-cto-prompt.md`. Do not start Sessions 11-12 from the old Phase 3 sequence until the replacement architecture is CTO-reviewed and the new foundation slice is approved.
- **Build workflow update (2026-03-07, session 31):** Future work now follows `planning thread -> repo build brief -> separate execution session`. Medium/high builds default to `codex/*` branches and require Claude CTO review before merge. After approval, Codex may merge/deploy and run same-session production smoke. Reference: `docs/build-workflow.md` and `docs/build-briefs/template.md`.
- **Q&A research thread opened (2026-03-07, session 30):** A separate Codex session is now reserved for founder Q&A, targeted research, and drafting future implementation prompts. No checklist items changed from that session; use it to refine scope before starting execution sessions.
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
- **Founder priority update (2026-03-06, session 18):** Browser tooling is not a near-term blocker as long as the Chief can still produce useful research without it and the dashboard shows real backend activity. Keep browser-tool investigation de-prioritized unless QA reveals a browser-only workflow gap.
- **Live truthfulness check (2026-03-06, session 18):** Pushed commit `ee284b3` to `main` and re-validated `vidacious-ai-4` on production. Dashboard `Recent Activity` now maps to real `agent_tasks` rows, not placeholder onboarding text. Authenticated API check for the tenant returned `active`, `5` completed research tasks, `3` competitor rows, and all `5` vault sections `ready`.
- **Current web-access nuance (2026-03-06, session 18):** Fresh tenants are clearly producing real research artifacts, but `tools.web` is still empty on live tenant configs until `GEMINI_API_KEY` is added to Vercel. Treat explicit Gemini-backed search as a capability gap, not as evidence that the current onboarding research is fake.
- **Workflow tooling added (2026-03-07, session 19):** `.mcp.json` now includes GitHub MCP (remote HTTP) and DigitalOcean MCP (local wrapper using the secure `~/.pixelport/get-secret.sh` flow). New Codex skills were added for `pixelport-fresh-tenant-canary`, `pixelport-openclaw-upgrade`, and `pixelport-release-smoke`. Supabase MCP is still pending a proper `SUPABASE_ACCESS_TOKEN`.
- **OpenClaw `2026.3.2` canary upgrade (2026-03-07, session 24):** Fresh-tenant provisioning now pins OpenClaw `2026.3.2`, validates `openclaw.json` via `docker run --rm ... openclaw.mjs config validate --json` before gateway start, and disables ACP dispatch by default with a validation-gated fallback if the ACP keys are rejected. The first canary exposed a real onboarding write-contract bug (`research_*` task types), which was fixed by preserving `scan_results` in tenant onboarding data, tightening the bootstrap/SOUL task contract, and normalizing task aliases in `api/agent/tasks.ts`.
- **Current canary verdict (2026-03-07, session 24):** A second fresh tenant on `2026.3.2` reached `active`, passed config validation, accepted bootstrap, wrote real rows (`9` tasks, `5` ready vault sections, `5` competitors), and the authenticated dashboard APIs returned those same rows instead of placeholders. However, the explicit `tools.profile: "full"` smoke still fails on browser access: shell and file tools succeed, but the browser tool times out against the OpenClaw browser control service. Recommendation is `keep canary only`, not broad roll-forward yet.
- **Health probe nuance (2026-03-07, session 24):** `/health`, `/healthz`, `/ready`, and `/readyz` all return `200` on the canary droplet, but each serves the HTML control UI rather than a dedicated readiness payload. Keep `/health` as the coded gate for now and treat the others as observational only.
- **Founder rollout decision (2026-03-07, session 25):** Founder explicitly approved broad rollout of the OpenClaw `2026.3.2` default after the successful fresh-tenant canary. Browser control timeout is now tracked as a non-blocking follow-up because the Chief still completed useful onboarding work and wrote truthful backend data without it.
- **Post-rollout QA handoff (2026-03-07, session 25):** Use `docs/openclaw-2026-3-2-qa-brief-2026-03-07.md` for the next-session validation pass after production rollout.
- **Post-rollout production QA result (2026-03-07, session 26):** A brand-new production tenant (`50d6ac40-3a73-4321-8258-86efc5404ebe`, droplet `556582623` / `157.230.185.69`) passed the core `2026.3.2` rollout gates: cloud-init completed, `pixelport-openclaw:2026.3.2-chromium` ran successfully, OpenClaw reported `2026.3.2`, `/opt/openclaw/config-validate.json` returned `valid: true`, ACP dispatch stayed disabled, hooks mapping was intact, the tenant reached `active`, and the authenticated dashboard/API surfaces returned the same real backend rows seen in Supabase.
- **Fresh-tenant follow-up bug from session 26:** The dashboard home page replayed `POST /api/tenants/bootstrap` after the tenant became `active` but before the original onboarding bootstrap had fully written data. That race created duplicate onboarding artifacts on the fresh tenant (`16` tasks total, `9` competitor rows with duplicate names like `Jasper`, `Klue`, and `Crayon`). Treat bootstrap idempotency/race-proofing as the highest-priority production fix on top of the otherwise successful rollout.
- **Bootstrap idempotency hotfix implemented locally (2026-03-07, session 27):** Bootstrap lifecycle state now persists inside `tenants.onboarding_data.bootstrap`, provisioning marks bootstrap `dispatching` before exposing the tenant as `active`, the replay endpoint returns `409` for `bootstrap_in_progress` / `bootstrap_already_completed` before duplicate writes can land, `GET /api/tenants/status` now exposes additive `bootstrap_status`, and Dashboard Home only auto-replays bootstrap for legacy recovery cases (`active` + no tasks + bootstrap `not_started` or `failed`). Agent-origin task/competitor/vault writes now flip bootstrap to `completed` on the first successful write.
- **Bootstrap race hardening follow-up implemented locally (2026-03-07, session 28):** The bootstrap state helper now uses optimistic compare-and-set semantics keyed on `tenants.updated_at`, which prevents concurrent replay requests from both dispatching after reading the same stale state. State transitions are now monotonic by default, so stale `accepted` / `failed` writes cannot overwrite a later `completed` state, while `force=true` still intentionally bypasses the monotonic guard for manual replay. `GET /api/tenants/status` now also returns additive `has_agent_output`, and Dashboard Home uses it to avoid even wasted legacy replay calls when competitors or agent-written vault output already exist before task rows appear.
- **Bootstrap idempotency validation passed live (2026-03-07, session 29):** Fresh production tenant `vidacious-ai-5` validated the full replay hardening path on the pushed `5a4030a` build. In the critical live race window the tenant reached `active` with `bootstrap_status=accepted` and no agent output, Home did not emit a second bootstrap request, manual replay correctly returned `409 bootstrap_in_progress`, and after the first agent writes landed the state moved to `completed` and replay correctly returned `409 bootstrap_already_completed`. Final tenant state during validation: `10` task rows, `3` unique competitors, all `5` vault sections `ready`.
- **New follow-up regression from session 29:** The signed-out child-route deep-link flow is only partially fixed. On the fresh tenant run, `/dashboard/content` redirected to `/login` correctly and initially returned to `/dashboard/content` after onboarding, but the app later drifted to `/dashboard` during the early provisioning window without user action. Normal authenticated hard-loads to `/dashboard/content`, `/dashboard/connections`, `/dashboard/vault`, and `/dashboard/competitors` still held correctly once the tenant was active.
- **Current runtime caveats after rollout QA (2026-03-07, session 26):** Browser control timeout remains non-blocking but unresolved, `GEMINI_API_KEY` and `AGENTMAIL_API_KEY` are still empty on fresh droplets, `sessions_log` stayed at `0`, and the runtime still logs noisy `web_search` / shell-tool failures (`missing_brave_api_key`, `python`/`rg`/`jq` issues) before completing a conservative onboarding pass.

---

## What Comes After Phase 3

**Phase 4: Dashboard Polish + Trust (Weeks 13–16)**
- Performance page, agent detail page
- API keys management, budget controls, brand voice enforcement
- Audit log, team management + RBAC, Stripe billing

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
