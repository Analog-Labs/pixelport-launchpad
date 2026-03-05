

## Plan: Content Pipeline Page

Replace `src/pages/dashboard/Content.tsx` with a full content pipeline wired to the tasks and approval APIs.

### Single file change: `src/pages/dashboard/Content.tsx`

**Imports:** `useState, useEffect` from React; `FileText, Loader2` from lucide-react; `useAuth`; `Button, Badge, Skeleton`; `getAgentName` from avatars; `toast` from sonner; `formatDistanceToNow` from date-fns.

**State:** `tasks` (array), `loading` (bool), `filter` (`"all" | "pending" | "approved" | "published"`), `actionLoading` (task ID string or null).

**Data fetching:** `useEffect` calls `GET /api/tasks?task_type=draft_content&limit=50` with Bearer token. Fails gracefully → empty array.

**Actions:**
- Approve: `POST /api/tasks/approve` with `{ task_id }` → update local state, toast
- Reject: `POST /api/tasks/reject` with `{ task_id }` → update local state, toast
- Both set `actionLoading` to the task ID during request

**Filter tabs:** 4 text buttons (All, Pending, Approved, Published). Active tab gets `bg-zinc-800 text-zinc-100`, inactive gets `text-zinc-400`. Client-side filtering on `approval_status` / `status`.

**Card layout per task:** `border border-zinc-800 bg-zinc-900 rounded-lg p-5`. Shows platform badge, status chip, description, relative timestamp. Pending tasks get Approve (emerald) + Reject (red outline) buttons.

**Platform badges:** linkedin → blue, twitter/x → zinc-300, other → zinc-400.

**Status chips:** pending → amber, approved → emerald, rejected → red, completed without approval → blue "Published".

**Empty state:** "{agentName} is analyzing your brand and will suggest content soon." centered with FileText icon.

**Routing:** Already at `/dashboard/content` in App.tsx — no change needed.

