# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Program: P7 Launch Reliability Hardening (In Progress)

**Objective:** execute founder-approved post-P6 order: `upgrade first -> fix point 2 -> fix point 3 -> integrations`.

## P7-S1 — Upgrade + Carryover Fixes

- [x] Sequence lock approved by founder (`upgrade-first`, then point 2/3, then integrations)
- [x] Upgrade-first verification completed:
  - OpenClaw latest stable confirmed: `v2026.3.13-1` (already pinned)
  - Paperclip latest stable confirmed: `v2026.318.0` (already pinned)
- [x] Point 2 fix: bootstrap `Unauthorized` hardening in hooks dispatch path
  - add query-token hook auth (`?token=`) per OpenClaw hooks contract
  - keep compatibility headers + controlled fallback attempts for mixed runtime variants
  - add test coverage for fallback matrix
- [x] Point 3 fix: `/pixelport/handoff` activation handling
  - runtime handoff route probe for HTTPS runtimes
  - launch mode auto-selection: `paperclip-handoff` when active, otherwise `gateway-token`
  - frontend launch now trusts backend-selected `workspace_launch_url`
  - docs updated to reflect dynamic handoff mode selection
- [x] Validation complete:
  - `npx tsc --noEmit`
  - `npm test`

## P7-S2 — Integrations Track (Next)

- [ ] Start Google + Slack integrations hardening on top of stabilized launch/runtime baseline
- [ ] Define first integration slice scope and CTO review gate

## R1 — Workspace Drift + Terminology Correction

- [x] Branch created: `codex/p6-r1-paperclip-default-workspace`
- [x] Pinned upstream Paperclip default CEO templates vendored under `paperclip/`
- [x] `workspace-contract.ts` switched to Paperclip defaults + SOUL-only additive onboarding block
- [x] Chief of Staff tenant-facing terminology applied in workspace markdown overlay
- [x] Tests updated and passing
- [x] CTO review approved and merged (PR `#18`, merge commit `53af0e2`)

## R2 — OpenClaw Upgrade (Canary-first)

- [x] Branch created: `codex/p6-r2-openclaw-2026-3-13`
- [x] Provisioning default pin updated to `ghcr.io/openclaw/openclaw:2026.3.13-1`
- [x] Infra manifest updated with immutable metadata:
  - tag: `v2026.3.13-1`
  - commit: `61d171ab0b2fe4abc9afe89c518586274b4b76c2`
  - digest: `sha256:a5a4c83b773aca85a8ba99cf155f09afa33946c0aa5cc6a9ccb6162738b5da02`
- [x] Tests/docs updated for new pin
- [x] Validation done (`npx tsc --noEmit`, `npm test`)
- [x] Build managed golden image candidate with this OpenClaw pin (`snapshot id 221188460`)
- [x] Run 2 fresh-tenant canaries on candidate image (compatibility bootstrap + strict managed-only)
- [x] Capture local backup artifacts and QA evidence
- [x] Promote managed image selector (`PROVISIONING_DROPLET_IMAGE=221188460`)
- [x] Re-enable strict gate in production: `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
- [x] CTO review approved + merged (PR `#19`, merge commit `45d4406`)

## R3 — Paperclip Upgrade (Compatibility-only)

- [x] Branch: `codex/p6-r3-paperclip-v2026-318-0`
- [x] Pin Paperclip to `v2026.318.0` and record tag + commit in manifest/evidence
- [x] Rebuild image with overlay compatibility baseline (managed snapshot `221189855`)
- [x] Run 2 fresh-tenant canaries (gateway-token auto-login compatibility)
- [x] Promote only after canaries pass (`PROVISIONING_DROPLET_IMAGE=221189855`, managed-only gate remains `true`)
- [x] CTO review approved + merged (PR `#21`, merge commit `472dfbd`)

## R4 — Combined Regression Proof

- [x] Branch: `codex/p6-r4-combined-regression-proof`
- [x] Run full proof:
  - `signup -> onboarding -> provision -> launch -> auto-login -> agent responds`
- [x] Confirm policy-compliant workspace behavior for new tenants:
  - Paperclip default template behavior retained
  - Chief of Staff terminology on tenant-facing surfaces
  - SOUL additive onboarding block present/correct
- [x] Capture rollback-readiness evidence
- [x] CTO review approved + merged (PR `#22`, merge commit `d1511ce`)

## R5 — Branding Baseline Pass

- [x] Branch: `codex/p6-r5-branding-baseline`
- [x] Baseline identity pass only (copy harmonization + key tenant-visible polish)
- [x] Fix known copy drift (including obsolete Settings mention)
- [x] CTO review approved + merged (PR `#23`, merge commit `f7b61de`)

## Release Gates (Per Phase)

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] targeted tests for changed contract behavior
- [ ] production smoke after merge
- [ ] rollback notes captured

## Evidence Links

- R1 QA evidence: `docs/qa/2026-03-18-p6-r1-paperclip-default-workspace.md`
- R2 pin/release evidence: `docs/qa/2026-03-19-p6-r2-openclaw-2026-3-13-pin-and-release-evidence.md`
- R2 rollout closure evidence: `docs/qa/2026-03-19-p6-r2-managed-image-rollout-closure.md`
- R3 rollout evidence: `docs/qa/2026-03-19-p6-r3-paperclip-v2026-318-0-rollout-evidence.md`
- R4 combined proof evidence: `docs/qa/2026-03-19-p6-r4-combined-regression-proof.md`
- R4 merge smoke: `docs/qa/2026-03-19-p6-r4-merge-smoke.md`
- R5 branding baseline evidence: `docs/qa/2026-03-19-p6-r5-branding-baseline.md`
- R5 merge smoke: `docs/qa/2026-03-19-p6-r5-merge-smoke.md`
- Launch-critical canary baseline: `docs/qa/2026-03-18-p6-d5-production-canary-proof.md`
- Golden-image backup runbook: `docs/ops/golden-image-backup-runbook.md`

---

## Previous Phases (Historical)

- Phase P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Phase P3 — Launchpad Runtime Prune ✅ (batches 1/2/3 merged)
- Phase P2 — Launch Workspace Redirect ✅
- Phase P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Phase P0 — Pivot Foundation ✅
