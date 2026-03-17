# QA Evidence — Pivot P0 Merge/Deploy Release Smoke

**Date:** 2026-03-16 (America/Chicago)  
**Release branch merged:** `codex/pivot-p0-implementation`  
**Release commit on `main`:** `a6a2ad0`  
**Deploy target:** `https://vercel.com/sanchalrs-projects/pixelport-launchpad/Dcn4hjt5rW449Eq2TmJieU5fCmAT`

## Deploy Confirmation

- GitHub status for `a6a2ad0`: `success`
- Status context: `Vercel`
- Production alias used for smoke: `https://pixelport-launchpad.vercel.app`

## Fresh-Tenant Canary

- Email: `test-pixelport-dry-run-mmu2ladg@pixelport-test.local`
- Tenant ID: `b31603b5-89e0-4f6c-9e71-7658ece7fdcc`
- Slug: `pixelport-dry-run-mmu2ladg`
- Droplet ID: `558840407`
- Droplet IP: `157.245.253.88`

### Provisioning + Runtime Facts

- Tenant progressed `provisioning -> active`.
- `/api/tenants/status` returned:
  - `status: "active"`
  - `bootstrap_status: "accepted"`
  - `task_step_unlocked: true`
  - `contract_version: "pivot-p0-v1"`
  - `has_droplet: true`, `has_gateway: true`, `has_litellm: true`
- Gateway health check passed:
  - `GET http://157.245.253.88:18789/health` -> `{"ok":true,"status":"live"}`

### API Truth Checks (Authenticated Canary User)

- `GET /api/tenants/me`: returned active tenant with expected droplet + onboarding payload.
- `GET /api/tasks`: returned `3` running tasks.
- `GET /api/vault`: returned `5` sections, all `populating`.
- `GET /api/competitors`: returned `0` competitors.

### Backend Row Truth (Supabase)

- `agents`: `1`
- `agent_tasks`: `3` (running: `0` at capture, meaning task state advanced after initial route read)
- `vault_sections`: `5`
- `vault_non_pending`: `5`
- `competitors`: `0`
- `sessions_log`: `0`

## Cleanup

- Cleanup endpoint run: `POST /api/debug/test-provision?cleanup=true`
- Tenant row deleted: `true`
- Droplet deleted: `false` (known DO token scope limitation from prior sessions)

## Verdict

`pass`

P0 release is live and core changed surfaces are working on a fresh production tenant.  
Open operational follow-up remains unchanged: set `PROVISIONING_DROPLET_IMAGE` to a valid golden image selector before enforcing strict golden-only provisioning.
