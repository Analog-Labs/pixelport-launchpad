# OpenClaw Platform Reference (Compiled from docs.openclaw.ai)

> Comprehensive reference for Claude Code so it doesn't need to research OpenClaw from scratch.
> Source: https://docs.openclaw.ai/ (fetched 2026-02-25)
>
> **Compatibility warning for this project:** The production droplet currently runs OpenClaw `2026.2.24`.
> In this version, `tools.web.search.provider = "gemini"` is schema-valid and active in production.
> Keep validating against live runtime behavior before config edits, especially for fast-moving CLI/plugin features.
> Email integration uses AgentMail (vidacious@agentmail.to). Gmail approach was replaced — see Phase F in project status.
> In this deployment, unresolved tool groups can create warning noise; `group:memory` and `group:automation` were removed from agent allowlists for cleaner operations.
> Current LUNA runtime model policy in production: primary `openai/gpt-5.2-codex`, fallback `google/gemini-2.5-flash`.
> Note: `gpt-5.3-codex` maps to `openai-codex` OAuth provider in this build; don't switch to it unless OAuth auth profiles are configured.

---

## 1. Architecture Overview

OpenClaw is an open-source (MIT) AI agent platform. It runs as a persistent Node.js process (the "Gateway") on your hardware, connecting AI models to messaging platforms and tools.

```
[ CHANNELS ]  ←→  [ GATEWAY (Node.js, port 18789) ]  ←→  [ LLM PROVIDERS ]
(Slack, WhatsApp,       (State, Routing, Sessions,         (OpenAI, Anthropic,
 Telegram, Web UI)       Tools, Command Queue)               Gemini, Ollama)
                              ↕
                      [ TOOLS & SKILLS ]
                      (Browser, FS, Shell, Cron,
                       Webhooks, Sub-agents, MCP)
```

**Key concepts:**
- **Gateway:** Single Node.js process, WebSocket server on `127.0.0.1:18789`. Hub-and-spoke: all messages route through it.
- **Agent Runtime:** Assembles context (session history + memory), invokes model, executes tool calls, persists state.
- **Sessions:** Stateful conversations. Processed one message at a time per session (serialized via Command Queue).
- **Workspace:** Each agent gets a directory with identity files, memory, tools config, skills.

---

## 2. Configuration

**File:** `~/.openclaw/openclaw.json` (JSON5 — comments + trailing commas OK)

