

## Plan: Dashboard Home Upgrade + Chat Widget + Onboarding Fix

### 1. Fix: Onboarding localStorage (Onboarding.tsx)
Add `pixelport_company_name` and `pixelport_company_url` to localStorage in `handleLaunch`.

### 2. Extract shared AVATAR_MAP (new file: `src/lib/avatars.ts`)
Move `AVATAR_MAP` to a shared module so Home, ChatWidget, and Chat can all import it.

### 3. Dashboard Home Upgrade (`src/pages/dashboard/Home.tsx`)
Full rewrite with two modes based on `pixelport_onboarded`:

**Pre-onboarding:** Keep current behavior (setup required, complete onboarding CTA).

**Post-onboarding:**
- Stat cards: Agent Status starts as "Provisioning..." (amber, pulsing dot), transitions to "Active" (green) after 10s via `useEffect` timer.
- Chief of Staff card: Updated description ("getting to know your business"), two buttons: "Chat with [name]" (outline) and "View Activity" (ghost).
- Quick Actions: Chat, Content Pipeline, Competitor Intel.
- New "Recent Activity" section: vertical timeline with 4 items (2 active with amber dots, 2 pending with gray dots). Reads company URL from localStorage.

### 4. Chat Context (`src/contexts/ChatContext.tsx`)
New context providing shared `messages` array, `addMessage`, `isWidgetOpen`, `setWidgetOpen`. Initialized with 2 agent welcome messages using agent name from localStorage.

### 5. Chat Widget Upgrade (`src/components/dashboard/ChatWidget.tsx`)
Replace simple button with full slide-up panel (desktop) or navigate-only bubble (mobile):

- **Bubble:** Amber circle with unread dot badge (shown until first open). Hidden on `/dashboard/chat`.
- **Panel (desktop only, 380x500px):** Header with avatar/name/online status + maximize/minimize buttons. Scrollable message area with styled bubbles. Input bar with send button. Simulated typing indicator and canned responses. Smooth slide-up/down transitions.
- Uses `ChatContext` for messages and widget state.

### 6. Full-page Chat (`src/pages/dashboard/Chat.tsx`)
Replace empty state with full chat interface:
- Header: avatar + name + online dot + "Minimize to Widget" button.
- Messages area from ChatContext (same styling, more spacious).
- Full-width input bar, auto-focused.
- Same simulated reply logic as widget.
- Auto-closes widget on mount.

### 7. Dashboard Layout (`src/pages/Dashboard.tsx`)
Wrap with `ChatProvider`.

### Files Changed
| File | Action |
|------|--------|
| `src/pages/Onboarding.tsx` | Add 2 localStorage lines |
| `src/lib/avatars.ts` | New — shared AVATAR_MAP |
| `src/contexts/ChatContext.tsx` | New — chat state provider |
| `src/pages/dashboard/Home.tsx` | Rewrite with pre/post modes + activity timeline |
| `src/components/dashboard/ChatWidget.tsx` | Rewrite with slide-up panel |
| `src/pages/dashboard/Chat.tsx` | Rewrite with full chat UI |
| `src/pages/Dashboard.tsx` | Wrap with ChatProvider |

