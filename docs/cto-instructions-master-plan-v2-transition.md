# CTO Instructions — Transition to PixelPort Master Plan v2.0

**Date:** 2026-02-28
**From:** Founder (Sanchal)
**To:** CTO (Claude Code) + Codex execution team
**Priority:** Immediate — read before any new work

---

## What Happened

We completed a 52-question architecture Q&A that locked every major product and infrastructure decision for PixelPort. The result is **Master Plan v2.0** — replacing the v1.0 plan you've been working from.

**The old `pixelport-master-plan.md` in the project folder is now obsolete.** Replace it with the v2.0 file attached.

---

## Key Shifts You Need to Know

### 1. Product Model Changed
- **Old**: 3 visible agents (Luna + Scout + Spark), customers interact with all
- **New**: **"Your AI Chief of Staff"** — one visible agent per customer (customizable name/avatar/tone). Scout and Spark become invisible sub-agents that the Chief of Staff spawns behind the scenes. Customers only interact with their Chief of Staff.

### 2. Tech Stack Additions
These are **new** services not in v1.0 that you'll be deploying:

| Service | What It Does | Your Responsibility |
|---------|-------------|-------------------|
| **LiteLLM** | Central LLM gateway — all agent API calls route through it. Budget caps, multi-provider routing, metering | Deploy central instance, configure per-tenant routing |
| **Inngest** | Durable workflow engine — replaces cron for approvals, scheduling, onboarding | Write workflow functions, connect to PixelPort API |
| **Mem0** (managed cloud) | Persistent memory — vector + graph DB per tenant | Integrate REST API into agent runtime, scope per tenant |
| **PostHog** | Analytics + LLM tracking + MCP server for agent self-optimization | Deploy, instrument events, configure MCP for agent access |

### 3. Lovable Cloud Is the Frontend
- **You do NOT build the frontend.** Founder + Claude (in claude.ai) design all dashboard pages in Lovable.
- **You DO integrate with it.** Lovable Cloud auto-provisions Supabase and deploys to GitHub. You push backend code to the same repo. You write the API endpoints that Lovable pages consume.
- **Supabase is the shared database.** Schema design happens collaboratively — founder defines what the UI needs, you implement the migrations and API layer.

### 4. Work Split

| Stream | Owner | Scope |
|--------|-------|-------|
| **Frontend** (all Lovable pages) | Founder + Claude (claude.ai) | Landing, onboarding, dashboard, content pipeline, calendar, performance, settings, chat widget |
| **Backend + Infra** | CTO + Codex | OpenClaw provisioning, LiteLLM, Inngest workflows, Mem0 integration, PostHog, AgentMail tenant setup, API bridge, agent templates, security |
| **Integration** | CTO + Codex | Connect API endpoints to Lovable-built UI, Supabase migrations, Vercel API routes |

### 5. Phase Timeline Changed
- **Email**: Moved to Phase 1 (was Phase 5) — core to Chief of Staff
- **Image gen**: Moved to Phase 2 (was Phase 5) — essential for social content
- **Video gen**: Moved to Phase 3 (was Phase 5) — GTM needs video
- **Audit log/RBAC**: Stays Phase 4

### 6. Pricing Locked
$299/mo Starter (1 agent) → $999/mo Pro (3 agents) → $3K+ Enterprise. 14-day free trial. Public on website. This affects provisioning — trial tenants need budget caps via LiteLLM.

---

## Your Immediate Next Actions

### Action 1: Read Master Plan v2.0
Read the full `pixelport-master-plan-v2.md` — especially Sections 3 (Architecture), 11 (Infrastructure), 14 (Work Split), and 15 (Build Phases).

### Action 2: Update Project Files
Replace `docs/pixelport-master-plan.md` in the project repo with v2.0. Update `CLAUDE.md` to reference the new plan.

### Action 3: Start Phase 0 Backend Work
Your Phase 0 scope (while founder builds Lovable frontend in parallel):

- [ ] **0.4**: Write OpenClaw provisioning script — spin up DO Droplet + OpenClaw container per user
- [ ] **0.5**: PixelPort API → OpenClaw gateway bridge (token auth, tenant routing)
- [ ] **0.6**: Deploy LiteLLM central instance, configure multi-tenant routing
- [ ] **0.8**: Supabase schema: tenants, agents, sessions, metrics (coordinate with founder on what UI needs)

**Do NOT work on**: Landing page, auth UI, dashboard shell — those are Lovable/founder scope.

### Action 4: Prepare Integration Points
Document the API contracts that Lovable pages will consume:
- `GET /api/tenants/:id/agents` — agent status for dashboard
- `POST /api/tenants/:id/provision` — trigger Inngest provisioning workflow
- `GET /api/tenants/:id/content` — content pipeline items
- `POST /api/tenants/:id/content/:id/approve` — approval action
- etc.

Share these with founder so Lovable pages can be built against the contract.

### Action 5: Growth Swarm Maintenance
Growth Swarm continues running on current droplet. No changes needed. LUNA keeps operating. When PixelPort Phase 1 is ready, we migrate Vidacious as first tenant.

---

## Shared Resources

| Resource | Access |
|----------|--------|
| **GitHub repo** | Lovable Cloud auto-pushes frontend. You push backend to same repo. |
| **Supabase** | Provisioned by Lovable Cloud. Connection string shared. |
| **Vercel** | Connected to GitHub repo. API routes live alongside frontend. |
| **DO account** | Existing — you already have access for Growth Swarm droplet. |

---

## Questions?

If anything in v2.0 conflicts with what you've built or seems unclear, flag it. The 52 decisions are locked but implementation details are flexible.

---

## Files to Replace

| Old File | New File |
|----------|----------|
| `docs/pixelport-master-plan.md` (v1.0) | `docs/pixelport-master-plan.md` (v2.0) |
| `CLAUDE.md` | Update to reference v2.0 plan, new tech stack, work split |
