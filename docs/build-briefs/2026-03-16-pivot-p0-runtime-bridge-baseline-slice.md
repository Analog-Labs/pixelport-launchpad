# PixelPort Pivot P0 — Runtime Baseline + Thin Bridge Contract Slice

**Title:** Golden-image baseline contract + tenant status thin-bridge interface + migration prune checklist  
**Date:** 2026-03-16  
**Owner:** Codex  
**Build Size:** `medium`  
**Suggested Branch:** `codex/pivot-p0-implementation`

---

## Goal

Complete remaining P0 Track C definition/implementation work needed for safe pivot execution:
- `C1` droplet baseline and image manifest contract
- `C3` launchpad-to-runtime thin bridge status interface contract
- `C4` migration prune checklist for legacy launchpad runtime APIs.

## Scope

- In scope: env-driven droplet baseline resolution for provisioning image/size/region.
- In scope: baseline defaults aligned to pivot sizing (`4 vCPU / 8 GB`) with compatibility fallback image to avoid provisioning outage.
- In scope: add explicit golden-image manifest for pinned runtime components and rollout policy.
- In scope: expose thin bridge status contract marker and `task_step_unlocked` signal via `/api/tenants/status`.
- In scope: onboarding uses backend unlock signal when available (fallback remains status-based).
- In scope: document concrete prune/deprecate groups for legacy launchpad runtime route cleanup.

## Non-Goals

- Not in scope: Stripe-trigger provisioning (phase-2 hook).
- Not in scope: deleting legacy route groups in this slice (checklist only).
- Not in scope: Paperclip fork bootstrap ownership work.
- Not in scope: live production cutover.

## Founder-Approved Decision Alignment

- Pivot stays Paperclip-primary; launchpad remains thin bridge + commercial layer.
- VM baseline target remains pre-baked image, pinned versions, manual canary rollout.
- Provisioning/testing continuity is preserved while baseline envs are being finalized.

## Implementation Notes

- Systems or surfaces touched:
  - `api/inngest/functions/provision-tenant.ts`
  - `api/debug/env-check.ts`
  - `src/test/provision-tenant-memory.test.ts`
  - `infra/provisioning/cloud-init.yaml`
  - `infra/provisioning/golden-image-manifest.yaml`
  - `api/lib/thin-bridge-contract.ts`
  - `api/tenants/status.ts`
  - `src/lib/runtime-bridge-contract.ts`
  - `src/pages/Onboarding.tsx`
  - `src/test/runtime-bridge-contract.test.ts`
  - `docs/migration/launchpad-runtime-prune-checklist.md`
- New provisioning baseline envs:
  - canonical: `PROVISIONING_DROPLET_IMAGE`, `PROVISIONING_DROPLET_SIZE`, `PROVISIONING_DROPLET_REGION`
  - legacy fallback inputs: `PIXELPORT_DROPLET_IMAGE`, `DO_GOLDEN_IMAGE_ID`, `PIXELPORT_DROPLET_SIZE`, `PIXELPORT_DROPLET_REGION`
- Compatibility behavior:
  - if no image env is set, provisioning uses `ubuntu-24-04-x64` and logs warning
  - this avoids hard regressions while golden image env rollout is completed.

## Acceptance Criteria

- [x] Droplet baseline resolution supports canonical envs and legacy fallback envs.
- [x] Default size/region align with pivot baseline (`s-4vcpu-8gb`, `nyc1`).
- [x] Provisioning remains backward-safe when image envs are unset.
- [x] Golden image manifest exists with pinned component contract and rollout policy.
- [x] `/api/tenants/status` includes thin-bridge contract marker + `task_step_unlocked`.
- [x] Onboarding respects `task_step_unlocked` with fallback to status mapping.
- [x] Migration prune checklist doc exists with keep/deprecate/archive classification.
- [x] `npx vitest run src/test/provision-tenant-memory.test.ts src/test/provisioning-allowlist.test.ts src/test/runtime-bridge-contract.test.ts` passes.
- [x] `npx tsc --noEmit` passes.
- [ ] CTO review approves merge/deploy.
- [ ] Post-merge production smoke validates fresh tenant provisioning under configured baseline envs.

## CTO Handoff Prompt

Use the companion prompt file:
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p0-runtime-bridge-baseline-slice-cto-prompt.md`

## Blockers / Dependencies

- Founder/technical lead must set `PROVISIONING_DROPLET_IMAGE` to a valid golden image selector before enforcing strict golden-only provisioning behavior.
- Paperclip fork bootstrap/environment ownership remains prerequisite for downstream runtime cutover slices.
