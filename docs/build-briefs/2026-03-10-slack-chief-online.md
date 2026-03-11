# PixelPort Build Brief

**Title:** Slack Chief Online Completion
**Date:** 2026-03-10
**Owner:** Codex
**Build Size:** `medium`
**Suggested Branch:** `codex/slack-chief-online`

---

## Goal

Finish the recovered Slack-only branch and prepare it for CTO review, merge, deploy, and controlled production Slack QA on a stable completed QA tenant without touching the frozen tenant creation, provisioning, bootstrap, or dashboard truth baselines.

## Scope

- In scope:
  - audit the recovered Slack branch against the approved Slack slice
  - keep Slack install initiation authenticated and server-driven
  - enforce the expanded required Slack scopes for current Chief behavior
  - keep `GET /api/connections` truthful about `not_connected`, `activating`, `active`, and `reauthorization_required`
  - activate Slack only after truthful bootstrap completion
  - harden Slack install and callback redirect generation against proxy header quirks
  - prepare controlled production Slack QA on the existing completed QA tenant
  - prepare CTO handoff once the branch is validated

## Non-Goals

- Not in scope:
  - modifying `api/inngest/functions/provision-tenant.ts`
  - changing validated tenant creation, droplet bootstrap, or durable bootstrap truth behavior
  - speculative fresh-tenant reprovisioning
  - unrelated provisioning/env fixes from the discarded dirty rescue state
  - merge, deploy, or production smoke before CTO review

## Locked Constraints

- The validated `main` flows for tenant creation, fresh-tenant provisioning, droplet bootstrap, durable bootstrap truth, and existing dashboard read truth are frozen in this session.
- If a reproduced Slack issue appears to require touching those frozen flows, stop and escalate before implementing anything outside the current Slack surface.
- Real Slack QA should prefer the already completed QA tenant `bootstrap-truth-qa-20260310054029` (`39a234b7-3ca5-4668-af9f-b188f2e5ec34`, droplet `142.93.117.18`).
- The real Slack workspace for QA is Analog unless the founder directs otherwise.

## Implementation Notes

- Systems or surfaces touched:
  - [install.ts](/Users/sanchal/pixelport-launchpad/api/connections/slack/install.ts)
  - [callback.ts](/Users/sanchal/pixelport-launchpad/api/connections/slack/callback.ts)
  - [index.ts](/Users/sanchal/pixelport-launchpad/api/connections/index.ts)
  - [activate-slack.ts](/Users/sanchal/pixelport-launchpad/api/inngest/functions/activate-slack.ts)
  - [slack-activation.ts](/Users/sanchal/pixelport-launchpad/api/lib/slack-activation.ts)
  - [slack-connection.ts](/Users/sanchal/pixelport-launchpad/api/lib/slack-connection.ts)
  - [Connections.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/Connections.tsx)
  - [capabilities.ts](/Users/sanchal/pixelport-launchpad/api/agent/capabilities.ts)
- The branch must preserve the intended contract:
  - `POST /api/connections/slack/install` returns `{ authorize_url }`
  - `GET /api/connections` exposes truthful Slack `status`, `missing_scopes`, and `reauthorization_required`
  - activation remains additive inside the current Slack path
- Narrow hardening found during the branch audit:
  - normalize `x-forwarded-proto` in the Slack install/callback routes so comma-separated proxy values do not produce malformed callback URLs
  - cover the normalization in focused route tests
- Live Slack QA path after CTO approval and deploy:
  - founder connects Slack from the real production Connections page on the stable QA tenant
  - founder sends one DM to the Chief
  - founder invites the Chief to one disposable test channel and sends one message
  - verify dashboard truth, Supabase truth, and droplet runtime truth against production

## Acceptance Criteria

- [ ] Branch diff remains Slack-only plus the expected session/build docs.
- [ ] `api/inngest/functions/provision-tenant.ts` is unchanged from `main`.
- [ ] Slack install starts through authenticated `POST /api/connections/slack/install`.
- [ ] Slack install/callback redirect generation is resilient to multi-value proxy headers.
- [ ] Targeted Slack tests and `npx tsc --noEmit` pass on the branch.
- [ ] CTO review artifacts are complete and truthful about remaining runtime QA.
- [ ] Production Slack QA plan is ready on the existing completed QA tenant without any fresh provisioning rerun.
- [ ] No frozen provisioning/bootstrap/dashboard truth flow is modified or reprovisioned during this build.

## Validation Evidence

- Local validation:
  - `npx vitest run src/test/slack-connection.test.ts src/test/slack-install-route.test.ts src/test/slack-callback-route.test.ts src/test/connections-route.test.ts src/test/slack-activation.test.ts src/pages/dashboard/Connections.test.tsx`
  - `npx tsc --noEmit`
- Controlled production QA target after CTO approval and deploy:
  - QA auth email: `codex.bootstrap.truth.20260310053742@example.com`
  - tenant slug: `bootstrap-truth-qa-20260310054029`
  - tenant id: `39a234b7-3ca5-4668-af9f-b188f2e5ec34`
  - droplet id: `557163621`
  - droplet ip: `142.93.117.18`
  - Slack workspace: `Analog`
- Final evidence will be recorded in:
  - [2026-03-10-slack-chief-online.md](/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-10-slack-chief-online.md)

## CTO Review

Use [2026-03-10-slack-chief-online-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-slack-chief-online-cto-prompt.md) for the required review before merge.

## Blockers / Required Founder Actions

- Founder must be available to:
  - connect Slack from the production QA tenant dashboard after deploy
  - approve or reapprove the Analog install if Slack requests it
  - send one DM to the bot
  - invite the bot into one controlled test channel
- CTO review remains required before any merge or deploy.
