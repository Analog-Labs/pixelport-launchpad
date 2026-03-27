# Session 6 — Live Canary (board8)

- **Date:** 2026-03-26
- **Branch tested:** `main` (post-merge PR `#59`, merge commit `2b0de82`)
- **Production target:** `https://pixelport-launchpad.vercel.app`
- **Account:** `board8@ziffyhomes.com`

## Goal

Validate Session 6 on production for a fresh tenant with truthful sync/provisioning behavior:

1. onboarding launch triggers provisioning
2. tenant reaches `active`
3. startup follows provisioning kickoff path
4. `/api/tenants/status` stays truthful through provisioning
5. knowledge mirror sync reaches `synced` and runtime files are actually present

## Flow Coverage

Validated in a real browser plus authenticated API checks:

1. Login with `board8@ziffyhomes.com`
2. Complete onboarding `Company -> Strategy -> Task -> Launch`
3. Observe launch and provisioning progression
4. Confirm redirect to dashboard after activation
5. Validate runtime knowledge files on droplet over SSH
6. Run post-pass release smoke endpoints on `main`

## Tenant Evidence

- tenant id: `9f87f6b2-c075-456f-9918-a35b20d1a5dc`
- tenant slug: `stripe`
- tenant status: `active`
- droplet id: `561116232`
- droplet ip: `67.207.94.54`
- paperclip company id: `9c288568-4a3e-425c-9849-f39e8371e550`

## Session 5 Critical Path Checks

### 1) Launch triggers provisioning

- `POST /api/tenants/launch` returned `202` during launch step.
- Status moved to provisioning and progressed through milestone checks.

### 2) Tenant reaches active

Observed during live polling:

- `20:46:19` -> `status=provisioning`, checks `9/12`
- `20:48:23` -> `status=active`, checks `12/12`

### 3) Startup follows provisioning kickoff path

From `onboarding_data.bootstrap` in `/api/tenants/me`:

- `source=provisioning`
- `status=completed`
- `accepted_at` and `completed_at` present

From `onboarding_data.bootstrap_seed`:

- kickoff seed records present (`kickoff_issue_id`, `kickoff_approval_id`, `wake_run_id`)

### 4) `/api/tenants/status` truthfulness

Final active payload confirmed:

- `status=active`
- `bootstrap_status=completed`
- provisioning checks `12/12`
- `knowledge_sync.status=synced`
- `knowledge_sync.revision=1`
- `knowledge_sync.synced_revision=1`
- `knowledge_sync.seeded_revision=1`

### 5) Dashboard/backend truth checks

- `GET /api/tenant-proxy/companies/dashboard` -> `200`
- `GET /api/tenant-proxy/companies/activity` -> `200`, 17 items
- `GET /api/tenant-proxy/companies/issues` -> `200`, 6 items
- `GET /api/tenant-proxy/companies/agents` -> `200`, 1 item
- `GET /api/tenant-proxy/companies/sidebar-badges` -> `200`

Note on legacy path assumptions:

- `/api/tasks`, `/api/vault`, and `/api/competitors` currently return `404` on production. In this mainline build, dashboard data is served through `/api/tenant-proxy/*` plus `/api/tenants/status`.

## Session 6 Sync Integrity Checks (Runtime)

SSH validation on droplet `67.207.94.54`:

- host-mounted workspace path exists: `/opt/openclaw/workspace-main/knowledge`
- all five mirror files present:
  - `company-overview.md`
  - `products-and-offers.md`
  - `audience-and-icp.md`
  - `brand-voice.md`
  - `competitors.md`
- no leftover temp files (`*.tmp`) in knowledge directory
- same files visible in container path `/home/node/.openclaw/workspace-main/knowledge`
- OpenClaw config still includes `memorySearch.extraPaths: ["knowledge"]`

## Release Smoke Summary

From post-pass smoke run on `main`:

- `200 /`
- `200 /api/tenants/me`
- `200 /api/tenants/status`
- `200 /api/tenant-proxy/companies/dashboard`
- `200 /api/tenant-proxy/companies/activity`
- `200 /api/tenant-proxy/companies/issues`
- `200 /api/tenant-proxy/companies/agents`
- `200 /api/tenant-proxy/companies/sidebar-badges`
- `404 /api/tasks`
- `404 /api/vault`
- `404 /api/competitors`

## Artifacts

- Browser snapshots:
  - `.playwright-cli/page-2026-03-27T01-48-31-425Z.yml`
- Browser/network logs:
  - `.playwright-cli/network-2026-03-27T01-43-47-254Z.log`
- API captures:
  - `docs/qa/artifacts/session6-main-canary-board8/tenants-me.json`
  - `docs/qa/artifacts/session6-main-canary-board8/tenants-status.json`
  - `docs/qa/artifacts/session6-main-canary-board8/proxy-dashboard.json`
  - `docs/qa/artifacts/session6-main-canary-board8/proxy-activity.json`
  - `docs/qa/artifacts/session6-main-canary-board8/proxy-issues.json`
  - `docs/qa/artifacts/session6-main-canary-board8/proxy-agents.json`
  - `docs/qa/artifacts/session6-main-canary-board8/proxy-sidebar-badges.json`
  - `docs/qa/artifacts/session6-main-canary-board8/release-smoke-http.txt`

## Verdict

**PASS** — Session 6 is production-safe on `main` with one clean fresh-tenant canary (`board8`).

No hotfix loop was required. `board9` and `board10` were not needed.
