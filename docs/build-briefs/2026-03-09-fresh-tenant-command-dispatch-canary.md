# PixelPort Build Brief

**Title:** Fresh-Tenant Command Dispatch Canary and Reachability Gate  
**Date:** 2026-03-09  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/fresh-tenant-command-dispatch`  

---

## Goal

Determine whether the current command-dispatch reachability problem is:
- only an old test-tenant/runtime issue that can be ignored for now
- or a real fresh-tenant provisioning/runtime bug that would affect new customers

The priority is **fresh-tenant reliability**, not repairing old disposable test tenants.

## Scope

- In scope:
  - create a brand-new production tenant through the real onboarding flow
  - validate end-to-end dashboard-originated command dispatch on that fresh tenant
  - inspect fresh droplet reachability, gateway health, and hook exposure if dispatch fails
  - compare against the known failing old tenant only as needed to classify the issue
  - if the fresh tenant fails due a real provisioning/runtime problem, implement the minimum safe fix and rerun the canary
- In scope:
  - decide whether old existing test tenants can be ignored, rebuilt, or need repair only after the fresh-tenant result is known

## Non-Goals

- Not in scope:
  - repairing every old test droplet unconditionally
  - building admin UI or command UX expansion
  - changing existing `/api/agent/*`, `/api/tasks/*`, or current dashboard read paths unless a fresh-tenant fix absolutely requires additive runtime/provisioning work
- Not in scope:
  - migrating old tenants to the new foundation model

## Founder-Approved Decisions

- Existing test tenants may be treated as disposable if fresh tenants created now work correctly.
- The next session should optimize for the **new-customer path**, not backward repair of stale test environments.
- If the issue is old-tenant-only, document it and move on instead of spending a build session repairing dead-end test infrastructure.

## Implementation Notes

### Decision rule

Use this exact rule:
- if a fresh tenant created after the foundation-spine deploy can dispatch commands successfully, stop and document the old-tenant timeout as a stale-test-tenant issue
- if a fresh tenant cannot dispatch commands successfully, treat that as a real production bug and implement the minimum fix needed for fresh tenants

### Required checks

- Provision one brand-new tenant on production through the real onboarding flow
- Verify:
  - tenant reaches `active`
  - fresh workspace contract exists
  - `POST /api/commands` does not fail because the fresh runtime hook is unreachable
  - command row progresses beyond dispatch failure
  - correlated `workspace_events` or command state updates can be observed end to end
- If dispatch fails:
  - check public/network reachability to the fresh droplet gateway
  - check gateway/container health
  - check hook config/token exposure
  - check whether the issue is Vercel egress, droplet bind/firewall, runtime startup, or hook config drift

### If a fix is needed

The fix must be:
- the smallest production-safe change needed for fresh tenants
- additive where possible
- limited to provisioning/runtime/network exposure or hook reachability

Do not expand scope into unrelated command UX or runtime-admin work.

### If no fix is needed

Produce a short conclusion:
- fresh tenants are healthy
- old tenant issue is stale/disposable
- recommended action is ignore, destroy/recreate, or clean up those old test tenants later

## Acceptance Criteria

- [ ] A brand-new production tenant created after the foundation-spine deploy reaches `active`.
- [ ] `POST /api/commands` on that fresh tenant does not fail due an unreachable hook endpoint.
- [ ] A fresh-tenant command can be observed progressing through the command ledger beyond dispatch failure.
- [ ] Existing live reads remain healthy on the same fresh tenant: `/api/tenants/me`, `/api/tenants/status`, `/api/tasks`, `/api/vault`, `/api/competitors`.
- [ ] The session ends with a clear classification:
  - fresh tenants work and old tenant issue can be ignored, or
  - fresh tenants fail and a minimum fix was implemented and revalidated
- [ ] If code changes were required, they are committed, validated, and a CTO handoff prompt is prepared before merge.

## CTO Handoff Prompt

If this session requires code changes, generate a review prompt that asks Claude CTO to verify:
- the bug was reproduced on a fresh tenant, not only on an old stale one
- the fix is the minimum required for fresh-tenant reliability
- existing command ledger/event ingest behavior was not regressed
- no existing `/api/agent/*` or `/api/tasks/*` paths were broken
- production rollout risk is acceptable

If no code changes are needed because the fresh canary passes, no CTO review is required for the canary-only conclusion.

## Production Smoke Checklist

- [ ] Fresh onboarding succeeds on production
- [ ] Fresh tenant reaches `active`
- [ ] `POST /api/commands` works end to end on the fresh tenant
- [ ] `GET /api/commands` and `GET /api/commands/:id` reflect the real command lifecycle
- [ ] Existing live read endpoints remain healthy on the same tenant
- [ ] If a fix was made, rerun the fresh-tenant canary after deploy

## Blockers / Required Credentials

- Blocking item:
  - none beyond the existing production stack access already used in session 36
- Required credential:
  - none beyond the current production access path
