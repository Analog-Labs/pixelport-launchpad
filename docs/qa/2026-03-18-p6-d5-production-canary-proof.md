# P6 D5 Production Canary Proof

- **Date:** 2026-03-18 (UTC evidence timestamps roll into 2026-03-19)
- **Environment:** production (`https://pixelport-launchpad.vercel.app`)
- **Goal:** prove the full launch-critical path end-to-end after PR `#17` merge and DO token rotation.

## Scope

`signup -> onboarding -> provision -> launch -> auto-login -> agent responds`

## Production Fixes Applied During This Run

1. Provisioning failures were traced to DigitalOcean image resolution errors in Inngest (`HTTP 422`, `Image is not available`, image id `221035422`).
2. Updated production Vercel env to compatibility mode:
- `PROVISIONING_DROPLET_IMAGE=ubuntu-24-04-x64`
- `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=false`
3. Redeployed production after env reset/re-add to clear stale values.

## Canary Tenant Evidence

- **Run id:** `canary-mmwqge5d`
- **Email:** `codex.canary-mmwqge5d@gmail.com`
- **Tenant id:** `6775e14a-116b-4071-a31c-08ca8cf4064b`
- **Slug:** `pixelport-canary-canary-mmwqge5d`
- **Droplet id:** `559309477`
- **Droplet IP:** `137.184.142.40`
- **Status:** `active`

Source artifact: `/tmp/d5-canary-final.json`

## Handoff + Auto-Login Proof

From `/tmp/d5-canary-final.json`:
- `runtime/handoff` status: `200`
- `contract_version`: `p1-v1`
- `launch_auth_mode`: `gateway-token`
- `workspace_launch_url` returned and tokenized

Playwright proof:
- `open` target: `https://pixelport-canary-canary-mmwqge5d.137-184-142-40.sslip.io/#token=...`
- landed URL: `https://pixelport-canary-canary-mmwqge5d.137-184-142-40.sslip.io/chat?session=main`
- page title: `OpenClaw Control`
- snapshot: `.playwright-cli/page-2026-03-19T00-36-47-831Z.yml`
- screenshot: `output/playwright/p6d5-autologin.png`

## Agent Response Proof

- Sent prompt in workspace chat: `Reply with exactly: PIXELPORT_LAUNCH_CANARY_OK`
- Snapshot `.playwright-cli/page-2026-03-19T00-39-41-252Z.yml` confirms:
- user prompt at line `411`
- assistant response `PIXELPORT_LAUNCH_CANARY_OK` at line `425`
- assistant role marker at line `427`
- screenshot: `output/playwright/p6d5-agent-poll.png`

## Backend Truth Checks

From `/tmp/d5-canary-final.json`:
- `onboarding_save.status`: `200`
- `runtime_hook.status`: `200`, `ok: true`, run id recorded
- backend truth rows: `agents=1`, `vault_sections=5`, no DB errors

## Verdict

**PASS** for D5 launch-critical canary: production flow reached active tenant provisioning, launch auto-login, and confirmed assistant response in workspace.

## Cleanup Note

Founder requested manual droplet cleanup for security. Canary droplet pending founder deletion:
- `559309477` (`137.184.142.40`)
