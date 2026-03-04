

## Plan: Wire Website Scan API to Onboarding

Four surgical edits to `src/pages/Onboarding.tsx`:

1. **Add state variables** (after line 33): `scanResults` and `scanError` state
2. **Add `triggerScan` function** (before `handleLaunch` at line 63): async function that calls `POST /api/tenants/scan` with the company URL, storing results silently
3. **Update Step 1 onNext** (line 175): also call `triggerScan(data.company_url)` when advancing to Step 2
4. **Add `scan_results` to payload** (after line 70): include `scanResults` in the tenant creation payload

No new imports, no UI changes. The scan runs in the background while the user continues through Steps 2-3.

