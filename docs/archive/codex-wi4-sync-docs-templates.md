# Codex Instruction Pack: WI-4 — Sync Docs/Templates with Runtime

## Context

We fixed 4 bugs in the Slack bot E2E flow (SSH key, python3 scripts, config schema, LiteLLM routing). The runtime code (`provision-tenant.ts`, `activate-slack.ts`) is now correct and proven working. However, 3 reference files are stale and show old/invalid config that no longer matches what actually runs on droplets.

## Scope

Update 3 files to match the proven runtime code. No code changes — docs/templates only.

## Source of Truth

All changes must match the runtime functions in `api/inngest/functions/provision-tenant.ts`:
- `buildOpenClawConfig()` (lines 496-584) — OpenClaw JSON config
- `buildCloudInit()` (lines 408-493) — cloud-init shell script
- `buildSlackConfig()` in `api/inngest/functions/activate-slack.ts` (lines 117-132) — Slack channel config

---

## Task 1: Fix `docs/openclaw-reference.md` Section 8 (lines 303-322)

**Problem:** Section 8 "Slack Channel Configuration" shows capitalized action keys and `allowBotMessages` that OpenClaw 2026.2.24's strict schema rejects.

**Replace lines 303-322 with:**

```
## 8. Slack Channel Configuration

```json5
channels: {
  slack: {
    enabled: true,
    botToken: "xoxb-...",
    appToken: "xapp-...",    // Socket Mode token (env var substitution: "${SLACK_APP_TOKEN}")
    dmPolicy: "open",        // pairing | allowlist | open | disabled
    allowFrom: ["*"],        // required when dmPolicy is "open"
    replyToMode: "first",    // first | all
    configWrites: true,      // allow config changes via Slack commands
  },
}
```

> **Note (2026.2.24):** OpenClaw strictly validates the Slack config schema. The following keys are **rejected** and must NOT be included: `Messages`, `DM`, `Reactions`, `Pins`, `MemberInfo`, `EmojiList`, `ChannelInfo`, `allowBotMessages`. Only the keys shown above are accepted.
```

**Verification:** Grep for `Messages`, `DM`, `Reactions`, `allowBotMessages` in Section 8 — should find zero matches.

---

## Task 2: Replace `infra/provisioning/openclaw-template.json`

**Problem:** Template uses old `gateway.token` format (should be `gateway.auth.token`), agents as flat array (should be `agents.list`), no `agents.defaults.model`, no `models.providers.litellm` section, model names without `litellm/` prefix.

**Replace entire file with:**

```json
{
  "_comment": "OpenClaw configuration template for PixelPort tenants. Matches buildOpenClawConfig() in provision-tenant.ts.",
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "{{GATEWAY_TOKEN}}"
    },
    "bind": "lan",
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
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
      {
        "id": "main",
        "name": "Chief of Staff",
        "workspace": "/home/node/.openclaw/workspace-main",
        "model": "litellm/gpt-5.2-codex"
      },
      {
        "id": "content",
        "name": "Content Agent",
        "workspace": "/home/node/.openclaw/workspace-content",
        "model": "litellm/gpt-4o-mini"
      },
      {
        "id": "growth",
        "name": "Research Agent",
        "workspace": "/home/node/.openclaw/workspace-growth",
        "model": "litellm/gpt-4o-mini"
      }
    ]
  },
  "models": {
    "mode": "merge",
    "providers": {
      "litellm": {
        "baseUrl": "{{LITELLM_URL}}/v1",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-responses",
        "authHeader": true,
        "models": [
          {
            "id": "gpt-5.2-codex",
            "name": "GPT 5.2 Codex",
            "api": "openai-responses",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 32000
          },
          {
            "id": "gpt-4o-mini",
            "name": "GPT 4o Mini",
            "api": "openai-responses",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 16384
          },
          {
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "api": "openai-responses",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 16384
          }
        ]
      }
    }
  }
}
```

**Verification:**
- `gateway.auth.token` exists (NOT `gateway.token`)
- `agents.list` is an array (NOT `agents` as flat array)
- `agents.defaults.model.primary` is `litellm/gpt-5.2-codex`
- `models.providers.litellm` section exists with 3 models
- All agent model refs use `litellm/` prefix

---

## Task 3: Replace `infra/provisioning/cloud-init.yaml`

