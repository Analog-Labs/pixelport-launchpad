# Session 8 — Live Canary (board12)

- **Date:** 2026-03-28
- **Branch tested:** `main` (post-merge PR `#64`, merge commit `3b77acf`)
- **Production target:** `https://pixelport-launchpad.vercel.app`
- **Account:** `board12@ziffyhomes.com`
- **Website seed used:** `https://stripe.com`

## Goal

Validate Session 8 on production for one fresh tenant with real onboarding input:

1. onboarding reaches truthful `active` lifecycle
2. Governance card shows truthful status progression and save behavior
3. `/api/tenants/status` truthfully reflects policy apply state
4. stale revision write returns `409 approval_policy_conflict`
5. runtime managed sections are present and updated in both `AGENTS.md` and `TOOLS.md`
6. onboarding runtime state includes policy revision/apply/audit metadata

## Flow Coverage

Validated with authenticated browser + API checks + runtime SSH verification:

1. Login with `board12@ziffyhomes.com`
2. Complete onboarding payload with real website scan from `https://stripe.com`
3. Launch provisioning and poll until tenant reaches `active`
4. Open `/dashboard/connections`, edit governance mode, and save
5. Verify `policy_apply` transition (`pending -> applied`) on `/api/tenants/status`
6. Run stale-revision conflict check through `/api/tenants/onboarding`
7. Verify managed markers and managed body on runtime host files

## Tenant Evidence

- tenant id: `30dd2ac6-67cd-4667-9336-e95af1702f7f`
- tenant slug: `stripe-2`
- tenant status: `active`
- droplet id: `561394185`
- droplet ip: `143.244.144.93`
- runtime url: `https://stripe-2.143-244-144-93.sslip.io`

## Session 8 Critical Path Checks

### 1) Onboarding launch reaches active

Observed during live poll sequence:

- `poll=1`: `status=provisioning`, `bootstrap=not_started`, `policy_apply=pending`
- `poll=14`: `status=provisioning`, `bootstrap=completed`
- `poll=22`: `status=active`, `bootstrap=completed`

Final status truth:

- `status=active`
- `bootstrap_status=completed`
- provisioning checks `12/12`

### 2) Governance UI save + status progression

Connections Governance card showed truthful progression:

- pre-save status from `/api/tenants/status`:
  - `policy_apply.status=pending`
  - `revision=1`
- UI action on `/dashboard/connections`:
  - click `Edit Governance`
  - switch mode to `Strict`
  - click `Save Governance`
- post-save status from `/api/tenants/status`:
  - `policy_apply.status=applied`
  - `revision=2`
  - `last_applied_revision=2`

Final card state text rendered:

- `Governance apply completed.`
- badge: `Applied`
- `Runtime policy was applied successfully.`

### 3) Conflict guard (`409 approval_policy_conflict`)

Production stale-write scenario:

- first write with current revision (`2`) succeeded:
  - HTTP `200`
  - response `policy_apply.revision=3`, `status=applied`
- second write reusing stale expected revision (`2`) returned:
  - HTTP `409`
  - `code=approval_policy_conflict`
  - `expected_revision=2`
  - `current_revision=3`

### 4) Runtime managed marker verification (`AGENTS.md` + `TOOLS.md`)

SSH checks on droplet `143.244.144.93` confirmed both files contain managed markers and updated managed body:

- `runtime-AGENTS.md`
  - `<!-- PIXELPORT:BEGIN approval-policy -->`
  - `Current mode: **Autonomous**`
  - `<!-- PIXELPORT:END approval-policy -->`
- `runtime-TOOLS.md`
  - `<!-- PIXELPORT:BEGIN approval-policy -->`
  - `Current mode: **Autonomous**`
  - `<!-- PIXELPORT:END approval-policy -->`

### 5) Onboarding runtime state + audit truth

From `tenants.onboarding_data.approval_policy_runtime`:

- `revision=3`
- apply state:
  - `status=applied`
  - `last_applied_revision=3`
  - `last_error=null`
- audit entries: `2`
  - revision `2`: `balanced -> strict`
  - revision `3`: `strict -> autonomous`

### 6) Session 8 contract checks

Validated in production:

- `POST /api/tenants/onboarding`
  - accepts `approval_policy_expected_revision`
  - accepts `force_policy_apply` (covered by route tests; not needed in this pass because apply succeeded)
- `GET /api/tenants/status`
  - returns truthful `policy_apply` summary (`status`, `revision`, `last_applied_revision`, timestamps, error)

## Release Smoke Summary

- `200 /`
- `200 /api/tenants/me` (auth)
- `200 /api/tenants/status` (auth)
- `200 /api/connections` (auth)

## Artifacts

- `docs/qa/artifacts/session8-main-canary-board12/scan-stripe.json`
- `docs/qa/artifacts/session8-main-canary-board12/tenants-me-before.json`
- `docs/qa/artifacts/session8-main-canary-board12/tenants-status-before.json`
- `docs/qa/artifacts/session8-main-canary-board12/poll/status-*.json`
- `docs/qa/artifacts/session8-main-canary-board12/tenants-me-after-launch.json`
- `docs/qa/artifacts/session8-main-canary-board12/tenants-status-after-launch.json`
- `docs/qa/artifacts/session8-main-canary-board12/governance-before-save.png`
- `docs/qa/artifacts/session8-main-canary-board12/governance-after-save.png`
- `docs/qa/artifacts/session8-main-canary-board12/governance-final-applied.png`
- `docs/qa/artifacts/session8-main-canary-board12/governance-status-before-ui-save.json`
- `docs/qa/artifacts/session8-main-canary-board12/governance-status-after-ui-save.json`
- `docs/qa/artifacts/session8-main-canary-board12/conflict-first-response.json`
- `docs/qa/artifacts/session8-main-canary-board12/conflict-second-response.json`
- `docs/qa/artifacts/session8-main-canary-board12/conflict-status-after.json`
- `docs/qa/artifacts/session8-main-canary-board12/runtime-AGENTS.md`
- `docs/qa/artifacts/session8-main-canary-board12/runtime-TOOLS.md`
- `docs/qa/artifacts/session8-main-canary-board12/release-smoke-http.txt`

## Verdict

**PASS** — Session 8 is production-safe on `main` with one full successful canary (`board12`) and no preview deployment path.

No hotfix loop was required, so `board13` was not needed.
