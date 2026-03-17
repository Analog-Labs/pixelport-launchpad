# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P1 — Paperclip Fork Bootstrap Ownership and Handoff

**Status:** Active (P1 ownership + first handoff implementation complete on branch; CTO review pending on 2026-03-16).  
**Goal:** Lock bootstrap ownership for the PixelPort-owned Paperclip fork and ship the first launchpad-to-Paperclip runtime handoff contract.  
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/paperclip-fork-bootstrap-ownership.md`

### Locked Decisions (Carry Forward)

- [x] Runtime source of truth is a PixelPort-owned Paperclip fork.
- [x] Auth source of truth for runtime is Paperclip auth.
- [x] Hard cutover direction (no long dual-run).
- [x] `pixelport-launchpad` remains marketing + billing + thin provisioning bridge.
- [x] Preserve Paperclip default workspace behavior; only approved additive customization.
- [x] V1 provisioning remains allowlist/invite gated.
- [x] Stripe-trigger provisioning remains phase-2 deferred.

### P1 Work Checklist

#### Track A — Ownership Lock
- [x] A1: Publish Paperclip fork bootstrap ownership contract.
- [ ] A2: Confirm repo/branch protection + CI owners and reviewer backups.
- [ ] A3: Confirm deploy ownership for staging/production runtime targets.
- [ ] A4: Confirm secret inventory + rotation ownership and rollback authority.
- [ ] A5: Confirm incident escalation path and founder decision boundaries.

#### Track B — First Runtime Handoff Slice
- [x] B1: Implement first launchpad-to-Paperclip runtime handoff API contract (additive).
- [x] B2: Define required handoff env contract and diagnostics coverage.
- [x] B3: Add route/contract tests for handoff behavior and failure modes.
- [x] B4: Validate with local checks + QA evidence for this slice.

#### Track C — Review and Release
- [x] C1: Create P1 build brief and CTO handoff prompt for this slice.
- [ ] C2: Complete CTO review on `codex/*` branch.
- [ ] C3: Merge approved P1 slice to `main`.
- [ ] C4: Run same-session targeted production smoke for handoff-related surfaces.

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Paperclip fork repo/deploy ownership details not fully confirmed | P1 implementation closure and cutover prep | Technical Lead + Founder |
| Secret authority mapping for runtime bootstrap surfaces | Safe cutover execution | Technical Lead + Founder |
| Allowlist owner/process for testing tenant creation | Controlled v1 provisioning operations | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with the pivot plan, pivot plan wins.
- P0 implementation and release artifacts remain valid and shipped:
  - `docs/qa/2026-03-16-pivot-p0-release-smoke.md`
- P1 kickoff artifacts:
  - ownership contract: `docs/paperclip-fork-bootstrap-ownership.md`
  - build brief: `docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`

---

## Previous Phases (Historical)

- Phase P0 — Paperclip-Primary Pivot Foundation ✅
- Phase 0 — Foundation ✅
- Phase 1 — Chief of Staff Alive ✅
- Phase 2 — Dynamic Chief + Real Dashboard Data ✅
