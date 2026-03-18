# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice.md`

Review implementation on branch:
- `codex/p2-paperclip-launch-redirect`

Compare against:
- `main`

Expected scope in this diff:
- onboarding launch uses blocking `POST /api/runtime/handoff` before completion state is persisted
- handoff response URL (`paperclip_runtime_url`) is validated and then used for redirect
- `launch_completed_at` is set only after successful handoff + successful onboarding save
- launch-step UX copy reflects workspace destination instead of dashboard destination
- no backend API contract changes and no template-file overrides to Paperclip defaults

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/src/pages/Onboarding.tsx`
- `/Users/sanchal/pixelport-launchpad/src/components/onboarding/StepConnectTools.tsx`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p2-launch-workspace-redirect-slice.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-17-pivot-p2-launch-workspace-redirect.md`

Validation already recorded for this slice:
- `npx tsc --noEmit`
- `npx vitest run src/test/runtime-handoff-route.test.ts`
- `npx vitest run src/test/onboarding-bootstrap.test.ts`
- independent QA sub-agent pass

Focus especially on:
- ordering/regression risk around launch completion persistence
- malformed URL handling and failure-mode UX
- any accidental onboarding navigation regressions
- any behavior drift from approved pivot decisions

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
