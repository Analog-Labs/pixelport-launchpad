# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Program: V1 Full Wedge Dashboard

**Objective:** Build PixelPort's first real dashboard — from redirect button to living command center.
**Sequence:** `T1 → T2 → T3 → T4 → T5 → T6`
**Design system:** `DESIGN.md`
**Full spec:** `docs/designs/v1-full-wedge.md`
**gstack artifacts:** `~/.gstack/projects/Analog-Labs-pixelport-launchpad/`

## T1 — Paperclip API Audit ✅

- [x] Audited all Paperclip endpoints needed for dashboard views
- [x] Documented contract in `docs/paperclip-api-contract.md`
- [x] Merged PR #28 (`d6a6a4e`)

## T2 — Proxy Layer ✅

- [x] Built `api/tenant-proxy/[...path].ts` — forwards dashboard requests to tenant Paperclip
- [x] Created allowlist at `api/lib/paperclip-proxy-allowlist.ts`
- [x] Merged PR #29 (`15cc13d`)

## T3 — Dashboard V1 Core Views ✅

- [x] CEO plan reviewed and merged: `docs/designs/t3-dashboard-core.md` (PR #30, `b285590`)
- [x] gstack artifacts: design doc, CEO plan, eng test plan all in `~/.gstack/projects/`
- [x] Implementation: 5 dashboard views built via Codex + Claude Code (PR #48, `d0fcfd7`)
  - Home (approval banner, agent cards, weekly cost, intelligence brief)
  - Agents (live status, activity timeline, budget bar, Chief workspace launch)
  - Approvals (inline edit, approve/reject, DOMPurify XSS sanitization, Clerk Bearer auth)
  - Run History (expandable detail, cost coloring, event timeline)
  - Tasks (kanban drag-and-drop, mobile snap-scroll, slide-out detail + comments)
- [x] Architecture: TanStack Query hooks (`usePaperclip*`), shared cache, client-side polling
- [x] Tenant proxy enhanced with board-handoff + agent-key fallback
- [x] `/review` pass (eng review + Codex code review + adversarial challenge)
- [x] Design review: 6 DESIGN.md violations fixed (a11y, shimmer CTA, heading hierarchy)
- [x] `/ship` — v0.19.2.0
- [x] Post-T3 foundation reliability hardening merged (PR #49; commits `a2edbc8`, `a8eac07`)
  - Chief adapter patch now requires config read-back verification before bootstrap proceeds
  - Bootstrap truth contract now includes durable seed evidence and workspace contract metadata
  - Tenant proxy now returns explicit board-session diagnostics for approval/comment auth failures
  - Provisioning now waits for claimed-key artifact writes before publishing Paperclip refs

## T4 — Real-time & Polish (Planned)

- [ ] Not yet planned via gstack

## T5 — Settings & Billing (Planned)

- [ ] Not yet planned via gstack

## T6 — Launch Readiness (Planned)

- [ ] Not yet planned via gstack

## Release Gates (Per Phase)

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `/review` pass
- [ ] `/qa` pass against localhost
- [ ] `/ship` creates PR

---

## Previous Programs (Historical)

- Program P6 — Reset (R1→R5) ✅ (PRs #18–#24)
- Program P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Program P3 — Launchpad Runtime Prune ✅
- Program P2 — Launch Workspace Redirect ✅
- Program P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Program P0 — Pivot Foundation ✅
