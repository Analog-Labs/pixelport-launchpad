# PixelPort Pivot P3 — Runtime Prune Batch 1 (Chat/Content/Approvals)

**Title:** Remove unused legacy launchpad runtime route groups (`chat`, `content`, `approvals`)  
**Date:** 2026-03-17  
**Owner:** Codex  
**Build Size:** `medium`  
**Branch:** `codex/p3-c4-prune-batch1-chat-content-approvals`

---

## Goal

Execute the first incremental route-prune batch from `docs/migration/launchpad-runtime-prune-checklist.md` by removing confirmed-unused legacy route groups while preserving onboarding/provisioning and active dashboard truth surfaces.

## Scope

- In scope: delete legacy route files for:
  - `api/chat.ts`
  - `api/chat/history.ts`
  - `api/content/index.ts`
  - `api/content/[id].ts`
  - `api/approvals/index.ts`
  - `api/approvals/[id]/decide.ts`
- In scope: remove emptied legacy route directories for the deleted groups.
- In scope: document dependency scans proving no active frontend/inngest/test imports for the removed groups.
- In scope: update active planning/session/status docs and add QA evidence.

## Non-Goals

- Not in scope: deleting `api/competitors/*` (still used by dashboard).
- Not in scope: deleting `commands/tasks/vault/agent/agents` route groups.
- Not in scope: `connections/*` or integration activation route/function deletions.
- Not in scope: production merge/deploy in this implementation slice.

## Implementation Plan

1. Verify `src` has no runtime calls to `/api/chat`, `/api/content`, `/api/approvals`.
2. Verify `src/test` + `api` have no imports/dependencies on those route files.
3. Delete the route files and remove emptied directories.
4. Re-run TypeScript and CI-equivalent test command.
5. Record QA evidence and open CTO review PR.

## Validation Plan

- `npx tsc --noEmit`
- `npm test -- --exclude src/test/tenants-status-route.test.ts`
- `rg` verification scans for removed route usages/imports

## Acceptance Criteria

- No remaining `api/chat*`, `api/content/*`, `api/approvals/*` route files in repo.
- No runtime frontend calls to removed route groups.
- No inngest/jobs depending on removed route groups.
- Typecheck and CI-equivalent tests pass.
- Docs reflect incremental prune status and next-prune constraints (`competitors` still active).
