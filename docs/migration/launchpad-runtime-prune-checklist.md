# Launchpad Runtime Prune Checklist (Track C4)

## Purpose
Define what `pixelport-launchpad` keeps vs retires after Paperclip cutover, without breaking onboarding/provisioning.

## Scope
- Repo: `/Users/sanchal/pixelport-launchpad`
- Route surface inventoried: `api/`
- Operating model: launchpad = marketing, billing, thin provisioning bridge

## Route Group Classification

### KEEP NOW (thin bridge responsibilities)
- `api/tenants/*`
  - Why: onboarding identity + provisioning status + onboarding payload persistence are still active launchpad duties.
  - Includes: `index`, `me`, `status`, `onboarding`, `bootstrap`, `scan`.
- `api/inngest/index.ts`
  - Why: event registration/ingestion endpoint for launchpad-owned provisioning workflows.
- `api/inngest/functions/provision-tenant.ts`
  - Why: core thin-bridge provisioning function until runtime ownership is fully moved.
- `api/lib/*` modules used by tenant provisioning and auth/isolation
  - Why: required dependencies for active keep-now endpoints.
- `api/debug/env-check.ts`, `api/debug/test-provision.ts`, `api/debug/do-status.ts` (internal use only)
  - Why: operational diagnostics needed during pivot rollout.

### DEPRECATE AFTER CUTOVER (remove from active path once Paperclip runtime is authoritative)
- `api/agent/*`
  - Why: legacy runtime sync/control endpoints for task/vault/workspace-event projection.
- `api/tasks/*`
  - Why: legacy dashboard task APIs; runtime task system should be Paperclip-primary.
- `api/vault/*`
  - Why: legacy vault APIs tied to launchpad runtime model.
- `api/commands/*`
  - Why: command orchestration for legacy runtime bridge.
- `api/content/*`, `api/approvals/*`, `api/agents/*`, `api/competitors/*`
  - Why: legacy dashboard domain APIs not part of thin provisioning bridge target state.
- `api/chat.ts`, `api/chat/history.ts`
  - Why: known non-primary chat bridge path and legacy dashboard dependency.
- `api/settings/*`
  - Why: launchpad runtime settings surface should be retired once runtime settings live in Paperclip.
- `api/connections/*` and `api/inngest/functions/{activate-integration.ts,activate-slack.ts}`
  - Why: integration activation and runtime wiring move to Paperclip runtime plane.
- `api/debug/slack-status.ts`
  - Why: specific to legacy Slack/runtime activation path.

### ARCHIVE HISTORICAL ONLY (do not keep in active operating path)
- Old phase implementation docs/checklists under `docs/archive/**` tied to launchpad-primary runtime.
- Retired route groups after deletion should remain discoverable via git history/tags only.

## Dependency and Deletion Order Constraints

1. Keep all `KEEP NOW` routes until Paperclip cutover acceptance criteria pass in production.
2. Move frontend callers first:
   - replace dashboard calls that hit `api/agent/*`, `api/tasks/*`, `api/vault/*`, `api/commands/*`, `api/connections/*`.
3. Remove runtime activation dependencies before deleting routes:
   - confirm no active jobs/events require `activate-integration` or `activate-slack`.
4. Decommission by group in this order:
   1. `chat`, `content`, `approvals`, `competitors`
   2. `commands`, `tasks`, `vault`, `agent`, `agents`
   3. `connections` + integration activation functions
   4. `settings` + legacy debug endpoints (`slack-status`)
5. Delete dead `api/lib/*` modules only after route deletion and reference scan confirms no imports.

## Verification Checklist Before Any Route Deletion

- [ ] Frontend no longer calls the route group (`rg "/api/<group>" src` returns no runtime usages).
- [ ] Route group has no test imports (`rg "api/<group>" src/test api` reviewed and updated).
- [ ] Inngest functions/jobs do not depend on deleted routes.
- [ ] Onboarding still works end-to-end:
  - Company submit creates tenant
  - Provision step reaches `ready`
  - Task/Launch flow persists onboarding data
