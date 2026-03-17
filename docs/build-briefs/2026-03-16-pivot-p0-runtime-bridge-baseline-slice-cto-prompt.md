# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p0-runtime-bridge-baseline-slice.md`

Review implementation on branch:
- `codex/pivot-p0-implementation`

Compare against:
- `main`

Expected scope in this diff:
- provisioning baseline resolver in `provision-tenant` for image/size/region env contracts
- baseline defaults aligned to `s-4vcpu-8gb` and `nyc1`
- compatibility fallback image behavior when image envs are unset
- golden image manifest + cloud-init doc sync
- thin bridge contract for `/api/tenants/status` including `task_step_unlocked`
- onboarding polling uses backend unlock signal with safe fallback
- migration prune checklist document for legacy launchpad runtime route groups

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts`
- `/Users/sanchal/pixelport-launchpad/api/debug/env-check.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/provision-tenant-memory.test.ts`
- `/Users/sanchal/pixelport-launchpad/infra/provisioning/cloud-init.yaml`
- `/Users/sanchal/pixelport-launchpad/infra/provisioning/golden-image-manifest.yaml`
- `/Users/sanchal/pixelport-launchpad/api/lib/thin-bridge-contract.ts`
- `/Users/sanchal/pixelport-launchpad/api/tenants/status.ts`
- `/Users/sanchal/pixelport-launchpad/src/lib/runtime-bridge-contract.ts`
- `/Users/sanchal/pixelport-launchpad/src/pages/Onboarding.tsx`
- `/Users/sanchal/pixelport-launchpad/src/test/runtime-bridge-contract.test.ts`
- `/Users/sanchal/pixelport-launchpad/docs/migration/launchpad-runtime-prune-checklist.md`
- session/build docs updates only

Validation already run on branch:
- `npx tsc --noEmit`
- `npx vitest run src/test/provision-tenant-memory.test.ts src/test/provisioning-allowlist.test.ts src/test/runtime-bridge-contract.test.ts`

Focus especially on:
- provisioning safety and backward compatibility when golden image env is missing
- whether the status contract additions are additive/non-breaking for existing callers
- whether onboarding unlock behavior can regress for in-progress tenants
- whether migration checklist classifications match pivot scope boundaries

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
