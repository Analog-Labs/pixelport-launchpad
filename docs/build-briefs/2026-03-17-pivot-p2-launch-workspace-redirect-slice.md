# PixelPort Pivot P2 — Launch Workspace Redirect Consumer Slice

**Title:** Consume runtime handoff on onboarding launch and redirect to tenant Paperclip workspace  
**Date:** 2026-03-17  
**Owner:** Codex  
**Build Size:** `medium`  
**Branch:** `codex/p2-paperclip-launch-redirect`

---

## Goal

Make onboarding Launch consume the existing `/api/runtime/handoff` response contract and redirect the user directly to the tenant Paperclip workspace URL.

## Scope

- In scope: make `handleLaunch()` call `POST /api/runtime/handoff` as a blocking prerequisite.
- In scope: validate `paperclip_runtime_url` as a safe `http/https` URL before redirect.
- In scope: persist `launch_completed_at` only after successful handoff and successful onboarding save.
- In scope: update launch-step UX copy from dashboard destination to workspace destination.
- In scope: run local checks and independent QA sub-agent review.

## Non-Goals

- Not in scope: backend handoff contract/schema changes.
- Not in scope: changes to Paperclip template defaults (`agents.md`, `heartbeat.md`).
- Not in scope: replacing existing post-auth dashboard redirect behavior for already-launched tenants.
- Not in scope: production merge/deploy in this implementation slice.

## Implementation Plan

1. Add runtime handoff response typing in onboarding page.
2. Add URL resolver/validator for workspace URL returned by handoff.
3. Reorder launch flow to:
   - call handoff
   - validate workspace URL
   - persist onboarding + `launch_completed_at`
   - redirect to workspace URL
4. Update Step 4 launch copy and CTA text for workspace framing.
5. Record QA evidence and update active planning/session docs.

## Validation Plan

- `npx tsc --noEmit`
- `npx vitest run src/test/runtime-handoff-route.test.ts`
- `npx vitest run src/test/onboarding-bootstrap.test.ts`
- independent QA sub-agent read-only review against changed files

## Acceptance Criteria

- Launch blocks when handoff fails and surfaces a user-facing error.
- Launch blocks when `paperclip_runtime_url` is missing/malformed/non-http(s).
- `launch_completed_at` is persisted only on the successful launch path.
- Successful launch redirects to tenant workspace via `window.location.assign(...)`.
- Updated launch copy clearly states workspace redirect destination.
