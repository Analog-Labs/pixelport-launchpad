# PixelPort Build Brief

**Title:** Foundation Slice — Command Ledger + Runtime Projection Spine  
**Date:** 2026-03-08  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/workspace-canonical-architecture`  

---

## Goal

Build the smallest correct foundation that makes the replacement architecture real:
- a durable command ledger
- a runtime-to-control-plane projection ingest path
- bootstrap scaffolding for the PixelPort workspace contract

This slice should not attempt to ship the full admin UI or rewrite the content product yet.

## Scope

- In scope:
  - command ledger schema and API foundation
  - runtime event/projection ingest API foundation
  - workspace contract scaffolding in provisioning/bootstrap
  - prompt/instruction updates so the Chief knows the contract
- In scope:
  - minimal read surfaces needed to validate the new spine

## Non-Goals

- Not in scope:
  - full admin-runtime route
  - content page rewrite
  - approval UX rewrite
  - cron UI
  - full vault redesign
- Not in scope:
  - trying to migrate every old task/content surface in the same slice
  - replacing or removing current `/api/agent/*`, `/api/tasks/*`, or dashboard read paths

## Founder-Approved Decisions

- The first code slice should be the smallest correct foundation, not a flashy UI slice.
- The architecture may use a hybrid control-plane/runtime model where needed.
- The old Phase 3 execution order is paused pending this foundation.

## Implementation Notes

### Coexistence rules

This slice must be strictly additive:
- existing tenants remain on the current direct-write model until a separate migration session
- current `/api/agent/tasks`, `/api/agent/vault`, `/api/agent/competitors`, `/api/tasks/*`, and current dashboard pages stay untouched
- the new `workspace-events` ingest supplements the current model; it does not replace existing agent write endpoints
- command ledger tables are additive schema only
- no existing tables are dropped, repurposed, or backfilled in this slice

### 1. Command ledger

Add a control-plane command ledger, likely with:
- `command_records`
- `command_events`

Minimum capabilities:
- create command
- store idempotency key
- store target entity type and ID
- track lifecycle status
- append failure and retry events

### 2. Runtime projection ingest

Add a narrow agent-authenticated ingest endpoint, likely:
- `POST /api/agent/workspace-events`

Minimum contract:
- command correlation ID when relevant
- event type
- runtime-owned entity type and ID
- event timestamp
- structured payload

Do not overfit it to one content format in v1.

### 3. Bootstrap runtime contract

Provisioning/bootstrap should:
- create the `pixelport/` namespace in the workspace
- scaffold the initial directories
- seed any required JSON/Markdown placeholders
- update the full runtime prompt surface so the Chief knows:
  - `SOUL.md` for identity and decision posture
  - `TOOLS.md` for tool and routine policy
  - `AGENTS.md` for delegation and sub-agent behavior
  - `HEARTBEAT.md` for proactive/recurring behavior
  - `BOOTSTRAP.md` for first-run setup and workspace contract orientation
- update runtime prompt files so the Chief knows:
  - where PixelPort-owned runtime artifacts live
  - where sub-agents may write scratch work
  - that final dashboard-facing manifests must be promoted by the Chief
  - which artifacts should emit projection events back to PixelPort
- remove the stale `Spark` / `Scout` permanent-role assumptions from [soul-template.md](/Users/sanchal/pixelport-launchpad/infra/provisioning/soul-template.md) as part of the prompt-surface refresh

### 4. Minimal validation surface

Add only the minimum read/verification surface needed to prove the foundation works, such as:
- listing command records
- verifying correlated runtime events reached Supabase

Avoid building end-user UI unless a minimal debug/admin read is required for proof.

## Acceptance Criteria

- [ ] A dashboard or API action can create a durable command record with an idempotency key.
- [ ] A command can be dispatched to the Chief through the proven external hook path with a command ID.
- [ ] The runtime can post a structured event back into PixelPort through the new ingest endpoint.
- [ ] Supabase can persist enough projected data to show command state and at least one runtime-owned event.
- [ ] Fresh bootstrap writes the `pixelport/` workspace contract and updated runtime instructions.
- [ ] Existing `/api/agent/*`, `/api/tasks/*`, and current dashboard reads remain untouched and working.
- [ ] The refreshed bootstrap prompt surface includes `SOUL.md`, `TOOLS.md`, `AGENTS.md`, `HEARTBEAT.md`, and `BOOTSTRAP.md`, and removes stale `Spark` / `Scout` permanent-role references.
- [ ] TypeScript and any touched validation paths pass.

## CTO Handoff Prompt

Use the separate prompt at:
- [2026-03-08-workspace-canonical-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-cto-prompt.md)

## Production Smoke Checklist

- [ ] No production deploy in this slice until CTO approves the implementation session that uses this brief
- [ ] Fresh bootstrap still succeeds after workspace scaffolding changes
- [ ] Existing active tenants are not broken by additive schema or prompt changes
- [ ] Command creation and runtime event ingest work on the target tenant
- [ ] No regression to current tasks/vault dashboard reads while the new spine is introduced

## Blockers / Required Credentials

- Blocking item:
  - none for the brief itself
- Required credential:
  - none for the brief itself
