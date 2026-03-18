# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/migration/launchpad-runtime-prune-checklist.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-18-pivot-p3-runtime-prune-batch3-chat-settings-legacy.md`

Review implementation on branch:
- `codex/p3-c4-prune-batch3-chat-settings-legacy`

Compare against:
- `main`

Expected scope in this diff:
- remove vestigial dashboard chat surfaces:
  - `src/pages/dashboard/Chat.tsx`
  - `src/components/dashboard/ChatWidget.tsx`
  - `src/contexts/ChatContext.tsx`
  - remove `ChatProvider` wiring from `src/pages/Dashboard.tsx`
- remove vestigial dashboard pages/routes:
  - `src/pages/dashboard/Performance.tsx`
  - `src/pages/dashboard/Settings.tsx`
  - route/nav cleanup in `src/App.tsx` and `src/components/dashboard/AppSidebar.tsx`
- delete legacy API surfaces:
  - `api/settings/*`
  - `api/debug/slack-status.ts`
- update `src/test/tenants-status-route.test.ts` to current status contract payload (`contract_version`, `task_step_unlocked`)
- preserve keep-now thin-bridge surfaces (`api/tenants/*`, `api/inngest/*`, `api/runtime/handoff`)

Validation recorded for this slice:
- `npx tsc --noEmit`
- `npm test`
- route/dependency scans for deleted chat/settings/debug surfaces

Focus especially on:
- accidental regressions in onboarding/provisioning thin-bridge paths
- stale imports/routes after chat/settings page deletion
- correctness of `tenants-status` contract test updates
- hidden dependency drift in connections/runtime handoff surfaces

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
