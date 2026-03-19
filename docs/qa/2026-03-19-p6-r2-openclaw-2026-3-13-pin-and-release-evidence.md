# P6 R2 — OpenClaw `2026.3.13` Pin + Release Evidence

- **Date:** 2026-03-19
- **Phase:** P6 R2 (OpenClaw upgrade canary-first)
- **Branch:** `codex/p6-r2-openclaw-2026-3-13`

## Target Version Evidence

- **OpenClaw release tag:** `v2026.3.13-1`
- **Published at:** `2026-03-14T18:04:28Z`
- **Release URL:** <https://github.com/openclaw/openclaw/releases/tag/v2026.3.13-1>
- **Upstream commit:** `61d171ab0b2fe4abc9afe89c518586274b4b76c2`
- **Commit URL:** <https://github.com/openclaw/openclaw/commit/61d171ab0b2fe4abc9afe89c518586274b4b76c2>
- **Container image tag:** `ghcr.io/openclaw/openclaw:2026.3.13-1`
- **Container manifest digest:** `sha256:a5a4c83b773aca85a8ba99cf155f09afa33946c0aa5cc6a9ccb6162738b5da02`

## Scope Applied in Repo

1. Updated default provisioning OpenClaw image pin to `2026.3.13-1`:
   - `api/inngest/functions/provision-tenant.ts`
2. Updated test expectations to new pin:
   - `src/test/provision-tenant-memory.test.ts`
3. Updated infra manifest and recorded immutable release metadata:
   - `infra/provisioning/golden-image-manifest.yaml`
4. Updated cloud-init template comment example to match current pin:
   - `infra/provisioning/cloud-init.yaml`

## Validation

```bash
npx tsc --noEmit
npm test
```

Result: **pass** (`19` test files, `88` tests).

## Canary and Promotion Gate Status

- Code pin + tests + manifest metadata are complete.
- Managed-image build + two fresh-tenant canaries + production selector promotion are pending execution in the R2 rollout gate.
- Managed-only enforcement (`PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`) remains pending until canaries pass on the upgraded managed image.

## Rollback Readiness

- Previous OpenClaw default pin: `ghcr.io/openclaw/openclaw:2026.3.11`
- Rollback scope is version-only for this slice (revert pin + test + manifest updates).
