# PixelPort Transition Plan — Post-P6 to Headless Paperclip + Conductor

## Status: PENDING FOUNDER LOCK

> Binding reference: `decision-brief-2026-03-19.md`
> This plan replaces `docs/post-p6-next-program-draft-2026-03-19.md` once locked.

---

## Current State (Where We Are)

- P6 reset is COMPLETE (R1-R5 merged, production smoke passed)
- Repo: `Analog-Labs/pixelport-launchpad` on `main`
- Tenant droplet stack: Caddy → Paperclip (v2026.318.0) → OpenClaw (2026.3.13-1), Postgres embedded
- Launch flow: Clerk auth → onboarding → provision → handoff token → gateway-token auto-login to Paperclip UI
- Dashboard: Vercel-hosted React (Lovable-built), currently a separate experience from the tenant workspace
- Dev process: Manual coordination between Codex (developer) and Claude Code (CTO/QA)
- Post-P6 draft exists at `docs/post-p6-next-program-draft-2026-03-19.md` with pending decision gates — THIS PLAN SUPERSEDES IT

## Target State (Where We're Going)

- Paperclip runs headless (API only, no UI served to tenants)
- PixelPort dashboard on Vercel is THE product experience, consuming Paperclip API via proxy
- Conductor + gstack manages development workflow
- Frontend built via Claude Code locally, deployed to Vercel deliberately
- Architecture drift prevented by Decision Briefs + CLAUDE.md constitution gates

---

## Phase T0 — Process Setup (Before Any Code)

**Goal:** Set up Conductor + gstack so all subsequent phases use the new dev process.

**Owner:** Founder (Sanchal)

### Steps:

1. **Install Conductor** on Mac, connect to GitHub (Analog-Labs/pixelport-launchpad)
2. **Install gstack** into Claude Code skills directory:
   ```
   git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
   cd ~/.claude/skills/gstack && ./setup
   ```
3. **Update CLAUDE.md** in the repo with:
   - gstack skills reference section
   - Architecture gates section (from Decision Brief)
   - Reference to this Decision Brief as binding
   - Updated "Who Does What" to reflect Conductor roles
4. **Update `docs/ACTIVE-PLAN.md`** to reflect this transition plan as the current program
5. **Lock Decision Brief** into project knowledge (Claude Chat, Codex, Claude Code all reference it)
6. **Test the loop:** Create one small task in Conductor, have CTO agent run `/plan-ceo-review`, have Developer agent implement, have CTO `/review` the PR. Verify the full cycle works before starting real architecture work.

**Exit criteria:** One successful Conductor task cycle completed end-to-end.

---

## Phase T1 — Paperclip API Audit

**Goal:** Map every Paperclip REST endpoint the dashboard needs. Confirm API stability and sufficiency.

**Owner:** CTO Agent (Claude Code + gstack)

### Steps:

1. **Enumerate Paperclip API surface** — Read Paperclip server source (route files) on the live droplet or from upstream repo. Document every endpoint under `/api/companies/:companyId/*`
2. **Categorize by dashboard need:**
   - MUST HAVE: issues CRUD, runs list/detail, agents list/status, approvals list/action, cost summary
   - SHOULD HAVE: workspace files read/write (SOUL.md, MEMORY.md), run streaming (WebSocket/SSE)
   - NICE TO HAVE: org chart, budget config, heartbeat config
3. **Test each endpoint** against the live canary droplet — confirm request/response shapes, auth requirements, and error behavior
4. **Document the API contract** as a reference doc in the repo: `docs/paperclip-api-contract.md`
5. **Identify gaps** — anything the dashboard needs that Paperclip doesn't expose as API

**Exit criteria:** Complete API contract doc with tested endpoint shapes, auth flow documented, and gap list (if any).

---

## Phase T2 — Proxy Layer Build

**Goal:** Build the Vercel API proxy that forwards authenticated dashboard requests to tenant Paperclip instances.

**Owner:** Developer Agent (Codex/Claude Code via Conductor)

### Design:

```
Browser (app.pixelport.app)
  → GET /api/tenant-proxy/issues
  → Vercel API route:
      1. Authenticate via Clerk (existing)
      2. Look up tenant record in Supabase (get droplet IP / runtime URL)
      3. Forward request to https://tenant-slug.IP.sslip.io:3100/api/companies/:companyId/issues
         with Paperclip session auth (handoff token or forwarded cookie)
      4. Return response to browser
```

### Steps:

1. **Create `/api/tenant-proxy/[...path].ts`** — Generic proxy route that forwards any sub-path to the tenant's Paperclip API
2. **Auth bridge:** Decide exact mechanism:
   - Option A: Proxy creates a Paperclip session via handoff token on first request, caches session cookie, forwards it on subsequent requests
   - Option B: Paperclip API accepts a bearer token (handoff JWT) directly without session cookie — may require a small Paperclip server patch
   - RECOMMENDATION: Start with Option A (handoff → session cookie → cache in encrypted server-side session)
