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

## Residual Risks

- This slice does not promote the production selector to a maintained golden image artifact; it only adds gate capability.
- Enabling managed-only gate before selector promotion will block fresh provisioning by design.

## Verdict

`pass` for scope: policy-gate behavior is implemented and test-validated with non-breaking default behavior.
