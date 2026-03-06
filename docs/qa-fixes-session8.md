# QA Fix Instructions — Session 8 Frontend Bugs

> **For:** Founder (Sanchal) to apply in Lovable
> **Found by:** CTO + Codex QA audit (session 8)
> **Total:** 10 bugs (3 Medium, 7 Low)
> **Estimated time:** ~30 min in Lovable

---

## MEDIUM Priority (Fix First)

### Bug #1: Missing error check in Competitors page

**File:** `src/pages/dashboard/Competitors.tsx`
**What's wrong:** When the API returns an error (server down, bad auth), the page crashes instead of showing an error message.
**Fix:** After the `fetch()` call, add a check: if the response isn't OK, throw an error. Currently it goes straight to `.json()` without checking.

**Tell Lovable:**
> "In Competitors.tsx, the fetch call to /api/competitors doesn't check if the response was successful before parsing JSON. Add `if (!r.ok) throw new Error('Failed to fetch competitors')` before `r.json()`. This prevents crashes when the API returns an error."

---

### Bug #2: Missing error check in Calendar page

**File:** `src/pages/dashboard/CalendarPage.tsx`
**What's wrong:** Same issue as Bug #1 — API errors crash the page.
**Fix:** Add `if (!r.ok) throw new Error(...)` check before `.json()`.

**Tell Lovable:**
> "In CalendarPage.tsx, the fetch call to /api/tasks doesn't check if the response was successful before parsing JSON. Add `if (!r.ok) throw new Error('Failed to fetch calendar tasks')` before `r.json()`. Same fix as Competitors.tsx."

---

### Bug #3: Auth token exposed in URL (Security)

**File:** `src/pages/dashboard/Connections.tsx`
**What's wrong:** When clicking "Connect Slack", the auth token is put directly in the URL (`?token=...`). This is visible in browser history, server logs, and could leak to third parties.
**Fix:** Use a different approach — either use a form POST or a redirect endpoint that reads the token from cookies/headers instead.

**Tell Lovable:**
> "In Connections.tsx line ~77, the Slack install link puts the auth token in the URL as a query parameter: `window.location.href = /api/connections/slack/install?token=${session?.access_token}`. This is a security issue — tokens shouldn't be in URLs. Instead, create a form POST to `/api/connections/slack/install` that sends the token in the request body or Authorization header, then have the backend redirect to Slack's OAuth URL."

---

## LOW Priority (Fix When Convenient)

### Bug #4: Vault content shows raw markdown

**File:** `src/pages/dashboard/Vault.tsx`
**What's wrong:** The Knowledge Vault sections contain markdown content (headings, bold, lists), but they display as plain text. Users see `## Company Profile` instead of a formatted heading.
**Fix:** Use a markdown renderer component.

**Tell Lovable:**
> "In Vault.tsx, the section content is rendered with `whitespace-pre-wrap` but it's actually markdown. Install and use `react-markdown` to render the content properly. Replace the plain `<p>` tag with `<ReactMarkdown>{section.content}</ReactMarkdown>` so headings, bold, lists etc. display correctly."

---

### Bug #5 & #6: Hardcoded vault section config and status styles

**File:** `src/pages/dashboard/Vault.tsx`
**What's wrong:** Section names (Company Profile, Brand Voice, etc.) and status badge colors are hardcoded. If we add new sections later, this breaks.
**Fix (low urgency):** These are fine for now but should be refactored when we add dynamic sections.

**Tell Lovable (optional):**
> "Low priority — the vault section icons/titles and status badge styles in Vault.tsx are hardcoded. No fix needed now, but when we add dynamic sections, we should fetch this config from the API instead."

---

### Bug #7: Agent name fallback handling

**File:** `src/pages/dashboard/Home.tsx`
**What's wrong:** The agent name is read from localStorage. If it's missing, some UI text might show "undefined" or empty strings.
**Fix:** Ensure all places that use the agent name have a proper fallback like "Your Agent" or "Chief of Staff".

**Tell Lovable:**
> "In Home.tsx, check every place that calls `getAgentName()` and make sure there's a fallback value like 'Your Agent' if the name isn't set yet. The function exists but some usage sites might not handle the null case gracefully."

---

### Bug #8 & #9: Duplicated platform styling logic

**Files:** `src/pages/dashboard/Content.tsx` + `src/pages/dashboard/CalendarPage.tsx`
**What's wrong:** Both files have their own logic for platform colors (LinkedIn = blue, X = gray). If we add Instagram or email, we'd need to update both files.
**Fix:** Move platform styling to a shared utility.

**Tell Lovable:**
> "Content.tsx has `getPlatformBadge()` and CalendarPage.tsx has `getPlatformDot()` — both define platform colors independently. Create a shared utility (e.g., `src/lib/platforms.ts`) with a single `PLATFORM_CONFIG` object that maps platform names to colors/labels. Both files import from there. Include: linkedin (blue), x/twitter (gray), instagram (pink), email (green), blog (purple), and a default."

---

### Bug #10: Hardcoded content filter logic

**File:** `src/pages/dashboard/Content.tsx`
**What's wrong:** The content filter tabs (All/Pending/Approved/Published) and their matching logic are hardcoded. Not a problem now, but could break if we add new statuses.
**Fix (low urgency):** Fine for now, refactor when we add more status types.

**Tell Lovable (optional):**
> "Low priority — the filter logic in Content.tsx (`matchesFilter` function and `FILTERS` array) is hardcoded. Works fine now, but consider making it configurable when we add new content statuses like 'scheduled' or 'revision_requested'."

---

## Summary

| # | Priority | File | Fix Time | Description |
|---|----------|------|----------|-------------|
| 1 | MEDIUM | Competitors.tsx | 2 min | Add res.ok check |
| 2 | MEDIUM | CalendarPage.tsx | 2 min | Add res.ok check |
| 3 | MEDIUM | Connections.tsx | 10 min | Move token from URL to header/body |
| 4 | LOW | Vault.tsx | 5 min | Add markdown renderer |
| 5-6 | LOW | Vault.tsx | skip | Hardcoded config (fine for now) |
| 7 | LOW | Home.tsx | 5 min | Agent name fallback |
| 8-9 | LOW | Content+Calendar | 10 min | Shared platform utility |
| 10 | LOW | Content.tsx | skip | Hardcoded filters (fine for now) |

**Recommended approach:** Fix bugs #1, #2, #3 immediately (security + stability). Fix #4 and #7 next session. Defer #5-6, #8-9, #10 to Phase 3 polish.
