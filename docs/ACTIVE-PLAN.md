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
- [x] Vercel visible (connecting during execution)
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
- [ ] Inngest Cloud account created (CTO, free tier)

### Founder Track (Lovable Frontend)
- [ ] 0.2: Landing page — hero, features, pricing, CTA ← READY TO START
- [ ] 0.1/0.3: Clerk auth — signup, login, redirect to dashboard
- [ ] 0.7: Dashboard shell — sidebar nav, empty states, greeting, placeholders

### CTO Track (Backend + Infra)
- [x] 0.6: LiteLLM deployed to Railway, health check passes ← CODEX SLICE 1 (no blockers)
- [ ] 0.8: Supabase schema migrated (6 tables + indexes + RLS) ← CODEX SLICE 2 (credentials received, ready)
- [ ] 0.5: API bridge routes in `api/` directory ← CODEX SLICE 3 (needs schema)
- [ ] 0.4: Provisioning script + Inngest workflow ← CODEX SLICE 4 (needs all above)

### Verification
- [ ] 0.9: Dry-run gate — test tenant provisioned end-to-end, all checks pass

---

### Blockers
| Blocker | Who's Waiting | Who Can Unblock |
|---------|--------------|-----------------|
| ~~Supabase credentials~~ | ~~CTO (Slices 2-4)~~ | ✅ Resolved — credentials received 2026-03-02 |

### Notes
- Founder and CTO tracks run in parallel — no dependency between them until integration
- Codex Slice 1 (LiteLLM) has zero blockers — CTO can send to Codex immediately
- Landing page has zero backend dependency — founder can start immediately
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
