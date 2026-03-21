# Paperclip API Contract (T1 Dashboard Audit)

Date: 2026-03-21  
Owner: Developer Agent (Codex)  
Status: Ready for T2 proxy build, with explicit gaps below

## Scope and sources

This document maps the Paperclip API surface needed for the PixelPort dashboard V1 plan in:

- `docs/designs/v1-full-wedge.md`
- `docs/transition-plan-2026-03-19.md` (Phase T1)
- `docs/decision-brief-2026-03-19.md` (Decision 3)

Paperclip route source-of-truth audited at pinned runtime tag:

- Repo: local clone of `paperclip` (Analog-Labs/paperclip)
- Tag: `v2026.318.0`
- Commit: `78c714c29ac9aa1a8ca85aebe48f7f1ee7e57e4d`

Runtime smoke validation was executed locally against Paperclip API (`http://127.0.0.1:3101/api`) on local repo commit `2f04796f44a0a988ae3c5e54c8fce4c8fc109b4b` to verify real request/response behavior for key endpoints.

## Finishing criteria and result

T1 finishing criteria used for this audit:

1. Enumerate endpoint surface required by V1 dashboard views.
2. Confirm endpoints exist in pinned Paperclip route source.
3. Verify request/response behavior for critical endpoints by direct API calls.
4. Document auth assumptions for T2 proxy.
5. Capture concrete gaps and blockers.

Result: criteria 1-5 completed. One runtime bug and multiple product-surface gaps identified.

## Auth and tenancy contract (for T2 proxy)

Paperclip API contract assumptions:

- Base path is `/api/*`.
- Company-scoped routes require `:companyId` in path for most list/create endpoints.
- Auth modes:
  - Local trusted mode: no explicit bearer required (dev only).
  - Authenticated mode: board session cookie and/or bearer token.
  - Agent mode: bearer token (`PAPERCLIP_API_KEY` JWT or API key).
- Mutating issue operations from agent heartbeats require `X-Paperclip-Run-Id` for traceability.

Proxy contract for PixelPort dashboard:

- Dashboard auth: Clerk (already in launchpad).
- Proxy auth to Paperclip: handoff/session bridge (Decision Brief + Transition Plan T2).
- Tenant boundary: proxy must resolve tenant ownership before forwarding any route.

## Endpoint matrix by dashboard surface

### Must-have surfaces

| Dashboard surface | Endpoint(s) | Purpose |
|---|---|---|
| Task board / Kanban | `GET /api/companies/:companyId/issues` | List tasks by status/assignee/search/label |
| Task board / Kanban | `GET /api/issues/:id` | Task detail, ancestors, project/goal context |
| Task board / Kanban | `PATCH /api/issues/:id` | Status/assignment updates, inline comment in same request |
| Task board / Kanban | `POST /api/issues/:id/checkout` | Atomic claim + transition to `in_progress` |
| Task board / Kanban | `POST /api/issues/:id/release` | Release ownership back to `todo` |
| Task detail thread | `GET /api/issues/:id/comments` | Comment history |
| Task detail thread | `POST /api/issues/:id/comments` | Add comment, optional `reopen` and `interrupt` flags |
| Task detail thread | `GET /api/issues/:id/comments/:commentId` | Fetch exact wake comment |
| Task context preload | `GET /api/issues/:id/heartbeat-context` | Compact context for issue + ancestors + comment cursor |
| Agent status cards | `GET /api/companies/:companyId/agents` | Agent list with status/budget/last heartbeat |
| Agent status cards | `GET /api/companies/:companyId/live-runs` | Running/queued runs for live activity UX |
| Agent status cards | `GET /api/issues/:issueId/active-run` | Current run attached to a task |
| Run history | `GET /api/companies/:companyId/heartbeat-runs` | Company run list (`agentId`, `limit`) |
| Run history | `GET /api/heartbeat-runs/:runId` | Run detail including usage/result/log refs |
| Run history | `GET /api/heartbeat-runs/:runId/events` | Poll incremental run events (`afterSeq`, `limit`) |
| Run history | `GET /api/heartbeat-runs/:runId/log` | Fetch run log content chunk (`offset`, `limitBytes`) |
| Run history | `GET /api/issues/:id/runs` | Runs associated to a specific issue |
| Approval queue | `GET /api/companies/:companyId/approvals` | List approvals (`status=pending` for queue) |
| Approval queue | `GET /api/approvals/:id` | Approval detail |
| Approval queue | `GET /api/approvals/:id/issues` | Linked issues for context |
| Approval queue actions | `POST /api/approvals/:id/approve` | Approve |
| Approval queue actions | `POST /api/approvals/:id/reject` | Reject |
| Approval queue actions | `POST /api/approvals/:id/request-revision` | Request revision |
| Approval queue actions | `POST /api/approvals/:id/resubmit` | Resubmit revised payload |
| Approval discussion | `GET/POST /api/approvals/:id/comments` | Approval thread |
| Cost summary | `GET /api/companies/:companyId/costs/summary` | Current spend vs budget |
| Aggregate home data | `GET /api/companies/:companyId/dashboard` | Single-call summary for agents/tasks/costs/pending approvals |
| Sidebar action badges | `GET /api/companies/:companyId/sidebar-badges` | Inbox/approvals/failed runs/join requests counts |

