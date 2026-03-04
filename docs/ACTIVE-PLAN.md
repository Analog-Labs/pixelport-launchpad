# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Previous Phase: Phase 0 — Foundation ✅

**Status:** Complete. Phase 0.9 dry-run PASSED (12-step Inngest pipeline, ~7 min end-to-end).

All items done: landing page, auth, dashboard shell, LiteLLM, Supabase schema, API bridge (16 routes), provisioning workflow (12-step Inngest), Inngest Cloud setup, CTO QA (9 frontend fixes), Codex review (both slices pass), dry-run (7 bugs found + fixed).

Branch `codex/phase0-slices-3-4` merged to `main`.

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
- [ ] 1.F5: Connections page — show connected integrations (Slack, email) ← DEFERRED (ready once I4 wiring lands)

### CTO Track (Backend + Infra)
- [x] 1.C1: Tenant creation endpoint + Inngest trigger ← CODEX SLICE 5 complete (`POST /api/tenants`)
- [x] 1.C2: Chat API streaming (SSE) + message history ← CODEX SLICE 6 complete (`POST /api/chat` SSE + `GET /api/chat/history`)
- [x] 1.C3: Slack OAuth flow + webhook ← CODEX SLICE 7 complete (`/api/connections/slack/{install,callback,events}` + `GET /api/connections`)
- [ ] 1.C4: Mem0 managed cloud — per-tenant scoping (user has active plan, Slice 10 planned)
- [x] 1.C5: PostHog ← REDESIGNED: user-facing integration (customers connect their PostHog), deferred to Phase 2
- [x] 1.C6: AgentMail per-tenant inbox ← already in provisioning workflow
- [x] 1.C7: Website auto-scan during onboarding ← CODEX SLICE 8 complete (`POST /api/tenants/scan` + SOUL knowledge injection)
- [x] 1.C8: Slack activation workflow ← CODEX SLICE 9 complete + CTO reviewed (ALL PASS). Env vars set: `SLACK_APP_TOKEN`, `SSH_PRIVATE_KEY`. Ready for live E2E test.

### Integration (CTO + Founder)
- [x] 1.I1: Wire onboarding widget → POST /api/tenants (create + provision) ← COMPLETE (Lovable + CTO review)
- [ ] 1.I1b: Wire scan API into onboarding → POST /api/tenants/scan during Step 1 ← CTO PROPOSAL READY (`docs/phase1/frontend-integration-proposals.md` Priority 1)
- [ ] 1.I2: Wire chat widget → POST /api/chat (streaming) — lower priority ← CTO PROPOSAL READY (Priority 4)
- [ ] 1.I3: Wire dashboard home → GET /api/tenants/status (real provisioning polling) ← CTO PROPOSAL READY (Priority 3)
- [ ] 1.I4: Wire connections page → Slack OAuth install + status ← CTO PROPOSAL READY (Priority 2)

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
| ~~Slack App Socket Mode setup~~ | ~~Slice 9 testing~~ | ✅ DONE (2026-03-04) |
| ~~SSH key pair for droplet access~~ | ~~Slice 9 testing~~ | ✅ DONE (2026-03-04) |
| Frontend integration wiring (I1b, I2, I3, I4) | E2E smoke test | Founder applies CTO proposals in Lovable |

### Notes
- **Phase 0 → Phase 1 transition (2026-03-03):** CTO reviewed all Codex code (PASS), merged branch to main, created Phase 1 Codex slice docs.
- **Phase 0.9 dry-run PASSED (2026-03-04):** 12-step Inngest pipeline completes in ~7 min. 7 bugs found and fixed (OpenClaw config schema, gateway binding, container permissions, Inngest polling, ESM/CJS bundler crash).
- **F1-F4 complete (2026-03-03 evening):** Founder built onboarding wizard, dashboard home (pre/post modes), chat widget (slide-up + full-page), agent personalization. All merged to main. Frontend runs on localStorage + simulated data — needs backend wiring.
- **Frontend data contract locked:** Onboarding payload fields: `company_name`, `company_url`, `goals[]`, `agent_name`, `agent_tone` (casual|professional|bold), `agent_avatar_url` (6 avatar IDs). See `src/lib/avatars.ts` for avatar map.
- **Codex Slices 5-7 COMPLETE:** All reviewed by CTO, all pass. Merged to main.
- **Codex Slices 8-9 COMPLETE + CTO REVIEWED (ALL PASS):** Slice 8 = website auto-scan (`POST /api/tenants/scan`), Slice 9 = Slack activation (6-step Inngest workflow via SSH). All env vars set.
- **Codex Slice 10 planned:** Mem0 integration — lower priority, depends on Mem0 API key.
- **Architecture decisions (2026-03-04):** Slack is PRIMARY channel for Phase 1. Dashboard chat ships as-is (WS bridge deferred to Phase 2). PostHog redesigned as user-facing integration (deferred to Phase 2). Website scan: lightweight fetch + LLM extraction.
- **DO droplet quota:** 1 slot available. Use `/api/debug/test-provision?cleanup=true` after each test to free the slot.
- Auth decision change: Supabase Auth replaces Clerk (2026-03-03).
- Codex is a full project participant: reads full project context, provides feedback to CTO, updates session docs after every work session.
- **Integration wiring (I1-I4):** CTO proposes changes to Lovable-managed frontend files, founder reviews and applies. Do NOT modify `src/` files directly without founder approval.
- **Frontend integration proposals READY (2026-03-05):** All 4 proposals written in `docs/phase1/frontend-integration-proposals.md`. Includes exact code snippets, API contracts, and implementation order. Founder can hand directly to Lovable.

---

## Founder Tasks (Required for Phase 1 Completion)

1. ~~**Slack App ("Pixel") Socket Mode setup:**~~ ✅ DONE (2026-03-04)
2. ~~**SSH key + Vercel env vars:**~~ ✅ DONE (2026-03-04)
3. **Apply frontend integration wiring** from `docs/phase1/frontend-integration-proposals.md`:
   - [ ] **Priority 1:** Scan wiring in `Onboarding.tsx` (add ~20 lines)
   - [ ] **Priority 2:** Connections page in `Connections.tsx` (full replacement)
   - [ ] **Priority 3:** Dashboard status polling in `Home.tsx` (replace 1 useEffect)
   - [ ] **Priority 4:** Chat SSE streaming in `ChatContext.tsx` + `ChatWidget.tsx` + `Chat.tsx` (can defer)

---

## What Comes After Phase 1

**Phase 2: Content Pipeline + Images (Weeks 6-9)**
- Sub-agent auto-provisioning, inter-agent comms
- Content pipeline UI, approval workflow (Inngest)
- Platform-native content + image generation
- Dashboard chat WebSocket bridge (deferred from Phase 1)
- PostHog user-facing integration
- Competitor intel dashboard, calendar, Knowledge Vault page

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
