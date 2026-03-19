# P6 R4 — Combined Regression Proof (Upgraded Baseline)

- **Date:** 2026-03-19
- **Branch:** `codex/p6-r4-combined-regression-proof`
- **Baseline:** `main` after R3 merge PR `#21` (`472dfbdbb9778ef1039c3a01868a39c78b64fe9a`)
- **Production target:** `https://pixelport-launchpad.vercel.app`

## Scope

Proof path required by R4:

- `signup -> onboarding -> provision -> launch -> auto-login -> agent responds`
- policy-compliant workspace behavior for new tenants (Paperclip defaults + Chief of Staff relabel + SOUL additive block)
- cleanup and rollback-readiness evidence

## Production Smoke (Post-R3 Merge)

Authenticated guardrails and debug access checks passed on production:

- `GET /api/runtime/handoff` -> `405`
- `POST /api/runtime/handoff` without auth -> `401`
- `GET /api/tenants/status` without auth -> `401`
- `POST /api/tenants/scan` without auth -> `401`
- `GET /api/debug/test-provision` without secret -> `401`
- `GET /api/debug/test-provision?mode=status&secret=<DO_API_TOKEN>` -> `200`

Artifacts:

- `/tmp/p6-r4-smoke-runtime-get.txt`
- `/tmp/p6-r4-smoke-runtime-post-unauth.txt`
- `/tmp/p6-r4-smoke-status-unauth.txt`
- `/tmp/p6-r4-smoke-scan-unauth.txt`
- `/tmp/p6-r4-smoke-debug-unauth.txt`
- `/tmp/p6-r4-smoke-debug-auth.txt`

## End-to-End Launch Proof

Tenant used for live R4 run:

- tenant id: `01de9e5c-adcd-4a6d-93c1-595e2a67d843`
- slug: `r4-canary-labs`
- auth user id: `d833a27c-2e07-4243-bb73-e43729ab25e7`
- droplet id: `559351329`
- droplet ip: `159.65.234.175`

Onboarding payload entered:

- company: `R4 Canary Labs`
- website: `https://r4-canary.example.org`
- mission/goals: `Mission: validate end-to-end launch reliability...`
- chosen agent name: `Luna Prime`

Launch and runtime proof:

- Launch click moved user to tenant runtime URL on sslip host:
  - `https://r4-canary-labs.159-65-234-175.sslip.io/chat?session=main`
- Runtime UI loaded (`OpenClaw` control shell visible).
- Agent response proof succeeded:
  - prompt: `Reply with exactly: P6_R4_AGENT_OK`
  - assistant response: `P6_R4_AGENT_OK`

Artifacts:

- screenshot: `.playwright-cli/page-2026-03-19T04-19-41-804Z.png`
- runtime snapshots:
  - `.playwright-cli/page-2026-03-19T04-19-42-961Z.yml`
  - `.playwright-cli/page-2026-03-19T04-20-27-905Z.yml`

## Workspace Policy Compliance Proof

Confirmed facts for R4 policy alignment were captured from source + tests (deterministic evidence):

- Paperclip default CEO templates are vendored and loaded as source templates:
  - `paperclip/templates/upstream-default-ceo/*`
  - `api/lib/paperclip-default-ceo-templates.ts`
- Workspace scaffold generation overlays are constrained to:
  - CEO -> Chief of Staff relabel on tenant-facing markdown
  - SOUL additive onboarding block only
  - no onboarding injection into AGENTS/HEARTBEAT/TOOLS
- Provisioning path uses this contract for new tenants:
  - `api/inngest/functions/provision-tenant.ts`
- Tests cover these behaviors:
  - `src/test/workspace-contract.test.ts`

Note:

- A runtime chat prompt requesting direct file excerpts (`AGENTS.md` + `SOUL.md`) did not return in-time during this session. Source-level + test-level proof above was used for deterministic contract validation.

## Backend Truth Snapshot (At Capture Time)

Tenant row snapshot showed expected runtime metadata persisted in `onboarding_data`:

- `runtime_url`, `runtime_https_url`, `runtime_host`, `runtime_url_source`, `launch_completed_at`
- onboarding fields present (`company_name`, `company_url`, `mission`, `goals`, `agent_name`)

Table counts at capture time:

- `agents=1`
- `vault_sections=5`
- `agent_tasks=0`
- `competitors=0`
- `sessions_log=0`
- `workspace_events=0`

Observed caveat:

- `onboarding_data.bootstrap.status` was `failed` with `last_error="Unauthorized"` in this run, so non-launch bootstrap artifacts remained pending.
- This did **not** block the launch-critical path validated in R4 (`launch -> auto-login -> agent responds`).

## Cleanup Proof

All remote R4 canary resources were removed (droplet, tenant-linked DB rows, tenant row, and auth user):

- droplet delete request for `559351329` -> `204`
- follow-up DO lookup for `559351329` -> `404`
- FK-safe DB cleanup completed for tenant-linked rows (including `vault_sections` and `agents`)
- tenant row deleted (`tenant_remaining=0`)
- auth user deleted and verified absent (`User not found`)

## Rollback Readiness

R4 introduced no new runtime image pin change and no production selector change.

- current managed image selector remains R3-promoted value (`PROVISIONING_DROPLET_IMAGE=221189855`)
- managed-only gate remains enabled (`PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`)
- rollback target remains previous known-good R3 baseline already documented in:
  - `docs/qa/2026-03-19-p6-r3-paperclip-v2026-318-0-rollout-evidence.md`

## Verdict

**PASS (launch-critical)** — R4 confirmed the full launch-critical user journey on the upgraded baseline (`launch -> auto-login -> agent responds`) and validated workspace policy compliance via source + test evidence (runtime file-excerpt check timed out in-session), with cleanup and rollback evidence captured.
