

## Plan: Dashboard Home Redesign

Rewrite `src/pages/dashboard/Home.tsx` with the new layout. All existing functionality (status polling, navigation, auth) preserved.

### New sections (top to bottom)

**1. Greeting row** — keep existing, subtitle to `text-sm text-zinc-400`

**2. Stat cards** — 4-column grid (`grid-cols-2 lg:grid-cols-4 gap-4`), add "Running Tasks" card (hardcoded "0"). Each card: `border border-zinc-800 bg-zinc-900 rounded-lg p-5`, value `text-2xl font-bold tabular-nums`, label `text-xs font-medium text-zinc-500 uppercase tracking-wider`

**3. Onboarding checklist** (new, shown only when `isOnboarded` and not all 4 steps complete)
- Card with progress bar (`{n}/4 setup steps`) and 4 checklist rows:
  - Account created (always checked)
  - Agent configured (checked if `pixelport_onboarded`)
  - Slack connected (fetched from `GET /api/connections`)
  - First content approved (always unchecked)
- Each row: green `CheckCircle` or gray `Circle` icon + text + optional "Connect →" link
- New state: `slackConnected` (boolean), fetched in a `useEffect` calling `/api/connections`
- Hide card when all 4 are done

**4. Chief of Staff card** — keep existing layout, add status badge on right side (`bg-emerald-500/15 text-emerald-400` or amber variant based on `tenantStatus`). Keep `border-l-[3px] border-l-primary`

**5. Two-column section** (`grid grid-cols-1 lg:grid-cols-3 gap-6`)

- **Left (lg:col-span-2): Recent Activity / Work Feed**
  - Keep existing timeline UI
  - Add `useEffect` to fetch `GET /api/tasks?limit=10&sort=updated_at&order=desc`
  - New state: `tasks` array, `tasksLoading` boolean
  - If tasks come back, map them into timeline items; otherwise fall back to hardcoded items
  - Empty state: "{agentName} is getting started..."

- **Right (lg:col-span-1): Team Roster**
  - Card with "Active Team" header
  - Reads from same tasks data, filters `status=running`
  - Each row: generic Lucide icon + task type name + status badge
  - Empty state: "{agentName} hasn't spawned any specialists yet"

**6. Quick Actions** — keep existing 3 cards, no changes needed (already styled correctly)

### New imports
- `CheckCircle, Circle, Users` from lucide-react
- `Progress` from `@/components/ui/progress`

### New state variables
- `slackConnected: boolean` (default false)
- `tasks: any[]` (default [])
- `tasksLoading: boolean` (default true)

### New useEffects
1. Fetch `/api/connections` on mount → set `slackConnected`
2. Fetch `/api/tasks?limit=10&sort=updated_at&order=desc` on mount → set `tasks`
Both use `session?.access_token`, fail gracefully (catch → keep defaults)

### Files changed
Only `src/pages/dashboard/Home.tsx`

