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
- Required live validation was run after CTO approval, merge, and deploy.
- Production QA target remains the stable completed tenant `bootstrap-truth-qa-20260310054029` (`39a234b7-3ca5-4668-af9f-b188f2e5ec34`) on droplet `142.93.117.18`.
- Production QA execution:
  - merged `codex/slack-chief-online` to `main` as `3b6b401`
  - Vercel deployment for commit `3b6b401` reached `success`
  - production pre-connect smoke on the QA tenant passed:
    - tenant stayed `active`
    - `/api/connections` showed Slack `not_connected`
    - `POST /api/connections/slack/install` returned the expected 13-scope authorize URL with the production callback
    - droplet `142.93.117.18` returned `200` on port `18789`
    - `/opt/openclaw/openclaw.json` had no Slack config before install
  - founder completed production Slack install from the direct authorize URL in Analog
  - post-install production truth:
    - `slack_connections` row created for tenant `39a234b7-3ca5-4668-af9f-b188f2e5ec34`
    - `team_id = TS7V7KT35`
    - all 13 required scopes present
    - dashboard truth showed `activating`
  - activation completion:
    - production `/api/inngest` was re-registered out-of-band during same-session smoke
    - `pixelport/slack.connected` was resent once against the already-installed row
    - `slack_connections.is_active` flipped to `true`
    - dashboard truth moved to `active`
    - droplet Slack config became:
      - `dmPolicy: open`
      - `allowFrom: ["*"]`
      - `replyToMode: first`
      - `configWrites: false`
  - live Slack behavior:
    - welcome DM: delivered, but duplicate welcome message observed during smoke after manual resend
    - DM reply: passed
    - invited-channel reply: failed cleanly for the new QA tenant; another existing Analog-linked app replied instead of Pixel

## Collision Watch

- Existing Analog-linked tenants:
  - `vidacious`
  - `vidacious-1`
- Production QA must explicitly watch for:
  - duplicate replies
  - wrong-tenant routing
  - stale old-workspace installs masking the new QA tenant state
- Observed in production QA:
  - both old tenants still have active `slack_connections` rows on `team_id = TS7V7KT35`
  - both old rows still carry the older 8-scope install set
  - the invited test channel `#vidacious-bot` produced a reply from the older `Florence by Pocodot` app, not from the newly activated Pixel tenant
  - result: real workspace collision confirmed; invited-channel behavior is not yet isolated to the new QA tenant

## Result

- Final verdict:
  - merge/deploy complete; production QA passed for install, truthful status, activation, droplet config, and DM reply
- Follow-up fixes required:
  - invited-channel behavior remains blocked by existing same-workspace tenant collisions
  - do not deactivate old Analog Slack rows or change workspace/tenant routing strategy without a separate explicit founder-approved Slack follow-up
