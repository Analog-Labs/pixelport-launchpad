

## Plan: Knowledge Vault Page

Replace `src/pages/dashboard/Vault.tsx` with a full interactive page wired to the vault API.

### What it does
Displays 5 collapsible knowledge sections (Company Profile, Brand Voice, ICP, Competitors, Products) that the agent populates. Users can view, edit inline, and save changes.

### Implementation

**Single file change: `src/pages/dashboard/Vault.tsx`**

**Imports:**
- `useState, useEffect` from React
- `Building2, MessageSquare, Users, Search, Package, ChevronDown, Loader2, Pencil` from lucide-react
- `useAuth` from `@/contexts/AuthContext`
- `Button` from ui/button
- `Textarea` from ui/textarea
- `Skeleton` from ui/skeleton
- `Badge` from ui/badge
- `Collapsible, CollapsibleTrigger, CollapsibleContent` from ui/collapsible
- `getAgentName` from `@/lib/avatars`
- `toast` from sonner

**State:**
- `sections: VaultSection[]` (array from API)
- `loading: boolean`
- `editingKey: string | null` (which section is being edited)
- `editContent: string` (textarea value)
- `saving: boolean`

**Type:**
```ts
interface VaultSection {
  id: string;
  section_key: string;
  title: string;
  content: string | null;
  status: 'pending' | 'populating' | 'ready';
  last_updated_by: string;
}
```

**useEffect on mount:** Fetch `GET /api/vault` with Bearer token, set sections. Fail gracefully → empty state.

**Section config map:** Maps `section_key` to icon and display title:
- `company_profile` → Building2, "Company Profile"
- `brand_voice` → MessageSquare, "Brand Voice"
- `icp` → Users, "Target Audience"
- `competitors` → Search, "Competitors"
- `products` → Package, "Products"

**Each VaultSection rendered as a `Collapsible`:**
- Trigger row: icon + title + status badge + Edit button (when ready)
- Content area varies by status:
  - `pending`: "{agentName} is researching this..." with `animate-pulse`
  - `populating`: "{agentName} is writing this section..." with `Loader2` spinner
  - `ready`: content in `whitespace-pre-wrap`, or "No content yet" if empty
- Edit mode: `Textarea` replaces content, Save (amber) + Cancel buttons
- Save calls `PUT /api/vault/{section_key}` with `{ content }`, updates local state on success

**Status badges:** `bg-emerald-500/15 text-emerald-400` (ready), `bg-amber-500/15 text-amber-400` (populating), `bg-zinc-500/15 text-zinc-400` (pending)

**Empty/error state:** Centered message: "{agentName} is setting up your Knowledge Vault. Check back in a few minutes."

**Styling:** Cards use `border border-zinc-800 bg-zinc-900 rounded-lg`. Textarea: `bg-zinc-950 border-zinc-700 focus:border-amber-500/50`. Page wrapper: `max-w-4xl mx-auto space-y-6`.

**Routing:** Already wired at `/dashboard/vault` in App.tsx — no change needed.

### Files changed
Only `src/pages/dashboard/Vault.tsx`

