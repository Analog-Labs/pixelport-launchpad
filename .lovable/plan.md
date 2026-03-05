

## Plan: Competitor Intelligence Page

Replace `src/pages/dashboard/Competitors.tsx` with a full page wired to `GET /api/competitors`.

### Single file change: `src/pages/dashboard/Competitors.tsx`

**Imports:** `useState, useEffect` from React; `Search, Loader2` from lucide-react; `useAuth`; `Skeleton`; `getAgentName`; `toast` from sonner.

**State:** `competitors` (array), `loading` (bool).

**Data fetching:** `useEffect` calls `GET /api/competitors` with Bearer token. Fails gracefully → empty array.

**Card grid:** `grid grid-cols-1 md:grid-cols-2 gap-4`. Each card: `border border-zinc-800 bg-zinc-900 rounded-lg p-5 space-y-3`.

**Card contents:**
- Header row: company_name (text-base font-semibold) + website link (text-xs text-zinc-500 hover:text-amber-400, shows hostname only) + threat badge
- Summary paragraph (text-sm text-zinc-300)
- Recent activity section (conditional, border-t border-zinc-800)

**Threat level badges:** high → red, medium → amber, low → emerald. Same `bg-{color}-500/15 text-{color}-400` pattern.

**Empty state:** Search icon + "{agentName} is identifying your competitors..." centered message.

**Routing:** Already at `/dashboard/competitors` — no change needed.

