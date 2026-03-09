# PixelPort Build Brief

**Title:** Vault Refresh Command v1  
**Date:** 2026-03-09  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/vault-refresh-command-v1`  

---

## Goal

Ship the first real dashboard command flow on top of the new foundation spine by letting a tenant user trigger a structured Chief command from the Knowledge Vault page to refresh one vault section.

This build should prove the full loop:
- user initiates a bounded product action from the dashboard
- PixelPort creates and tracks a durable command record
- the Chief receives the command through the live hook path
- the runtime emits correlated `workspace-events`
- the Chief updates the existing live product surface through the current vault write path
- the dashboard shows meaningful progress and the final updated result

## Scope

- In scope:
  - Add a section-level `Refresh with Chief` action to the existing Knowledge Vault UI.
  - Use the existing `POST /api/commands` and `GET /api/commands/:id` surfaces as the command transport and status source.
  - Standardize the first typed command payload for this flow:
    - `command_type: vault_refresh`
    - `target_entity_type: vault_section`
    - `target_entity_id: <section_key>`
  - Add minimal section-level command state in the Vault UI:
    - idle
    - dispatching / in progress
    - completed
    - failed
  - Ensure the Chief/runtime has explicit enough instructions to execute a vault refresh correctly and emit correlated `workspace-events`.
  - Keep the final section write on the current live path: existing agent vault write endpoint updates `vault_sections`.
  - Validate end to end on a fresh reachable tenant runtime.

## Non-Goals

- Not in scope:
  - full command center UI
  - generic command UX across every dashboard page
  - scheduled/background vault refresh
  - vault schema redesign or human-lock model
  - content generation, competitor sweep, approvals, or admin-runtime UI
  - migration of old disposable tenants
  - replacement of current `/api/vault`, `/api/agent/vault*`, `/api/tasks/*`, or dashboard read paths

## Founder-Approved Decisions

- Approved before this brief:
  - Structured dashboard actions go through the control-plane command ledger.
  - Runtime execution continues through the proven hook path plus correlated `workspace-events`.
  - Existing live vault tables and APIs remain the source of truth for human-edited vault facts in this slice.
  - Old dead test tenants should not drive current engineering scope if fresh tenants work.
- Approved for this build on 2026-03-09:
  - Knowledge Vault is the first command-backed dashboard surface.
  - A user-clicked vault refresh counts as explicit permission for the Chief to replace that section's current content through the existing live vault write path.
  - This vault refresh slice should happen before content draft generation or competitor sweep command UX.

## Implementation Notes

- Systems or surfaces touched:
  - [Vault.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/Vault.tsx)
  - existing command APIs under [api/commands](/Users/sanchal/pixelport-launchpad/api/commands)
  - existing vault agent write path under [api/agent/vault/[key].ts](/Users/sanchal/pixelport-launchpad/api/agent/vault/%5Bkey%5D.ts)
  - command dispatch contract under [command-contract.ts](/Users/sanchal/pixelport-launchpad/api/lib/command-contract.ts)
  - prompt/workspace instruction scaffolding only if needed to make future tenants understand this command type more reliably
- Expected data flow or integration behavior:
  - user clicks refresh on one section
  - frontend posts a typed `vault_refresh` command to `POST /api/commands`
  - frontend polls `GET /api/commands/:id` for that section's active command state
  - Chief acknowledges, runs, and completes the command through `workspace-events`
  - Chief updates the targeted section through the existing agent vault API
  - Vault UI refetches the section data after terminal completion
- Known constraints or existing caveats:
  - keep the implementation grounded in real OpenClaw primitives only: hook dispatch plus event ingest
  - do not route this through `api/chat.ts`
  - do not replace existing vault or task APIs
  - do not assume old disposable tenants are healthy
  - prefer a fresh tenant created after the foundation-spine rollout for proof
- External credentials or dependencies:
  - no new third-party credentials expected
  - requires an authenticated QA user and a reachable tenant runtime

## Acceptance Criteria

- [ ] The Knowledge Vault page exposes a section-level `Refresh with Chief` action for at least the ready-state sections.
- [ ] Clicking refresh creates a `vault_refresh` command through the existing command ledger with a stable target entity and idempotency key.
- [ ] The user sees real section-level command progress and a clear failure state if dispatch or execution fails.
- [ ] A successful run on a fresh reachable tenant advances through `dispatched -> acknowledged -> running -> completed` with correlated `workspace-events`.
- [ ] The targeted `vault_sections` row updates through the existing live path and the refreshed content becomes visible in the current Vault page.
- [ ] Existing manual vault edit behavior still works after the command flow ships.
- [ ] Existing live reads remain healthy: `/api/tasks`, `/api/vault`, `/api/competitors`, `/api/tenants/me`, `/api/tenants/status`.

## CTO Handoff Prompt

Paste this into a fresh Claude Code review session once the implementation branch is ready:

```md
Review this PixelPort implementation branch as CTO QA.

Read these first:
- /Users/sanchal/pixelport-launchpad/AGENTS.md
- /Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md
- /Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md
- /Users/sanchal/pixelport-launchpad/docs/build-workflow.md
- /Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-command-v1.md
- /Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-architecture.md

Review the implementation on branch `codex/vault-refresh-command-v1`.

Expected scope:
- one real dashboard command flow from the Knowledge Vault page
- section-level `vault_refresh` command creation through existing `/api/commands`
- section-level command progress in the Vault UI
- runtime execution through the existing hook path plus correlated `workspace-events`
- final section update through the existing agent vault write path

Critical constraints that must still be true:
- no replacement of existing `/api/vault`, `/api/agent/vault*`, `/api/tasks/*`, or dashboard read paths
- no fake chat-based command transport
- no broad command center/admin-runtime expansion in this slice
- command flow remains grounded in actual OpenClaw behavior
- manual vault edit behavior still works

Return your review in this exact shape:
1. `Verdict: APPROVED` or `Verdict: BLOCKED`
2. Findings first, ordered by severity
3. File references for each finding
4. What must be fixed before merge, if anything
5. What you checked
6. Residual risks
7. One explicit final line:
   - `Approved to merge and deploy.`
   - or `Blocked pending fixes.`

Focus especially on:
- incorrect OpenClaw assumptions
- command idempotency or duplicate-trigger issues
- stale or misleading Vault UI states
- regressions to existing vault editing or existing dashboard reads
- command completion without actual vault truth update
- auth or tenant-scoping mistakes
```

## Production Smoke Checklist

- [ ] Deploy completed successfully
- [ ] Authenticated user can load the live Knowledge Vault page
- [ ] Triggering one section refresh creates a real command and shows progress in the UI
- [ ] `GET /api/commands/:id` reaches a terminal state without auth or tenant leakage
- [ ] The refreshed vault section content becomes visible on the live Vault page
- [ ] Manual vault edit still works after the command flow deploy
- [ ] Adjacent live reads remain healthy: `/api/tasks`, `/api/vault`, `/api/competitors`, `/api/tenants/status`

## Blockers / Required Credentials

- Blocking item:
  - a reachable fresh tenant runtime is required for end-to-end proof
- Required credential:
  - no new external credential expected beyond the normal project QA access already in use
