# QA Evidence — Pivot P1 Managed Golden Promotion and Managed-Only Canary

**Date:** 2026-03-17 (America/Chicago)  
**Target alias:** `https://pixelport-launchpad.vercel.app`

## Scope

Validate rollout sequence:
1. Promote production selector to maintained managed snapshot image.
2. Verify fresh-tenant canary uses managed snapshot image.
3. Enable managed-only gate and run strict fresh-tenant canary.

## Step 1 — Selector Promotion (Confirmed)

- DO snapshot promoted: `220984246` (`pixelport-paperclip-golden-2026-03-17-a627712`)
- Production env selector updated:
  - `PROVISIONING_DROPLET_IMAGE=220984246`
- Production alias redeployed successfully.

## Step 2 — Managed Snapshot Canary (Pass)

- Canary tenant:
  - `id`: `025792b0-80f1-48c1-812a-75af3f7020d3`
  - `slug`: `pixelport-dry-run-mmudpzis`
- Runtime status:
  - reached `active`
  - droplet `558892798` / `159.65.239.67`
  - gateway health: `GET http://159.65.239.67:18789/health` -> `200 {"ok":true,"status":"live"}`
- Image truth:
  - DO `droplet_get(558892798)` returned `image.id=220984246`
  - image name matched snapshot: `pixelport-paperclip-golden-2026-03-17-a627712`
- Cleanup:
  - cleanup endpoint removed tenant row
  - verification query returned `TENANT_AFTER=[]`

## Step 3 — Managed-Only Gate + Strict Canary (Blocked)

- Managed-only gate enabled in production:
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
- Strict canary tenant:
  - `id`: `86fc38f5-ac20-4c14-be88-3bcb1d2792aa`
  - `slug`: `pixelport-dry-run-mmudwezi`
- Observed behavior:
  - remained `status=provisioning` with `droplet_id=null` in tenant row
  - Inngest run (Provision New Tenant) failed on `create-droplet`
  - failure class: `HTTP 422` from DigitalOcean API

## Root Cause Diagnostics (Confirmed)

- Direct DigitalOcean probe with same provisioning parameters returned:
  - `HTTP 422`
  - `{"id":"unprocessable_entity","message":"creating this/these droplet(s) will exceed your droplet limit"}`
- Existing stale dry-run droplets consume quota:
  - `558840407`, `558876964`, `558878686`, `558892354`, `558892798`
- Cleanup token cannot delete those droplets:
  - each delete attempt returned `HTTP 403 {"id":"Forbidden","message":"You are not authorized to perform this operation"}`

## Evidence Snippets (Command + Key Output)

- Production env verification after Step 3 toggle:
  - `rg '^PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=' /tmp/pixelport-env-verify.*`
  - output: `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE="true\\n"`
  - `rg '^PROVISIONING_DROPLET_IMAGE=' /tmp/pixelport-env-verify.*`
  - output: `PROVISIONING_DROPLET_IMAGE="220984246\\n"`
- Managed-image truth check:
  - `mcp__digitalocean__droplet_get(ID=558892798)`
  - output excerpt: `"image": {"id": 220984246, "name": "pixelport-paperclip-golden-2026-03-17-a627712"}`
- Quota failure probe:
  - `POST https://api.digitalocean.com/v2/droplets` with `{region:"nyc1",size:"s-4vcpu-8gb",image:"220984246"}`
  - output: `HTTP 422 {"id":"unprocessable_entity","message":"creating this/these droplet(s) will exceed your droplet limit"}`
- Delete-scope verification:
  - `DELETE https://api.digitalocean.com/v2/droplets/{id}` for stale dry-run droplet IDs
  - output: `HTTP 403 {"id":"Forbidden","message":"You are not authorized to perform this operation"}`

## Verdict

`blocked` for Step 3 closure due to external infrastructure constraints (DO droplet quota + delete permission scope), not due to managed-only policy logic.
