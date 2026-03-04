

## Plan: Replace Hardcoded Timer with Real Status Polling

Three surgical edits to `src/pages/dashboard/Home.tsx`:

1. **Line 48** — Add `session` to `useAuth()` destructure: `const { user, session } = useAuth();`

2. **Lines 54-60** — Replace `agentActive` state + fake timer `useEffect` with:
   - `tenantStatus` state (initialized from localStorage, default `"provisioning"`)
   - Derived `agentActive = tenantStatus === "active"`
   - `useEffect` that polls `GET /api/tenants/status` every 10s, stops when `active` or `failed`

3. **Lines 77-82** — Replace the Agent Status stat card object to handle three states: `active` (green), `failed` (red), `provisioning` (primary + pulse)

No other changes. No new imports needed.

