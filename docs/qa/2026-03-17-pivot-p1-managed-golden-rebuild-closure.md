# QA Evidence — Pivot P1 Managed Golden Rebuild Closure

**Date:** 2026-03-17 (America/Chicago)  
**Target alias:** `https://pixelport-launchpad.vercel.app`

## Scope

Founder-approved Option 1 recovery:
1. temporarily relax to compatibility bootstrap,
2. mint a fresh managed snapshot image,
3. restore managed-only enforcement,
4. validate strict fresh-tenant canary closure.

## Precondition and Root Cause

- Prior managed image selector target `220984246` no longer existed.
- Inngest failures were at `create-droplet` with `HTTP 422`.
- DO action history showed image destroy action for the old image:
  - `action.id=3094840018`, `type=image_destroy`, `resource_id=220984246`.

## Recovery Execution and Results

### 1) Temporary compatibility bootstrap

- Production env set:
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=false`
  - `PROVISIONING_DROPLET_IMAGE=ubuntu-24-04-x64`
- Production deploy:
  - `https://pixelport-launchpad-ceju3vqx8-sanchalrs-projects.vercel.app`

### 2) Bootstrap canary (compat mode)

- Tenant: `2c7b413a-d034-40df-9455-4cdec1c0786e`
- Slug: `pixelport-dry-run-mmv5mnoe`
- Final status: `active` (poll 13)
- Droplet: `559040968` / `104.248.61.186`
- Gateway health: `200 {"ok":true,"status":"live"}`

### 3) Snapshot build

- Snapshot action:
  - `snapshot_droplet(ID=559040968, Name=pixelport-paperclip-golden-2026-03-17-rebuild-4c24047)`
  - action `3095700311`, status `completed`
- New managed image:
  - image id: `221035422`
  - image name: `pixelport-paperclip-golden-2026-03-17-rebuild-4c24047`
  - type: `snapshot`, region: `nyc1`

### 4) Restore managed-only enforcement

- Production env set:
  - `PROVISIONING_DROPLET_IMAGE=221035422`
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
- Production deploy:
  - `https://pixelport-launchpad-geushz7cg-sanchalrs-projects.vercel.app`

### 5) Strict managed-only canary

- Tenant: `c19aa8eb-96b8-434a-8fa5-79a9da6c7060`
- Slug: `pixelport-dry-run-mmv5wck7`
- Final status: `active` (poll 7)
- Droplet: `559042841` / `157.230.10.108`
- Gateway health: `200 {"ok":true,"status":"live"}`
- Managed image truth:
  - `droplet_get(559042841).image.id = 221035422`
- Cleanup:
  - tenant row removed (`TENANT_AFTER=[]`)
  - cleanup response still reports `droplet_deleted:false` due DO delete scope

## Evidence Snippets

- Env truth before strict canary:
  - `STRICT_ENV_IMAGE=221035422`
  - `STRICT_ENV_REQUIRE_MANAGED=true`
- Strict canary terminal line:
  - `FINAL_STATUS=active`
  - `FINAL_DROPLET_ID=559042841`
  - `GATEWAY_STATUS=200`
- DO droplet image proof:
  - `droplet_get(559042841)` returned image id `221035422`

## Residual Operational Risk

- DO token used by cleanup path still cannot delete droplets:
  - `DELETE /v2/droplets/{id}` returns `HTTP 403 Forbidden`
- Dry-run droplets may accumulate unless manually deleted.

## Verdict

`pass` — strict managed-only provisioning is restored and validated on new managed snapshot image `221035422`.
