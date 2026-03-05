

## Plan: Sidebar Navigation Redesign

Single file change: `src/components/dashboard/AppSidebar.tsx`

### Changes

**1. Update nav items array**
- Remove Performance, Chat entries
- Rename "Competitor Intel" → "Competitors", "Content Calendar" → "Calendar"
- Replace icons: `Calendar` → `CalendarDays`, `Brain` → `BookOpen`, `Link` → `Plug`
- Split into `primaryNav` (6 items) and `secondaryNav` (Settings only)

**2. Update active item styling**
- Remove: `border-l-2 border-l-primary bg-primary/[0.08] [&>svg]:text-primary`
- Replace with: `bg-zinc-800 text-white font-medium`
- Hover state: `hover:bg-zinc-800/50 hover:text-zinc-100`
- Base text: `text-zinc-400`

**3. Add divider between primary and secondary nav**
- `border-t border-zinc-800 my-2` separator between the two groups

**4. Replace footer with agent status indicator**
- Keep user info section but simplify
- Add agent status row: read `tenantStatus` from localStorage (`pixelport_tenant_status`)
- Show agent name from localStorage (`pixelport_agent_name`) or default "Chief of Staff"
- Green dot (`bg-emerald-500`) if active, amber dot (`bg-amber-500`) if provisioning
- Style: `text-xs text-zinc-500`
- Keep sign out button

**5. Remove amber tinting**
- Avatar fallback: `bg-zinc-800 text-zinc-300` instead of `bg-primary/20 text-primary`
- Sign out hover: `hover:bg-zinc-800/50` instead of `hover:bg-[hsl(0_0%_100%/0.04)]`

### No other files changed

