# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`

Review implementation on branch:
- `codex/pivot-p1-bootstrap-handoff`

Compare against:
- `main`

Expected scope in this diff:
- ownership contract is published for Paperclip fork bootstrap and runtime handoff ownership
- active execution moves from P0 to P1 with explicit ownership + first handoff checklist
- session log records P1 kickoff intent/state without fabricated runtime outcomes
- project status immediate actions are updated to reflect P1 kickoff
- additive launchpad-to-paperclip handoff contract route exists at `POST /api/runtime/handoff`
- handoff helper contract exists under `api/lib/` with explicit env validation/failure handling
- env diagnostics surface includes required handoff contract variables
- focused tests cover contract helper and handoff route behavior

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/docs/paperclip-fork-bootstrap-ownership.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/pixelport-project-status.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-16-pivot-p1-paperclip-bootstrap-handoff-slice-cto-prompt.md`
- `/Users/sanchal/pixelport-launchpad/api/runtime/handoff.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/paperclip-handoff-contract.ts`
- `/Users/sanchal/pixelport-launchpad/api/debug/env-check.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/paperclip-handoff-contract.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/runtime-handoff-route.test.ts`

Validation already run on branch:
- `npx vitest run src/test/paperclip-handoff-contract.test.ts src/test/runtime-handoff-route.test.ts`
- `npx tsc --noEmit`

Focus especially on:
- ownership matrix completeness and whether runbook owners are unambiguous
- boundary correctness for founder-approval-required decisions
- additive safety of the new handoff route (no regressions to existing runtime endpoints)
- explicit handling when required handoff env variables are missing or malformed
- alignment with pivot rules: Paperclip runtime source of truth, launchpad stays thin bridge

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
