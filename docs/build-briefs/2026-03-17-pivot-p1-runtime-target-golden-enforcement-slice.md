# PixelPort Pivot P1 — Runtime Target + Golden Enforcement Slice

**Title:** Runtime-target handoff hardening and strict golden-image enforcement  
**Date:** 2026-03-17  
**Owner:** Codex  
**Build Size:** `medium`  
**Branch:** `codex/pivot-p1-runtime-target-golden-enforcement`  
**Merged commit:** `688c4e3`

---

## Goal

Harden runtime handoff targeting and remove provisioning compatibility fallback so golden image selection is enforced.

## Scope

- In scope: production-gate debug env endpoint and require header-based auth.
- In scope: derive runtime handoff target from tenant `droplet_ip`.
- In scope: remove runtime handoff dependency on `PAPERCLIP_RUNTIME_URL`.
- In scope: return explicit `409 runtime-target-unavailable` when tenant runtime target is missing/invalid.
- In scope: enforce strict golden selector in provisioning baseline resolver (no compatibility image fallback).
- In scope: keep size/region defaulting behavior intact.

## Non-Goals

- Not in scope: Track A ownership closure decisions (A2-A5).
- Not in scope: changing onboarding topology or Paperclip workspace defaults.
- Not in scope: rotating secrets or exposing secret values in docs.

## Recorded Implementation Outcomes

1. `api/debug/env-check.ts` now production-gated and header-auth only (`x-debug-secret`).
2. `api/tenants/index.ts` removed `Record<string, any>` in favor of proper typing.
3. `/api/runtime/handoff` now derives `paperclip_runtime_url` from tenant `droplet_ip` as `http://<ip>:18789`; `PAPERCLIP_RUNTIME_URL` is no longer required.
4. Missing/invalid runtime target now returns `409` (`runtime-target-unavailable`).
5. Provisioning golden-image enforcement is strict (no compatibility fallback image).

## Validation Recorded

- `npx tsc --noEmit` -> pass
- vitest suite -> 4 files, 29 tests, pass
- QA reviewer verdict -> `APPROVED` with no findings

## Production Truth Recorded

- Commit on `main`: `688c4e3`
- Deploy status: `success`
- Deploy URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/7wihkxTEH7eRPevqicduNULohfcX`
- Smoke results:
  - `GET /api/debug/env-check` -> `404 {"error":"Not found"}`
  - `POST /api/runtime/handoff` (no auth) -> `401`
  - `POST /api/runtime/handoff` (invalid bearer) -> `401`
  - authenticated temporary user+tenant rerun -> `200` with `paperclip_runtime_url=http://157.245.253.88:18789`
  - cleanup: tenant deleted `true`, user deleted `true`

## Operational Follow-Up

- `PAPERCLIP_HANDOFF_SECRET` is now present in Vercel env.
- `PROVISIONING_DROPLET_IMAGE` is not currently present in `vercel env ls`.
- Because strict enforcement is live, fresh provisioning is blocked until `PROVISIONING_DROPLET_IMAGE` is configured.
