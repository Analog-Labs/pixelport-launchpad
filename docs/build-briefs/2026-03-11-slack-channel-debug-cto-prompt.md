# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-11-slack-channel-debug.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-11-slack-channel-debug.md`

Review the implementation on branch `codex/slack-channel-debug` against `main`.

Expected scope:
- make Slack activation write explicit `groupPolicy: "open"` for OpenClaw `2026.3.2`
- treat old DM-only tenant configs as stale and repatchable
- keep the fix strictly Slack-only
- preserve DM behavior and reply mode while unblocking invited-channel mentions

Critical constraints that must still be true:
- `api/inngest/functions/provision-tenant.ts` must remain unchanged from `main`
- no onboarding, provisioning, droplet bootstrap, durable bootstrap truth, or unrelated dashboard behavior changes
- no multi-tenant routing rewrite, old-row cleanup, or workspace-collision strategy change
- no merge or deploy has happened before this review

Files expected in the real code diff:
- `/Users/sanchal/pixelport-launchpad/api/lib/slack-activation.ts`
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/activate-slack.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/slack-activation.test.ts`
- session/build/QA docs only

Validation evidence captured in this session is summarized in:
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-11-slack-channel-debug.md`

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

Focus especially on:
- whether the explicit `groupPolicy: "open"` fix is the minimum safe Slack-only correction
- whether the config verification change correctly forces stale tenants to repatch
- any accidental widening of channel behavior beyond mention-only invited-channel handling
- any regression risk to DM behavior, existing Slack activation truth, or bootstrap/tenant truth
- whether the production validation evidence is sufficient and truthful
