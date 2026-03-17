# PixelPort Pivot P1 — Golden Image Policy Gate Slice

**Title:** Managed-vs-compatibility selector policy gate for provisioning image  
**Date:** 2026-03-17  
**Owner:** Codex  
**Build Size:** `medium`  
**Branch:** `codex/p1-golden-image-policy-gate`

---

## Goal

Add an explicit policy layer for provisioning image selectors so we can run safely on compatibility image today and enforce managed golden image only when founder-approved.

## Scope

- In scope: classify image selector source as `managed`, `compatibility`, or `missing`.
- In scope: keep missing-selector strict enforcement behavior.
- In scope: add optional enforcement gate:
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
  - blocks compatibility selector values.
- In scope: add tests for compatibility classification + enforcement toggle.
- In scope: sync manifest notes with strict-selector reality and optional managed-only gate.

## Non-Goals

- Not in scope: changing production selector value in this slice.
- Not in scope: building/promoting a new DO snapshot image.
- Not in scope: changing tenant onboarding flow.

## Implementation Plan

1. Update `resolveDropletBaseline` source classification logic.
2. Extend `assertGoldenImageConfigured` with optional managed-only gate.
3. Add explicit compatibility warning at droplet-creation call site.
4. Expand `src/test/provision-tenant-memory.test.ts` for new policy behavior.
5. Update `infra/provisioning/golden-image-manifest.yaml` notes.

## Validation Plan

- `npx tsc --noEmit`
- `npx vitest run src/test/provision-tenant-memory.test.ts`

## Acceptance Criteria

- Missing image selector still throws actionable error.
- Compatibility selector is allowed by default when explicitly configured.
- Compatibility selector is rejected when `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`.
- Tests pass and behavior is documented in manifest notes.
