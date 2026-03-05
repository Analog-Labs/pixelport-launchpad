

## Plan: Global Theme + Typography Upgrade

Purely visual changes across 6 files. No functionality or API changes.

### 1. `src/index.css` — Update CSS variables

- `--background`: change to zinc-950 (`240 6% 4%` → maps to #09090b)
- `--card`: change to zinc-900 (`240 6% 10%` → #18181b)
- `--popover`: match card (zinc-900)
- `--border`: change to zinc-800 (`240 4% 16%` → #27272a)
- `--input`: match border (zinc-800)
- `--secondary`: zinc-800 (`240 4% 16%`)
- `--muted`: zinc-800 area
- `--muted-foreground`: zinc-400 (`240 5% 65%`)
- `--surface`: zinc-900 area
- `--sidebar-background`: slightly darker than card
- `--sidebar-border`: match border
- Keep `--primary` (amber) and `--ring` unchanged

### 2. `src/pages/dashboard/Home.tsx` — Card + typography cleanup

- Stat cards: remove `border-primary/15`, use `border-zinc-800 bg-zinc-900`; stat values become `text-3xl font-bold tabular-nums`; labels become `text-xs font-medium text-zinc-500`
- Chief of Staff card: keep `border-l-primary` accent, change base border to `border-zinc-800 bg-zinc-900`
- Quick action cards: remove `border-primary/15 hover:border-primary/30`, use `border-zinc-800 bg-zinc-900 hover:border-zinc-700`; icon color from `text-primary` to `text-zinc-400` (amber only for active states)
- Greeting h1: `text-2xl font-bold tracking-tight` (remove `sm:text-3xl`)
- Activity timeline line: `bg-zinc-800` instead of `bg-primary/20`

### 3. `src/pages/dashboard/Connections.tsx` — Card styling

- Both cards: add `border-zinc-800 bg-zinc-900` classes
- Connected status: `text-emerald-400` instead of `text-green-600`
- Email active badge: `bg-emerald-500/15 text-emerald-400` pattern

### 4. `src/pages/dashboard/Chat.tsx` — Subtle border updates

- Header/input borders: already using `border-border` (will inherit from CSS var change)
- No explicit changes needed beyond what CSS vars handle

### 5. `src/components/dashboard/ChatWidget.tsx` — Card border update

- Widget panel: change `border-primary/15` to `border-zinc-800`
- Already uses `bg-card` which will pick up new zinc-900 value

### 6. `src/components/dashboard/AppSidebar.tsx` — Border update

- Sidebar border: change `border-[hsl(0_0%_100%/0.06)]` to `border-zinc-800`
- Background `bg-[hsl(240_33%_4%)]` will be close to new `--sidebar-background`; can simplify to `bg-sidebar`
- Footer border: same treatment

### Files changed (6 total)
All changes are class name and CSS variable swaps. Zero logic changes.

