# QA Evidence — Pivot P1 Track A2 Governance Merge and Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Merged PR:** `#2`  
**Merge commit on `main`:** `9eb17df`  
**Deploy status:** `success`  
**Deploy URL:** `https://vercel.com/sanchalrs-projects/pixelport-launchpad/EGgViFwByLvrTxZrZvK8uvvtD2Wu`

## Scope

Post-merge verification for Track A2 governance guardrails:

1. Confirm `main` protection still enforces both required checks.
2. Confirm production deploy health after merge.
3. Confirm key handoff surface guardrails still behave correctly on production.

## Governance Truth (GitHub)

`main` branch protection (`Analog-Labs/pixelport-launchpad`):

- required status checks:
  - `Analyze (javascript-typescript)` (CodeQL)
  - `validate` (CI workflow)
- strict required checks: `true`
- required pull-request approvals: `1`
- code-owner reviews required: `true`
- stale review dismissal: `true`
- required conversation resolution: `true`
- required linear history: `true`

## Production Smoke Truth (`https://pixelport-launchpad.vercel.app`)

- `GET /api/runtime/handoff` -> `405 {"error":"Method not allowed"}`
- `POST /api/runtime/handoff` without auth -> `401 {"error":"Missing or invalid Authorization header"}`
- `POST /api/runtime/handoff` invalid bearer -> `401 {"error":"Invalid or expired token"}`
- `GET /api/debug/env-check` -> `404` (`NOT_FOUND`)

## Verdict

`pass` for A2 merge smoke scope.
