# QA Evidence — P1 Step 5 Authenticated Onboarding Launch Handoff Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Release commit on `main`:** `f8a5b1a`  
**Target alias:** `https://pixelport-launchpad.vercel.app`

## Scope

Close the remaining post-merge verification gap by running an authenticated production smoke that mirrors the onboarding launch handoff contract:

1. `POST /api/tenants/onboarding` with valid bearer auth
2. `POST /api/runtime/handoff` with `{ "source": "onboarding-launch" }` using the same session
3. Immediate cleanup of temporary tenant and temporary auth user

## Execution Summary

- Temporary user created via Supabase service-role flow (`email_confirm=true`)
- Temporary tenant created in `active` status with valid `droplet_ip`
- Valid access token acquired via `signInWithPassword`
- Onboarding save call succeeded:
  - `POST /api/tenants/onboarding` -> `200`
- Runtime handoff call succeeded:
  - `POST /api/runtime/handoff` -> `200`
  - response fields validated:
    - `contract_version = "p1-v1"`
    - `source = "onboarding-launch"`
    - `paperclip_runtime_url = "http://203.0.113.10:18789"`
    - `handoff_token` present
    - `tenant.status = "active"`
- Cleanup completed:
  - tenant deleted: `true`
  - user deleted: `true`

## Representative Result Snapshot

```json
{
  "runId": "smoke-mmv8jxqd-7d4fb2",
  "tenant": {
    "id": "627b36d7-abe7-4bc1-a3a0-e57453961962",
    "slug": "pixelport-auth-smoke-mmv8jxqd",
    "status": "active",
    "droplet_ip": "203.0.113.10"
  },
  "onboarding": { "status": 200, "ok": true },
  "handoff": {
    "status": 200,
    "ok": true,
    "contract_version": "p1-v1",
    "source": "onboarding-launch",
    "runtime_url": "http://203.0.113.10:18789",
    "has_handoff_token": true,
    "tenant_status": "active"
  },
  "cleanup": { "tenantDeleted": true, "userDeleted": true }
}
```

## Verdict

`pass` for authenticated post-merge onboarding-launch handoff smoke.
