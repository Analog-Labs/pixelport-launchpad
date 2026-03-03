

## Plan: Authentication + Protected Dashboard

This adds login/signup pages using Supabase Auth, a protected dashboard shell with sidebar navigation, and empty-state pages -- all matching the existing dark + amber design system.

### Database
No new tables needed. The existing Supabase Auth handles user accounts. No profiles table required (user didn't ask for profile data storage). Google OAuth configuration is done in the Supabase dashboard -- you'll need to set that up separately.

### New Files

**Auth infrastructure:**
- `src/contexts/AuthContext.tsx` -- React context wrapping `onAuthStateChange` + `getSession`, exposes `user`, `session`, `loading`, `signOut`
- `src/components/ProtectedRoute.tsx` -- Checks auth state, redirects to `/login` if not authenticated, shows loading spinner while checking

**Pages:**
- `src/pages/Login.tsx` -- Full-screen centered card with Google OAuth button, email/password form, amber styling, redirects to `/dashboard` on success
- `src/pages/Signup.tsx` -- Same layout, "Start your free trial" heading, "Create Account" button, links to `/login`
- `src/pages/Dashboard.tsx` -- Protected layout with sidebar + main content area
- `src/pages/dashboard/Overview.tsx` -- Empty state: "Welcome to PixelPort" with amber icon
- `src/pages/dashboard/Content.tsx` -- Empty state: "Content Pipeline"
- `src/pages/dashboard/Agents.tsx` -- Empty state: "Your Agents"
- `src/pages/dashboard/Analytics.tsx` -- Empty state: "Analytics"
- `src/pages/dashboard/Approvals.tsx` -- Empty state: "Approvals"
- `src/pages/dashboard/Settings.tsx` -- Empty state: "Settings"

**Dashboard shell:**
- `src/components/dashboard/AppSidebar.tsx` -- Sidebar with PixelPort logo, nav items (Overview, Content, Agents, Analytics, Approvals, Settings), sign-out button at bottom

### Modified Files

- `src/App.tsx` -- Wrap with `AuthProvider`, add routes: `/login`, `/signup`, `/dashboard` (protected, with nested child routes)
- `src/components/landing/Navbar.tsx` -- "Start Free" and "Book a Demo" buttons become `<Link>` to `/signup` and `/login`

### Design Details

All auth pages use the same dark background (`#0A0A0F`), card background (`#111118`), amber accent (`#D4A853`), and subtle radial glow from the landing page. Input fields use `bg-[#0D0D14]` with amber focus rings. The dashboard sidebar uses the existing `--sidebar-*` CSS variables already defined in `index.css`.

### Route Structure

```text
/              → Landing page (public)
/login         → Login page (public)
/signup        → Signup page (public)
/dashboard     → Protected layout with sidebar
  /dashboard          → Overview (default)
  /dashboard/content  → Content Pipeline
  /dashboard/agents   → Agents
  /dashboard/analytics → Analytics
  /dashboard/approvals → Approvals
  /dashboard/settings  → Settings
```

### Google OAuth Note
After implementation, you'll need to configure the Google OAuth provider in your Supabase dashboard (Authentication > Providers > Google) with your Google Cloud credentials. The code will include the `signInWithOAuth({ provider: 'google' })` call ready to go.

