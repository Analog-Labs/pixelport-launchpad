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

## Current Phase: Phase 2 — Content Pipeline + Images

**Target:** Weeks 6–9 (March 10 – April 4, 2026)
**Goal:** Sub-agents alive, content pipeline end-to-end, dashboard pages populated with real data

---

### Carry-Forward from Phase 1

| Item | Owner | Notes |
|------|-------|-------|
| Mem0 per-tenant integration | CTO + Codex | Depends on Mem0 API key / startup program approval |
| Chat WebSocket/SSE bridge | CTO + Codex | Dashboard chat → agent via droplet gateway |
| PostHog user-facing integration | CTO + Codex | Customers connect their own PostHog |

---

### CTO + Codex Track (Backend)

- [ ] 2.B1: Sub-agent auto-provisioning — SPARK + SCOUT per tenant (OpenClaw config)
- [ ] 2.B2: Inter-agent communication wiring (allowlist mesh, delegation contracts)
- [ ] 2.B3: Content pipeline API — create, approve, schedule, publish endpoints
- [ ] 2.B4: Inngest approval workflow — content approval + scheduling durable flow
- [ ] 2.B5: Image generation integration (OpenAI Images API via LiteLLM)
- [ ] 2.B6: Mem0 per-tenant integration (carry-forward from 1.C4)
- [ ] 2.B7: Chat WebSocket bridge (carry-forward from 1.I2)
- [ ] 2.B8: PostHog user-facing integration (carry-forward from 1.C5)
- [ ] 2.B9: Recent Activity API — real event data for dashboard feed

### Founder + Lovable Track (Frontend)

- [ ] 2.F1: Content Pipeline page — draft/approve/schedule/publish workflow UI
- [ ] 2.F2: Content Calendar page — calendar view of scheduled content
- [ ] 2.F3: Knowledge Vault page — brand docs, competitor intel, ICP data
- [ ] 2.F4: Competitor Intelligence page — competitive landscape dashboard
- [ ] 2.F5: Recent Activity feed — real data (replace static placeholder)
- [ ] 2.F6: Chat WebSocket UI — real-time agent chat (when 2.B7 is ready)
- [ ] 2.F7: Performance page — KPI tracking + agent metrics

### Integration (CTO + Founder)

- [ ] 2.I1: Wire Content Pipeline page → content API endpoints
- [ ] 2.I2: Wire Knowledge Vault → tenant knowledge store
- [ ] 2.I3: Wire Chat widget → WebSocket bridge
- [ ] 2.I4: Wire Recent Activity → real event feed
- [ ] 2.I5: Wire Performance page → PostHog / metrics API

---

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Mem0 API key / startup program | 2.B6 | Founder applies to Mem0 |
| Content pipeline API design | 2.F1, 2.I1 | CTO designs API contract |
| Sub-agent provisioning templates | 2.B3+ | CTO designs SPARK/SCOUT templates |

### Notes

- **Phase 1 → Phase 2 transition (2026-03-05):** CTO closed Phase 1 gate, archived 16 completed slice/instruction files, updated all status docs.
- **Integration wiring pattern (from Phase 1):** CTO proposes changes to Lovable-managed frontend files, founder reviews and applies. Do NOT modify `src/` files directly without founder approval.
- **DO droplet quota:** 1 slot available. Use `/api/debug/test-provision?cleanup=true` after each test to free the slot.
- **Vercel build cost discipline:** Docs-only changes auto-skipped. Batch code pushes. Target <$5/day.

---

## What Comes After Phase 2

**Phase 3: Social Publishing + Video (Weeks 10–12)**
- X + LinkedIn API integration (read + assisted publish)
- Video generation integration
- Scheduling engine + performance tracking + weekly reports

**Phase 4: Dashboard Polish + Trust (Weeks 13–16)**
- Performance page, agent detail page
- API keys management, budget controls, brand voice enforcement
- Audit log, team management + RBAC, Stripe billing

See `docs/pixelport-master-plan-v2.md` Section 15 for full phase details.
