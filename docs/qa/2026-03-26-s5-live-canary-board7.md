# Session 5 — Live Canary (board7)

- **Date:** 2026-03-26
- **Branch tested:** `main` (post-merge PR `#57`, commit `fa87961`)
- **Production target:** `https://pixelport-launchpad.vercel.app`
- **Account:** `board7@ziffyhomes.com`

## Goal

Validate Session 5 startup-trigger routing on production for a fresh tenant:

1. new-tenant path reaches truthful `draft -> provisioning -> active`
2. startup lifecycle semantics remain truthful (`dispatching`, `accepted`, `failed` contract)
3. manual break-glass bootstrap route still works with provenance + conflict guardrails
4. Session 4 workspace/config contract remains intact after Session 5 cutover

## Flow Coverage

Validated in a real browser + authenticated API checks from the same session:

1. Login with `board7@ziffyhomes.com`
2. Complete onboarding flow `Company -> Strategy -> Task -> Launch`
3. Observe provisioning progress transitions through startup lifecycle
4. Confirm redirect to dashboard after `active`
5. Exercise manual bootstrap route in both guarded and forced-replay modes
6. SSH to live tenant droplet and validate runtime workspace/config contract

## Tenant Evidence

- tenant id: `7c47e09a-94d5-41ad-ba4d-2700b9862b49`
- tenant slug: `ziffy-homes-board7-s5-canary`
- tenant status: `active`
- droplet id: `561098067`
- droplet ip: `68.183.25.226`
- paperclip company id: `389306ce-0b5c-47a9-9011-b6d321037799`

## Session 5 Startup Truth (Live)

Observed progression from authenticated API checks:

- during provisioning:
  - `status=provisioning`
  - `bootstrap.status=not_started` (early)
  - then `bootstrap.status=dispatching` with `source=provisioning`
  - progress advanced to `6/12` with current check `bootstrap_acknowledged`
- completion:
  - `status=active`
  - `bootstrap.status=completed`
  - `bootstrap.accepted_at=2026-03-26T23:28:52.325Z`
  - `bootstrap.completed_at=2026-03-26T23:28:52.726Z`
  - `launch_completed_at=2026-03-26T23:28:57.450Z`
  - provisioning checks `12/12`

This confirms startup acceptance landed before final launch completion and tenant activation stayed truthful.

## Manual Break-Glass Validation

`POST /api/tenants/bootstrap` on the same active tenant:

1. **No-force replay** (`{}`):
   - HTTP `409`
   - `reason=bootstrap_already_completed`
2. **Forced replay** (`{ force: true }`):
   - HTTP `202`
   - response included `startup_source=manual_bootstrap`, `forced=true`

Provenance persisted in tenant onboarding data:

- `startup_provenance.manual_bootstrap.startup_source=manual_bootstrap`
- `invoked_by_user_id=72b3ea56-86e7-456d-90a0-fbaad793bf03`
- `invoked_at` timestamp persisted
- `force=true` persisted

## Session 4 Regression Gate (Live Runtime)

Validated over SSH on droplet `68.183.25.226`:

- workspace root files present:
  - `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOT.md`, `MEMORY.md`
- `BOOTSTRAP.md` absent (`test -f ...` returned missing)
- system artifacts present:
  - `system/onboarding.json`
  - `system/render-manifest.json`
- OpenClaw config (`/home/node/.openclaw/openclaw.json` in container):
  - `agents.defaults.skipBootstrap = true`
  - `agents.defaults.heartbeat.every = "0m"`
  - `agents.defaults.memorySearch.extraPaths = ["knowledge"]`
- strict validation:
  - `docker exec openclaw-gateway openclaw config validate --json`
  - result: `{"valid":true,"path":"/home/node/.openclaw/openclaw.json"}`

## Dashboard Truth Checks

Authenticated tenant-proxy responses on active tenant:

- `GET /api/tenant-proxy/companies/dashboard` -> `200`
- `GET /api/tenant-proxy/companies/activity` -> `200`, 19 items
- `GET /api/tenant-proxy/companies/issues` -> `200`, 4 items
- `GET /api/tenant-proxy/companies/agents` -> `200`, 1 item
- `GET /api/tenant-proxy/companies/sidebar-badges` -> `200`

## Compensation Contract Status

- `startup_compensation` is absent on this run (expected for success path).
- Failure compensation behavior (`failed` + rollback to `draft` + preserved resources metadata) was validated pre-merge by automated tests and implementation review, but not exercised in this successful canary.

## Artifacts

- dashboard screenshot:
  - `.playwright-cli/page-2026-03-26T23-31-52-517Z.png`
- dashboard snapshot:
  - `.playwright-cli/page-2026-03-26T23-31-58-430Z.yml`

## Verdict

**PASS** — Session 5 startup cutover is production-safe on `main` for fresh-tenant flow with one clean canary pass (`board7`).

No hotfix loop was required. `board8` and `board9` were not needed.
