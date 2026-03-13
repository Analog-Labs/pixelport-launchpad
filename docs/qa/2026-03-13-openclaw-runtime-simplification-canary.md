# OpenClaw Runtime Simplification + Upgrade Canary (2026-03-13)

## Scope

Validated the founder-approved runtime simplification in two isolated steps:

1. Step 1: no custom Chromium build, runtime pinned to `ghcr.io/openclaw/openclaw:2026.3.2`
2. Step 2: same simplified runtime path, runtime pinned to `ghcr.io/openclaw/openclaw:2026.3.11`

Policy locks in this rollout:
- browser tool disabled (`tools.deny: ["browser"]`)
- `OPENCLAW_RUNTIME_IMAGE` remains optional override
- Growth Swarm excluded
- no mass reprovisioning of existing tenants

## Step 1 Canary (`2026.3.2`, no custom image build)

Tenant:
- `openclaw-canary-step1-2026-3-2-mmoa4tyv`
- tenant id `175a80df-1150-4880-9773-2bf60a092c31`

Droplet:
- id `557903542`
- IP `64.227.21.130`

Runtime proof:
- `docker ps` image: `ghcr.io/openclaw/openclaw:2026.3.2`
- `openclaw --version`: `2026.3.2`
- no `*-chromium` image build path used

Config proof:
- `acp.dispatch.enabled=false`
- `agents.list[0].tools.deny=["browser"]`
- `tools.sessions.visibility="all"`
- `tools.agentToAgent.enabled=true`
- `agents.defaults.memorySearch.enabled=true` with `${MEMORY_OPENAI_API_KEY}`

ACP checks:
- current config validation passed: `openclaw config validate --json` => `{"valid":true,...}`
- ACP-enabled variant validation passed via isolated profile: `openclaw --profile acpcheck config validate --json` => `{"valid":true,...}`

Truth checks:
- tenant status `active`
- bootstrap status `accepted`
- dashboard APIs responded `200` for:
  - `/api/tenants/status`
  - `/api/tasks`
  - `/api/vault`
  - `/api/competitors`

Captured counts at check time:
- `vault_sections=5`
- `agent_tasks=0`
- `competitors=0`
- `workspace_events=0`
- `sessions_log=0`

## Step 2 Canary (`2026.3.11`, same simplified path)

Tenant:
- `openclaw-canary-step2-2026-3-11-mmoatomg`
- tenant id `858eb9ac-5605-4570-a670-48f06d6099bc`

Droplet:
- id `557905772`
- IP `67.205.139.111`

Runtime proof:
- `docker ps` image: `ghcr.io/openclaw/openclaw:2026.3.11`
- `openclaw --version`: `OpenClaw 2026.3.11`

Provision result payload:
- `success=true`
- `bootstrapAccepted=true`
- `bootstrapStatus=200`
- `requestedSize=s-1vcpu-2gb`
- `requestedRegion=nyc1`

Config + ACP checks:
- same policy shape as Step 1 (`browser` denied, sessions/agentToAgent unchanged, memorySearch defaults unchanged)
- current config validation passed (`acp.dispatch.enabled=false`)
- ACP-enabled profile variant validation passed

Truth checks:
- tenant status `active`
- bootstrap status `accepted`
- dashboard APIs responded `200` for status/tasks/vault/competitors

Captured counts at check time:
- `vault_sections=5`
- `agent_tasks=0`
- `competitors=0`
- `workspace_events=0`
- `sessions_log=0`

## Cross-Step Comparison

Unchanged between `2026.3.2` and `2026.3.11` in this canary:
- browser is blocked by policy (intentional)
- sessions delegation toggles remain intact
- ACP false config validates
- ACP-enabled variant validates
- dashboard read endpoints remain truthful/healthy (`200`)
- local runtime caveat remains: no early task/competitor/workspace-event writes captured during this check window

Memory CLI parity note:
- `openclaw memory status --json` and `openclaw memory search` both returned `unable to open database file` on both canary droplets
- this appears unchanged by version upgrade (no new regression introduced by `2026.3.11`)

## Cleanup

Database/auth cleanup:
- completed for all canary tenant rows in FK-safe order
- auth users deleted
- no remaining `openclaw-canary-step1-2026-3-2-%` or `openclaw-canary-step2-2026-3-11-%` tenant rows

Droplet cleanup blocker:
- DO API `DELETE /v2/droplets/{id}` returned `403 Forbidden`
- message: `You are not authorized to perform this operation`
- blocker affects both canary droplets (`557903542`, `557905772`)

## Verdict

Recommendation: `upgrade default now`

Rationale:
- new default (`2026.3.11`) passed the same canary gates as `2026.3.2` on the simplified runtime path
- no new regressions were observed in the validated surfaces
- this rollout removes per-tenant Chromium image build overhead and keeps rollback simple (image pin revert only)

Follow-up required:
- fix DO token delete scope (or delete canary droplets manually) to restore automated disposable-canary cleanup.
