# CTO Phase 1 Go Package — Slices 5 + 7

**Date:** 2026-03-04
**From:** CTO (Claude Code)
**To:** Codex
**Status:** ✅ Phase 0 complete, Phase 0.9 dry-run PASSED. Begin Phase 1.

---

## What Changed Since Phase 0

### Phase 0.9 Dry-Run (2026-03-04)

CTO ran a full end-to-end provisioning test. The 12-step Inngest pipeline now completes in ~7 minutes: tenant → LiteLLM team/key → DO droplet → Docker CE install → OpenClaw container → agents configured → tenant marked active.

**7 bugs were found and fixed during testing.** These bugs revealed critical patterns that **you must follow** in all future API code.

### ⚠️ CRITICAL: Vercel Serverless Patterns (MUST READ)

These patterns were discovered through painful debugging. Violating any of them will crash your endpoints at runtime.

#### 1. ESM/CommonJS Fix
The root `package.json` has `"type": "module"`. This causes ALL Vercel serverless functions that import local files to crash with `ERR_REQUIRE_ESM`.

**Fix already applied:** `api/package.json` exists with `{"type": "commonjs"}`. Do NOT delete this file. Do NOT add `"type": "module"` to any package.json in `api/`.

#### 2. Inngest Client — INLINE ONLY
**DO NOT** import the Inngest client from `api/inngest/client.ts` or any local file that re-exports it. This crashes Vercel's esbuild bundler at runtime.

**WRONG:**
```typescript
import { inngest } from '../inngest/client';  // ❌ CRASHES VERCEL
```

**CORRECT:**
```typescript
import { Inngest } from 'inngest';            // ✅ Direct package import
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

This applies to ALL files that need to send Inngest events. Create the client inline.

#### 3. Shared Library Imports — VERIFY BEFORE USING
The existing shared libraries (`api/lib/auth.ts`, `api/lib/supabase.ts`) may or may not work depending on what they import internally. Before using them:
- Check if they import from other local files (chained imports crash Vercel)
- If they only import from npm packages directly, they're fine
- If in doubt, inline the logic

#### 4. After Deploy — Sync Inngest
After any push that changes Inngest functions, run:
```bash
curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest
```
This registers the updated function with Inngest Cloud.

### OpenClaw Gateway Facts (Important for Slice 6 — DEFERRED)

During testing we discovered:
- **OpenClaw gateway is WebSocket-only** — all HTTP routes return SPA UI HTML, not JSON
- There is **no REST API** for sending messages to agents
- The agent chat interface works via WebSocket connections to `ws://{ip}:18789`
- The config schema uses `gateway.auth.token` (not `gateway.token`) and `agents.list[]` (not `agents[]`)

**Impact: Slice 6 (Chat API) is DEFERRED.** The current Slice 6 instruction assumes an HTTP `POST /openclaw/chat` endpoint on the gateway, which doesn't exist. CTO is designing the chat bridge architecture. Do NOT work on Slice 6.

---

## Your Assignment

### Execute: Slice 5 (Tenant Creation) + Slice 7 (Slack OAuth)

These two slices are independent and can be done in parallel or sequentially.

**Slice 5** (`docs/phase1/codex-slice-5-onboarding.md`):
- Creates `POST /api/tenants` endpoint
- Triggers the Inngest provisioning workflow
- **IMPORTANT FIX:** The instruction doc shows `import { inngest } from '../inngest/client'` — change this to inline Inngest client creation (see pattern #2 above)

**Slice 7** (`docs/phase1/codex-slice-7-slack.md`):
- Slack OAuth install + callback + events webhook
- Connections status API
- Database migration for `slack_connections` table
- **IMPORTANT FIX:** Same Inngest import fix applies if any file uses Inngest
- **NOTE:** The shared library imports (`authenticateRequest`, `supabase`) should work here since they're direct npm package imports, but verify

### Skip: Slice 6 (Chat API)

Do NOT work on Slice 6. It requires an architecture decision that CTO hasn't made yet.

---

## Testing Instructions

After completing Slices 5 + 7, verify:

### Slice 5 Testing

1. **TypeScript compiles:**
   ```bash
   npx tsc --noEmit api/tenants/index.ts
   ```

2. **Endpoint responds (after Vercel deploy):**
   ```bash
   # Should return 401 (no auth header)
   curl -s https://pixelport-launchpad.vercel.app/api/tenants
   ```

3. **Inngest event name matches:**
   Verify the event name in your code matches what `provision-tenant.ts` expects:
   ```
   Event name: 'pixelport/tenant.created'
   Data: { tenantId: string, trialMode?: boolean }
   ```

4. **No local file re-exports:**
   ```bash
   grep -r "from.*inngest/client" api/tenants/
   # Expected: no results
   ```

### Slice 7 Testing

1. **TypeScript compiles:**
   ```bash
   npx tsc --noEmit api/connections/**/*.ts
   ```

2. **Events webhook URL verification (after deploy):**
   ```bash
   # Should return 405 (GET not POST)
   curl -s https://pixelport-launchpad.vercel.app/api/connections/slack/events
   ```

3. **Connections endpoint (after deploy):**
   ```bash
   # Should return 401 (no auth)
   curl -s https://pixelport-launchpad.vercel.app/api/connections
   ```

4. **Migration 005 applied:**
   Verify `slack_connections` table exists in Supabase.

5. **No hardcoded secrets:**
   ```bash
   grep -r "xoxb-\|sk-\|eyJ" api/connections/
   ```

---

## Environment Variables

All required env vars are already set in Vercel (11 vars confirmed SET):

| Variable | Status |
|----------|--------|
| SUPABASE_PROJECT_URL | ✅ SET |
| SUPABASE_SERVICE_ROLE_KEY | ✅ SET |
| LITELLM_URL | ✅ SET |
| LITELLM_MASTER_KEY | ✅ SET |
| DO_API_TOKEN | ✅ SET |
| INNGEST_EVENT_KEY | ✅ SET |
| INNGEST_SIGNING_KEY | ✅ SET |
| API_KEY_ENCRYPTION_KEY | ✅ SET |
| SLACK_CLIENT_ID | ✅ SET |
| SLACK_CLIENT_SECRET | ✅ SET |
| SLACK_SIGNING_SECRET | ✅ SET |
| AGENTMAIL_API_KEY | ⬜ Optional (skips AgentMail inbox creation) |
| OPENCLAW_IMAGE | ⬜ Optional (defaults to ghcr.io/openclaw/openclaw:2026.2.24) |

No new env vars needed for Slices 5 or 7.

---

## Commit Guidelines

- Work on `main` branch
- Commit with clear messages describing what was built
- Include `Co-Authored-By: Codex <noreply@openai.com>` in commits
- Update `docs/SESSION-LOG.md` after completing work
- Push when done — Vercel auto-deploys from main

---

## Summary

| Slice | Task | Status | Notes |
|-------|------|--------|-------|
| 5 | Tenant Creation (`POST /api/tenants`) | 🟢 Execute | Fix Inngest import (inline) |
| 6 | Chat API (SSE streaming) | ⛔ SKIP | Deferred — CTO designing WS bridge |
| 7 | Slack OAuth + Events | 🟢 Execute | Verify shared lib imports work |
