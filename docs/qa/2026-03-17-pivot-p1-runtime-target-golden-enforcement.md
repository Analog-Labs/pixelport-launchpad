# QA Evidence — Pivot P1 Runtime Target + Golden Enforcement

**Date:** 2026-03-17 (America/Chicago)  
**Release commit on `main`:** `688c4e3`  
**Deploy status:** `success`  
**Deploy URL:** `https://vercel.com/sanchalrs-projects/pixelport-launchpad/7wihkxTEH7eRPevqicduNULohfcX`

## Scope

Record post-merge truth for runtime-target handoff hardening and strict provisioning golden-image enforcement.

## Implemented Outcomes (Recorded from `688c4e3`)

1. `api/debug/env-check.ts` is production-gated and header-auth only (`x-debug-secret`).
2. `api/tenants/index.ts` removed `Record<string, any>` in favor of typed request body handling.
3. `/api/runtime/handoff` derives `paperclip_runtime_url` from tenant `droplet_ip` as `http://<ip>:18789` and no longer depends on `PAPERCLIP_RUNTIME_URL`.
4. Missing/invalid runtime target now returns `409` with `runtime-target-unavailable`.
5. Provisioning path enforces strict golden image selection (no compatibility fallback image).

## Local Validation

- `npx tsc --noEmit` -> pass
- `vitest` suite for 4 files / 29 tests -> pass
- QA reviewer verdict -> `APPROVED` with no findings

## Production Smoke Truth

- `GET /api/debug/env-check` -> `404 {"error":"Not found"}`
- `POST /api/runtime/handoff` without auth -> `401`
- `POST /api/runtime/handoff` with invalid bearer -> `401`
- Authenticated rerun with temporary user+tenant (valid `droplet_ip`) -> `200`
  - returned `paperclip_runtime_url`: `http://157.245.253.88:18789`
- Cleanup:
  - tenant deleted: `true`
  - user deleted: `true`

## Critical Follow-Up Truth

- `PAPERCLIP_HANDOFF_SECRET` is present in Vercel env.
- `PROVISIONING_DROPLET_IMAGE` was set in production to `ubuntu-24-04-x64` on 2026-03-17.
- With strict enforcement active, missing-env blocker is now cleared; remaining follow-up is promotion to a maintained PixelPort golden image artifact.

## Verdict

`pass` for this slice: runtime-targeted handoff behavior is validated in production (including authenticated `200` path), and strict golden-image enforcement is live with missing-env blocker cleared; follow-up is promotion to a maintained PixelPort golden image artifact.
