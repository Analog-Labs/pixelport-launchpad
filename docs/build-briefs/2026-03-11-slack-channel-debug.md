# PixelPort Slack Channel Reply Fix

**Title:** Explicit Slack channel policy for OpenClaw `2026.3.2`
**Date:** 2026-03-11
**Owner:** Codex
**Build Size:** `medium`
**Suggested Branch:** `codex/slack-channel-debug`

---

## Goal

Fix the active Slack bug where Pixel replies in DMs but not in invited Slack channels on tenant `vidacious-4`, without touching onboarding, provisioning, bootstrap truth, or unrelated dashboard behavior.

## Scope

- In scope: make Slack activation write an explicit `groupPolicy: "open"` setting so OpenClaw `2026.3.2` does not fall back to channel `allowlist` mode.
- In scope: update Slack config verification so existing tenants with the old DM-only config are treated as stale and get repatched.
- In scope: validate the fix locally and on the live tenant/workspace.

## Non-Goals

- Not in scope: onboarding, tenant creation, provisioning, droplet bootstrap, durable bootstrap truth, or unrelated dashboard behavior.
- Not in scope: workspace-collision routing strategy, old-row deactivation, or any non-Slack channel work.

## Founder-Approved Decisions

- Product decisions already approved: invited channels remain mention-only; do not broaden to reply-to-all behavior.
- UX decisions already approved: no dashboard/UI expansion in this session.
- Architecture decisions already approved: treat the live OpenClaw `2026.3.2` runtime as source of truth for this Slack-only follow-up.

## Implementation Notes

- Systems or surfaces touched: `api/lib/slack-activation.ts`, `api/inngest/functions/activate-slack.ts`, and focused Slack activation tests.
- Expected data flow or integration behavior: Slack OAuth row remains unchanged; activation writes the explicit channel policy to `/opt/openclaw/openclaw.json`; existing stale tenants repatch on reactivation.
- Known constraints or existing caveats: Event Subscriptions and required bot events were already confirmed in the Slack app UI; only one active `slack_connections` row remains for `TS7V7KT35`.
- External credentials or dependencies: Slack bot/app tokens, Supabase service role, SSH access to droplet `137.184.56.1`.

## Acceptance Criteria

- [x] Slack activation writes and verifies `groupPolicy: "open"` alongside the existing DM settings.
- [x] Targeted Slack tests pass and `npx tsc --noEmit` passes.
- [x] Production validation proves the active tenant replies in one clean invited channel after the config correction.

## CTO Handoff Prompt

Use the companion prompt file:
- `docs/build-briefs/2026-03-11-slack-channel-debug-cto-prompt.md`

## Production Smoke Checklist

- [x] Changed Slack runtime config works on production tenant `vidacious-4`
- [x] No obvious DM regression on the active Slack install
- [x] Invited-channel mention behavior is proven on one clean channel
- [x] Branch code was merged to `main` and Vercel marked commit `7202c36` deployed successfully
- [x] Same-session post-deploy smoke on the active tenant matched the expected Slack control-plane and droplet truth

## Blockers / Required Credentials

- Blocking item: CTO review is still required before merge.
- Required credential: founder Slack access for real production channel validation.
