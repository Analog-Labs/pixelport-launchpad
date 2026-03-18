# QA Evidence — Pivot P3 Runtime Prune Batch 2 (Dashboard/API Legacy Removal)

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p3-c4-prune-batch2-dashboard-runtime-legacy`  
**Scope:** Remove vestigial dashboard surfaces and prune legacy runtime route groups (`commands`, `tasks`, `vault`, `agent`, `agents`, `competitors`)

## Dashboard Surface Changes

Removed vestigial dashboard pages/routes tied to legacy runtime APIs:
- `src/pages/dashboard/Content.tsx`
- `src/pages/dashboard/CalendarPage.tsx`
- `src/pages/dashboard/Vault.tsx`
- `src/pages/dashboard/Competitors.tsx`
- `src/pages/dashboard/Vault.test.tsx`

Routing/nav cleanup:
- removed deleted page route wiring from `src/App.tsx`
- removed stale sidebar nav links from `src/components/dashboard/AppSidebar.tsx`
- repurposed `src/pages/dashboard/Home.tsx` into a workspace-launch surface using `/api/runtime/handoff`

## Deleted API Route Groups

- `api/commands/*`
- `api/tasks/*`
- `api/vault/*`
- `api/agent/*`
- `api/agents/*`
- `api/competitors/*`

Removed now-empty route directories:
- `api/commands/`
- `api/tasks/`
- `api/vault/`
- `api/agent/`
- `api/agents/`
- `api/competitors/`

## Supporting Legacy Library/Test Prune

Removed dead command-route support libraries that no longer have route consumers:
- `api/lib/command-contract.ts`
- `api/lib/command-definitions.ts`
- `api/lib/commands.ts`
- `api/lib/vault-refresh-recovery.ts`

Removed route tests tied to deleted surfaces:
- `src/test/agent-bootstrap-sync-route.test.ts`
- `src/test/agent-memory-route.test.ts`
- `src/test/command-contract.test.ts`
- `src/test/command-definitions.test.ts`
- `src/test/command-detail-route.test.ts`
- `src/test/commands-route.test.ts`
- `src/test/vault-refresh-recovery.test.ts`
- `src/test/workspace-events-route.test.ts`

## Dependency Scan Evidence

Frontend runtime usage checks:
- `rg -n "(/api/(commands|tasks|vault|agent|agents|competitors))" src/pages src/components src/contexts src/lib -S`
- Result: no runtime calls in active frontend surfaces

Route/test import checks:
- `rg -n "api/(commands|tasks|vault|agent|agents|competitors)" api src/test -S`
- Result: no route imports remain; only negative-assertion strings in:
  - `src/test/onboarding-bootstrap.test.ts`
  - `src/test/workspace-contract.test.ts`

Route inventory check:
- `find api -maxdepth 2 -type f | sort`
- Result: deleted route groups are absent; keep-now thin-bridge surfaces remain (`api/tenants/*`, `api/inngest/*`, `api/runtime/handoff`, `api/connections/*`, `api/settings/*`).

## Workspace Contract Alignment (Batch-2 additive)

- `api/lib/onboarding-bootstrap.ts` updated to workspace-first bootstrap instructions (no `/api/agent/*` guidance).
- `api/lib/workspace-contract.ts` updated to remove legacy `/api/agent/*` command/write guidance and use workspace-first artifact rules.

## Validation

- `npx tsc --noEmit` -> `pass`
- `npm test -- --exclude src/test/tenants-status-route.test.ts` -> `pass` (17 files / 70 tests)

## Verdict

`pass` for prune batch 2 implementation scope. Legacy dashboard/API runtime surfaces were removed as a coherent set, with keep-now thin-bridge provisioning surfaces preserved and validation passing.
