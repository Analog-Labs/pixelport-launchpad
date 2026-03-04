# CTO Phase 1 Go Package v2 — Slices 8 + 9

**Date:** 2026-03-04
**From:** CTO (Claude Code)
**To:** Codex
**Status:** Slices 5, 6, 7 COMPLETE. Begin Slices 8 + 9.

---

## What Changed Since Go Package v1

### Previous Codex Work — DONE

Slices 5, 6, and 7 are complete and merged to `main`:
- **Slice 5** (`POST /api/tenants`) — commit `7560526`
- **Slice 6** (`POST /api/chat` SSE + `GET /api/chat/history`) — commit `72be4e0`
- **Slice 7** (Slack OAuth install/callback/events + connections API) — commit `f767db4` (Inngest fix)

CTO reviewed all files — ALL PASS. Do not modify these files unless instructed by this package.

### Architecture Decisions (New)

1. **Slack is the PRIMARY channel for Phase 1.** Dashboard chat ships as-is (graceful fallback for WS-only gateway). WebSocket bridge deferred to Phase 2.
2. **Website scan** during onboarding: lightweight fetch + LLM extraction of brand profile. Results populate the agent's SOUL.md Knowledge Base.
3. **OpenClaw config hot-reloads** for channel changes — no container restart needed after Slack activation.
4. **1 DO droplet slot available** — use `/api/debug/test-provision?cleanup=true` after each test to free it.

---

## ⚠️ CRITICAL: Vercel Serverless Patterns (MUST READ)

These patterns were discovered through painful debugging. Violating any of them will crash your endpoints at runtime.

### 1. ESM/CommonJS Fix
The root `package.json` has `"type": "module"`. This causes ALL Vercel serverless functions that import local files to crash with `ERR_REQUIRE_ESM`.

**Fix already applied:** `api/package.json` exists with `{"type": "commonjs"}`. Do NOT delete this file. Do NOT add `"type": "module"` to any package.json in `api/`.

### 2. Inngest Client — INLINE ONLY
**DO NOT** import the Inngest client from `api/inngest/client.ts` or any local file that re-exports it. This crashes Vercel's esbuild bundler at runtime.

**WRONG:**
```typescript
import { inngest } from '../inngest/client';  // CRASHES VERCEL
```

