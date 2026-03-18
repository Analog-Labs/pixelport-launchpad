# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P4 — Paperclip Authenticated Handoff Consumer

**Status:** Active (`P3` is now closed on `main`; PR `#12` merged as `4d80c49`).  
**Goal:** Complete the last-mile launch experience so `Launch -> Paperclip workspace` lands the user already authenticated.  
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `api/lib/paperclip-handoff-contract.ts`

### Locked Decisions (Carry Forward)

- [x] Launchpad remains marketing + billing + thin provisioning bridge.
- [x] Runtime handoff contract stays `p1-v1` and remains HMAC-signed with short TTL.
- [x] Runtime URL remains per-tenant (`droplet_ip:18789`) for V1; TLS cutover is deferred.
- [x] Launchpad onboarding save flow remains unchanged except redirect target composition.
- [x] Paperclip consumes handoff token at `/api/auth/pixelport/handoff` and sets Better Auth session cookie.

### P4 Work Checklist

#### Track A — Paperclip Consumer Implementation
- [x] A1: Add Better Auth plugin endpoint `GET /api/auth/pixelport/handoff`.
- [x] A2: Verify HMAC handoff token contract (`iss/aud/v/iat/exp/signature`) in Paperclip.
- [x] A3: Ensure/create board principal (`authUsers`), `instance_admin` role, and owner memberships.
- [x] A4: Create Better Auth session cookie and redirect to workspace path (`next`, default `/`).
- [x] A5: Add token-verification unit tests in Paperclip and run server typecheck/tests.

#### Track B — Launchpad Redirect Wiring
- [x] B1: Keep existing `/api/runtime/handoff` request behavior in onboarding launch.
- [x] B2: Require `handoff_token` and redirect to `/api/auth/pixelport/handoff?handoff_token=...&next=/`.
- [x] B3: Keep existing launch ordering (`runtime handoff` -> `save onboarding` -> `redirect`).
- [x] B4: Run launchpad compile validation (`npx tsc --noEmit`).

#### Track C — Review and Release
- [x] C1: Sync plan/session docs for multi-agent awareness.
- [ ] C2: Open CTO review PRs (launchpad + Paperclip fork) for this slice.
- [ ] C3: Merge approved PRs and run production smoke (`Launch -> authenticated workspace`).

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Cross-repo deployment ordering: Paperclip consumer must be deployed before launchpad redirect is released globally | Avoid broken redirects to missing endpoint | Technical Lead + Founder |
| `PAPERCLIP_HANDOFF_SECRET` parity across launchpad and every tenant Paperclip runtime | Prevent invalid-signature handoff failures | Founder + Technical Lead |
| Current DO token cannot delete droplets (`HTTP 403`), so debug cleanup removes tenant rows but leaves dry-run droplets running | Repeat canary cost/quota hygiene and unattended cleanup reliability | Founder + Technical Lead |
| Allowlist owner/process for testing tenant creation | Controlled v1 provisioning operations | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with the pivot plan, pivot plan wins.
- P4 implementation branches:
  - launchpad: `codex/p4-launchpad-handoff-redirect`
  - Paperclip fork: `codex/pixelport-handoff-autologin`
- P4 artifacts:
  - build brief: `docs/build-briefs/2026-03-18-pivot-p4-paperclip-handoff-autologin-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-18-pivot-p4-paperclip-handoff-autologin-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-18-pivot-p4-paperclip-handoff-autologin.md`
- P3 artifacts:
  - migration checklist: `docs/migration/launchpad-runtime-prune-checklist.md`
  - build brief: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch1-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch1-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch1.md`
  - merge smoke evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch1-merge-smoke.md`
  - batch-2 build brief: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy.md`
  - batch-2 CTO prompt: `docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy-cto-prompt.md`
  - batch-2 QA evidence: `docs/qa/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy.md`
  - batch-3 build brief: `docs/build-briefs/2026-03-18-pivot-p3-runtime-prune-batch3-chat-settings-legacy.md`
  - batch-3 CTO prompt: `docs/build-briefs/2026-03-18-pivot-p3-runtime-prune-batch3-chat-settings-legacy-cto-prompt.md`
  - batch-3 QA evidence: `docs/qa/2026-03-18-pivot-p3-runtime-prune-batch3-chat-settings-legacy.md`
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

- Phase P3 — Launchpad Runtime Prune (Tracks C4 batches 1-3) ✅
- Phase P0 — Paperclip-Primary Pivot Foundation ✅
- Phase 0 — Foundation ✅
- Phase 1 — Chief of Staff Alive ✅
- Phase 2 — Dynamic Chief + Real Dashboard Data ✅