3. **CORS / security:** Proxy runs server-side on Vercel, so no browser CORS issues. Proxy must validate Clerk auth + tenant ownership before forwarding.
4. **Error handling:** Tenant droplet down → graceful error in dashboard ("Your workspace is starting up...")
5. **Test against live canary droplet**

**Exit criteria:** Proxy routes working end-to-end — browser → Vercel proxy → tenant Paperclip API → response rendered in dashboard.

---

## Phase T3 — Dashboard V1 (Core Views)

**Goal:** Build the first set of dashboard views consuming Paperclip API via proxy.

**Owner:** Developer Agent (via Conductor), with CTO `/plan-ceo-review` before each view

### Views to build (in order):

1. **Agent Status Cards** — Show each agent's name, role, status (online/offline), budget usage, last run time. Simple, visual, high-impact.
2. **Task Board** — List of issues/tasks with status (backlog, in_progress, done, blocked). Click to expand detail with conversation thread. Approve/reject buttons for approval-gated tasks.
3. **Run History** — List of recent agent runs with cost, duration, success/fail. Expandable to show run output (streamed if possible, otherwise polled).
4. **Approval Queue** — Dedicated view for pending approvals. Approve/reject with one click.

### Design approach:

- Reuse existing PixelPort design system (zinc palette, amber accents, dark theme)
- Built locally via Claude Code, tested locally with `npm run dev`
- Deploy to Vercel only for staging/production validation
- Each view is a Conductor task → CTO reviews → merge

**Exit criteria:** All four core views rendering real Paperclip data from a canary tenant.

---

## Phase T4 — Chat Integration

**Goal:** Enable "chat with your agent" in the PixelPort dashboard.

**Owner:** Developer Agent + CTO review

### Options (decide during T4 kickoff):

- **Option A: WebSocket proxy** — Dashboard opens WebSocket to Vercel edge function, which proxies to Paperclip's OpenClaw adapter WebSocket. Most seamless but most complex.
- **Option B: Direct WebSocket** — Dashboard opens WebSocket directly to tenant droplet (requires CORS config on Caddy + auth token in URL). Simpler but exposes tenant URL to browser.
- **Option C: REST polling** — Dashboard polls Paperclip run output endpoint. Simplest, but not real-time chat experience.

RECOMMENDATION: Start with Option C (polling) for V1, upgrade to Option A or B when chat UX becomes a priority.

**Exit criteria:** User can send a message and see agent response in dashboard.

---

## Phase T5 — Marketing Features (PixelPort Differentiators)

**Goal:** Build the features that make PixelPort a marketing SaaS, not just an agent dashboard.

**Owner:** Developer Agent + Founder product input

### Features:

- Content Calendar (task-backed, reads scheduled tasks from Paperclip)
- Competitor Intelligence (agent-generated, stored in workspace files, surfaced via API)
- Knowledge Vault (read/write to workspace SOUL.md and custom vault files)
- Integration connectors (Gmail, Slack, Calendar — OpenClaw tools/plugins)

These are designed and scoped per-feature with Decision Briefs as needed.

---

## Phase T6 — Cleanup & Migration

**Goal:** Remove legacy code paths, update golden image to not serve Paperclip UI (optional optimization), update all docs.

### Steps:

- Prune unused launchpad runtime APIs that assumed Paperclip UI redirect
- Update provisioning to not require Paperclip UI build in golden image (saves image size, optional)
- Update all docs to reflect headless Paperclip architecture as canonical
- Archive Growth Swarm references definitively

---

## Sequencing Summary

| Phase | What | Depends On | Est. Effort |
|---|---|---|---|
| T0 | Process setup (Conductor + gstack) | Nothing (do first) | 1 day |
| T1 | Paperclip API audit | T0 | 2-3 days |
| T2 | Proxy layer build | T1 | 3-5 days |
| T3 | Dashboard V1 core views | T2 | 1-2 weeks |
| T4 | Chat integration | T2 | 3-5 days |
| T5 | Marketing features | T3 | Ongoing |
| T6 | Cleanup & migration | T3 | 2-3 days |

**Critical path:** T0 → T1 → T2 → T3. Everything else can run in parallel after T2.

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Paperclip API not stable across versions | Proxy breaks on upgrade | Pin Paperclip version, integration test on every upgrade |
| WebSocket chat proxy is complex | Chat feature delayed | Start with REST polling (T4 Option C), upgrade later |
| Conductor is Mac-only | Can't use from other machines | Founder is on Mac; CTO/Codex can run via Claude Code CLI if needed |
| Vercel proxy adds latency | Sluggish dashboard | Acceptable for V1; optimize with caching or edge functions later |
| Handoff auth bridge is fragile | Proxy can't authenticate to Paperclip | Test thoroughly in T2; handoff plugin code already exists in repo |

---

## Decision Gates (Require Founder Approval)

- [ ] Lock this transition plan
- [ ] T2: Approve proxy auth mechanism (Option A vs B)
- [ ] T3: Approve dashboard V1 view designs before build
- [ ] T4: Approve chat integration approach (polling vs WebSocket)
- [ ] Any architectural change not covered by this plan or the Decision Brief
