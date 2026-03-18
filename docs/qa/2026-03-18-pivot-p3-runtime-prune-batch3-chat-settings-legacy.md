# QA Evidence — Pivot P3 Runtime Prune Batch 3 (Chat/Settings Legacy Removal)

**Date:** 2026-03-18 (America/Chicago)  
**Branch:** `codex/p3-c4-prune-batch3-chat-settings-legacy`  
**Scope:** Remove remaining vestigial dashboard chat/settings/performance surfaces, delete legacy settings/debug APIs, and align `tenants-status` contract test

## Deleted Frontend Surfaces

- `src/pages/dashboard/Chat.tsx`
- `src/components/dashboard/ChatWidget.tsx`
- `src/contexts/ChatContext.tsx`
- `src/pages/dashboard/Performance.tsx`
- `src/pages/dashboard/Settings.tsx`

Wiring cleanup:
- removed chat/settings/performance route wiring in `src/App.tsx`
- removed `ChatProvider` and `ChatWidget` usage from `src/pages/Dashboard.tsx`
- removed sidebar settings nav from `src/components/dashboard/AppSidebar.tsx`

## Deleted API Surfaces

- `api/settings/*`
- `api/debug/slack-status.ts`

## Contract-Test Alignment

Updated `src/test/tenants-status-route.test.ts` to current thin-bridge payload shape:
- added `contract_version` expectation
- added `task_step_unlocked` expectation

Decision: kept this test and fixed assertions instead of deleting it, so `GET /api/tenants/status` contract coverage remains active.

## Dependency Scan Evidence

Frontend stale-surface checks:
- `rg -n "dashboard/(Chat|Performance|Settings)|/dashboard/(chat|performance|settings)|ChatProvider|ChatWidget|useChat|contexts/ChatContext" src`
- Result: no references remain

Settings/debug API reference checks:
- `rg -n "api/settings|/api/settings|debug/slack-status|/api/debug/slack-status" src api`
- Result: no references remain

Route inventory checks:
- `find src/pages/dashboard -maxdepth 1 -type f | sort`
- Result: dashboard pages now include only `Home` + `Connections`
- `find api/debug -maxdepth 1 -type f | sort`
- Result: only `do-status.ts` and `test-provision.ts` remain (no `slack-status.ts`)

## Validation

- `npx tsc --noEmit` -> `pass`
- `npm test` -> `pass` (18 files / 71 tests; includes `src/test/tenants-status-route.test.ts`)
- `npm run build` -> `pass`

## Verdict

`pass` for prune batch 3 implementation scope. Remaining vestigial dashboard chat/settings/performance surfaces and legacy settings/debug routes were removed cleanly, and `tenants-status` contract testing is now aligned to the current payload schema.
