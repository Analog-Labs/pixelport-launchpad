# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P1 — Paperclip Fork Bootstrap Ownership and Handoff

**Status:** Active (`688c4e3` and `9faee29` are merged/deployed; managed selector has been rebuilt and promoted to `PROVISIONING_DROPLET_IMAGE=221035422`; managed-only gate is enabled with `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`; strict managed-only fresh canary is now passing; Track A top-level A2-A5 remain open).  
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

Track A audit evidence recorded (without closure fabrication):
- [x] A2-evidence: PixelPort `main` defaults and protection/ruleset/CODEOWNERS state documented.
- [x] A2-evidence: Paperclip default/protected branch and active ruleset/workflow signals documented.
- [x] A3-evidence: Vercel/Railway/DO ownership signals documented with source commands.
- [x] A4-evidence: secrets inventory key names captured by surface; `PAPERCLIP_*` visibility gap noted.
- [x] A5-evidence: founder decision gates listed explicitly for closure.

#### Track B — First Runtime Handoff Slice
- [x] B1: Implement first launchpad-to-Paperclip runtime handoff API contract (additive).
- [x] B2: Define required handoff env contract and diagnostics coverage.
- [x] B3: Add route/contract tests for handoff behavior and failure modes.
- [x] B4: Validate with local checks + QA evidence for this slice.
- [x] B5: Validate authenticated production `POST /api/runtime/handoff` success path (`200`) with temporary tenant cleanup.

#### Track C — Review and Release
- [x] C1: Create P1 build brief and CTO handoff prompt for this slice.
- [x] C2: Complete CTO review on `codex/*` branch.
- [x] C3: Merge approved P1 slice to `main`.
- [x] C4: Run same-session targeted production smoke for handoff-related surfaces.

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| PixelPort `main` lacks enforced branch protection/review/check gates and explicit backup reviewer assignment | A2 closure and cutover-safe governance | Technical Lead + Founder |
| Deploy ownership signals exist but explicit founder approval of named primary/backup owners is pending | A3 closure and runtime cutover prep | Founder + Technical Lead |
| Handoff/runtime secret source-of-truth and rotation authority are not founder-closed | A4 closure and safe runtime handoff | Founder + Technical Lead |
| Current DO token cannot delete droplets (`HTTP 403`), so debug cleanup removes tenant rows but leaves dry-run droplets running | Repeat canary cost/quota hygiene and unattended cleanup reliability | Founder + Technical Lead |
| Rollback authority and incident escalation chain are documented but not explicitly founder-confirmed for closure | A5 closure and incident readiness | Founder + Technical Lead |
| Allowlist owner/process for testing tenant creation | Controlled v1 provisioning operations | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with the pivot plan, pivot plan wins.
- P0 implementation and release artifacts remain valid and shipped:
  - `docs/qa/2026-03-16-pivot-p0-release-smoke.md`
- P1 artifacts:
  - ownership contract: `docs/paperclip-fork-bootstrap-ownership.md`
  - build brief: `docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`
  - release smoke evidence: `docs/qa/2026-03-17-pivot-p1-handoff-release-smoke.md`
  - ownership-audit brief: `docs/build-briefs/2026-03-17-pivot-p1-ownership-audit-slice.md`
  - ownership-audit CTO prompt: `docs/build-briefs/2026-03-17-pivot-p1-ownership-audit-slice-cto-prompt.md`
  - ownership-audit QA evidence: `docs/qa/2026-03-17-pivot-p1-ownership-audit.md`
  - authenticated smoke brief: `docs/build-briefs/2026-03-17-pivot-p1-handoff-auth-smoke-slice.md`
  - authenticated smoke CTO prompt: `docs/build-briefs/2026-03-17-pivot-p1-handoff-auth-smoke-slice-cto-prompt.md`
  - authenticated smoke QA evidence: `docs/qa/2026-03-17-pivot-p1-handoff-authenticated-smoke.md`
  - runtime target + golden enforcement brief: `docs/build-briefs/2026-03-17-pivot-p1-runtime-target-golden-enforcement-slice.md`
  - runtime target + golden enforcement CTO prompt: `docs/build-briefs/2026-03-17-pivot-p1-runtime-target-golden-enforcement-slice-cto-prompt.md`
  - runtime target + golden enforcement QA evidence: `docs/qa/2026-03-17-pivot-p1-runtime-target-golden-enforcement.md`
  - golden selector fresh-tenant canary QA evidence: `docs/qa/2026-03-17-pivot-p1-golden-selector-fresh-tenant-canary.md`
  - golden image policy gate brief: `docs/build-briefs/2026-03-17-pivot-p1-golden-image-policy-gate-slice.md`
  - golden image policy gate CTO prompt: `docs/build-briefs/2026-03-17-pivot-p1-golden-image-policy-gate-slice-cto-prompt.md`
  - golden image policy gate QA evidence: `docs/qa/2026-03-17-pivot-p1-golden-image-policy-gate.md`
  - managed golden promotion + managed-only canary evidence: `docs/qa/2026-03-17-pivot-p1-managed-golden-promotion-and-managed-only-canary.md`
  - managed golden rebuild closure evidence: `docs/qa/2026-03-17-pivot-p1-managed-golden-rebuild-closure.md`

---

## Previous Phases (Historical)

- Phase P0 — Paperclip-Primary Pivot Foundation ✅
- Phase 0 — Foundation ✅
- Phase 1 — Chief of Staff Alive ✅
- Phase 2 — Dynamic Chief + Real Dashboard Data ✅
