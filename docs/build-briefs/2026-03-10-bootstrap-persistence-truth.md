# PixelPort Build Brief

**Title:** Bootstrap Persistence And Truthfulness  
**Date:** 2026-03-10  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/bootstrap-persistence-truth`  

---

## Goal

Fix the onboarding bootstrap so a fresh tenant uses the runtime's real injected credentials when writing back to PixelPort, and make bootstrap status truthful so it remains in-progress while work is plausibly active, becomes `failed` only on clear timeout or error, and becomes `completed` only after durable backend truth exists.

This build must make the system truthful in two places at once:
- the generated runtime contract must stop telling the container to source a non-existent `/opt/openclaw/.env`
- bootstrap status must reflect durable backend truth instead of being flipped to `completed` by a single later agent write

## Scope

- In scope:
  - Update generated `TOOLS.md` guidance in the workspace contract to use injected env vars directly.
  - Add fail-fast checks for `PIXELPORT_API_KEY` and direct-model env vars where needed.
  - Replace implicit bootstrap completion behavior with durable completion evaluation.
  - Re-evaluate bootstrap progress after successful agent writes to tasks, competitors, and vault sections.
  - Keep bootstrap `accepted` or `dispatching` while the run is plausibly active.
  - Mark bootstrap `failed` only on explicit timeout or clear failure conditions.
  - Validate the fix with a real fresh tenant created against the branch code.

## Non-Goals

- Not in scope:
  - repairing existing broken tenants such as `analog-2`
  - adding a new bootstrap-specific persistence API
  - changing dashboard read contracts beyond truthful bootstrap state
  - broad onboarding, provisioning, or command-center refactors
  - retroactive migrations or auto-repair jobs for existing tenants

## Founder-Approved Decisions

- Approved before implementation:
  - this is a high-risk production fix and must stay narrow
  - `analog-2` must not be repaired in the same build
- Locked during approval:
  - if durable bootstrap criteria are not yet met, keep bootstrap non-complete and in-progress while the run is still plausibly active
  - mark bootstrap `failed` only when the run clearly ended, errored, or timed out
  - never mark bootstrap `completed` from a single agent write

## Implementation Notes

- Systems or surfaces touched:
  - [workspace-contract.ts](/Users/sanchal/pixelport-launchpad/api/lib/workspace-contract.ts)
  - [bootstrap-state.ts](/Users/sanchal/pixelport-launchpad/api/lib/bootstrap-state.ts)
  - [bootstrap.ts](/Users/sanchal/pixelport-launchpad/api/tenants/bootstrap.ts)
  - [me.ts](/Users/sanchal/pixelport-launchpad/api/tenants/me.ts)
  - [status.ts](/Users/sanchal/pixelport-launchpad/api/tenants/status.ts)
  - [tasks.ts](/Users/sanchal/pixelport-launchpad/api/agent/tasks.ts)
  - [competitors.ts](/Users/sanchal/pixelport-launchpad/api/agent/competitors.ts)
  - [[key].ts](/Users/sanchal/pixelport-launchpad/api/agent/vault/%5Bkey%5D.ts)
- Durable bootstrap completion criteria:
  - `agent_tasks >= 1`
  - `competitors >= 1`
  - all 5 `vault_sections` exist and are `ready`
- Timeout posture in this build:
  - `dispatching` can fail after a bounded dispatch timeout with no acceptance
  - `accepted` can fail after a bounded inactivity/elapsed timeout if durable truth still is not complete
  - partial agent output alone is not completion
- Route behavior:
  - `/api/tenants/me` and `/api/tenants/status` now reconcile and return truthful bootstrap state
  - `/api/tenants/bootstrap` allows replay after clear failure instead of treating any prior agent output as completed
  - `/api/agent/tasks`, `/api/agent/competitors`, and `/api/agent/vault/:key` only transition bootstrap to `completed` after durable criteria are met
- Runtime contract behavior:
  - `TOOLS.md` no longer references `/opt/openclaw/.env`
  - the generated setup text now requires `PIXELPORT_API_KEY` to already be injected into the running container
  - direct model access checks require `OPENAI_API_KEY` and `OPENAI_BASE_URL` only where that path is used

## Acceptance Criteria

- [ ] Generated `TOOLS.md` no longer instructs the runtime to source `/opt/openclaw/.env`.
- [ ] Bootstrap is never marked `completed` from a single agent write.
- [ ] Bootstrap remains `dispatching` or `accepted` while durable criteria are still incomplete and the run is plausibly active.
- [ ] Bootstrap moves to `failed` only on explicit timeout or clear failure.
- [ ] Bootstrap moves to `completed` only when tasks, competitors, and all 5 ready vault sections exist durably in backend truth.
- [ ] `/api/tenants/me` and `/api/tenants/status` report truthful bootstrap state for partial-output tenants.
- [ ] `/api/tenants/bootstrap` does not block replay solely because partial durable output exists.
- [ ] Existing `/api/tasks`, `/api/vault`, and `/api/competitors` read behavior remains unchanged.
- [ ] A real fresh-tenant canary proves partial output stays in-progress and final output completes only after durable truth exists.

## Validation Evidence

- Local validation:
  - `npx vitest run src/test/bootstrap-state.test.ts src/test/tenants-status-route.test.ts src/test/tenants-bootstrap-route.test.ts src/test/agent-bootstrap-sync-route.test.ts src/test/workspace-contract.test.ts`
  - `npx vitest run src/test/onboarding-bootstrap.test.ts src/test/commands-route.test.ts src/test/command-detail-route.test.ts src/test/workspace-events-route.test.ts src/test/workspace-contract.test.ts`
  - `npx tsc --noEmit`
- Real branch canary:
  - QA auth email: `codex.bootstrap.truth.20260310053742@example.com`
  - tenant slug: `bootstrap-truth-qa-20260310054029`
  - tenant id: `39a234b7-3ca5-4668-af9f-b188f2e5ec34`
  - droplet id: `557163621`
  - droplet ip: `142.93.117.18`
  - initial truthful partial state on the branch:
    - `bootstrap_status: accepted`
    - `tasks: 0`
    - `competitors: 0`
    - `vault_ready: 2/5`
  - final durable state on the same tenant:
    - `bootstrap_status: completed`
    - `tasks: 5`
    - `competitors: 4`
    - `vault_ready: 5/5`
  - observed bootstrap timestamps:
    - `requested_at: 2026-03-10T05:46:21.999Z`
    - `accepted_at: 2026-03-10T05:46:22.917Z`
    - `completed_at: 2026-03-10T05:47:38.491Z`
  - adjacent authenticated reads stayed healthy throughout:
    - `/api/tenants/me`
    - `/api/tenants/status`
    - `/api/tasks`
    - `/api/vault`
    - `/api/competitors`

## CTO Review

Use [2026-03-10-bootstrap-persistence-truth-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-bootstrap-persistence-truth-cto-prompt.md) for the required review before merge.

## Production Smoke Checklist

- [ ] Deploy completed successfully
- [ ] A fresh QA tenant reaches `accepted` before durable output is complete
- [ ] The same tenant reaches `completed` only after at least one task, at least one competitor, and all 5 ready vault sections exist
- [ ] `/api/tenants/me` and `/api/tenants/status` agree on truthful bootstrap state
- [ ] `/api/tasks`, `/api/vault`, and `/api/competitors` return durable backend truth consistent with the dashboard
- [ ] No existing tenant is auto-repaired or mutated outside the intended branch smoke

## Blockers / Required Credentials

- Blocking item:
  - CTO review is required before merge because this is a high-risk onboarding/runtime truth fix
- Required credential:
  - no new third-party credential is required beyond the existing project QA and provisioning access already in use