### Should-have surfaces

| Surface | Endpoint(s) | Notes |
|---|---|---|
| Chat polling (V1) | `GET /api/issues/:id/comments`, `POST /api/issues/:id/comments`, `GET /api/issues/:id/live-runs`, `GET /api/heartbeat-runs/:runId/events` | Works as task-thread chat + run output polling |
| Lightweight agent wake | `POST /api/agents/:id/wakeup` or `POST /api/agents/:id/heartbeat/invoke` | Needed if dashboard provides manual "nudge agent" UX |
| Task labeling/filter UX | `GET/POST /api/companies/:companyId/labels`, `DELETE /api/labels/:labelId` | Optional for richer Kanban filters |
| Issue attachments | `GET /api/issues/:id/attachments`, `POST /api/companies/:companyId/issues/:issueId/attachments`, `GET /api/attachments/:attachmentId/content`, `DELETE /api/attachments/:attachmentId` | Useful for media/context artifacts |
| Issue documents | `GET/PUT /api/issues/:id/documents/:key` (+ list/revisions/delete) | Useful for issue-scoped plans/notes |

### Nice-to-have surfaces

| Surface | Endpoint(s) | Notes |
|---|---|---|
| Org chart | `GET /api/companies/:companyId/org` | Listed as nice-to-have in Decision 3 |
| Budget controls | `PATCH /api/companies/:companyId/budgets`, `PATCH /api/agents/:agentId/budgets` | Admin controls |
| Deeper cost analytics | `GET /api/companies/:companyId/costs/by-agent`, `.../by-project`, other cost slices in `costs.ts` | Can power advanced finance views later |
| Scheduler visibility | `GET /api/instance/scheduler-heartbeats` | Board-level operational view |

## Request/response shape notes (critical)

### `GET /api/companies/:companyId/issues`

Supported query params in route implementation:

- `status` (comma-separated)
- `assigneeAgentId`
- `assigneeUserId` (supports `me` for board user context)
- `touchedByUserId` (supports `me`)
- `unreadForUserId` (supports `me`)
- `projectId`
- `parentId`
- `labelId`
- `q`

### `PATCH /api/issues/:id`

Supports (partial):

- `title`, `description`, `status`, `priority`
- `assigneeAgentId`, `assigneeUserId`
- `projectId`, `goalId`, `parentId`
- `billingCode`
- `hiddenAt`
- `comment` (adds comment in same mutation)

### `GET /api/issues/:id/comments`

Supports:

- `after` or `afterCommentId`
- `order` (`asc` or `desc`)
- `limit`

Known bug discovered in runtime smoke: when `after` points to an existing comment ID, endpoint returned `500` instead of `[]`/delta payload.

### `GET /api/companies/:companyId/heartbeat-runs`

Supports:

- `agentId`
- `limit` (server clamps range)

### `GET /api/heartbeat-runs/:runId/events`

Supports:

- `afterSeq`
- `limit`

## Runtime smoke evidence (local)

Validated as `200`/expected behavior in local smoke:

- `GET /api/health`
- `POST /api/companies`
- `POST /api/companies/:companyId/agents`
- `POST /api/companies/:companyId/issues`
- `GET /api/companies/:companyId/issues`
- `POST /api/issues/:id/checkout`
- `POST /api/issues/:id/comments`
- `GET /api/issues/:id/heartbeat-context`
- `GET /api/companies/:companyId/agents`
- `POST /api/agents/:id/heartbeat/invoke`
- `GET /api/heartbeat-runs/:runId`
- `GET /api/heartbeat-runs/:runId/events`
- `GET /api/heartbeat-runs/:runId/log`
- `GET /api/issues/:id/runs`
- `GET /api/companies/:companyId/approvals?status=pending`
- `POST /api/approvals/:id/approve`
- `GET /api/companies/:companyId/costs/summary`
- `GET /api/companies/:companyId/dashboard`
- `GET /api/companies/:companyId/sidebar-badges`

Observed runtime failure:

- `GET /api/issues/:id/comments?after=<existingCommentId>&order=asc` -> `500 Internal server error`
- Server error signature: `ERR_INVALID_ARG_TYPE` in Postgres parameter binding, coming from `server/src/services/issues.ts` delta query path.

## Gaps and blockers for dashboard plan

1. No workspace-file API for vault/SOUL/MEMORY paths  
Decision 3 says "workspace memory (SOUL.md, MEMORY.md)" should be surfaced, but current API only exposes issue-scoped documents, not arbitrary workspace file read/write by path.

2. Approval type coverage is too narrow for content-approval product UX  
Current approval types are `hire_agent` and `approve_ceo_strategy` only. V1 wedge approval queue for marketing content likely needs new approval type(s) and payload schema conventions.

