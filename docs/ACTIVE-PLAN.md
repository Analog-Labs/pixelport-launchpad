# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P0 — Paperclip-Primary Pivot Foundation

**Status:** Active (first two implementation slices completed on 2026-03-16; CTO review + production smoke pending).
**Goal:** Shift active product execution to a PixelPort-owned Paperclip fork while keeping launchpad focused on marketing, billing, and thin bridge duties.
**Binding spec:** `docs/pixelport-pivot-plan-2026-03-16.md`

### Locked Decisions (Do Not Reinterpret)

- [x] Runtime source of truth is a PixelPort-owned Paperclip fork.
- [x] Auth source of truth for runtime is Paperclip auth.
- [x] Hard cutover direction (no long dual-run).
- [x] Growth Swarm is archived/deactivated from active scope.
- [x] Preserve Paperclip default workspace behavior.
- [x] No PixelPort functional rewrite of workspace `AGENTS.md`/`HEARTBEAT.md`.
- [x] Additive onboarding context allowed in `SOUL.md`.
- [x] User-facing terminology alignment: `CEO` -> `Chief of Staff` (no behavior change).
- [x] Onboarding flow: `Company -> Provision -> Task -> Launch`.
- [x] Provisioning gate before Task unlock; auto-resume Provision until ready.
- [x] Prefilled 3 editable agent suggestions in Task/Launch (not enforced topology).
- [x] VM baseline: pre-baked image, `4 vCPU / 8 GB`, pinned manual rollouts.
- [x] V1 testing provisioning is allowlist/invite gated.
- [x] Stripe-trigger provisioning deferred to phase-2 hook.
- [x] Customer SSH policy deferred.

### P0 Work Checklist

#### Track A — Documentation and Coordination
- [x] A1: Publish canonical pivot contract doc (`docs/pixelport-pivot-plan-2026-03-16.md`).
- [x] A2: Update constitutions (`AGENTS.md`, `CLAUDE.md`) to point at pivot contract.
- [x] A3: Update long-form docs (`SESSION-LOG`, project status, master spec overrides, coordination guide) for pivot alignment.
- [x] A4: Create first execution build brief for Paperclip-fork implementation slice.

#### Track B — Product/UX Execution Prep
- [x] B1: Define exact Company-step field contract and validation shape for onboarding capture.
- [x] B2: Define Provision-step state machine and UI copy for progress/failure/retry.
- [x] B3: Define Task-step default starter-task generation contract.
- [x] B4: Define Launch-step agent suggestion behavior and edit controls.

#### Track C — Runtime and Provisioning Prep
- [x] C1: Finalize golden-image manifest (Paperclip + OpenClaw + Postgres + pinned versions).
- [x] C2: Define allowlist-gated provisioning trigger path for no-Stripe testing mode.
- [x] C3: Define launchpad-to-runtime thin bridge interfaces for handoff.
- [x] C4: Define migration prune list for launchpad runtime routes/services.

### Blockers

| Blocker | Who's Waiting | Who Can Unblock |
|---------|---------------|-----------------|
| Paperclip fork bootstrap and environment ownership details | Implementation branch kickoff | Technical Lead |
| Allowlist owner/process for testing tenant creation | Safe v1 testing rollout | Founder + Technical Lead |

### Notes

- If any older checklist conflicts with this phase, this phase wins.
- Pre-pivot checklist history is archived at `docs/archive/ACTIVE-PLAN-pre-pivot-2026-03-16.md`.
- First implementation slice artifacts:
  - Build brief: `docs/build-briefs/2026-03-16-pivot-p0-onboarding-provisioning-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-16-pivot-p0-onboarding-provisioning-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-16-pivot-p0-onboarding-provisioning-slice.md`
- Second implementation slice artifacts:
  - Build brief: `docs/build-briefs/2026-03-16-pivot-p0-runtime-bridge-baseline-slice.md`
  - CTO prompt: `docs/build-briefs/2026-03-16-pivot-p0-runtime-bridge-baseline-slice-cto-prompt.md`
  - QA evidence: `docs/qa/2026-03-16-pivot-p0-runtime-bridge-baseline-slice.md`
  - Migration checklist: `docs/migration/launchpad-runtime-prune-checklist.md`

---

## Previous Phases (Historical)

- Phase 0 — Foundation ✅
- Phase 1 — Chief of Staff Alive ✅
- Phase 2 — Dynamic Chief + Real Dashboard Data ✅
- Legacy Phase 3 checklist is archived and superseded for active execution.