**CORRECT:**
```typescript
import { Inngest } from 'inngest';            // Direct package import
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

### 3. Shared Library Imports — VERIFIED SAFE
`api/lib/auth.ts` and `api/lib/supabase.ts` only import from npm packages. They are safe to use:
```typescript
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
```

### 4. After Deploy — Sync Inngest
After any push that changes Inngest functions, run:
```bash
curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest
```

---

## Your Assignment

### Execute: Slice 8 (Website Auto-Scan) → then Slice 9 (Slack Activation)

**Do Slice 8 first**, then Slice 9. Slice 9 modifies a file that Slice 8 also modifies (`provision-tenant.ts`), so sequential execution avoids merge conflicts.

---

### Slice 8: Website Auto-Scan API

**Instruction doc:** `docs/phase1/codex-slice-8-scan.md`

Creates `POST /api/tenants/scan` — called by the frontend during onboarding. Fetches a company URL, extracts brand profile via LLM, returns structured JSON.

**What you'll build:**
1. **NEW** `api/tenants/scan.ts` — scan endpoint
2. **MODIFY** `api/inngest/functions/provision-tenant.ts` — enrich `buildSoulTemplate()` with scan results + tone mapping

**Key notes:**
- Auth: uses `supabase.auth.getUser()` directly (tenant may not exist yet during onboarding)
- LLM model: `openai/gpt-4o-mini` via LiteLLM
- No new dependencies needed (built-in `fetch` + regex for HTML parsing)
- No new env vars needed

---

### Slice 9: Slack Activation Inngest Workflow

**Instruction doc:** `docs/phase1/codex-slice-9-slack-activation.md`

After a customer completes Slack OAuth, an Inngest workflow SSHes into their droplet and injects the Slack channel config. OpenClaw hot-reloads and the bot comes alive.

**What you'll build:**
1. **NEW** `api/inngest/functions/activate-slack.ts` — Inngest function (6 steps)
2. **MODIFY** `api/inngest/index.ts` — register `activateSlack` in functions array
3. **MODIFY** `api/connections/slack/callback.ts` — fire `pixelport/slack.connected` Inngest event after successful upsert
4. **MODIFY** `api/inngest/functions/provision-tenant.ts` — add `SLACK_APP_TOKEN` to cloud-init `.env`

**Key notes:**
- New dependency: `ssh2` (install `ssh2` + `@types/ssh2`)
- New env vars needed: `SLACK_APP_TOKEN`, `SSH_PRIVATE_KEY` (will be added by founder/CTO before testing)
- OpenClaw hot-reloads channel changes — NO restart needed
- The `callback.ts` currently sets `is_active: true` in the upsert. Change this to `is_active: false` — the activation workflow (step 6: `mark-slack-active`) sets it to `true` after confirming the droplet config update succeeded.

---

## Execution Order

```
1. Read CLAUDE.md and this go-package
2. Read docs/phase1/codex-slice-8-scan.md
3. Execute Slice 8 (scan endpoint + SOUL template enrichment)
4. Commit Slice 8
5. Read docs/phase1/codex-slice-9-slack-activation.md
6. Execute Slice 9 (activate-slack function + callback modification + cloud-init update)
7. Commit Slice 9
8. Push to main
9. Update docs/SESSION-LOG.md
```

---

## Important: callback.ts `is_active` Fix

When modifying `api/connections/slack/callback.ts` in Slice 9, also change the upsert to set `is_active: false` instead of `true`:

**Current (line 176 of callback.ts):**
```typescript
is_active: true,
```

**Change to:**
```typescript
is_active: false,  // Activation workflow sets true after droplet config update
```

This ensures the connections status API shows "connected but not yet active" until the Inngest workflow confirms the bot is actually responding on the droplet.

---

## Environment Variables

### Already Set in Vercel (from Phase 0)
| Variable | Status |
|----------|--------|
| SUPABASE_PROJECT_URL | SET |
| SUPABASE_SERVICE_ROLE_KEY | SET |
| LITELLM_URL | SET |
| LITELLM_MASTER_KEY | SET |
| DO_API_TOKEN | SET |
| INNGEST_EVENT_KEY | SET |
| INNGEST_SIGNING_KEY | SET |
| API_KEY_ENCRYPTION_KEY | SET |
| SLACK_CLIENT_ID | SET |
| SLACK_CLIENT_SECRET | SET |
| SLACK_SIGNING_SECRET | SET |

### NEW — Will Be Added Before Live Testing
| Variable | Source | Notes |
|----------|--------|-------|
| SLACK_APP_TOKEN | Slack App Socket Mode settings | `xapp-...` format, founder will create |
| SSH_PRIVATE_KEY | Generated by CTO | Full PEM content (multi-line), CTO will add |

**Your code should handle these being unset gracefully** — throw clear errors in the Inngest steps, don't crash at module load time.

---

## Testing After Completion

### Slice 8
```bash
# TypeScript compiles
npx tsc --noEmit api/tenants/scan.ts

# Endpoint responds (after deploy)
curl -s https://pixelport-launchpad.vercel.app/api/tenants/scan  # → 401

# No local Inngest imports
grep -r "from.*inngest/client" api/tenants/

# No hardcoded secrets
grep -r "sk-\|eyJ" api/tenants/scan.ts
```

### Slice 9
```bash
# TypeScript compiles
npx tsc --noEmit api/inngest/functions/activate-slack.ts

# No local Inngest imports
grep -r "from.*inngest/client" api/inngest/functions/activate-slack.ts api/connections/slack/callback.ts

# No hardcoded secrets
grep -r "xoxb-\|xapp-\|sk-\|eyJ\|BEGIN.*PRIVATE" api/inngest/functions/activate-slack.ts api/connections/slack/callback.ts

# ssh2 installed
node -e "require('ssh2')"

# After deploy: sync Inngest
curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest
```

---

## Commit Guidelines

- Work on `main` branch
- One commit per slice (2 total)
- Clear commit messages describing what was built
- Include `Co-Authored-By: Codex <noreply@openai.com>` in commits
- Push when both slices are done — Vercel auto-deploys from main
- Update `docs/SESSION-LOG.md` after completing work

---

## Summary

| Slice | Task | Status | Instruction Doc |
|-------|------|--------|-----------------|
| 5 | Tenant Creation | DONE | — |
| 6 | Chat API (SSE) | DONE | — |
| 7 | Slack OAuth | DONE | — |
| **8** | **Website Auto-Scan** | **Execute** | `codex-slice-8-scan.md` |
| **9** | **Slack Activation** | **Execute** | `codex-slice-9-slack-activation.md` |
