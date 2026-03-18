# P6 Runtime Ingress HTTPS Resolution (D4 Progress)

- **Date:** 2026-03-18
- **Branch:** `codex/p6-e2e-handoff-golden-image-scan-hardening`
- **Commits:** `0c60680`, `74a2f37`
- **PR:** `#17`

## Objective

Advance D4 by making runtime launch URLs resolve to per-tenant HTTPS targets first, while preserving droplet-IP HTTP fallback compatibility.

## Shipped Changes

1. Runtime URL resolver now uses this precedence:
   - `onboarding_data.runtime_https_url` / `onboarding_data.runtime_url`
   - `https://<tenant-slug>.<PAPERCLIP_RUNTIME_BASE_DOMAIN>`
   - legacy `http://<droplet-ip>:18789`
2. Provisioning now computes/persists runtime ingress metadata in onboarding data:
   - `runtime_url`, `runtime_https_url`, `runtime_host`, `runtime_url_source`, `runtime_url_updated_at`
3. Cloud-init now supports HTTPS ingress setup via Caddy for resolved runtime hosts.
4. Route/unit tests added for runtime resolver precedence + provisioning ingress planning.

## Validation

- `npx tsc --noEmit` -> pass
- `npm test` -> pass (`19 files`, `88 tests`)

## Live Canary Research (Not Persisted)

Canary host: `157.230.10.108`

- Verified that `trusted-proxy` auth behind Caddy can bypass pairing and return successful WS `hello-ok` for Control UI clients.
- Immediately rolled canary changes back to prior config after validation.

Rollback confirmed:
- OpenClaw auth mode restored to `token`
- Caddyfile restored to plain reverse proxy
- `openclaw-gateway` container healthy after restart

## Option 1 Execution (Founder Approved)

- Implemented temporary break-glass default in provisioning:
  - `gateway.controlUi.dangerouslyDisableDeviceAuth=true` (token auth remains enabled)
  - env switch added: `OPENCLAW_CONTROL_UI_DISABLE_DEVICE_AUTH` (set `false` to disable break-glass later)
- Added tests for:
  - break-glass default on
  - explicit override off
  - cloud-init emitted config includes the flag

## Live Canary Proof (Option 1)

Canary host: `157.230.10.108`

- Applied `gateway.controlUi.dangerouslyDisableDeviceAuth=true` under token auth mode.
- Verified WS connect result for Control UI client over HTTPS with token and no device identity:
  - `{"type":"res","id":"1","ok":true,"payload":{"type":"hello-ok",...}}`
- Result: pairing blocker was cleared for the tested control-ui connect flow.
