

## Plan: Content Calendar Page

Replace `src/pages/dashboard/CalendarPage.tsx` with a full monthly calendar view wired to the tasks API.

### Single file change: `src/pages/dashboard/CalendarPage.tsx`

**Note:** The file is `CalendarPage.tsx` (not `Calendar.tsx`), already routed at `/dashboard/calendar`.

**Imports:** `useState, useEffect, useMemo` from React; `ChevronLeft, ChevronRight, CalendarDays` from lucide-react; `useAuth`; `Button, Skeleton`; `getAgentName`; `toast` from sonner; `format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths` from date-fns.

**State:** `tasks` (array), `loading` (bool), `currentMonth` (Date), `selectedDate` (string | null).

**Data fetching:** `useEffect` calls `GET /api/tasks?scheduled_for=true&sort=scheduled_for&order=asc&limit=100` with Bearer token. Fails gracefully.

**Calendar generation:** Build 42-day grid (6 weeks) using date-fns. Start from Monday of the week containing the 1st of `currentMonth`.

**Month navigation:** Prev/Next buttons using `subMonths`/`addMonths`. Header shows `format(currentMonth, "MMMM yyyy")`.

**DayCell (inline):** `min-h-[80px] p-2 border-r border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50`. Day number styling: current month → `text-zinc-400`, other month → `text-zinc-600`, today → `text-amber-400 font-bold`, selected → `bg-zinc-800`. Shows up to 2 colored dots (LinkedIn=blue, X=zinc-400, other=amber-500) plus "+N more" if needed.

**Selected day detail panel:** Shows below the calendar when a date with tasks is clicked. Lists each task with platform dot, description, and time.

**Platform dot colors:** linkedin → `bg-blue-500`, twitter/x → `bg-zinc-400`, other → `bg-amber-500`.

**Empty state:** CalendarDays icon + "{agentName} is building your content calendar..."

### Files changed
Only `src/pages/dashboard/CalendarPage.tsx`

