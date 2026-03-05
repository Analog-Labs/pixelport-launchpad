# Codex QA Brief: Slack Bot E2E Fixes

## Context

PixelPort provisions an OpenClaw-based AI agent per tenant on DigitalOcean droplets. Each droplet runs OpenClaw inside Docker, which connects to Slack via Socket Mode and routes LLM calls through a central LiteLLM proxy on Railway.

We fixed 4 bugs that prevented the Slack bot from responding. This brief documents the bugs, fixes applied, and QA tasks for Codex to verify and test.

---

## Bugs Found & Fixed

### Bug 1: SSH Key Mismatch (FIXED — env var)
- **Symptom:** `activate-slack` Inngest workflow silently failed at SSH step
- **Root cause:** `SSH_PRIVATE_KEY` in Vercel was an ed25519 key (419 chars) that didn't match any authorized key on the droplet
- **Fix:** Founder updated Vercel env var to RSA key matching DO account keys (2610 chars)
- **Verification:** `test-activate-slack` endpoint now passes SSH step

### Bug 2: `node` Not Available on Droplet Host (FIXED — code)
- **Symptom:** SSH config injection script failed with `node: command not found`
- **Root cause:** `activate-slack.ts` used `node -` heredocs for JSON manipulation, but Node.js only exists inside the Docker container, not on the Ubuntu host
- **Fix:** Replaced all `node -` scripts with `python3` (always available on Ubuntu 24.04)
- **Files changed:**
  - `api/inngest/functions/activate-slack.ts` — `buildConfigPatchScript()` and `CONFIG_CHECK_SCRIPT`
  - `api/debug/test-activate-slack.ts` — same pattern
- **Commit:** `5670bdd`

### Bug 3: OpenClaw Config Schema Validation (FIXED — code)
- **Symptom:** OpenClaw gateway crash-loop with `Unrecognized keys` error
- **Root cause:** Slack config template included capitalized action keys (`Messages`, `DM`, `Reactions`, etc.) and `allowBotMessages` that OpenClaw 2026.2.24's strict schema rejects
- **Fix:** Stripped to minimal validated schema: `enabled`, `botToken`, `appToken`, `dmPolicy`, `allowFrom`, `replyToMode`, `configWrites`
- **Files changed:**
  - `api/inngest/functions/activate-slack.ts` — `buildSlackConfig()`
  - `api/debug/test-activate-slack.ts` — same pattern
- **Commit:** `4bd886e`

### Bug 4: LLM 401 — OpenClaw Ignores OPENAI_BASE_URL (FIXED — code)
- **Symptom:** Bot receives Slack messages but returns `401 Incorrect API key provided: sk-zJROY*...`
- **Root cause:** OpenClaw has its own provider system and **ignores the `OPENAI_BASE_URL` env var**. The built-in `openai` provider hardcodes `api.openai.com` as the endpoint. Since `OPENAI_API_KEY` contains a LiteLLM virtual key (not a real OpenAI key), requests to `api.openai.com` fail with 401.
- **Fix:** Define a custom `litellm` provider in `models.providers` config with `baseUrl` pointing to the LiteLLM proxy. Change all model refs from `openai/model` to `litellm/model`.
- **Files changed:**
  - `api/inngest/functions/provision-tenant.ts` — `buildOpenClawConfig()` now includes `models.providers.litellm` section and uses `litellm/` model prefixes