- [ ] Tenant provisioning canary passes on a fresh tenant after deletions.
- [ ] Production smoke confirms dashboard truthfulness on retained surfaces.
- [ ] `npx tsc --noEmit` and targeted tests pass after each deletion batch.

## Execution Notes
- Pruning is incremental, not a single big-bang removal.
- Every deletion batch should ship with:
  - explicit branch-scoped diff
  - CTO review
  - same-session smoke evidence.

## Batch Progress Snapshot (2026-03-17)

### Batch 1 (chat/content/approvals) — Completed on implementation branch
- Removed route files:
  - `api/chat.ts`
  - `api/chat/history.ts`
  - `api/content/index.ts`
  - `api/content/[id].ts`
  - `api/approvals/index.ts`
  - `api/approvals/[id]/decide.ts`
- Removed now-empty directories:
  - `api/chat/`
  - `api/content/`
  - `api/approvals/`
- Validation completed:
  - `npx tsc --noEmit` (`pass`)
  - `npm test -- --exclude src/test/tenants-status-route.test.ts` (`pass`)
  - dependency scans show no active frontend/inngest/test dependencies on removed groups

### Deferred from Batch 1
- `api/competitors/*` deletion was deferred in batch 1 because dashboard still called `GET /api/competitors`.

### Batch 2 (dashboard/api legacy removal) — Completed on implementation branch
- Branch: `codex/p3-c4-prune-batch2-dashboard-runtime-legacy`
- Removed vestigial dashboard pages/routes that depended on deleted APIs:
  - `src/pages/dashboard/Content.tsx`
  - `src/pages/dashboard/CalendarPage.tsx`
  - `src/pages/dashboard/Vault.tsx`
  - `src/pages/dashboard/Competitors.tsx`
  - plus route/nav wiring cleanup in `src/App.tsx` and `src/components/dashboard/AppSidebar.tsx`
- Removed route groups:
  - `api/commands/*`
  - `api/tasks/*`
  - `api/vault/*`
  - `api/agent/*`
  - `api/agents/*`
  - `api/competitors/*`
- Removed now-empty route directories:
  - `api/commands/`
  - `api/tasks/`
  - `api/vault/`
  - `api/agent/`
  - `api/agents/`
  - `api/competitors/`
- Validation completed:
  - `npx tsc --noEmit` (`pass`)
  - `npm test -- --exclude src/test/tenants-status-route.test.ts` (`pass`)
  - dependency scans show no active frontend runtime usage of deleted groups
- Additive alignment:
  - bootstrap/workspace contract messaging moved to workspace-first guidance (no `/api/agent/*` instructions)

### Batch 3 (chat/settings legacy removal) — Completed on implementation branch
- Branch: `codex/p3-c4-prune-batch3-chat-settings-legacy`
- Removed vestigial dashboard surfaces:
  - `src/pages/dashboard/Chat.tsx`
  - `src/components/dashboard/ChatWidget.tsx`
  - `src/contexts/ChatContext.tsx`
  - `src/pages/dashboard/Performance.tsx`
  - `src/pages/dashboard/Settings.tsx`
  - plus route/nav/provider wiring cleanup in `src/App.tsx`, `src/pages/Dashboard.tsx`, and `src/components/dashboard/AppSidebar.tsx`
- Removed route groups/endpoints:
  - `api/settings/*`
  - `api/debug/slack-status.ts`
- Validation completed:
  - `npx tsc --noEmit` (`pass`)
  - `npm test` (`pass`, `tenants-status-route.test.ts` included)
  - `npm run build` (`pass`)
- Contract alignment:
  - `src/test/tenants-status-route.test.ts` updated to assert current payload fields (`contract_version`, `task_step_unlocked`)

### Next Deferred Group(s)
- `api/connections/*` + integration activation functions
