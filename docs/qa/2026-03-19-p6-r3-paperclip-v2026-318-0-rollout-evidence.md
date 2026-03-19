# P6 R3 — Paperclip `v2026.318.0` Compatibility Rollout Evidence

- **Date:** 2026-03-19
- **Branch:** `codex/p6-r3-paperclip-v2026-318-0`
- **Decision path:** founder-approved gateway-token launch standard (`workspace_launch_url`) for R3 compatibility scope

## Pin Metadata

- Paperclip release tag: `v2026.318.0`
- Paperclip release commit: `78c714c29ac9aa1a8ca85aebe48f7f1ee7e57e4d`
- OpenClaw runtime pin (unchanged from R2): `ghcr.io/openclaw/openclaw:2026.3.13-1`
- Managed image promoted for R3: `221189855`
  - name: `pixelport-paperclip-golden-2026-03-19-paperclip-v2026-318-0-r3`

## Canary 1 (Pre-promotion Baseline)

- Trigger: `POST /api/debug/test-provision?mode=new`
- Tenant:
  - id: `1f4f4302-fb2a-4157-adef-db8e1f13aa7c`
  - slug: `pixelport-dry-run-mmwx4yez`
- Droplet:
  - id: `559343510`
  - ip: `104.248.60.33`
  - image truth: `221188460` (`pixelport-paperclip-golden-2026-03-19-openclaw-2026-3-13-1-r2`)
- Health: `GET /health` -> `{"ok":true,"status":"live"}`
- Gateway-token launch proof (Playwright):
  - launch URL: `https://pixelport-dry-run-mmwx4yez.104-248-60-33.sslip.io/#token=...`
  - landed URL: `https://pixelport-dry-run-mmwx4yez.104-248-60-33.sslip.io/chat?session=main`
  - page title: `OpenClaw Control`
  - screenshot: `.playwright-cli/page-2026-03-19T03-40-06-123Z.png`

## Snapshot Build + Promotion

- Snapshot action:
  - id: `3097765317`
  - source droplet: `559343510`
  - status: `completed`
  - completed_at: `2026-03-19T03:41:39Z`
- Produced managed image:
  - id: `221189855`
  - name: `pixelport-paperclip-golden-2026-03-19-paperclip-v2026-318-0-r3`
  - status: `available`
- Production selector/gate:
  - `PROVISIONING_DROPLET_IMAGE=221189855`
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
- Production deploy:
  - `https://pixelport-launchpad-7chcol1n9-sanchalrs-projects.vercel.app`
  - alias: `https://pixelport-launchpad.vercel.app`

## Canary 2 (Post-promotion Strict Managed-only)

- Trigger: `POST /api/debug/test-provision?mode=new`
- Tenant:
  - id: `e4564033-d5fd-4d14-8f7b-d708024fdc89`
  - slug: `pixelport-dry-run-mmwxefq8`
- Droplet:
  - id: `559344696`
  - ip: `104.248.228.181`
  - image truth: `221189855` (`pixelport-paperclip-golden-2026-03-19-paperclip-v2026-318-0-r3`)
- Health: `GET /health` -> `{"ok":true,"status":"live"}`
- Gateway-token launch proof (Playwright):
  - launch URL: `https://pixelport-dry-run-mmwxefq8.104-248-228-181.sslip.io/#token=...`
  - landed URL: `https://pixelport-dry-run-mmwxefq8.104-248-228-181.sslip.io/chat?session=main`
  - page title: `OpenClaw Control`
  - screenshot: `.playwright-cli/page-2026-03-19T03-46-54-675Z.png`

## Runtime Route Compatibility Note

- `GET /pixelport/handoff?handoff_token=test123&next=/` returns HTTP `200` HTML shell (`OpenClaw Control`) on runtime images.
- R3 therefore validates launch via `workspace_launch_url` (`#token=...`) as the supported auto-login path.

## Cleanup Proof

- Cleanup call: `POST /api/debug/test-provision?cleanup=true`
- Result: both R3 canary tenants removed; `droplet_deleted=true` for both.
- Direct DO checks after cleanup:
  - droplet `559343510` -> `404`
  - droplet `559344696` -> `404`

## Local Fail-safe Backup Artifacts

Saved under: `/Users/sanchal/pixelport-artifacts/golden-image-backups`

- Manifest:
  - `manifests/2026-03-19-p6-r3-paperclip-v2026.318.0.manifest.txt`
- Provisioning source snapshot:
  - `cloud-init-snapshots/2026-03-19-p6-r3-paperclip-v2026.318.0-provision-tenant.ts`
- Checksums:
  - `checksums/2026-03-19-p6-r3-paperclip-v2026.318.0.manifest.sha256`
  - `checksums/2026-03-19-p6-r3-paperclip-v2026.318.0.provision-tenant.sha256`
- Evidence bundle:
  - `evidence/2026-03-19-p6-r3-paperclip-v2026.318.0-*.json`
  - `evidence/2026-03-19-p6-r3-paperclip-v2026.318.0-*.log`

## Pre-existing TypeScript Issues Observed During Production Deploy

These errors appeared in the Vercel build logs and are pre-existing (not introduced by this R3 slice):

- `api/inngest/functions/activate-slack.ts:249` — `SlackConnectionRecord` required field mismatch (`team_id` optional vs required)
- `api/inngest/functions/activate-slack.ts:330` — health object optional `healthy` mismatch
- `api/inngest/functions/provision-tenant.ts:518` — `RuntimeIngressPlan` optional `hostTemplate` mismatch
- `api/lib/workspace-contract.ts:7` — `JsonValue` circular type alias
- `api/lib/workspace-contract.ts:15` — `JsonRecord` circular type alias
- `api/lib/onboarding-bootstrap.ts:147-151` — `Error.cause` not in current TS lib target

## Verdict

**PASS** — R3 compatibility rollout is complete under the approved gateway-token launch standard, with managed-image-only enforcement preserved and both fresh-tenant canaries passing auto-login + health checks.
