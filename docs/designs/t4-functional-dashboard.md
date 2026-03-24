# T4 — Functional Dashboard: Actionability + Visibility + Polish

## Context

T3 shipped 5 dashboard views (Home, Agents, Approvals, Run History, Tasks) but they're largely read-only. After a full scrub of the Paperclip dashboard (running locally at :3100), we identified critical gaps: no way to create tasks, no way to assign or invoke agents, clicking an agent shows nothing useful, no analytics, no activity feed, no cost breakdown. The Paperclip dashboard already surfaces all this data — our proxy and API contract support it — we just don't expose it.

T4 redefines "Real-time & Polish" as "Functional Dashboard" — making every view actionable and informative so a marketing lead can actually use PixelPort to manage their Chief of Staff productively.

**Source of truth:** `docs/designs/v1-full-wedge.md`
**Design system:** `DESIGN.md` (Industrial-Luxe, Satoshi font, amber-only accent)
**API contract:** `docs/paperclip-api-contract.md`

---

## Scope: Tier 1 (Productivity Loop) + Tier 2 (Visibility) + Agent Detail

### Tier 1 — The Productivity Loop

**1. Create Task Dialog**
- "New Task" button on Tasks page header + Home quick actions
- Dialog/modal: title (required), description (optional), priority dropdown (low/medium/high/critical), assign to agent dropdown (populated from agents query)
- On submit: `POST /api/companies/:companyId/issues` with `{ title, description, priority, assigneeAgentId }`
- Optimistic: add task to kanban, invalidate issues + sidebar-badges queries
- Files: new `src/components/dashboard/CreateTaskDialog.tsx`, modify `src/pages/dashboard/Tasks.tsx`, modify `src/pages/dashboard/Home.tsx`

