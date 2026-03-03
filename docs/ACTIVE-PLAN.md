# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Previous Phase: Phase 0 — Foundation ✅

**Status:** Complete (0.9 dry-run deferred — DO quota limit, not blocking Phase 1)

All items done: landing page, auth, dashboard shell, LiteLLM, Supabase schema, API bridge (16 routes), provisioning workflow (12-step Inngest), Inngest Cloud setup, CTO QA (9 frontend fixes), Codex review (both slices pass).

Branch `codex/phase0-slices-3-4` merged to `main`.

**Deferred:** 0.9 dry-run gate — DO droplet quota exceeded. Will retest when founder increases quota. Steps 1-3 verified live (tenant insert, LiteLLM team, LiteLLM key). Step 4 (droplet creation) blocked by account limit.

---

## Current Phase: Phase 1 — Chief of Staff Alive

**Target:** Weeks 3-5 (March 10-28, 2026)
**Goal:** Customer onboards in 3 steps, Chief of Staff is alive in dashboard + Slack + email

---

### Founder Track (Lovable Frontend)
- [x] 1.F1: Onboarding widget — 3-step flow (company URL → goals → connect Slack)
- [x] 1.F2: Dashboard Home — agent status card, pending approvals, recent activity
- [x] 1.F3: Chat widget (persistent sidebar) + full-page chat view (`/dashboard/chat`)
- [x] 1.F4: Agent personalization UI — name, avatar, tone selection during onboarding
- [ ] 1.F5: Connections page — show connected integrations (Slack, email) ← DEFERRED (blocked by C3)

### CTO Track (Backend + Infra)
- [x] 1.C1: Tenant creation endpoint + Inngest trigger ← CODEX SLICE 5 complete (`POST /api/tenants`)
- [x] 1.C2: Chat API streaming (SSE) + message history ← CODEX SLICE 6 complete (`POST /api/chat` SSE + `GET /api/chat/history`)
- [ ] 1.C3: Slack OAuth flow + webhook ← CODEX SLICE 7 (Slack App "Pixel" created, credentials ready, event subscriptions deferred until endpoint exists)
- [ ] 1.C4: Mem0 managed cloud — apply for startup program, set up per-tenant scoping
- [ ] 1.C5: PostHog basic instrumentation (user analytics + agent events)
- [ ] 1.C6: AgentMail per-tenant inbox (already in provisioning workflow)
- [ ] 1.C7: Website auto-scan during onboarding (agent scrapes URL, populates vault)

### Integration (CTO + Founder)
- [x] 1.I1: Wire onboarding widget → POST /api/tenants (create + provision) ← COMPLETE (Lovable + CTO review)
- [ ] 1.I2: Wire chat widget → POST /api/chat (streaming)
- [ ] 1.I3: Wire dashboard home → GET /api/tenants/status + /api/content
- [ ] 1.I4: Wire connections page → Slack OAuth install + status

---

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

### Blockers
| Blocker | Who's Waiting | Who Can Unblock |
|---------|--------------|-----------------|
| DigitalOcean droplet quota (deferred from Phase 0) | CTO | Founder increases limit |
| Mem0 startup program approval | CTO | Mem0 team (apply first) |
| Slack App credentials (for Slice 7) | Codex | Founder creates Slack App |

### Notes
- **Phase 0 → Phase 1 transition (2026-03-03):** CTO reviewed all Codex code (PASS), merged branch to main, created Phase 1 Codex slice docs.
- **F1-F4 complete (2026-03-03 evening):** Founder built onboarding wizard, dashboard home (pre/post modes), chat widget (slide-up + full-page), agent personalization. All merged to main. Frontend runs on localStorage + simulated data — needs backend wiring.
- **Frontend data contract locked:** Onboarding payload fields: `company_name`, `company_url`, `goals[]`, `agent_name`, `agent_tone` (casual|professional|bold), `agent_avatar_url` (6 avatar IDs). See `src/lib/avatars.ts` for avatar map.
- Codex Slices 5-7 ready in `docs/phase1/` — Slice 5 sent to Codex (zero blockers).
- Slice 6 requires OpenClaw gateway accessible (blocked until DO quota resolved for real testing).
- Slice 7 requires Slack App credentials from founder.
- Strategic improvement ideas saved in `docs/strategic-ideas-backlog.md` for future review.
- Auth decision change: Supabase Auth replaces Clerk (2026-03-03).
- Codex is a full project participant: reads full project context, provides feedback to CTO, updates session docs after every work session.
- **Integration wiring (I1-I4):** CTO proposes changes to Lovable-managed frontend files, founder reviews and applies. Do NOT modify `src/` files directly without founder approval.

---

## What Comes After Phase 1

**Phase 2: Content Pipeline + Images (Weeks 6-9)**
- Sub-agent auto-provisioning, inter-agent comms
- Content pipeline UI, approval workflow (Inngest)
- Platform-native content + image generation
- Competitor intel dashboard, calendar, Knowledge Vault page

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
