# Slack Channel Debug QA Evidence

**Date:** 2026-03-11
**Branch:** `codex/slack-channel-debug`
**QA target tenant:** `vidacious-4` (`6c6ae22c-d682-4af6-83ff-79913d267aea`)
**Droplet:** `557399795` / `137.184.56.1`
**Slack workspace:** `Analog` (`TS7V7KT35`)

---

## Scope

- Slack-only channel reply diagnosis and fix
- no onboarding/provisioning/bootstrap/dashboard expansion
- real production validation on the active tenant

## Live Baseline Truth

- Supabase showed exactly one active `slack_connections` row for `team_id = TS7V7KT35` on the active tenant.
- The active row carried the expected 13 bot scopes:
  - `app_mentions:read`
  - `channels:history`
  - `channels:read`
  - `chat:write`
  - `files:read`
  - `files:write`
  - `groups:history`
  - `groups:read`
  - `im:history`
  - `im:read`
  - `im:write`
  - `reactions:write`
  - `users:read`
- Founder confirmed the Slack app UI already had Event Subscriptions enabled with:
  - `app_mention`
  - `message.channels`
  - `message.groups`
  - `message.im`
- The target droplet was running image `pixelport-openclaw:2026.3.2-chromium`, and `openclaw --version` returned `2026.3.2`.
- Live runtime logs showed Socket Mode healthy before the fix:
  - `[slack] socket mode connected`

## Root Cause

- On OpenClaw `2026.3.2`, the live container resolved `channels.slack.groupPolicy` to `allowlist` when the field was absent.
- The active tenant had no Slack group allowlist configured.
- Result: DM traffic worked, but invited channel traffic was blocked by channel policy before reply handling.

## Code Change

- `api/lib/slack-activation.ts`
  - added explicit `groupPolicy: "open"` to the generated Slack config
  - extended parsed config state and the “current config” check to require `groupPolicy: "open"`
- `api/inngest/functions/activate-slack.ts`
  - extended the droplet-side Slack config check script to read `groupPolicy`
- `src/test/slack-activation.test.ts`
  - updated helper expectations for the explicit channel policy
  - added a regression test proving the old DM-only config is now considered stale

## Local Validation

- [x] `npx vitest run src/test/slack-activation.test.ts src/test/slack-connection.test.ts src/test/slack-install-route.test.ts src/test/slack-callback-route.test.ts src/test/connections-route.test.ts src/pages/dashboard/Connections.test.tsx`
  - result: 6 files passed, 17 tests passed
- [x] `npx tsc --noEmit`
  - result: passed

## Production Validation

- Applied the same explicit config correction directly on `137.184.56.1` for the active tenant only:
  - backup created at `/opt/openclaw/openclaw.json.bak.20260311-045843`
  - `/opt/openclaw/openclaw.json` now contains:
    - `dmPolicy: "open"`
    - `groupPolicy: "open"`
    - `allowFrom: ["*"]`
    - `replyToMode: "first"`
    - `configWrites: false`
- Live hot reload succeeded cleanly:
  - `[reload] config hot reload applied (channels.slack.groupPolicy)`
  - `[slack] socket mode connected`
- Founder supplied a live production screenshot proving Pixel replied in private channel `#vidacious-new-registrations`.
- Droplet session-store truth confirmed the active runtime processed that channel thread:
  - session file `830f9a38-9330-4a44-84f6-59df5acf7bcd.jsonl` captured the initial channel mention:
    - channel `C0A9C605ELD`
    - conversation label `#vidacious-new-registrations`
    - `was_mentioned: true`
    - user text: `<@U0AJE9BSERZ> there?`
  - the same session captured Pixel’s reply:
    - `[[reply_to_current]] Yep — I’m here. What do you need?`
  - follow-up thread session `cf001847-93a2-4eab-ad2b-56fa86db2a5b-topic-1773205571.525419.jsonl` captured subsequent thread replies in the same Slack channel/thread

## Known Nuance

- Slack Web API enumeration with the active bot token did not surface the private channel during validation, even though the live runtime session store and founder screenshot proved channel-thread processing on the active tenant.
- Treat that enumeration mismatch as a diagnostic nuance, not a blocker for this fix.

## Result

- Final verdict:
  - the active production tenant now proves DM plus invited-channel thread replies after the explicit Slack channel policy correction
- Remaining gate:
  - branch `codex/slack-channel-debug` still requires CTO review before merge/deploy
