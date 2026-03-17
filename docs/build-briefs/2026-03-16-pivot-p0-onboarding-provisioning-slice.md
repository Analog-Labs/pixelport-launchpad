# PixelPort Pivot P0 — Onboarding + Provisioning Gate Slice

**Title:** Company/Provision/Task/Launch onboarding implementation + allowlist-gated tenant creation  
**Date:** 2026-03-16  
**Owner:** Codex  
**Build Size:** `medium`  
**Suggested Branch:** `codex/pivot-p0-implementation`

---

## Goal

Implement the founder-approved pivot onboarding contract in `pixelport-launchpad` and add safe v1 invite-gated provisioning behavior.

## Scope

- In scope: onboarding flow and UI sequence `Company -> Provision -> Task -> Launch`.
- In scope: explicit provisioning gate so Task is blocked until tenant status is `ready`/`active`.
- In scope: prefilled but editable starter task + agent suggestions in Task/Launch.
- In scope: `POST /api/tenants` allowlist gating for invite-only v1 provisioning.
- In scope: mission field compatibility (`mission` + `mission_goals`) for onboarding payloads.
- In scope: tests for allowlist parser behavior.

## Non-Goals

- Not in scope: Stripe-triggered provisioning hookup.
- Not in scope: Paperclip workspace template rewrites (`AGENTS.md`, `HEARTBEAT.md`).
- Not in scope: runtime topology enforcement in templates.
- Not in scope: launchpad/runtime migration prune (Phase P0 follow-up).

## Founder-Approved Decisions

- Preserve Paperclip defaults; only additive context collection from onboarding.
- No enforced 3-agent topology in templates.
- `SOUL.md` additive context is allowed; `AGENTS.md`/`HEARTBEAT.md` remain untouched.
- User-facing language can align from `CEO` to `Chief of Staff` without behavior changes.
- Provisioning for v1 testing is invite/allowlist gated.

## Implementation Notes

- Systems or surfaces touched:
  - `src/pages/Onboarding.tsx`
  - `src/components/onboarding/StepIndicator.tsx`
  - `src/components/onboarding/StepCompanyInfo.tsx`
  - `src/components/onboarding/StepProvisioning.tsx`
  - `src/components/onboarding/StepTaskSetup.tsx`
  - `src/components/onboarding/StepConnectTools.tsx`
  - `api/tenants/index.ts`
  - `api/lib/provisioning-allowlist.ts`
  - `src/test/provisioning-allowlist.test.ts`
- Expected behavior:
  - Company submit creates/provisions tenant and advances to Provision step.
  - Provision step polls `/api/tenants/status` and unlocks Task only when ready.
  - Task step allows starter task edits and agent suggestion add/edit/remove.
  - Launch persists onboarding payload and redirects to dashboard.
  - `TENANT_PROVISIONING_ALLOWLIST` supports exact emails and bare domains.
  - Blank/empty allowlist value does not accidentally block all provisioning.

## Acceptance Criteria

- [x] Onboarding flow renders and progresses as `Company -> Provision -> Task -> Launch`.
- [x] Provisioning gate blocks Task until tenant is `ready`/`active`.
- [x] Task/Launch surfaces editable starter task and editable agent suggestions.
- [x] `POST /api/tenants` accepts `mission` and `mission_goals` payload compatibility.
- [x] Allowlist gating enforces invite-only when configured.
- [x] Empty allowlist env is treated as disabled (open provisioning), not block-all.
- [x] `npx vitest run src/test/provisioning-allowlist.test.ts` passes.
- [x] `npx tsc --noEmit` passes.
- [ ] CTO review approves merge/deploy.
- [ ] Post-merge production smoke validates fresh-tenant onboarding/provisioning.

## CTO Handoff Prompt

Use the companion prompt file:
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p0-onboarding-provisioning-slice-cto-prompt.md`

## Blockers / Dependencies

- Allowlist owner/process needs founder + technical lead confirmation for v1 test rollout.
- Paperclip fork bootstrap ownership remains a prerequisite for downstream runtime cutover slices.
