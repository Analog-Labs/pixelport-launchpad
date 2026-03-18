# PixelPort Pivot P3 — Runtime Prune Batch 2 (Dashboard/API Legacy Removal)

**Title:** Remove vestigial dashboard runtime surfaces and prune legacy runtime route groups  
**Date:** 2026-03-17  
**Owner:** Codex  
**Build Size:** `high`  
**Branch:** `codex/p3-c4-prune-batch2-dashboard-runtime-legacy`

---

## Goal

Execute the second incremental route-prune batch from `docs/migration/launchpad-runtime-prune-checklist.md` by removing legacy dashboard/API surfaces that are no longer part of the Paperclip-primary product path.

## Scope

- In scope: remove vestigial dashboard pages/routes that still call legacy APIs:
  - `Home`, `Content`, `Calendar`, `Vault`, `Competitors`
- In scope: remove related sidebar links and route wiring so deleted pages are not reachable.
- In scope: delete legacy route groups:
  - `api/commands/*`
  - `api/tasks/*`
  - `api/vault/*`
  - `api/agent/*`
  - `api/agents/*`
  - `api/competitors/*`
- In scope: remove now-dead tests and references tied to deleted route groups.
- In scope: add a dashboard-safe fallback index surface that does not depend on deleted APIs.
- In scope: update migration/plan/session/status docs and add QA evidence for batch 2.

## Non-Goals

- Not in scope: deleting `api/connections/*` and integration activation functions.
- Not in scope: deleting `api/settings/*` or Slack-specific debug endpoints.
- Not in scope: changing onboarding/provisioning thin-bridge endpoints (`api/tenants/*`, `api/inngest/*`, `api/runtime/handoff`).
- Not in scope: production merge/deploy in this implementation slice.

## Implementation Plan

1. Remove dashboard route/nav dependencies on `tasks/vault/competitors/commands`.
2. Delete legacy dashboard pages that depended on removed runtime APIs.
3. Delete legacy API route groups (`commands/tasks/vault/agent/agents/competitors`) and emptied directories.
4. Remove or update tests that import deleted routes.
5. Re-run typecheck + full test suite.
6. Record QA evidence and open CTO review PR.

## Validation Plan

- `npx tsc --noEmit`
- `npm test -- --exclude src/test/tenants-status-route.test.ts`
- `rg` verification scans for removed route usages/imports

## Acceptance Criteria

- No remaining runtime usages of:
  - `/api/commands`
  - `/api/tasks`
  - `/api/vault`
  - `/api/agent`
  - `/api/agents`
  - `/api/competitors`
- Legacy dashboard pages that depended on deleted APIs are no longer routed or linked.
- Typecheck and CI-equivalent tests pass.
- Active plan/session/status docs reflect batch-2 progress and updated blockers/next steps.
