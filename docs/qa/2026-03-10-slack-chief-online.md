# Slack Chief Online QA Evidence

**Date:** 2026-03-10
**Branch:** `codex/slack-chief-online`
**Starting commit:** `1ed362ed27388ea4a23ad392a0ccba4116cd9ab6`
**QA target tenant:** `bootstrap-truth-qa-20260310054029` (`39a234b7-3ca5-4668-af9f-b188f2e5ec34`)
**Droplet:** `557163621` / `142.93.117.18`
**Slack workspace:** `Analog`

---

## Scope

- Slack-only recovery audit
- safer Slack install initiation
- redirect URI hardening for proxied callback generation
- expanded Slack scopes
- truthful Slack connection status
- post-bootstrap Slack activation
- welcome DM
- DM reply
- invited-channel reply

## Baseline Guardrails

- `api/inngest/functions/provision-tenant.ts` must remain untouched.
- No fresh-tenant reprovisioning is allowed in this session.
- Frozen baseline flows:
  - tenant creation
  - fresh-tenant provisioning
  - droplet bootstrap
  - durable bootstrap truth
  - existing dashboard read truth

## Local Validation

- [x] `npx vitest run src/test/slack-connection.test.ts src/test/slack-install-route.test.ts src/test/slack-callback-route.test.ts src/test/connections-route.test.ts src/test/slack-activation.test.ts src/pages/dashboard/Connections.test.tsx`
  - result: 6 files passed, 15 tests passed
- [x] `npx tsc --noEmit`
  - result: passed

## Branch Audit

- `git diff --name-only main...HEAD` stayed inside the approved Slack slice:
  - `api/agent/capabilities.ts`
  - `api/connections/index.ts`
  - `api/connections/slack/callback.ts`
  - `api/connections/slack/install.ts`
  - `api/inngest/functions/activate-slack.ts`
  - `api/lib/slack-activation.ts`
  - `api/lib/slack-connection.ts`
  - `src/pages/dashboard/Connections.tsx`
  - `src/pages/dashboard/Home.tsx`
  - Slack tests and session docs only
- Verified frozen baseline files were untouched by the branch audit:
  - `api/inngest/functions/provision-tenant.ts`
  - bootstrap truth routes/helpers
  - existing dashboard read truth routes
- `git diff --check` passed for the session delta.
- New session hardening stayed Slack-only:
  - normalized `x-forwarded-proto` handling in the Slack install/callback routes
  - added focused route coverage for the normalization path

## Deferred Runtime QA

- Local tunnel QA path was intentionally abandoned for this session and is not part of the final evidence gate.
- Required live validation is deferred until after CTO approval, merge, and deploy.
- Production QA target remains the stable completed tenant `bootstrap-truth-qa-20260310054029` (`39a234b7-3ca5-4668-af9f-b188f2e5ec34`) on droplet `142.93.117.18`.
- Founder-driven production QA checklist after deploy:
  - connect Slack from the real production Connections page
  - confirm all required scopes on install or reinstall
  - verify dashboard truth transitions through `not_connected`, `activating`, `active`, or `reauthorization_required`
  - verify Supabase `slack_connections` truth including scopes and `is_active`
  - verify droplet Slack config truth:
    - `dmPolicy: open`
    - `allowFrom: ["*"]`
    - `replyToMode: first`
    - `configWrites: false`
  - verify welcome DM, DM reply, and invited-channel reply in Analog

## Collision Watch

- Existing Analog-linked tenants:
  - `vidacious`
  - `vidacious-1`
- Production QA must explicitly watch for:
  - duplicate replies
  - wrong-tenant routing
  - stale old-workspace installs masking the new QA tenant state

## Result

- Final verdict:
  - branch audit complete; CTO-required pre-merge fix applied; ready for merge/deploy when production Slack QA can follow immediately
- Follow-up fixes required:
  - none before merge
  - production Slack QA after deploy
