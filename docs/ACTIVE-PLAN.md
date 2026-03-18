# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P3 — Launchpad Runtime Prune (Track C4 Batch 2)

**Status:** Active (P2 is closed/merged on `main`; P3 batch-1 is merged/deployed on `main`; P3 batch-2 implementation is prepared on `codex/p3-c4-prune-batch2-dashboard-runtime-legacy` pending CTO review).  
**Goal:** Incrementally prune unused legacy launchpad runtime route groups while preserving active thin-bridge provisioning responsibilities.  
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/migration/launchpad-runtime-prune-checklist.md`

### Locked Decisions (Carry Forward)

- [x] Launchpad remains marketing + billing + thin provisioning bridge.
- [x] Pruning is incremental; no big-bang deletion.
- [x] Remove only route groups with confirmed no active frontend/inngest dependencies.
- [x] Remove vestigial dashboard pages in the same batch as the dependent API deletions.
- [x] Keep all onboarding/provisioning keep-now surfaces intact.
- [x] Workspace bootstrap guidance is workspace-first and must not depend on removed legacy runtime APIs.

### P3 Work Checklist

#### Track A — Batch 1 Implementation (Chat/Content/Approvals)
- [x] A1: Verify no active frontend runtime calls to `/api/chat`, `/api/content`, `/api/approvals`.
- [x] A2: Verify no route/test/inngest dependencies on those route groups.
- [x] A3: Delete `chat`, `content`, and `approvals` route files and emptied directories.
- [x] A4: Run local validation (`npx tsc --noEmit`, CI-equivalent tests).
- [x] A5: Record QA evidence for this batch.

#### Track B — Review and Release
- [x] B1: Create P3 build brief and CTO review prompt.
- [x] B2: Open CTO review PR for `codex/p3-c4-prune-batch1-chat-content-approvals` (`#9`).
- [x] B3: Merge approved P3 slice to `main`.
- [x] B4: Run same-session production smoke for retained active surfaces.

#### Track C — Batch 2 Implementation (Dashboard/API Legacy Removal)
- [x] C1: Remove dashboard runtime dependencies on legacy task/vault/competitor/command APIs.
- [x] C2: Delete vestigial dashboard pages/routes (`Content`, `Calendar`, `Vault`, `Competitors`).
- [x] C3: Delete legacy route groups (`commands`, `tasks`, `vault`, `agent`, `agents`, `competitors`).
- [x] C4: Update bootstrap/workspace contract guidance to workspace-first instructions (no `/api/agent/*` guidance).
- [x] C5: Remove dead route tests/libraries tied to deleted groups.
- [x] C6: Run local validation (`npx tsc --noEmit`, CI-equivalent tests).
- [x] C7: Record QA evidence for batch 2.

#### Track D — Review and Release (Batch 2)
- [x] D1: Create batch-2 build brief and CTO review prompt.
- [x] D2: Open CTO review PR for `codex/p3-c4-prune-batch2-dashboard-runtime-legacy` (`#11`).
- [ ] D3: Merge approved batch-2 slice to `main`.
- [ ] D4: Run same-session production smoke for retained active surfaces.

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Current DO token cannot delete droplets (`HTTP 403`), so debug cleanup removes tenant rows but leaves dry-run droplets running | Repeat canary cost/quota hygiene and unattended cleanup reliability | Founder + Technical Lead |
| Allowlist owner/process for testing tenant creation | Controlled v1 provisioning operations | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with the pivot plan, pivot plan wins.
- P3 artifacts:
  - migration checklist: `docs/migration/launchpad-runtime-prune-checklist.md`
  - build brief: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch1-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch1-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch1.md`
  - merge smoke evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch1-merge-smoke.md`
  - batch-2 build brief: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy.md`
  - batch-2 CTO prompt: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy-cto-prompt.md`
  - batch-2 QA evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy.md`
- P2 artifacts:
  - build brief: `docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-17-pivot-p2-launch-workspace-redirect.md`
  - merge smoke evidence: `docs/qa/2026-03-17-pivot-p2-launch-workspace-redirect-merge-smoke.md`
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
