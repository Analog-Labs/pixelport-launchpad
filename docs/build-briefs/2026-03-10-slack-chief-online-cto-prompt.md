# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-slack-chief-online.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-10-slack-chief-online.md`

Review the implementation on branch `codex/slack-chief-online`.

Expected scope:
- safer authenticated Slack install initiation through `POST /api/connections/slack/install`
- proxy-safe redirect URI generation in the Slack install/callback routes
- expanded required Slack scopes for current Chief behavior
- truthful Slack connection status on `GET /api/connections` and the dashboard Connections page
- post-bootstrap Slack activation on the tenant droplet
- truthful production-QA plan for welcome DM, DM reply, and invited-channel reply in the real Analog Slack workspace after deploy

Critical constraints that must still be true:
- `api/inngest/functions/provision-tenant.ts` must remain unchanged from `main`
- validated tenant creation, fresh-tenant provisioning, droplet bootstrap, durable bootstrap truth, and existing dashboard read truth must remain frozen
- no fresh-tenant reprovisioning in this branch
- no unrelated provisioning/env repair from the discarded rescue state
- no merge or deploy has happened before this review

Validation evidence captured in this session will be summarized in:
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-10-slack-chief-online.md`

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
- any accidental touch to frozen provisioning/bootstrap truth paths
- false Slack `active` state before activation really completes
- missing-scope or reauthorization edge cases
- install/callback auth safety
- multi-proxy redirect URI safety in install/callback URL generation
- Slack runtime config correctness on the droplet
- whether the deferred production DM and invited-channel QA plan is sufficient and truthful
- tenant/workspace collision risk because Analog is already installed on older tenants `vidacious` and `vidacious-1`