**2. Task Detail Enhancement — Properties Panel + Agent Invoke**
- Replace the current minimal slide-out with a richer detail view (inspired by Paperclip's issue detail)
- Add Properties sidebar panel: Status (editable dropdown), Priority (editable dropdown), Assignee (editable — agent picker), Project (read-only for now), Created by, Created date, Updated date
- Add tabs: Comments (existing), Activity (from issue-level activity if available)
- Agent invoke button in comment area: "Ask [Agent Name]" button that posts a comment with `{ body, interrupt: true }` to wake the agent on this task
- Files: enhance `TaskDetailPanel` in `src/pages/dashboard/Tasks.tsx` (or extract to `src/components/dashboard/TaskDetailPanel.tsx`)

**3. Agent Detail Page**
- Clicking an agent name navigates to `/dashboard/agents/:agentId` (new route)
- Agent header: name, role, status badge, action buttons (Run Now, Assign Task, Open Workspace)
- "Run Now" button: `POST /api/agents/:id/wakeup` — invokes agent heartbeat (disable button while mutation.isPending to prevent duplicate invocations)
- Latest Run card: status badge, run ID, trigger type, timestamp — from `GET /companies/:companyId/heartbeat-runs?agentId=X&limit=1`
- Recent Issues list: tasks assigned to this agent — from `GET /companies/:companyId/issues?assigneeAgentId=X`
- Cost summary: from `GET /companies/:companyId/costs/by-agent` (filter client-side by agentId)
- Data sources: `GET /agents/:id` for metadata (new `usePaperclipAgentDetail` hook); reuse existing `usePaperclipAgentRuns(agentId, limit)` from `src/hooks/usePaperclipAgents.ts` for runs (fix: include limit in query key); new `usePaperclipAgentIssues(agentId)` hook in `usePaperclipAgentDetail.ts` for agent-specific tasks; costs from `usePaperclipCostsByAgent()` filtered client-side
- Files: new `src/pages/dashboard/AgentDetail.tsx`, new `src/hooks/usePaperclipAgentDetail.ts`

**4. Summary Stats on Home**
- Replace the current weak "Weekly cost" / "Current focus" card with a 4-card stats row:
  - Agents Enabled (X running, Y paused, Z errors)
  - Tasks In Progress (X open, Y blocked)
  - Month Spend ($X.XX / budget or unlimited)
  - Pending Approvals (X awaiting review)
- Data source: existing `/companies/:companyId/dashboard` API (already fetched via `usePaperclipDashboard`)
- Enhance `DashboardSummary` type to include the nested agent/task/cost breakdowns the API already returns
- Files: modify `src/pages/dashboard/Home.tsx`, update `src/lib/paperclip-types.ts`, update `src/lib/paperclip-normalize.ts`

**5. Recent Tasks on Home**
- Below stats row, add "Recent Tasks" section showing last 5 tasks with: identifier (VID-5), title, assignee, status badge, timestamp
- Reuse data from existing `usePaperclipTasks()` (sort by updatedAt, take 5)
- "See All →" links to /dashboard/tasks
- Files: modify `src/pages/dashboard/Home.tsx`

### Tier 2 — Visibility

**6. Inbox View**
- New page at `/dashboard/inbox`
- Tabs: Recent / Unread / All
- Each row: priority arrow, status dot, issue identifier, title, last action ("commented 1w ago")
- Data source: `GET /companies/:companyId/issues?unreadForUserId=me` for Unread tab, all issues sorted by updatedAt for Recent
- Sidebar nav item with badge count (from sidebar-badges `inbox` field)
- Files: new `src/pages/dashboard/Inbox.tsx`, modify `src/components/dashboard/AppSidebar.tsx`, modify `src/App.tsx`

**7. Activity Feed on Home**
- "Recent Activity" section on Home below Recent Tasks
- Timeline of actions: "Board created VID-5", "Pixie completed VID-2", "Board approved strategy"
- Data source: `GET /companies/:companyId/activity?limit=8`
- Files: modify `src/pages/dashboard/Home.tsx`, new hook `src/hooks/usePaperclipActivity.ts`

**8. Costs Page**
- New page at `/dashboard/costs`
- Header: total month spend, budget utilization bar
- Table: agent name, status, cost (cents), input tokens, output tokens
- Data source: `GET /companies/:companyId/costs/by-agent`
- Sidebar nav item (no badge — informational)
- Files: new `src/pages/dashboard/Costs.tsx`, new `src/hooks/usePaperclipCosts.ts`

---

## Proxy Allowlist Additions

Add to `api/lib/paperclip-proxy-allowlist.ts`:

```
// Task creation
{ proxyPattern: 'companies/issues', methods: ['GET', 'POST'], companyScoped: true }
// (GET already exists, add POST)

// Agent wakeup (single endpoint — do not also add heartbeat/invoke to avoid overlap)
{ proxyPattern: 'agents/:id/wakeup', methods: ['POST'], companyScoped: false }

// Activity feed
{ proxyPattern: 'companies/activity', methods: ['GET'], companyScoped: true }

// Cost breakdown
{ proxyPattern: 'companies/costs/by-agent', methods: ['GET'], companyScoped: true }

// Agent detail
{ proxyPattern: 'agents/:id', methods: ['GET'], companyScoped: false }

// Goals and Projects deferred — only proxy what you ship
```

Also update the existing `companies/issues` entry to include `POST` method.

---

## New Types Needed (paperclip-types.ts)

```typescript
// Enhanced DashboardSummary (API already returns this shape)
export interface DashboardSummary {
  agents: { active: number; running: number; paused: number; error: number };
  tasks: { open: number; inProgress: number; blocked: number; done: number };
  costs: { monthSpendCents: number; monthBudgetCents: number; monthUtilizationPercent: number };
  pendingApprovals: number;
}

// Activity entry
export interface ActivityEntry {
  id: string;
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  agentId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// Cost by agent
export interface AgentCost {
  agentId: string;
  agentName: string;
  agentStatus: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

// Create task request
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assigneeAgentId?: string;
}
```

---

## New Hooks

| Hook | File | Pattern |
|------|------|---------|
| `useCreateTask()` | `usePaperclipTasks.ts` | `useMutation` → POST companies/issues, invalidate issues + badges |
| `useAssignTask()` | `usePaperclipTasks.ts` | `useMutation` → PATCH issues/:id { assigneeAgentId }, invalidate issues list + issue detail + sidebar-badges (3-phase: optimistic → rollback → invalidate) |
| `useUpdateTaskPriority()` | `usePaperclipTasks.ts` | `useMutation` → PATCH issues/:id { priority }, invalidate issues list + issue detail + sidebar-badges (3-phase: optimistic → rollback → invalidate) |
| `useWakeAgent()` | new `usePaperclipAgentDetail.ts` | `useMutation` → POST agents/:id/wakeup |
| `usePaperclipAgentDetail(id)` | new `usePaperclipAgentDetail.ts` | `useQuery` → GET agents/:id |
| `usePaperclipAgentIssues(agentId)` | new `usePaperclipAgentDetail.ts` | `useQuery` → GET companies/issues?assigneeAgentId={agentId} |
| `usePaperclipActivity()` | new `usePaperclipActivity.ts` | `useQuery` → GET companies/activity?limit=8 |
| `usePaperclipCostsByAgent()` | new `usePaperclipCosts.ts` | `useQuery` → GET companies/costs/by-agent |

---

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| `CreateTaskDialog` | `src/components/dashboard/CreateTaskDialog.tsx` | Modal for creating new tasks |
| `TaskDetailPanel` | `src/components/dashboard/TaskDetailPanel.tsx` | Enhanced task detail with properties sidebar |
| `AgentInvokeButton` | `src/components/dashboard/AgentInvokeButton.tsx` | "Ask [Agent]" / "Run Now" button with loading state |
| `StatCard` | `src/components/dashboard/StatCard.tsx` | Reusable stat card (number + label + subtitle) |
| `ActivityTimeline` | `src/components/dashboard/ActivityTimeline.tsx` | Activity feed timeline entries |
| `StatusBadge` | `src/components/dashboard/StatusBadge.tsx` | Reusable status badge (done/backlog/in_progress etc) |

---

## Route Changes (App.tsx)

```tsx
<Route path="inbox" element={<Inbox />} />
<Route path="agents/:agentId" element={<AgentDetail />} />
<Route path="costs" element={<Costs />} />
```

## Sidebar Changes (AppSidebar.tsx)

```typescript
const primaryNav = [
  { title: 'Home', url: '/dashboard', icon: LayoutDashboard, end: true, badge: null },
  { title: 'Inbox', url: '/dashboard/inbox', icon: Inbox, badge: 'inbox' as const },
  { title: 'Approvals', url: '/dashboard/approvals', icon: CheckSquare, badge: 'approvals' as const },
  { title: 'Tasks', url: '/dashboard/tasks', icon: ListTodo, badge: null },
  { title: 'Agents', url: '/dashboard/agents', icon: Bot, badge: null },
  { title: 'Runs', url: '/dashboard/runs', icon: Clock, badge: null },
  { title: 'Costs', url: '/dashboard/costs', icon: DollarSign, badge: null },
  { title: 'Connections', url: '/dashboard/connections', icon: Plug, badge: null },
];
```

---

## UX Polish (applies to all views)

- All new views follow DESIGN.md: Satoshi font, amber accent, dark bg, grain texture
- Skeleton loading states for every new section (amber shimmer pattern)
- Toast notifications on all mutations (success/error)
- 44px+ touch targets on mobile for all action buttons
- Keyboard accessibility: Enter/Space on buttons, Escape to close panels
- Error boundaries per-section (not page-level crashes)

## Design Review Additions

### Home Page Layout (Pass 1)
- Remove existing Quick Action buttons — stats row replaces them (clickable cards → nav)
- Add "New Task" button inline with "Recent Tasks" section header
- Stats row: 4 cards in `grid grid-cols-2 sm:grid-cols-4 gap-4`
- Hierarchy: approval banner → stats → recent tasks → activity → agents → intelligence brief

### Interaction State Table (Pass 2)

| Feature | Loading | Empty | Error | Success |
|---------|---------|-------|-------|---------|
| Home Stats | 4 skeleton cards (amber shimmer) | Shows 0s | "Dashboard offline" + retry | 4 stat cards |
| Recent Tasks | 3 skeleton rows | "No tasks yet — create your first" + New Task btn | Inherits from tasks query | 5 task rows |
| Activity Feed | 4 skeleton rows | "No activity yet — your Chief will start soon" | "Activity unavailable" + retry | Timeline entries |
| Create Task | Submit: "Creating..." | N/A (starts empty) | Toast: "Failed to create task" | Toast: "Task created" + panel closes |
| Agent Detail | Header + stat skeletons | Runs: "No runs yet — click Run Now"; Issues: "No tasks assigned" | "Agent not found" or "Failed to load" | Full profile |
| Inbox | List skeleton rows | "All caught up — no updates" (checkmark icon) | "Inbox unavailable" + retry | Issue rows |
| Costs | Table skeleton | "No cost data yet — your agent hasn't run yet" | "Costs unavailable" + retry | Agent cost table |
| Agent Wake | Button: spinner + "Running..." | N/A | Toast: "Failed to wake agent" | Toast: "Agent nudged — check runs" |

### Component Design Specs (Pass 5)

**StatCard:** `rounded-xl border border-border bg-card p-5`, number in `font-satoshi font-extrabold text-2xl`, label in `font-mono text-[11px] uppercase tracking-widest text-muted-foreground`, subtitle in `text-sm text-muted-foreground`. Clickable: `hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]` + cursor-pointer.

**StatusBadge:** `rounded-full border px-2.5 py-0.5 text-xs font-mono`. Colors: done=`border-emerald-500/30 bg-emerald-500/10 text-emerald-400`, in_progress=`border-amber-400/30 bg-amber-500/10 text-amber-400`, backlog/todo=`border-border bg-zinc-800 text-muted-foreground`.

**ActivityTimeline:** Each entry: `text-sm text-foreground` for action, `font-mono text-[11px] text-muted-foreground/60` for timestamp. No decorative timeline line.

**Create Task:** Right-side slide-out panel (same as TaskDetailPanel pattern, 400px max-width). Form fields vertically stacked. "Create" button with shimmer-btn class + "Cancel" ghost button.

### Responsive Strategy (Pass 6)
- **Home stats:** `grid-cols-2` on mobile (< 640px), `grid-cols-4` on desktop
- **Inbox:** Full-width rows, 44px+ touch targets. Full mobile treatment.
- **Agent Detail:** Desktop-first. Mobile gets "Best viewed on desktop" banner.
- **Costs:** Desktop-first. Table scrolls horizontally on mobile.

---

## Implementation Order

1. **Proxy allowlist expansion + types** — unblock everything else (~15 min)
2. **Enhanced Home page** — stats row + recent tasks + activity feed (~45 min)
3. **Create Task dialog + hook** — the #1 missing action (~30 min)
4. **Task Detail enhancement** — properties panel + agent invoke (~45 min)
5. **Agent Detail page** — clicking agent shows rich profile (~45 min)
6. **Inbox page** — notification center (~30 min)
7. **Costs page** — spend breakdown (~20 min)
8. **Sidebar updates + routing** — wire everything together (~15 min)
9. **Tests** — unit tests for new hooks, proxy allowlist tests (~30 min)
10. **Polish pass** — loading states, empty states, mobile, a11y (~30 min)

**Total estimated CC time: ~5-6 hours**

---

## Files Modified (existing)

| File | Changes |
|------|---------|
| `api/lib/paperclip-proxy-allowlist.ts` | Add 4 new entries (agents/:id GET, agents/:id/wakeup POST, companies/activity GET, companies/costs/by-agent GET) + expand 1 existing (companies/issues: add POST) |
| `src/lib/paperclip-types.ts` | Add new types (DashboardSummary enhanced, ActivityEntry, AgentCost, CreateTaskRequest) |
| `src/lib/paperclip-normalize.ts` | Add normalizers for activity, costs, enhanced dashboard |
| `src/hooks/usePaperclipTasks.ts` | Add useCreateTask, useAssignTask, useUpdateTaskPriority mutations |
| `src/pages/dashboard/Home.tsx` | Major rewrite — stats row, recent tasks, activity feed |
| `src/pages/dashboard/Tasks.tsx` | Add "New Task" button, extract/enhance TaskDetailPanel |
| `src/pages/dashboard/Agents.tsx` | Agent cards link to detail page, add "Run Now" button |
| `src/components/dashboard/AppSidebar.tsx` | Add Inbox + Costs nav items, inbox badge |
| `src/App.tsx` | Add routes for inbox, agent detail, costs |
| `src/components/dashboard/DashboardSkeleton.tsx` | Add new skeleton variants |

## Files Created (new)

| File | Purpose |
|------|---------|
| `src/pages/dashboard/Inbox.tsx` | Inbox page (Recent/Unread/All) |
| `src/pages/dashboard/AgentDetail.tsx` | Agent detail page |
| `src/pages/dashboard/Costs.tsx` | Cost breakdown page |
| `src/hooks/usePaperclipAgentDetail.ts` | Agent detail + wake mutation |
| `src/hooks/usePaperclipActivity.ts` | Activity feed hook |
| `src/hooks/usePaperclipCosts.ts` | Costs by agent hook |
| `src/components/dashboard/CreateTaskDialog.tsx` | Create task modal |
| `src/components/dashboard/TaskDetailPanel.tsx` | Enhanced task detail (extracted from Tasks.tsx) |
| `src/components/dashboard/AgentInvokeButton.tsx` | Agent wake/invoke button |
| `src/components/dashboard/StatCard.tsx` | Reusable stat card |
| `src/components/dashboard/ActivityTimeline.tsx` | Activity feed entries |
| `src/components/dashboard/StatusBadge.tsx` | Reusable status badge |

---

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `npm test` — all existing + new tests pass
3. Manual verification against local Paperclip (:3100):
   - Create a task → verify it appears in Paperclip's issue list
   - Assign task to agent → verify assignee in Paperclip
   - Click "Run Now" on agent → verify heartbeat invoked in Paperclip
   - Home page shows accurate stats matching Paperclip's dashboard
   - Activity feed shows same entries as Paperclip's activity page
   - Costs page shows same breakdown as Paperclip's costs page
   - Inbox shows same items as Paperclip's inbox
4. `/qa` pass against localhost

---

## NOT in T4 Scope

- Projects sidebar/view (T4.5 — API exists but NOT proxied until needed)
- Goals view (T4.5)
- Analytics bar charts (requires charting library + historical data aggregation — defer)
- Search issues (small volume, kanban is fine)
- Labels/tags on tasks
- Org chart
- Agent configuration/settings
- Sub-issues
- File attachments on tasks
- Chat page (deferred — Slack covers this use case)

---

## ACTIVE-PLAN.md Updates

Update T4 from "Real-time & Polish (Planned)" to:

```markdown
## T4 — Functional Dashboard: Actionability + Visibility + Polish

- [ ] Proxy allowlist expansion (POST issues, agent wakeup, activity, costs)
- [ ] Home page: 4-card stats row, recent tasks, activity feed
- [ ] Create Task dialog (title, description, priority, assign to agent)
- [ ] Task Detail: properties panel, agent invoke button
- [ ] Agent Detail page (profile, latest run, recent issues, costs)
- [ ] Inbox page (Recent/Unread/All with badges)
- [ ] Costs page (spend by agent, tokens)
- [ ] Sidebar: add Inbox + Costs nav items
- [ ] Tests for new hooks + proxy allowlist
- [ ] Polish: loading states, empty states, mobile, a11y
```

## Eng Review Additions

### Architecture Decision: Auth Level
- Task creation (`POST companies/issues`) and agent wakeup (`POST agents/:id/wakeup`) use **API key auth** (standard), not board session auth (governance-only).

### Code Quality Decision: Extract TaskDetailPanel
- Extract `TaskDetailPanel` from `Tasks.tsx` into `src/components/dashboard/TaskDetailPanel.tsx` — clean separation of kanban vs detail concerns.

### Codex Fixes (GPT 5.3 xhigh with codebase context)

**Fix 1 — Hook reuse assumptions corrected:**
- **Agent runs:** Reuse existing `usePaperclipAgentRuns(agentId, limit)` from `src/hooks/usePaperclipAgents.ts:42`. This hook already accepts agentId and limit params. BUT: its query key currently ignores `limit` — fix by including `limit` in the query key array to prevent cache collisions when Agent Detail requests a different limit than Agent cards.
- **Agent issues:** Do NOT reuse `usePaperclipTasks()` (no filter param). Create NEW `usePaperclipAgentIssues(agentId)` in `src/hooks/usePaperclipAgentDetail.ts` that calls `companies/issues?assigneeAgentId=${agentId}`.
- **Run history:** Do NOT reuse `usePaperclipRunHistory()` (no agent filter). Agent Detail page uses `usePaperclipAgentRuns()` above instead.

**Fix 2 — Cache invalidation for useAssignTask and useUpdateTaskPriority:**
- Both must invalidate `['paperclip', 'issues']` (list) AND `['paperclip', 'issue', issueId]` (detail) AND `['paperclip', 'sidebar-badges']`.
- Follow the same 3-phase pattern as `useUpdateTaskStatus`: optimistic update in list cache, rollback on error, invalidate on settled.

**Fix 3 — SidebarBadges type AND normalizer need `inbox` field:**
- API already returns `{ inbox: 1, approvals: 0, failedRuns: 1, joinRequests: 0 }`.
- Add `inbox?: number` and `failedRuns?: number` to `SidebarBadges` interface in `paperclip-types.ts`.
- Update `normalizeSidebarBadges()` in `paperclip-normalize.ts` to pass through `inbox` and `failedRuns` fields (currently maps them to `tasks` and `chat` — remove that incorrect mapping).
- Update `getBadgeCount()` in `AppSidebar.tsx` to handle `'inbox'` badge key.
- Import `Inbox` and `DollarSign` icons from lucide-react in `AppSidebar.tsx`.

**Fix 4 — PaperclipIssue type needs additional fields:**
- API returns `priority`, `projectId`, `createdByUserId`, `createdByAgentId`, `identifier` — all needed for TaskDetail Properties panel.
- Add these as optional fields to `PaperclipIssue` interface.
- Update `normalizeTaskDetail()` to preserve these fields.

**Fix 5 — Wakeup endpoint requires `{}` body (not empty):**
- `POST /agents/:id/wakeup` returns validation error on empty body. Must send `{}` as JSON body.
- Hook: `paperclipFetch('agents/${agentId}/wakeup', { method: 'POST', body: JSON.stringify({}) }, token)`

**Fix 6 — Runtime-validate missing endpoints before implementation:**
- These endpoints work (verified via curl against live Paperclip at :3100):
  - `GET /api/agents/:id` → returns full agent metadata ✓
  - `POST /api/agents/:id/wakeup` → returns queued run (with `{}` body) ✓
  - `GET /api/companies/:id/activity` → returns activity entries ✓
  - `GET /api/companies/:id/costs/by-agent` → returns cost breakdown ✓
  - `PATCH /api/issues/:id` → returns updated issue ✓
  - `GET /api/companies/:id/dashboard` → returns nested agents/tasks/costs shape ✓
- All shapes documented in this plan match the actual API responses.

### Test Requirements (26 gaps identified)

**Proxy allowlist tests** (add to `src/test/paperclip-proxy-allowlist.test.ts`):
- POST companies/issues matches and injects companyId
- POST agents/:id/wakeup matches
- GET companies/activity matches and injects companyId
- GET companies/costs/by-agent matches and injects companyId
- GET agents/:id matches

**Hook tests** (new `src/test/paperclip-hooks-t4.test.ts` or per-hook):
- useCreateTask: happy path (POST succeeds, cache invalidated), error (toast shown)
- useAssignTask: happy path (PATCH with assigneeAgentId), error rollback
- useWakeAgent: happy path (POST wakeup), error (agent offline)
- usePaperclipAgentIssues: happy path (GET issues filtered by assignee), empty response
- useUpdateTaskPriority: happy path (PATCH with priority), error rollback
- usePaperclipAgentRuns: existing hook, but test query key includes limit param (cache isolation)
- usePaperclipActivity: happy path, empty response
- usePaperclipCostsByAgent: happy path, empty response

**Normalizer tests** (add to `src/lib/paperclip-normalize.test.ts`):
- normalizeDashboardSummary with nested agents/tasks/costs shape
- normalizeActivityEntry with various action types
- normalizeAgentCost with missing fields

### Failure Modes

| Codepath | Failure Mode | Test? | Error Handling? | User Sees? |
|----------|-------------|-------|-----------------|------------|
| POST companies/issues | Proxy unreachable | GAP | Yes (paperclipFetch throws) | Error toast |
| POST agents/:id/wakeup | Agent in error state | GAP | Yes (paperclipFetch throws) | Error toast |
| GET companies/activity | Empty response | GAP | Yes (empty array check) | "No activity yet" |
| GET companies/costs/by-agent | No cost data | GAP | Yes (empty array check) | "No cost data" |
| GET agents/:id | Agent not found (404) | GAP | Yes (ProxyQueryWrapper) | Error card with retry |
| TaskDetailPanel | User edits property while stale | No | No - optimistic + invalidate | Brief stale then refresh |

0 critical gaps — all failure modes have error handling via `paperclipFetch` + `ProxyQueryWrapper`. Tests are gaps but the error paths are covered by the existing infrastructure.

### What Already Exists
- `paperclipFetch()` — reused for all 7 new endpoints
- `ProxyQueryWrapper` — reused for all 3 new pages
- `usePaperclipTasks` — template for new mutations (useCreateTask, useAssignTask)
- `usePaperclipDashboard` — already fetches `/dashboard`, just needs type update
- `DashboardSkeleton` — skeleton patterns reusable for new sections
- Proxy allowlist + matchProxyRoute — just adding entries
- `useUpdateTaskStatus` — exact pattern for useAssignTask, useUpdateTaskPriority

### NOT in Scope
- Projects sidebar/view (API exists but NOT proxied — deferred to T4.5)
- Goals view (deferred to T4.5)
- Analytics bar charts (needs charting library — defer)
- Search issues, Labels, Org chart, Sub-issues, Attachments
- Chat page (deferred — Slack covers this)
- Agent configuration/settings

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | Redefined T4 from Chat→Functional Dashboard; Tiers 1+2 accepted |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | CLEAR | 2 broad passes + 6 validation rounds. APPROVED on attempt 8. |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 issues resolved, 26 test gaps specified, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 → 8/10, 4 decisions made |

**CODEX:** Agent detail data sources fixed, /heartbeat/invoke removed, future proxy entries removed, hook contradictions resolved. APPROVED.
**UNRESOLVED:** 0
**VERDICT:** CEO + ENG + CODEX + DESIGN ALL CLEARED — ready to implement.
