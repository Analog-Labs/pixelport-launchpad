# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p0-onboarding-provisioning-slice.md`

Review implementation on branch:
- `codex/pivot-p0-implementation`

Compare against:
- `main`

Expected scope in this diff:
- onboarding flow contract implemented as `Company -> Provision -> Task -> Launch`
- explicit provisioning gate before Task unlock (`ready`/`active` required)
- prefilled but editable starter task + agent suggestions in Task/Launch
- `POST /api/tenants` invite/allowlist gating using `TENANT_PROVISIONING_ALLOWLIST`
- compatibility for onboarding mission payloads (`mission` and `mission_goals`)
- allowlist parser behavior where blank env value is treated as disabled (not block-all)

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/src/pages/Onboarding.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepIndicator.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepCompanyInfo.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepProvisioning.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepTaskSetup.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepConnectTools.tsx`
- `/Users/sanchal/pixelport-launchpad/api/tenants/index.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/provisioning-allowlist.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/provisioning-allowlist.test.ts`
- session/build docs updates only

Validation already run on branch:
- `npx vitest run src/test/provisioning-allowlist.test.ts`
- `npx tsc --noEmit`

Focus especially on:
- onboarding step gating correctness and resume behavior for in-progress tenants
- no regression in existing tenant path when allowlist is enabled
- payload compatibility and backward-safe handling of mission fields
- invite-only behavior correctness for exact email + bare-domain entries
- frontend UX parity with Paperclip defaults where mission remains optional

Return your review in this exact shape:
1. `Verdict: APPROVED` or `Verdict: BLOCKED`
2. Findings first, ordered by severity
3. File references for each finding
4. What must be fixed before merge, if anything
5. What you checked
6. Residual risks
7. One explicit final line:
   - `Approved to merge and deploy.`
   - or `Blocked pending fixes.`
