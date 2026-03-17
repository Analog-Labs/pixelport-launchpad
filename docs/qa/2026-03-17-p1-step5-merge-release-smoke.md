# QA Evidence — P1 Step 5 Follow-Up Merge and Production Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Merged PR:** `#1`  
**Merge commit on `main`:** `f8a5b1a`  
**Deploy status:** `success`  
**Deploy URL:** `https://vercel.com/sanchalrs-projects/pixelport-launchpad/2WF7uGPwNwYZFu8icQDKSn3iTEem`

## Scope

Run same-session production smoke after merging the Step 5 follow-up slice:
- remove `api/debug/env-check.ts`
- wire onboarding thin handoff trigger
- add V1 plaintext HTTP contract notices

## Production Smoke Checks

Base alias: `https://pixelport-launchpad.vercel.app`

- `GET /api/runtime/handoff` -> `405 {"error":"Method not allowed"}`
- `POST /api/runtime/handoff` (no auth) -> `401 {"error":"Missing or invalid Authorization header"}`
- `POST /api/runtime/handoff` (invalid bearer) -> `401 {"error":"Invalid or expired token"}`
- `GET /api/debug/env-check` -> `404` (`NOT_FOUND` from Vercel)
- `GET /api/debug/test-provision?mode=status` (no secret) -> `401 {"error":"Invalid or missing secret"}`
- `POST /api/tenants/onboarding` (no auth) -> `401 {"error":"Missing or invalid Authorization header"}`

## Notes

- The changed live surfaces are reachable and correctly guarded on production.
- An authenticated onboarding-launch handoff invocation was not re-run in this smoke session because no QA auth fixture credentials or service-role credentials were available in this shell context.
- Prior production evidence for authenticated handoff `200` exists in:
  - `docs/qa/2026-03-17-pivot-p1-runtime-target-golden-enforcement.md`

## Verdict

`pass` for targeted post-merge smoke scope.
