# P6 Runtime Ingress HTTPS Resolution (D4 Progress)

- **Date:** 2026-03-18
- **Branch:** `codex/p6-e2e-handoff-golden-image-scan-hardening`
- **Commit:** `0c60680`
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
- `npm test` -> pass (`19 files`, `86 tests`)

## Live Canary Research (Not Persisted)

Canary host: `157.230.10.108`

- Verified that `trusted-proxy` auth behind Caddy can bypass pairing and return successful WS `hello-ok` for Control UI clients.
- Immediately rolled canary changes back to prior config after validation.

Rollback confirmed:
- OpenClaw auth mode restored to `token`
- Caddyfile restored to plain reverse proxy
- `openclaw-gateway` container healthy after restart

## Remaining D4 Decision Gate

HTTPS runtime targeting is now in place, but first-time Control UI pairing on public hostnames still requires an explicit auth-mode decision for production rollout.
