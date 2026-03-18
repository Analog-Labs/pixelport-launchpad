# PixelPort CTO Review Prompt

Review this PixelPort pivot high-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/migration/launchpad-runtime-prune-checklist.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch2-dashboard-runtime-legacy.md`

Review implementation on branch:
- `codex/p3-c4-prune-batch2-dashboard-runtime-legacy`

Compare against:
- `main`

Expected scope in this diff:
- remove vestigial dashboard pages/routes that depend on legacy runtime APIs:
  - `Home`, `Content`, `Calendar`, `Vault`, `Competitors`
- remove sidebar/nav links to deleted surfaces
- retain a safe dashboard landing route that does not depend on deleted runtime APIs
- delete legacy route groups:
  - `api/commands/*`
  - `api/tasks/*`
  - `api/vault/*`
  - `api/agent/*`
  - `api/agents/*`
  - `api/competitors/*`
- remove/update tests and references tied to deleted route groups
- preserve onboarding/provisioning keep-now surfaces (`api/tenants/*`, `api/inngest/*`, `api/runtime/handoff`)

Validation recorded for this slice:
- `npx tsc --noEmit`
- `npm test -- --exclude src/test/tenants-status-route.test.ts`
- route-usage scans proving removed route groups are no longer consumed by frontend runtime paths

Focus especially on:
- accidental deletion of still-required keep-now thin-bridge functionality
- hidden dependency drift in auth/onboarding/provisioning paths
- route regressions from dashboard route cleanup
- test coverage gaps after deleting legacy route suites

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
