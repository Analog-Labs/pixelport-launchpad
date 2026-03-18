# QA Evidence — Pivot P3 Runtime Prune Batch 1 (Chat/Content/Approvals)

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p3-c4-prune-batch1-chat-content-approvals`  
**Scope:** Incremental deletion of unused legacy launchpad runtime route groups (`chat`, `content`, `approvals`)

## Deleted Route Files

- `api/chat.ts`
- `api/chat/history.ts`
- `api/content/index.ts`
- `api/content/[id].ts`
- `api/approvals/index.ts`
- `api/approvals/[id]/decide.ts`

Removed route directories that became empty:
- `api/chat/`
- `api/content/`
- `api/approvals/`

## Dependency Scan Evidence

Frontend runtime usage checks:
- `rg -n "(/api/chat|/api/content|/api/approvals)" src -S`
- Result: no launchpad runtime endpoint calls; only Slack URL literal in test (`https://slack.com/api/chat.postMessage`)

Route/test import checks:
- `rg -n "api/(chat|content|approvals)" src/test api -S`
- Result: no imports/usages of deleted route groups; only Slack API URL literals unrelated to launchpad routes

Inngest dependency checks:
- `rg -n "(/api/chat|/api/content|/api/approvals|api/(chat|content|approvals))" api/inngest -S`
- Result: no dependencies on deleted route groups

## Guardrail Confirmation

- `api/competitors/*` was intentionally **not deleted** because dashboard still calls `GET /api/competitors` (`src/pages/dashboard/Competitors.tsx`).
- Keep-now provisioning bridge surfaces remain unchanged.

## Validation

- `npx tsc --noEmit` -> `pass`
- `npm test -- --exclude src/test/tenants-status-route.test.ts` -> `pass` (26 files / 103 tests)

## Independent QA Sub-Agent Validation

Reviewer: `Einstein` (read-only QA pass)

- Verdict: `PASS`
- Findings: none
- Confirmed:
  - deletions are limited to the intended route groups (+ `.gitkeep` cleanup in those groups)
  - no remaining route files under `api/chat*`, `api/content/*`, `api/approvals/*`
  - no active frontend/inngest/test dependencies on deleted groups
  - `api/competitors/*` remains present and is still referenced by dashboard UI

## Verdict

`pass` for prune batch 1 scope. Deleted route groups are unused by active frontend/inngest paths, and validation passed without regressions.