3. Incremental comment polling bug blocks robust REST chat polling  
The `after` cursor mode for issue comments throws `500` when anchor exists. This affects V1 chat polling strategy unless fixed or worked around.

4. No first-class run SSE/WebSocket stream endpoint for dashboard  
Current run stream model is polling (`events` + `log`). This is acceptable for V1 plan, but explicit as a constraint.

5. Canary runtime validation still required before T2 sign-off  
This audit validated locally and against pinned route source. Final canary tenant verification (auth, headers, real data shape under proxy path) should run before shipping T2.

## Recommended T2 proxy starter allowlist

Initial proxy allowlist to unblock T3 core views quickly:

- `/api/companies/:companyId/dashboard`
- `/api/companies/:companyId/sidebar-badges`
- `/api/companies/:companyId/agents`
- `/api/companies/:companyId/issues`
- `/api/issues/:id`
- `/api/issues/:id/heartbeat-context`
- `/api/issues/:id/comments`
- `/api/issues/:id/comments/:commentId`
- `/api/issues/:id/checkout`
- `/api/issues/:id/release`
- `PATCH /api/issues/:id`
- `/api/companies/:companyId/heartbeat-runs`
- `/api/heartbeat-runs/:runId`
- `/api/heartbeat-runs/:runId/events`
- `/api/heartbeat-runs/:runId/log`
- `/api/issues/:id/runs`
- `/api/issues/:issueId/active-run`
- `/api/issues/:issueId/live-runs`
- `/api/companies/:companyId/approvals`
- `/api/approvals/:id`
- `/api/approvals/:id/issues`
- `/api/approvals/:id/approve`
- `/api/approvals/:id/reject`
- `/api/approvals/:id/request-revision`
- `/api/approvals/:id/resubmit`
- `/api/approvals/:id/comments`
- `/api/companies/:companyId/costs/summary`

## Open decisions before T2/T3 implementation

1. Content approval modeling:
Should marketing content approvals use Paperclip approvals with new approval types, or use issue status + custom payload in Supabase while keeping Paperclip approvals for governance-only flows?

2. Workspace vault data source:
Do we add workspace-file API endpoints in Paperclip, or treat Supabase as source-of-truth for V1 brand voice and memory UI?

3. Chat architecture fallback:
If incremental comment polling bug is not fixed in time, do we use full comment list polling with client diffing for V1?

## Appendix A: Full `/api/companies/:companyId/*` inventory (pinned tag)

Enumerated from `v2026.318.0` route source with `git grep` on server route handlers.

- `GET /api/companies/:companyId/join-requests`
- `GET /api/companies/:companyId/members`
- `GET /api/companies/:companyId/activity`
- `POST /api/companies/:companyId/activity`
- `GET /api/companies/:companyId/adapters/:type/models`
- `GET /api/companies/:companyId/agents`
- `GET /api/companies/:companyId/org`
- `GET /api/companies/:companyId/agent-configurations`
- `POST /api/companies/:companyId/agent-hires`
- `POST /api/companies/:companyId/agents`
- `GET /api/companies/:companyId/heartbeat-runs`
- `GET /api/companies/:companyId/live-runs`
- `GET /api/companies/:companyId/approvals`
- `POST /api/companies/:companyId/approvals`
- `POST /api/companies/:companyId/assets/images`
- `POST /api/companies/:companyId/logo`
- `POST /api/companies/:companyId/cost-events`
- `POST /api/companies/:companyId/finance-events`
- `GET /api/companies/:companyId/costs/summary`
- `GET /api/companies/:companyId/costs/by-agent`
- `GET /api/companies/:companyId/costs/by-agent-model`
- `GET /api/companies/:companyId/costs/by-provider`
- `GET /api/companies/:companyId/costs/by-biller`
- `GET /api/companies/:companyId/costs/finance-summary`
- `GET /api/companies/:companyId/costs/finance-by-biller`
- `GET /api/companies/:companyId/costs/finance-by-kind`
- `GET /api/companies/:companyId/costs/finance-events`
- `GET /api/companies/:companyId/costs/window-spend`
- `GET /api/companies/:companyId/costs/quota-windows`
- `GET /api/companies/:companyId/budgets/overview`
- `GET /api/companies/:companyId/costs/by-project`
- `PATCH /api/companies/:companyId/budgets`
- `GET /api/companies/:companyId/dashboard`
- `GET /api/companies/:companyId/execution-workspaces`
- `GET /api/companies/:companyId/goals`
- `POST /api/companies/:companyId/goals`
- `GET /api/companies/:companyId/issues`
- `GET /api/companies/:companyId/labels`
- `POST /api/companies/:companyId/labels`
- `POST /api/companies/:companyId/issues`
- `POST /api/companies/:companyId/issues/:issueId/attachments`
- `GET /api/companies/:companyId/projects`
- `POST /api/companies/:companyId/projects`
- `GET /api/companies/:companyId/secret-providers`
- `GET /api/companies/:companyId/secrets`
- `POST /api/companies/:companyId/secrets`
- `GET /api/companies/:companyId/sidebar-badges`
