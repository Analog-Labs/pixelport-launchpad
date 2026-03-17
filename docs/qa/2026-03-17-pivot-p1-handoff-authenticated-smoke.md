# QA Evidence — Pivot P1 Authenticated Handoff Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/pivot-p1-handoff-auth-smoke`  
**Target:** `https://pixelport-launchpad.vercel.app/api/runtime/handoff`

## Scope

Validate authenticated production behavior for `POST /api/runtime/handoff` using a temporary test user and temporary active tenant.

## Commands / Execution Steps

```bash
# 1) Create temporary test user + temporary active tenant (Supabase service-role flow)
# 2) Generate valid bearer token via signInWithPassword for that temporary user

curl -sS -X POST https://pixelport-launchpad.vercel.app/api/runtime/handoff \
  -H "Authorization: Bearer <valid_temp_access_token>" \
  -H "Content-Type: application/json"

# 3) Cleanup temporary artifacts (tenant + user)
```

## Result

- HTTP status: `503`
- Response body:
  - `{"error":"Paperclip runtime handoff is not configured.","missing":["PAPERCLIP_RUNTIME_URL","PAPERCLIP_HANDOFF_SECRET"]}`

## Cleanup Evidence

- tenant deleted: `true`
- user deleted: `true`

## Verdict

`pass` for this smoke scope.

Authenticated path is working up to config validation.  
Success-path `200` remains blocked until required handoff env vars are set.

## Residual Risk

- `POST /api/runtime/handoff` success payload (`200`) is still unverified in production.
