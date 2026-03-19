# P6 R2 — Managed Image Rollout Closure

- **Date:** 2026-03-19
- **Goal:** complete R2 canary-first rollout after OpenClaw `2026.3.13-1` pin merge.
- **Merged code baseline:** PR `#18` then PR `#19`
  - `#18` merge commit: `53af0e2bae54b98682d512cca1dd60cdedf22273`
  - `#19` merge commit: `45d4406874676032149dd7f2d13d7f48f32dd818`

## Production Selector State (Final)

- `PROVISIONING_DROPLET_IMAGE=221188460`
- `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
- Production redeploy completed:
  - `https://pixelport-launchpad-qqjlyrm61-sanchalrs-projects.vercel.app`
  - aliased to `https://pixelport-launchpad.vercel.app`

## Canary 1 (Compatibility Bootstrap)

- Trigger path: `POST /api/debug/test-provision?mode=new`
- Tenant:
  - `id`: `7de82d7c-f8fc-4233-a088-b3d3b1f9b329`
  - `slug`: `pixelport-dry-run-mmwvc1iw`
- Result:
  - tenant reached `active`
  - droplet `559334599` / `192.34.60.236`
  - droplet image: `ubuntu-24-04-x64` (`id: 195932981`)
  - gateway health: `{"ok":true,"status":"live"}`

## Managed Snapshot Build/Promotion

- Snapshot action from canary 1 droplet:
  - action id: `3097711410`
  - status: `completed`
- New managed image:
  - snapshot id: `221188460`
  - name: `pixelport-paperclip-golden-2026-03-19-openclaw-2026-3-13-1-r2`
  - status: `available`
  - created_at: `2026-03-19T02:52:10Z`

## Canary 2 (Strict Managed-Only)

- Trigger path: `POST /api/debug/test-provision?mode=new`
- Tenant:
  - `id`: `66e86eb8-41d7-46bd-a1f0-c9dbcb088720`
  - `slug`: `pixelport-dry-run-mmwvp6kd`
- Result:
  - tenant reached `active`
  - droplet `559336547` / `161.35.10.166`
  - droplet image: `pixelport-paperclip-golden-2026-03-19-openclaw-2026-3-13-1-r2` (`id: 221188460`)
  - managed image match check: `yes` (`expected=221188460`, `actual=221188460`)
  - gateway health: `{"ok":true,"status":"live"}`

## Cleanup Proof

- Cleanup call: `POST /api/debug/test-provision?cleanup=true`
- Processed tenants: `2`
- Tenant rows deleted: `2/2`
- Droplet deletions reported: `2/2`
- Direct DO verification:
  - `GET /v2/droplets/559334599` -> `404`
  - `GET /v2/droplets/559336547` -> `404`

## Local Fail-Safe Artifacts

Saved under: `/Users/sanchal/pixelport-artifacts/golden-image-backups`

- Manifest:
  - `manifests/2026-03-19-p6-r2-openclaw-2026.3.13-1.manifest.txt`
- Provisioning source snapshot:
  - `cloud-init-snapshots/2026-03-19-p6-r2-openclaw-2026.3.13-1-provision-tenant.ts`
- Checksums:
  - `checksums/2026-03-19-p6-r2-openclaw-2026.3.13-1.manifest.sha256`
  - `checksums/2026-03-19-p6-r2-openclaw-2026.3.13-1.provision-tenant.sha256`
- Evidence JSON bundle:
  - `evidence/2026-03-19-p6-r2-openclaw-2026.3.13-1-*.json`

## Verdict

**PASS** — R2 rollout gate is complete: managed image built from canary, strict managed-only provisioning re-enabled in production, and fresh-tenant canary image truth validated.
