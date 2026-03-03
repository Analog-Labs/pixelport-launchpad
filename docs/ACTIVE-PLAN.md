# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase 0 — Foundation
**Target:** Weeks 1-2 (March 3-14, 2026)
**Goal:** Web app shell + provisioning pipeline + database + LLM gateway

---

### Setup (Shared)
- [x] Lovable Cloud project created ("PixelPort Launchpad")
- [x] GitHub repo created and connected
- [x] Vercel connected and deployed ✅
- [x] Supabase provisioned via Lovable Cloud
- [x] CTO has repo read/write access
- [x] Phase 0 plan reviewed and approved by founder
- [x] Project coordination system designed (CLAUDE.md, SESSION-LOG, ACTIVE-PLAN)
- [x] Supabase credentials shared with CTO
- [x] CTO Go Package delivered to CTO
- [x] Coordination files committed to repo
- [x] All docs moved from growth-swarm to monorepo
- [x] 4 Codex slice instruction docs written in docs/phase0/
- [x] Backend directory structure created (api/, infra/, supabase/)
- [x] Inngest Cloud account created — Event Key + Signing Key received ✅

### Founder Track (Lovable Frontend)
- [x] 0.2: Landing page — 8 sections (hero, features, how-it-works, pricing, security, integrations, FAQ, CTA) ✅
- [x] 0.1/0.3: Supabase Auth — Google OAuth + email/password, /login + /signup, protected routes ✅ (DECISION CHANGE: was Clerk)
- [x] 0.7: Dashboard shell — 9 routes, sidebar nav, empty states, greeting, quick actions ✅

### CTO Track (Backend + Infra)
- [x] 0.6: LiteLLM deployed to Railway, health check passes ← CODEX SLICE 1 (no blockers)
- [x] 0.8: Supabase schema migrated (6 tables + indexes + RLS) ← CODEX SLICE 2 (credentials received, ready)
- [x] 0.5: API bridge routes in `api/` directory ← CODEX SLICE 3 complete (Supabase Auth + tenant isolation verified)
- [x] 0.4: Provisioning script + Inngest workflow ← CODEX SLICE 4 complete (12-step flow + templates + live trial/cleanup run)

### Verification
- [ ] 0.9: Dry-run gate — test tenant provisioned end-to-end, all checks pass

---

### Blockers
| Blocker | Who's Waiting | Who Can Unblock |
|---------|--------------|-----------------|
| DigitalOcean droplet quota limit (`422 unprocessable_entity`) blocks full 0.9 provisioning dry-run | CTO/Founder | Founder to increase droplet limit or free one slot, then rerun 0.9 |

### Dashboard Route Structure (Locked)
```
/dashboard               → Home (stat cards, agent status, quick actions)
/dashboard/content       → Content Pipeline
/dashboard/calendar      → Content Calendar
/dashboard/performance   → Performance + KPI tracking
/dashboard/vault         → Knowledge Vault
/dashboard/competitors   → Competitor Intelligence
/dashboard/connections   → Integration management
/dashboard/settings      → Agent config, API keys, budget, team
/dashboard/chat          → Full-page agent chat
```

### Notes
- **Founder Track Phase 0: COMPLETE** — all 3 items done and deployed via Vercel
- **Auth decision change (2026-03-03):** Supabase Auth replaces Clerk. Rationale: native Lovable integration, zero new vendors. Migration path to Clerk available Phase 4.
- CTO Track code slices complete (0.4/0.5 done). 0.9 dry-run remains pending due current DigitalOcean droplet quota.
- Vercel = web app + API routes. Railway = LiteLLM gateway. Both needed, different jobs.
- Codex is a full project participant: reads full project context, provides feedback to CTO, updates session docs after every work session.

---

## What Comes After Phase 0

**Phase 1: Chief of Staff Alive (Weeks 3-5)**
- 3-step onboarding, website auto-scan, agent personalization
- Dashboard home + chat widget
- Slack OAuth, AgentMail per-tenant, Mem0, PostHog
- KPI negotiation, configurable reporting

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
