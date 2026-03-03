

## Plan: Dashboard Shell Overhaul

Replace the existing placeholder dashboard with the full layout described — new navigation structure, rich home page, styled empty states, chat route, and floating chat widget.

### No Database Changes
No new tables or migrations needed. All data is static/placeholder for now.

### Route Changes (App.tsx)

Remove old routes (agents, analytics, approvals). Add new routes:
- `/dashboard` → Home (rich overview page)
- `/dashboard/content` → Content Pipeline
- `/dashboard/calendar` → Content Calendar
- `/dashboard/performance` → Performance
- `/dashboard/vault` → Knowledge Vault
- `/dashboard/competitors` → Competitor Intel
- `/dashboard/connections` → Connections
- `/dashboard/settings` → Settings
- `/dashboard/chat` → Full-page agent chat

### Files to Modify

**`src/App.tsx`** — Update route definitions to match new structure. Remove imports for Agents/Analytics/Approvals/Overview, add imports for new pages.

**`src/pages/Dashboard.tsx`** — Add floating chat widget button (fixed bottom-right of main content area). Remove the header with SidebarTrigger or integrate it with the sidebar collapse.

**`src/components/dashboard/AppSidebar.tsx`** — Complete redesign:
- Custom styling: `bg-[#0D0D14]`, right border `rgba(255,255,255,0.06)`, 250px width
- New nav items with correct icons (LayoutDashboard, FileText, Calendar, BarChart3, Brain, Search, Link, Settings)
- Active state: amber icon, white text, left 2px amber border, subtle amber bg tint
- Footer: user avatar with initials fallback + display name/email + sign out button
- Responsive: icons-only on tablet, hamburger overlay on mobile

### New Files

**`src/pages/dashboard/Home.tsx`** — Rich home page with:
- Dynamic greeting (morning/afternoon/evening + user's name from auth)
- 3 stat cards (Agent Status, Pending Approvals, Monthly Cost)
- Chief of Staff card with amber left border, Luna placeholder, onboarding CTA
- 3 Quick Action cards (Create Content, Add Competitors, Connect Slack)

**`src/pages/dashboard/CalendarPage.tsx`** — Empty state with Calendar icon

**`src/pages/dashboard/Performance.tsx`** — Empty state with BarChart3 icon

**`src/pages/dashboard/Vault.tsx`** — Empty state with Brain icon

**`src/pages/dashboard/Competitors.tsx`** — Empty state with Search icon

**`src/pages/dashboard/Connections.tsx`** — Empty state with Link icon

**`src/pages/dashboard/Chat.tsx`** — Full-page chat empty state with MessageCircle icon

**`src/components/dashboard/ChatWidget.tsx`** — Floating amber circle button (56px), MessageCircle icon, navigates to `/dashboard/chat`, hover scale effect

**`src/components/dashboard/EmptyState.tsx`** — Reusable component accepting icon, heading, description, and optional button text. Used by all empty-state pages to avoid repetition.

### Files to Delete

- `src/pages/dashboard/Overview.tsx` (replaced by Home.tsx)
- `src/pages/dashboard/Agents.tsx` (removed from nav)
- `src/pages/dashboard/Analytics.tsx` (replaced by Performance)
- `src/pages/dashboard/Approvals.tsx` (removed from nav)

### Design Details

- All empty states: centered, 48px amber icon, 24px white heading, gray subtext (max-w-[400px]), amber outlined "Get Started" button
- Stat cards: `bg-[#111118]` with `border border-[rgba(212,168,83,0.15)]`
- Chief of Staff card: same card style + `border-l-[3px] border-l-[#D4A853]`
- Sidebar active item: `border-l-2 border-l-[#D4A853] bg-[rgba(212,168,83,0.08)] text-white` with amber icon color
- Responsive: sidebar collapses to 56px icons-only below 1024px, becomes hamburger overlay below 768px

### Responsive Approach

Use the existing `useSidebar` hook's `collapsible="icon"` for tablet. For mobile, the existing Sheet-based sidebar component handles the overlay. The `SidebarTrigger` moves into the dashboard header for mobile hamburger access.

