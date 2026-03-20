# PixelPort Decision Brief — 2026-03-19

## Status: PENDING FOUNDER LOCK

> This document captures architecture and process decisions from the founder Q&A session on 2026-03-19.
> Once locked, this supersedes conflicting assumptions in older docs.
> Paste into project knowledge and reference from CLAUDE.md after locking.

---

## Decision 1: Headless Paperclip Architecture

**Decision:** Paperclip serves as a headless orchestration backend only. Its React UI is NOT served to tenants.

**What this means:**
- Paperclip server runs on each tenant droplet (port 3100) as API/orchestration infrastructure
- OpenClaw runs on each tenant droplet (port 18789, localhost only), managed by Paperclip's adapter
- Paperclip's REST API is consumed by PixelPort's own dashboard
- Paperclip's built-in React UI is not exposed — PixelPort builds its own frontend

**Why:** Paperclip's orchestration engine (run lifecycle, atomic task checkout, cost tracking, workspace memory management, bootstrap, OpenClaw WebSocket adapter) is genuinely valuable infrastructure that would take months to rebuild. Its UI is designed for developer power-users, not marketing founders — PixelPort's product differentiation lives in its own dashboard UX.

**Rejected alternative:** Using Paperclip UI with branding/plugin customization — rejected because the plugin system is weeks old (shipped v2026.318.0), fork maintenance burden grows with every customization, and it creates a category mismatch (agent orchestration UI vs. marketing SaaS UX).

**Rejected alternative:** Merging Paperclip into one app with shared Supabase auth — rejected because it would require massive rewrite, lose Paperclip's plugin system, lose tenant isolation, and defeat the Paperclip-primary pivot.

---

## Decision 2: Dashboard Stays on Vercel (Proxy Model)

**Decision:** The PixelPort dashboard remains centrally deployed on Vercel (`app.pixelport.app`). API calls to tenant Paperclip instances are proxied through Vercel API routes.

**Architecture:**

```
app.pixelport.app (Vercel) — CENTRAL
├── Marketing / landing pages
├── Clerk auth + onboarding
├── Billing (Stripe, deferred)
├── Provisioning trigger (Inngest)
├── THE DASHBOARD (full product UI)
│   ├── Agent status, tasks, approvals (via proxy → Paperclip API)
│   ├── Content calendar, competitor intel (own features)
│   ├── Chat with agent (WebSocket proxy or direct connect)
│   └── TryClam-style features (browse, integrations)
└── /api/tenant-proxy/* → forwards to tenant droplet Paperclip API

Tenant Droplet — PER-TENANT
├── Caddy (443, SSL)
├── Paperclip server (3100, API only)
│   ├── Orchestration, task management, runs
│   ├── Workspace/memory management (SOUL.md, MEMORY.md, daily notes)
│   ├── OpenClaw adapter (WebSocket to localhost)
│   └── Auth (better-auth, handoff plugin for session creation)
├── OpenClaw (18789, localhost only)
└── Postgres (embedded)
```

**Why:** Keeps fast Vercel deployment loop (no golden image rebuild for UI changes), centralized PostHog analytics, single dashboard codebase for all tenants, no cross-origin cookie issues (proxy handles it server-side).

**Tradeoff accepted:** ~50-100ms added latency per proxied API call. Acceptable for dashboard data (task lists, agent status, approvals — not real-time gaming).

**Rejected alternative:** Dashboard on tenant droplet — rejected because every UI change would require Docker image rebuild + rollout to all tenants, killing iteration speed.

---

## Decision 3: Paperclip Features to Surface in Dashboard (V1 Scope)

**Decision:** PixelPort's dashboard consumes these Paperclip API surfaces for V1:

| Paperclip Feature | Surface in Dashboard | Priority |
|---|---|---|
| Issues/tasks (CRUD, status, checkout) | Task board with status tracking | Must-have |
| Approvals (approve/reject gates) | Approval queue with actions | Must-have |
| Agent status (online, budget, last run) | Agent status cards | Must-have |
| Runs (live output, cost, success/fail) | Run history with expandable detail | Must-have |
| Workspace memory (SOUL.md, MEMORY.md) | Knowledge Vault (read/edit) | Should-have |
| Cost tracking (per agent, per task) | Cost dashboard | Should-have |
| Org chart / delegation hierarchy | Simplified agent list | Nice-to-have |

**What we DON'T surface from Paperclip in V1:**
- Full governance settings (board-level config)
- Plugin management UI
- Company template import/export
- Detailed budget configuration
- Heartbeat scheduling config (use defaults)

---

## Decision 4: Bootstrap Uses Paperclip Native Scaffolding

**Decision:** Tenant workspace bootstrap continues to use Paperclip's native company creation flow, which scaffolds SOUL.md, AGENTS.md, HEARTBEAT.md, memory directories, and CEO agent configuration.

**PixelPort additive overlay remains:**
- SOUL.md enriched with onboarding context (company name, website, mission, goals, chosen agent name)
- CEO → Chief of Staff terminology in tenant-facing copy
- No changes to AGENTS.md, HEARTBEAT.md, or TOOLS.md behavior

---

## Decision 5: Development Process — Conductor + gstack

**Decision:** Migrate from manual Codex/Claude Code coordination to Conductor + gstack.

**New operating model:**

| Role | Tool | Scope |
|---|---|---|
| Founder (Sanchal) | Claude Chat | Architecture, product, pivot decisions → produces Decision Briefs |
| Founder (Sanchal) | Conductor UI | Task creation, work monitoring, review/merge approval |
| CTO Agent | Claude Code + gstack | Plan review (/plan-ceo-review), code review (/review), QA (/qa + /browse) |
| Developer Agent | Claude Code or Codex (via Conductor) | Implementation from build briefs in isolated worktrees |

**gstack skills to use:**
- /plan-ceo-review — validates every build brief against product vision before coding starts
- /review — paranoid code review on every PR
- /qa + /browse — visual QA with headless browser on staging
- /ship — handles branch sync, test run, PR creation

**Process gates (add to CLAUDE.md):**
```
## Architecture Gates
Before any medium/high build begins, CTO must verify:
1. Does this align with docs/pixelport-pivot-plan-2026-03-16.md?
2. Does this align with the latest Decision Brief?
3. If it conflicts, STOP and escalate to founder.
```

---

## Decision 6: Kill Lovable for Frontend Development

**Decision:** Stop using Lovable for frontend changes. All frontend work is done via Claude Code in Conductor, built locally, deployed to Vercel only for deliberate production testing.

**Why:** Vercel build minutes are expensive with Lovable's push-per-change model. Local dev + deliberate deploy is more cost-effective and gives better control.

---

## Decision 7: OpenRouter — Deferred

**Decision:** OpenRouter is not in scope for V1. Current direct OpenAI API key provisioning per tenant continues.

**Revisit when:** Tenant model choice or cost optimization across providers becomes a product requirement.

---

## What This Supersedes

- The assumption that Paperclip UI is served to tenants (superseded by Decision 1)
- The assumption that TryClam features become Paperclip plugins (superseded by Decision 1 — they're PixelPort dashboard features)
- The /pixelport/handoff scope discussion from post-P6 draft (handoff still needed for proxy auth, but not for UI redirect)
- Manual Codex/Claude Code coordination process (superseded by Decision 5)
- Lovable as frontend dev tool (superseded by Decision 6)
