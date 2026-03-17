# PixelPort Pivot P1 — Paperclip Bootstrap Ownership + First Handoff Slice

**Title:** Bootstrap ownership lock + first launchpad-to-Paperclip runtime handoff contract  
**Date:** 2026-03-16  
**Owner:** Codex  
**Build Size:** `medium`  
**Suggested Branch:** `codex/pivot-p1-bootstrap-handoff`

---

## Goal

Execute the first post-P0 pivot slice by:
- locking bootstrap ownership for the PixelPort-owned Paperclip fork
- implementing the first additive runtime handoff contract from launchpad to Paperclip runtime surfaces.

## Scope

- In scope: publish ownership contract with concrete owner matrix and runbook owners.
- In scope: advance active execution plan from P0 to P1.
- In scope: implement additive handoff route contract (`launchpad -> paperclip`) with explicit env contract and test coverage.
- In scope: produce CTO-ready handoff prompt for review.

## Non-Goals

- Not in scope: full auth migration to Paperclip auth in launchpad frontend.
- Not in scope: cutover execution itself.
- Not in scope: deleting legacy runtime APIs in this slice.
- Not in scope: Stripe-trigger provisioning (still phase-2 deferred).

## Founder-Approved Alignment

- Paperclip fork remains runtime source of truth.
- Launchpad remains marketing/billing/thin bridge.
- Hard cutover direction remains unchanged.
- Major architecture/product/UX shifts still require founder approval.

## Implementation Notes

- Ownership/coordination artifacts:
  - `docs/paperclip-fork-bootstrap-ownership.md`
  - `docs/ACTIVE-PLAN.md`
  - `docs/SESSION-LOG.md`
  - `docs/pixelport-project-status.md`
- Handoff contract implementation target (additive):
  - route: `POST /api/runtime/handoff`
  - helper contract/signing module under `api/lib/`
  - env diagnostics update in `api/debug/env-check.ts`
  - focused tests under `src/test/`

## Acceptance Criteria

- [x] Ownership contract doc exists with explicit owner matrix and runbook ownership.
- [x] P1 active plan is published with checklist and blockers.
- [x] Session log records P1 kickoff intent/state without fabricated runtime results.
- [x] Project status immediate actions reflect P1 kickoff.
- [x] Additive handoff route contract implemented with success and failure behaviors.
- [x] Handoff contract helper + tests are passing.
- [x] `npx tsc --noEmit` passes for the slice.
- [ ] CTO review approves merge/deploy.
- [ ] Post-merge production smoke validates changed handoff surfaces.

## CTO Handoff Prompt

Use the companion prompt file:
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice-cto-prompt.md`

## Blockers / Dependencies

- Paperclip runtime repo/environment ownership details must be fully confirmed to close P1.
- Secret authority mapping needs founder + technical lead confirmation before cutover.
