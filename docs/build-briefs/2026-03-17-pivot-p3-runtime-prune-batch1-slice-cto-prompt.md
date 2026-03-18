# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/migration/launchpad-runtime-prune-checklist.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p3-runtime-prune-batch1-slice.md`

Review implementation on branch:
- `codex/p3-c4-prune-batch1-chat-content-approvals`

Compare against:
- `main`

Expected scope in this diff:
- delete legacy unused route groups:
  - `api/chat.ts`
  - `api/chat/history.ts`
  - `api/content/index.ts`
  - `api/content/[id].ts`
  - `api/approvals/index.ts`
  - `api/approvals/[id]/decide.ts`
- remove emptied route directories for deleted groups
- preserve active keep-now provisioning bridge surfaces
- preserve `api/competitors/*` (still used by dashboard)
- docs updated for prune-batch evidence + next-step constraints

Validation recorded for this slice:
- `npx tsc --noEmit`
- `npm test -- --exclude src/test/tenants-status-route.test.ts`
- route-usage scans proving no live frontend/inngest dependency on removed groups

Focus especially on:
- accidental removal of any still-used route surface
- regressions in active onboarding/provisioning flow contracts
- hidden dependency drift (tests, inngest, or dashboard route consumption)
- whether `competitors` was correctly left intact for now

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
