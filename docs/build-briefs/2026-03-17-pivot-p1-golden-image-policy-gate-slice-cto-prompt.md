# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-golden-image-policy-gate-slice.md`

Review implementation on branch:
- `codex/p1-golden-image-policy-gate`

Compare against:
- `main`

Expected scope in this diff:
- provisioning image selector source classification is explicit:
  - `managed`
  - `compatibility`
  - `missing`
- strict missing-selector enforcement remains intact
- optional gate `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true` blocks compatibility selectors
- compatibility selector still works by default when explicitly configured
- tests cover classification and managed-only gate behavior
- manifest notes match strict-selector runtime behavior

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/provision-tenant-memory.test.ts`
- `/Users/sanchal/pixelport-launchpad/infra/provisioning/golden-image-manifest.yaml`

Validation already recorded for this slice:
- `npx tsc --noEmit`
- `npx vitest run src/test/provision-tenant-memory.test.ts`

Focus especially on:
- accidental behavior changes to existing provisioning paths
- whether compatibility-mode default remains non-breaking
- clarity/actionability of new managed-only enforcement error
- policy drift between code and manifest notes

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