**Problem:** Uses `-p 18789:18789` port mapping (should be `--network host`), missing volume mounts for `canvas`, `cron`, `agents` directories, missing `openclaw.mjs gateway` command with flags.

**Replace entire file with:**

```yaml
#cloud-config
# PixelPort Tenant Provisioning — cloud-init Template
# This template documents the expected shape of the provisioning script.
# The actual runtime script is generated by buildCloudInit() in provision-tenant.ts.
#
# Variables (replaced at runtime by Inngest provisioning function):
#   {{TENANT_SLUG}}       — tenant identifier
#   {{OPENCLAW_IMAGE}}    — Docker image (e.g., ghcr.io/openclaw/openclaw:2026.2.24)
#   {{GATEWAY_TOKEN}}     — random UUID for gateway auth
#   {{LITELLM_KEY}}       — LiteLLM virtual key for this tenant
#   {{LITELLM_URL}}       — LiteLLM proxy base URL
#   {{AGENTMAIL_API_KEY}} — AgentMail API key

runcmd:
  - |
    set -euo pipefail

    # 1. Install Docker CE if not already present
    if ! command -v docker &> /dev/null; then
      apt-get update -y
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
      systemctl enable docker
      systemctl start docker
    fi

    # 2. Pull the OpenClaw image
    docker pull {{OPENCLAW_IMAGE}}

    # 3. Create config, workspace, and runtime directories
    mkdir -p /opt/openclaw
    mkdir -p /opt/openclaw/workspace-main
    mkdir -p /opt/openclaw/workspace-content
    mkdir -p /opt/openclaw/workspace-growth
    mkdir -p /opt/openclaw/canvas
    mkdir -p /opt/openclaw/cron
    mkdir -p /opt/openclaw/agents

    # 4. Write openclaw.json (generated from buildOpenClawConfig)
    # 5. Write workspace-main/SOUL.md (generated from buildSoulTemplate)
    # 6. Write .env (OPENAI_API_KEY, OPENAI_BASE_URL, AGENTMAIL_API_KEY, SLACK_APP_TOKEN)

    # 7. Set ownership (OpenClaw container runs as node:1000)
    chown -R 1000:1000 /opt/openclaw

    # 8. Run the OpenClaw gateway container
    # --network host: required because OpenClaw binds to 127.0.0.1 in bridge mode
    # --env-file: secrets (LiteLLM key, AgentMail key, Slack app token)
    # openclaw.mjs gateway: explicit entrypoint with port and bind flags
    docker run -d \
      --name openclaw-gateway \
      --restart unless-stopped \
      --network host \
      --env-file /opt/openclaw/.env \
      -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \
      -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \
      -v /opt/openclaw/workspace-content:/home/node/.openclaw/workspace-content \
      -v /opt/openclaw/workspace-growth:/home/node/.openclaw/workspace-growth \
      -v /opt/openclaw/canvas:/home/node/.openclaw/canvas \
      -v /opt/openclaw/cron:/home/node/.openclaw/cron \
      -v /opt/openclaw/agents:/home/node/.openclaw/agents \
      {{OPENCLAW_IMAGE}} \
      openclaw.mjs gateway --port 18789 --bind lan --allow-unconfigured
```

**Verification:**
- Uses `--network host` (NOT `-p 18789:18789`)
- Has `--env-file /opt/openclaw/.env`
- Has 7 volume mounts (openclaw.json + 3 workspaces + canvas + cron + agents)
- Has `openclaw.mjs gateway --port 18789 --bind lan --allow-unconfigured` command
- Has Docker CE install block
- Has `chown -R 1000:1000 /opt/openclaw`

---

## Rollback

If any file is wrong, revert with:
```bash
git checkout HEAD -- docs/openclaw-reference.md infra/provisioning/openclaw-template.json infra/provisioning/cloud-init.yaml
```

## Success Criteria

All 3 files updated. No runtime code changed. Grep confirms:
1. `docs/openclaw-reference.md` Section 8 has NO capitalized action keys or `allowBotMessages`
2. `infra/provisioning/openclaw-template.json` has `gateway.auth.token`, `agents.list`, `models.providers.litellm`
3. `infra/provisioning/cloud-init.yaml` has `--network host`, 7 volume mounts, `openclaw.mjs gateway` command