### Critical Rules
- **Strict schema validation** — unknown keys prevent Gateway boot
- Use `openclaw doctor` to diagnose config issues  
- Config **hot-reloads** automatically (most changes don't need restart)
- Gateway-level changes (port, auth, TLS) DO need restart
- Direct edit OK, or use CLI: `openclaw config get/set/unset`
- Or use Control UI at `http://127.0.0.1:18789` Config tab

### Hot Reload Behavior
| Category | Restart needed? |
|----------|----------------|
| Channels, Agent & models, Automation, Sessions, Tools & media, UI | **No** |
| Gateway server (port, bind, auth, TLS) | **Yes** |
| Infrastructure (discovery, plugins) | **Yes** |

### Environment Variables
OpenClaw reads from (in order):
1. Parent process env
2. `.env` from current working directory
3. `~/.openclaw/.env` (global fallback)

Can also set inline: `env: { vars: { GEMINI_API_KEY: "..." } }`

Env var substitution in config values: `${VAR_NAME}` (uppercase only). Missing vars throw error at load time.

### Minimal Config
```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

---

## 3. Multi-Agent Setup

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.2-codex" },
      workspace: "~/.openclaw/workspace",
    },
    list: [
      { id: "main", name: "LUNA", default: true, workspace: "~/.openclaw/workspace-main",
        tools: { profile: "full", allow: ["group:fs","group:sessions","group:web","group:messaging","browser","image","group:ui"] }
      },
      { id: "content", name: "SPARK", workspace: "~/.openclaw/workspace-content",
        tools: { profile: "full", allow: ["group:fs","group:sessions","group:web","browser"] }
      },
      { id: "growth", name: "SCOUT", workspace: "~/.openclaw/workspace-growth",
        tools: { profile: "full", allow: ["group:fs","group:sessions","group:web","browser","image"] }
      },
    ],
  },
  // Optional: bind agents to specific channels/contacts
  bindings: [
    { agentId: "work", match: { channel: "slack", peer: { kind: "group", id: "C123" } } },
  ],
}
```

Each agent has its own workspace, session history, memory, and tools. They communicate via `sessions_spawn`.

---

## 4. Tools System

### Tool Profiles
```json5
tools: {
  profile: "full",  // "full" | "coding" | "messaging" | "minimal"
  allow: ["group:fs", "browser"],  // additional allowlist
  deny: ["cron"],  // deny always wins
}
```
Per-agent override: `agents.list[].tools.profile` / `.allow` / `.deny`

### Tool Groups (shorthands for allow/deny)
| Group | Expands to |
|-------|-----------|
| `group:runtime` | exec, bash, process |
| `group:fs` | read, write, edit, apply_patch |
| `group:sessions` | sessions_list, sessions_history, sessions_send, sessions_spawn, session_status |
| `group:memory` | memory_search, memory_get |
| `group:web` | web_search, web_fetch |
| `group:ui` | browser, canvas |
| `group:automation` | cron, gateway |
| `group:messaging` | message |
| `group:nodes` | nodes |
| `group:openclaw` | all built-in tools |

### Tool Inventory

**exec** — Run shell commands. Params: command (required), yieldMs, background, timeout, elevated, host, security.

**process** — Manage background exec sessions. Actions: list, poll, log, write, kill, clear, remove.

**web_search** — Search web via configured provider. Params: query (required), count (1-10).

**web_fetch** — HTTP GET + readable extraction (HTML→markdown). Params: url (required), extractMode, maxChars. Does NOT execute JS.

**browser** — Control dedicated OpenClaw-managed Chromium. Actions: status, start, stop, tabs, open, focus, close, snapshot, screenshot, act, navigate, console, pdf, upload, dialog. Requires `browser.enabled=true`.

**message** — Send messages across channels (Slack/WhatsApp/Telegram/Discord/etc). Actions: send, poll, react, read, edit, delete, pin, thread-create, search, channel-info, member-info.

**sessions_spawn** — Start a new conversation session with another agent. Params: task (required), label, agentId, model, thinking, runTimeoutSeconds, thread, mode, cleanup.

**sessions_send** — Send message to existing session. Params: sessionKey/sessionId, message, timeoutSeconds (0 = fire-and-forget).

**sessions_list** — List sessions. Params: kinds, limit, activeMinutes, messageLimit.

**sessions_history** — Inspect transcript. Params: sessionKey/sessionId, limit, includeTools.

**agents_list** — List available agents and their allowed targets.

**cron** — Manage Gateway cron jobs. Actions: status, list, add, update, remove, run, runs, wake.

**gateway** — Restart or apply updates. Actions: restart, config.get, config.schema, config.apply, config.patch, update.run.

**image** — Analyze image with configured image model. Params: image (path/URL), prompt, model.

**memory_search / memory_get** — Agent memory operations.

---

## 5. Web Search Providers

> Version scope note:
> The examples below are platform-level reference. On this project's currently deployed OpenClaw `2026.2.24`,
> use only provider keys supported by that build's schema. Validate live schema before applying provider-specific snippets.

### Auto-Detection Order (when no provider explicitly set)
1. **Brave** — checks `BRAVE_API_KEY` env or `search.apiKey` config
2. **Gemini** — checks `GEMINI_API_KEY` env or `search.gemini.apiKey` config  
3. **Perplexity** — checks `PERPLEXITY_API_KEY` / `OPENROUTER_API_KEY`
4. **Grok** — checks `XAI_API_KEY`
5. Falls back to Brave (missing-key error if no key found)

### Provider Comparison
| Provider | Type | Key Env Var | Config Key |
|----------|------|------------|------------|
| Brave (default) | Structured results | `BRAVE_API_KEY` | `tools.web.search.apiKey` |
| Gemini | AI-synthesized + Google Search grounding | `GEMINI_API_KEY` | `tools.web.search.gemini.apiKey` |
| Perplexity | AI-synthesized + citations | `PERPLEXITY_API_KEY` or `OPENROUTER_API_KEY` | `tools.web.search.perplexity.apiKey` |

### Brave Setup
```json5
tools: { web: { search: {
  enabled: true,
  provider: "brave",
  apiKey: "BRAVE_API_KEY_HERE",
  maxResults: 5,
  timeoutSeconds: 30,
  cacheTtlMinutes: 15,
}}}
```
Free tier at https://brave.com/search/api/ (choose "Data for Search" plan, NOT "Data for AI").

### Gemini Setup
```json5
tools: { web: { search: {
  provider: "gemini",
  gemini: {
    apiKey: "AIza...",       // optional if GEMINI_API_KEY env set
    model: "gemini-2.5-flash",  // default, fast + cost-effective
  },
}}}
```
Get key at https://aistudio.google.com/apikey. Set `GEMINI_API_KEY` in env or `~/.openclaw/.env`.

**IMPORTANT:** If you have GEMINI_API_KEY set but no explicit provider, auto-detection checks Brave first. If no Brave key exists, it falls through to Gemini. To force Gemini, set `provider: "gemini"` explicitly.

### Perplexity Setup (via OpenRouter)
```json5
tools: { web: { search: {
  enabled: true,
  provider: "perplexity",
  perplexity: {
    apiKey: "sk-or-v1-...",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "perplexity/sonar-pro",
  },
}}}
```

### web_fetch Config
```json5
tools: { web: { fetch: {
  enabled: true,        // default: true
  maxChars: 50000,
  maxCharsCap: 50000,
  timeoutSeconds: 30,
  cacheTtlMinutes: 15,
}}}
```

---

## 6. Inter-Agent Communication (Sessions)

### sessions_spawn
Creates a new conversation with another agent:
```
sessions_spawn(task: "Write a LinkedIn post about...", agentId: "content")
```
- Target agent processes in a new session with full access to its workspace, memory, tools
- Results return to spawning agent
- Default model: inherits caller unless overridden
- `runTimeoutSeconds`: 0 = no timeout (default)

### Allowlist Control
```json5
agents: { list: [{
  id: "main",
  subagents: {
    allowAgents: ["content", "growth"],  // which agents can be spawned
    // or ["*"] to allow any
  },
}]}
```
Discovery: `agents_list` tool shows which agent IDs are allowed for `sessions_spawn`.

### Sub-Agents (Disposable)
Different from persistent multi-agent — these are temporary:
- Don't get session tools by default
- Auto-archive after `archiveAfterMinutes` (default: 60)
- Can set cheaper model via `agents.defaults.subagents.model`

```json5
agents: { defaults: { subagents: {
  maxConcurrent: 1,
  model: "openai/gpt-4o-mini",  // cheaper for disposable work
}}}
```

---

## 7. Workspace Files

Each agent workspace contains:

| File | Purpose | Notes |
|------|---------|-------|
| `SOUL.md` | Identity, personality, decision framework | Core identity |
| `IDENTITY.md` | Name, role, capabilities | Auto-generated |
| `USER.md` | Info about the user | Agent's understanding of user |
| `TOOLS.md` | Tool usage guidance | **Must be customized** (ships as generic template) |
| `AGENTS.md` | Inter-agent communication instructions | How to work with other agents |
| `MEMORY.md` | Persistent memory/learnings | Accumulates over time |
| `HEARTBEAT.md` | Proactive scan checklist | For scheduled behaviors |
| `BOOTSTRAP.md` | Initial setup instructions | First-run context |

**Skills** are loaded from:
1. `<workspace>/skills` (highest precedence, per-agent)
2. `~/.openclaw/skills` (shared across agents)
3. Bundled skills (lowest)

---

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

---

## 9. Cron Jobs & Heartbeat

### Cron Config
```json5
cron: { enabled: true, maxConcurrentRuns: 2, sessionRetention: "24h" }
```

### Adding a Job
```json5
{
  "name": "Morning Brief",
  "schedule": { "kind": "cron", "expr": "0 8 * * *" },
  "sessionTarget": "isolated",
  "payload": { "kind": "agentTurn", "message": "Run your morning scan checklist." }
}
```

### Heartbeat (simpler alternative)
```json5
agents: { defaults: { heartbeat: {
  every: "30m",      // duration string. "0m" to disable
  target: "last",    // last | whatsapp | telegram | slack | discord | none
}}}
```

---

## 10. Hooks (Webhooks)

```json5
hooks: {
  enabled: true,
  token: "shared-secret",
  path: "/hooks",
  mappings: [{
    match: { path: "gmail" },
    action: "agent",
    agentId: "main",
    deliver: true,
  }],
}
```
Endpoint: `POST http://localhost:18789/hooks/<path>?token=<token>`

---

## 11. Models Configuration

```json5
agents: { defaults: {
  model: {
    primary: "openai/gpt-5.2-codex",
    fallbacks: ["google/gemini-2.5-flash"],
  },
  models: {
    "openai/gpt-5.2-codex": { alias: "Codex" },
  },
}}
```
Model refs use `provider/model` format. OpenClaw rotates through auth profiles on rate limits.

---

## 12. CLI Quick Reference

```bash
openclaw doctor              # diagnose config issues
openclaw doctor --fix        # auto-repair
openclaw health              # gateway health
openclaw status              # full status
openclaw config get <path>   # read config value
openclaw config set <path> <value>  # set value
openclaw config unset <path> # remove value
openclaw channels list/status
openclaw agents list
openclaw cron list/status/add
openclaw memory search <query>
openclaw sessions
openclaw models list
openclaw browser status
openclaw skills list
```

---

## 13. Common Gotchas & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Bot thinks but doesn't respond | Slack Actions toggles OFF | Enable Messages, DM in UI > Channels > Slack |
| `missing_recipient_team_id` | Slack settings disabled | Enable ALL action toggles |
| Unknown keys crash gateway | Strict schema | Use `openclaw doctor`. Don't add unrecognized keys |
| TOOLS.md = home automation | Generic templates | Must rewrite per agent |
| Web search fails | Missing provider config | Set `provider: "gemini"` explicitly if using Gemini key |
| Search auto-detects wrong provider | Multiple API keys | Set `provider` explicitly |
| Env vars not in container | .env not mounted | Use bind mount or `env.vars` in config |
| `allowFrom: ["*"]` required | dmPolicy is "open" | Add alongside `dmPolicy: "open"` |

---

## 14. Key Documentation URLs

- **Config:** https://docs.openclaw.ai/gateway/configuration
- **Config Reference:** https://docs.openclaw.ai/gateway/configuration-reference
- **Config Examples:** https://docs.openclaw.ai/gateway/configuration-examples
- **Tools:** https://docs.openclaw.ai/tools
- **Web Tools:** https://docs.openclaw.ai/tools/web
- **Sub-Agents:** https://docs.openclaw.ai/tools/subagents
- **Skills:** https://docs.openclaw.ai/tools/skills
- **Browser:** https://docs.openclaw.ai/tools/browser
- **Cron:** https://docs.openclaw.ai/automation/cron-jobs
- **Hooks:** https://docs.openclaw.ai/automation/hooks
- **Gmail PubSub:** https://docs.openclaw.ai/automation/gmail-pubsub
- **Slack:** https://docs.openclaw.ai/channels/slack
- **Multi-Agent:** https://docs.openclaw.ai/concepts/multi-agent
- **Sessions:** https://docs.openclaw.ai/concepts/session
- **Heartbeat:** https://docs.openclaw.ai/gateway/heartbeat
- **CLI:** https://docs.openclaw.ai/cli
- **Troubleshooting:** https://docs.openclaw.ai/gateway/troubleshooting
- **FAQ:** https://docs.openclaw.ai/help/faq
- **GitHub:** https://github.com/openclaw/openclaw
