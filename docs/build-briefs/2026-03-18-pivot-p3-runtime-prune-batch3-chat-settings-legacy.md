# PixelPort Pivot P3 — Runtime Prune Batch 3 (Chat/Settings Legacy Removal)

**Title:** Remove remaining vestigial dashboard/chat/settings surfaces and legacy settings debug APIs  
**Date:** 2026-03-18  
**Owner:** Codex  
**Build Size:** `medium`  
**Branch:** `codex/p3-c4-prune-batch3-chat-settings-legacy`

---

## Goal

Execute the next incremental prune batch by removing obsolete dashboard chat/settings/performance surfaces and deleting legacy settings/debug API routes, while preserving active thin-bridge provisioning paths.

## Scope

- In scope: remove dashboard/chat surfaces:
  - `src/pages/dashboard/Chat.tsx`
  - `src/components/dashboard/ChatWidget.tsx`
  - `src/contexts/ChatContext.tsx`
  - remove `ChatProvider` wiring from `src/pages/Dashboard.tsx`
- In scope: remove vestigial dashboard pages/routes:
  - `src/pages/dashboard/Performance.tsx`
  - `src/pages/dashboard/Settings.tsx`
  - route/nav cleanup in `src/App.tsx` and sidebar
- In scope: delete legacy API surfaces:
  - `api/settings/*`
  - `api/debug/slack-status.ts`
- In scope: fix `src/test/tenants-status-route.test.ts` to current payload contract (`contract_version`, `task_step_unlocked`) and include this test in validation.
- In scope: add QA evidence and update active docs.

## Non-Goals

- Not in scope: deleting `api/connections/*` or Slack integration activation flows.
- Not in scope: modifying onboarding/provisioning keep-now routes (`api/tenants/*`, `api/inngest/*`, `api/runtime/handoff`).
- Not in scope: production merge/deploy in this implementation slice.

## Implementation Plan

1. Remove chat provider/widget/page and dependent dashboard route wiring.
2. Remove performance/settings dashboard pages and stale nav links/routes.
3. Delete `api/settings/*` and `api/debug/slack-status.ts`.
4. Update `tenants-status-route.test.ts` expected payload shape to the current thin-bridge contract.
5. Run full validation with `tenants-status-route.test.ts` included.
6. Record QA evidence and open CTO review PR.

## Validation Plan

- `npx tsc --noEmit`
- `npm test`
- route/dependency scans for removed chat/settings/debug surfaces

## Acceptance Criteria

- No remaining dashboard chat/performance/settings routes or chat context/widget wiring.
- No remaining `api/settings/*` or `api/debug/slack-status.ts`.
- `src/test/tenants-status-route.test.ts` passes with current contract fields.
- Full test suite passes without excluding `tenants-status-route.test.ts`.
- Docs reflect batch-3 implementation truth and next prune candidates.
