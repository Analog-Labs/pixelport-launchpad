

## Plan: Replace Connections.tsx with Integration Management Page

Full replacement of `src/pages/dashboard/Connections.tsx` (12 lines → ~130 lines).

### What it does
- Fetches integration status from `GET /api/connections` on mount using the auth token
- Handles Slack OAuth callback query params (`?slack=connected` → success toast, `?error=...` → error toast), then clears params
- Shows a loading spinner while fetching
- **Slack card**: purple `#4A154B` background icon circle, `MessageSquare` icon, "Connect Slack" button (with `Loader2` spinner while redirecting) or green `CheckCircle` + "Connected to {team_name}" status
- **Email card**: blue background icon circle, `Mail` icon, shows inbox address with green "Active" badge or "automatically set up when provisioned" message
- Connect Slack button redirects to `/api/connections/slack/install`

### Components used
- `Card`, `CardContent` from ui/card
- `Button` from ui/button
- `useAuth` for session token
- `useToast` for notifications
- `useSearchParams` for OAuth callback handling
- Icons: `MessageSquare`, `Mail`, `CheckCircle`, `Loader2` from lucide-react

### Structure
```text
<div className="space-y-6">
  <header> — title + subtitle
  <Card> — Slack row: icon circle (bg-[#4A154B]) | name + status | button
  <Card> — Email row: icon circle (bg-blue-600) | name + status
</div>
```

Single file change, no other files affected.

