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

## T3 — Dashboard V1 Core Views (In Progress)

- [x] CEO plan reviewed and merged: `docs/designs/t3-dashboard-core.md` (PR #30, `b285590`)
- [x] gstack artifacts: design doc, CEO plan, eng test plan all in `~/.gstack/projects/`
- [ ] Implementation: Conductor workspace `chennai` attempted (PR #31 open) — not production-ready, to be redone in Codex
- [ ] Views to build: Home, Agent Status, Task Board, Run History, Approval Queue, Sidebar Badges
- [ ] Architecture: TanStack Query hooks (`usePaperclip*`), shared cache, client-side polling
- [ ] `/review` pass
- [ ] `/qa` pass
- [ ] `/ship`

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
