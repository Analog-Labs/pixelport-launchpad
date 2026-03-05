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

## Current Phase: Phase 2 — Dynamic Chief + Real Dashboard Data

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

| Item | Owner | Notes |
|------|-------|-------|
| Mem0 per-tenant integration | CTO + Codex | Depends on Mem0 API key / startup program approval |
| Chat WebSocket/SSE bridge | CTO + Codex | Dashboard chat → agent via droplet gateway |
| PostHog user-facing integration | CTO + Codex | Customers connect their own PostHog |

---

### CTO + Codex Track (Backend)

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
- [ ] 2.B11: Image generation integration (OpenAI Images API via LiteLLM)
- [ ] 2.B12: Mem0 per-tenant integration (carry-forward from 1.C4)
- [ ] 2.B13: Chat WebSocket bridge (carry-forward from 1.I2)
- [ ] 2.B14: PostHog user-facing integration (carry-forward from 1.C5)
- [ ] 2.B15: Inngest approval workflow — content approval + scheduling durable flow

### Founder + Lovable Track (Frontend)

- [ ] 2.F1: Content Pipeline page — reads `GET /api/tasks?task_type=draft_content`
- [ ] 2.F2: Content Calendar page — reads `GET /api/tasks?scheduled_for=true`
- [ ] 2.F3: Knowledge Vault page — reads `GET /api/vault`, edits via `PUT /api/vault/:key`
- [ ] 2.F4: Competitor Intelligence page — reads `GET /api/competitors`
- [ ] 2.F5: Dashboard Home updates — Team Roster + Work Feed from `/api/tasks`
- [ ] 2.F6: Chat WebSocket UI — real-time agent chat (when 2.B10 is ready)
- [ ] 2.F7: Performance page — KPI tracking + agent metrics

### Integration (CTO + Founder)

- [ ] 2.I1: Wire Content Pipeline page → tasks API
- [ ] 2.I2: Wire Knowledge Vault → vault API
- [ ] 2.I3: Wire Competitor Intelligence → competitors API
- [ ] 2.I4: Wire Dashboard Home → tasks API (work feed + team roster)
- [ ] 2.I5: Wire Chat widget → WebSocket bridge

---

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Mem0 API key / startup program | 2.B9 | Founder applies to Mem0 |

### Notes

- **Architecture pivot (2026-03-05):** Founder locked decision to kill permanent sub-agents. Chief uses OpenClaw native `sessions_spawn` for dynamic sub-agents. Simplifies provisioning, reduces idle LLM cost.
- **Agent API key pattern:** Per-tenant `agent_api_key` (prefix `ppk-`) stored in tenants table, injected as `PIXELPORT_API_KEY` in droplet `.env`. Chief authenticates via `X-Agent-Key` header.
- **Dashboard data flow:** Chief → `/api/agent/*` (writes) → Supabase → `/api/tasks/*`, `/api/vault/*`, `/api/competitors/*` (reads) → Lovable dashboard
- **Loading states:** Dashboard pages show "[Agent name] is working on this..." until Chief populates data.
- **Integration wiring pattern (from Phase 1):** CTO proposes changes to Lovable-managed frontend files, founder reviews and applies. Do NOT modify `src/` files directly without founder approval.
- **DO droplet quota:** 1 slot available. Use `/api/debug/test-provision?cleanup=true` after each test to free the slot.
- **Vercel build cost discipline:** Docs-only changes auto-skipped. Batch code pushes. Target <$5/day.
- **Secrets management:** All API keys stored locally at `~/.pixelport/secrets.env`. CTO reads via `~/.pixelport/get-secret.sh VAR_NAME`. Usage logged to `~/.pixelport/usage.log`.
- **Test tenant (Phase 2):** TestCo Phase2 — droplet `142.93.195.23` (ID `556101720`), agent_api_key `ppk-f633202f-...`

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
