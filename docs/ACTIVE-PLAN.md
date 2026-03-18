# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P2 — Paperclip Handoff Consumer and Workspace Launch Redirect

**Status:** Active (PR `#6` is merged on `main` as `cba0625`; implementation PR `#7` is open for CTO review on `codex/p2-paperclip-launch-redirect`; required checks `validate` + `Analyze (javascript-typescript)` are green).  
**Goal:** Consume the existing `/api/runtime/handoff` contract during onboarding Launch and redirect users directly to their tenant Paperclip workspace URL.  
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/paperclip-fork-bootstrap-ownership.md`

### Locked Decisions (Carry Forward)

- [x] Runtime source of truth remains the PixelPort-owned Paperclip fork.
- [x] Preserve Paperclip default workspace behavior; do not modify `agents.md`/`heartbeat.md` templates from launchpad.
- [x] Keep `SOUL.md` additive with onboarding-captured context only.
- [x] Launch should redirect to the tenant Paperclip workspace URL returned by handoff.
- [x] `launch_completed_at` should persist only after successful handoff and successful onboarding save.
- [x] Railway/LiteLLM remains legacy/decommission path and is not part of active pivot runtime architecture.

### P2 Work Checklist

#### Track A — Launch Redirect Consumer
- [x] A1: Wire onboarding Launch to blocking `POST /api/runtime/handoff` (`source=onboarding-launch`).
- [x] A2: Validate `paperclip_runtime_url` and redirect with `window.location.assign(...)`.
- [x] A3: Persist `launch_completed_at` only after handoff success and onboarding save success.
- [x] A4: Update launch-step UX copy from dashboard language to workspace language.
- [x] A5: Validate with local checks + independent QA sub-agent review.

#### Track B — Review and Release
- [x] B1: Create P2 build brief and CTO review prompt.
- [x] B2: Open CTO review PR for `codex/p2-paperclip-launch-redirect` (`#7`).
- [ ] B3: Merge approved P2 slice to `main`.
- [ ] B4: Run same-session production smoke for onboarding launch + handoff surfaces.

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Current DO token cannot delete droplets (`HTTP 403`), so debug cleanup removes tenant rows but leaves dry-run droplets running | Repeat canary cost/quota hygiene and unattended cleanup reliability | Founder + Technical Lead |
| Allowlist owner/process for testing tenant creation | Controlled v1 provisioning operations | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with the pivot plan, pivot plan wins.
- P2 artifacts:
  - build brief: `docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-17-pivot-p2-launch-workspace-redirect.md`
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
  - post-session QA follow-up log: `docs/SESSION-LOG.md` (sessions 82-87)
  - step 5 follow-up merge smoke evidence: `docs/qa/2026-03-17-p1-step5-merge-release-smoke.md`
  - step 5 authenticated onboarding-launch handoff smoke evidence: `docs/qa/2026-03-17-p1-step5-authenticated-onboarding-launch-smoke.md`
  - A2 governance guardrails slice evidence: `docs/qa/2026-03-17-pivot-p1-a2-governance-guardrails-slice.md`
  - A2 governance merge smoke evidence: `docs/qa/2026-03-17-pivot-p1-a2-governance-merge-smoke.md`
  - A3 deploy ownership closure evidence: `docs/qa/2026-03-17-pivot-p1-a3-deploy-ownership-closure.md`
  - A3 merge smoke evidence: `docs/qa/2026-03-17-pivot-p1-a3-merge-smoke.md`
  - A4 secrets inventory kickoff evidence: `docs/qa/2026-03-17-pivot-p1-a4-secrets-inventory-kickoff.md`
  - A4 secrets closure evidence: `docs/qa/2026-03-17-pivot-p1-a4-secrets-closure.md`
  - A4 merge smoke evidence: `docs/qa/2026-03-17-pivot-p1-a4-merge-smoke.md`
  - A5 boundary proposal evidence: `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-proposal.md`
  - A5 boundary closure evidence: `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-closure.md`
  - A5 merge smoke evidence: `docs/qa/2026-03-17-pivot-p1-a5-merge-smoke.md`

---

## Previous Phases (Historical)

- Phase P0 — Paperclip-Primary Pivot Foundation ✅
- Phase 0 — Foundation ✅
- Phase 1 — Chief of Staff Alive ✅
- Phase 2 — Dynamic Chief + Real Dashboard Data ✅