- **Commits:** `1abd995`, `929b7ad`
- **Config structure (applied to droplet and baked into provision template):**

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "litellm": {
        "baseUrl": "https://litellm-production-77cc.up.railway.app/v1",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-responses",
        "authHeader": true,
        "models": [
          { "id": "gpt-5.2-codex", "name": "GPT 5.2 Codex", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }, "contextWindow": 128000, "maxTokens": 32000 },
          { "id": "gpt-4o-mini", "name": "GPT 4o Mini", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }, "contextWindow": 128000, "maxTokens": 16384 },
          { "id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }, "contextWindow": 128000, "maxTokens": 16384 }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "litellm/gpt-5.2-codex",
        "fallbacks": ["litellm/gpt-4o-mini"]
      }
    },
    "list": [
      { "id": "main", "model": "litellm/gpt-5.2-codex" },
      { "id": "content", "model": "litellm/gpt-4o-mini" },
      { "id": "growth", "model": "litellm/gpt-4o-mini" }
    ]
  }
}
```

---

## Codex QA Tasks

### Task 1: Verify `provision-tenant.ts` Config Template
**Goal:** Confirm `buildOpenClawConfig()` generates valid OpenClaw config with `litellm` provider.

1. Read `api/inngest/functions/provision-tenant.ts`
2. Verify `buildOpenClawConfig()` includes:
   - `models.providers.litellm` with `baseUrl`, `apiKey`, `api`, `authHeader`, and `models` array
   - All agent model refs use `litellm/` prefix (not `openai/`)
   - `agents.defaults.model.primary` is `litellm/gpt-5.2-codex`
3. Verify `buildCloudInit()` passes `litellmUrl` to `buildOpenClawConfig()`
4. Verify the `litellmUrl` param in `buildOpenClawConfig` type signature

### Task 2: Verify `activate-slack.ts` Uses python3
**Goal:** Confirm all SSH scripts use python3, not node.

1. Read `api/inngest/functions/activate-slack.ts`
2. Search for any remaining `node ` or `node -` references in SSH scripts
3. Verify `buildConfigPatchScript()` uses `python3 << 'PYEOF'` pattern
4. Verify `CONFIG_CHECK_SCRIPT` uses `python3 -c` pattern
5. Verify `buildSlackConfig()` only contains validated keys: `enabled`, `botToken`, `appToken`, `dmPolicy`, `allowFrom`, `replyToMode`, `configWrites`
6. Verify NO capitalized keys (`Messages`, `DM`, `Reactions`, `Pins`, `MemberInfo`, `EmojiList`, `ChannelInfo`) or `allowBotMessages`

### Task 3: Verify `test-activate-slack.ts` Debug Endpoint
**Goal:** Confirm debug endpoint mirrors production logic.

1. Read `api/debug/test-activate-slack.ts`
2. Verify Slack config template matches `activate-slack.ts` (same validated keys)
3. Verify SSH scripts use python3
4. Verify `vercel.json` has `maxDuration: 60` for this endpoint

### Task 4: Check LiteLLM Team Model Access
**Goal:** Verify the LiteLLM team's allowed models match what OpenClaw requests.

The LiteLLM team for this tenant allows: `gpt-5.2-codex`, `gemini-2.5-flash`, `gpt-4o-mini`

The custom provider defines models with IDs: `gpt-5.2-codex`, `gpt-4o-mini`, `gemini-2.5-flash`

Verify these match (no prefix, just the model name) since LiteLLM strips the provider prefix.

### Task 5: Check for Inconsistent Model References
**Goal:** Find any remaining `openai/` model references that should be `litellm/`.

Search across the entire codebase for `openai/gpt` pattern:
- `api/inngest/functions/provision-tenant.ts` — should all be `litellm/`
- `api/inngest/functions/activate-slack.ts` — does NOT reference models (only Slack config), so no changes needed
- `api/debug/*.ts` — debug endpoints don't set models
- Any other files referencing model names

**Note:** The `agents` table in Supabase stores `model: 'gpt-5.2-codex'` (without prefix) — this is correct and doesn't need the `litellm/` prefix since it's just metadata.

---

## How to Test End-to-End

1. **Vidacious test tenant** (already provisioned at `137.184.193.239`):
   - SSH: `ssh root@137.184.193.239`
   - Gateway logs: `docker logs openclaw-gateway --follow`
   - Config: `cat /opt/openclaw/openclaw.json`
   - Verify `agent model: litellm/gpt-5.2-codex` in boot logs
   - Verify `[slack] socket mode connected` in boot logs
   - DM the @Pixel bot in Slack → should get LLM response (not 401)

2. **New tenant provisioning** (requires Inngest event):
   - The `provision-tenant` Inngest function now writes `models.providers.litellm` into cloud-init
   - New droplets will boot with correct config automatically

---

## Key Architectural Decision

**Why custom provider instead of env var?**

OpenClaw 2026.2.24 has its own provider system with built-in profiles for `openai`, `anthropic`, `google`, etc. These providers have hardcoded base URLs (e.g., `api.openai.com` for `openai`). The `OPENAI_BASE_URL` env var is picked up by the OpenAI Node.js SDK but **OpenClaw's own model routing layer bypasses this** and uses its internal provider config.

Defining a custom `litellm` provider is the correct approach because:
1. It explicitly routes through our proxy with the correct base URL
2. It avoids conflicts with OpenClaw's built-in provider behavior
3. It makes the routing transparent in the config
4. It works for all models (gpt-5.2-codex, gpt-4o-mini, gemini-2.5-flash) through a single proxy

---

## Files Modified (Full List)

| File | Changes | Commit |
|------|---------|--------|
| `api/inngest/functions/activate-slack.ts` | python3 scripts, validated Slack schema | `5670bdd`, `4bd886e` |
| `api/inngest/functions/provision-tenant.ts` | `litellm` provider config, `litellm/` model refs | `1abd995`, `929b7ad` |
| `api/debug/test-activate-slack.ts` | python3 scripts, validated Slack schema | `5670bdd`, `4bd886e` |
| `api/debug/env-check.ts` | Added SSH_PRIVATE_KEY, SLACK_APP_TOKEN | `e1959fc` |
| `api/debug/slack-status.ts` | New diagnostic endpoint | `e59a0c3` |
| `api/debug/retry-activate-slack.ts` | New retry endpoint | `9e667df` |
| `api/debug/mark-slack-active.ts` | New manual activation endpoint | `80f1b89` |
| `vercel.json` | maxDuration for test-activate-slack | `b38df97` |
