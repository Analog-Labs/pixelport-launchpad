# QA Evidence — Pivot P1 Golden Image Policy Gate

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-golden-image-policy-gate`

## Scope

Validate non-breaking policy-gate additions for provisioning image selectors.

## Implemented Outcomes

1. `resolveDropletBaseline` now classifies selector source as:
   - `managed`
   - `compatibility`
   - `missing`
2. `assertGoldenImageConfigured` retains strict missing-selector failure behavior.
3. Optional env gate introduced:
   - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
   - blocks compatibility selector (`ubuntu-24-04-x64`).
4. Compatibility selector remains allowed by default when explicitly configured.
5. Manifest notes updated to match strict-selector behavior and optional managed-only gate.

## Validation

- `npx tsc --noEmit` -> pass
- `npx vitest run src/test/provision-tenant-memory.test.ts` -> pass (`12/12`)

## Post-Merge Production Smoke

- Release commit on `main`: `9faee29`
- Deploy URL: `https://pixelport-launchpad-q4qnlchai-sanchalrs-projects.vercel.app`
- Post-merge fresh tenant canary:
  - tenant: `d53e52ae-f593-4f79-9e24-0e9a72998b38`
  - slug: `pixelport-dry-run-mmuap4ug`
  - status progression: reached `active` at poll 16
  - droplet: `558878686` / `157.245.83.187`
  - gateway health: `GET http://157.245.83.187:18789/health` -> `200`
- Cleanup truth:
  - tenant row is deleted (`BEFORE=[]`, `AFTER=[]` on direct verification query)
  - cleanup endpoint currently returns `No test tenants found to clean up` after deletion
  - droplet remains reachable (`200` health), consistent with known DO delete-scope limitation

## Residual Risks

- This slice does not promote the production selector to a maintained golden image artifact; it only adds gate capability.
- Enabling managed-only gate before selector promotion will block fresh provisioning by design.

## Verdict

`pass` for scope: policy-gate behavior is implemented and test-validated with non-breaking default behavior.
