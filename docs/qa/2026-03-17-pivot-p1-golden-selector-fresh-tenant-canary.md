# QA Evidence — Pivot P1 Golden Selector Fresh-Tenant Canary

**Date:** 2026-03-17 (America/Chicago)  
**Target alias:** `https://pixelport-launchpad.vercel.app`  
**Purpose:** Validate strict provisioning selector behavior after setting `PROVISIONING_DROPLET_IMAGE=ubuntu-24-04-x64`.

## Tenant Trace (Confirmed)

- Email: `test-pixelport-dry-run-mmua9dqn@pixelport-test.local`
- Tenant ID: `078bd6f9-ff77-4431-8bac-ba83f2d94e59`
- Slug: `pixelport-dry-run-mmua9dqn`
- Droplet ID: `558876964`
- Droplet IP: `64.227.3.37`

## Provisioning Progress (Confirmed)

- Tenant created via `POST /api/debug/test-provision?mode=new`.
- Status progression observed from Supabase tenant row:
  - `provisioning` through poll 8
  - `active` at poll 9

## Runtime + API Truth Checks (Confirmed)

- Gateway health: `GET http://64.227.3.37:18789/health` -> `200 {"ok":true,"status":"live"}`
- Authenticated canary API checks:
  - `GET /api/tenants/me` -> `200`
  - `GET /api/tenants/status` -> `200` with:
    - `status: "active"`
    - `bootstrap_status: "accepted"`
    - `task_step_unlocked: true`
    - `has_agent_output: true`
  - `GET /api/tasks` -> `200`
  - `GET /api/vault` -> `200`
  - `GET /api/competitors` -> `200`

## Backend Artifact Truth (Confirmed)

- `agents`: `1`
- `agent_tasks`: `0`
- `vault_sections`: `5`
- `vault_non_pending`: `5`
- `competitors`: `0`
- `sessions_log`: `0`

At least one real artifact condition is satisfied (`vault_non_pending=5`).

## Cleanup (Confirmed)

- Cleanup call: `POST /api/debug/test-provision?cleanup=true`
- Response: `200`
- Tenant row deleted: `true`
- Droplet delete signal: `false` (known DO token scope limitation from prior sessions)

## Inference

- The strict selector path is operational under the currently configured compatibility selector value (`ubuntu-24-04-x64`), since a fresh tenant reached `active` with healthy runtime and real backend artifacts.

## Verdict

`pass`
