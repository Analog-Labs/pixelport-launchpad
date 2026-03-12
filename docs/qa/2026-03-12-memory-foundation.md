# Native Memory Foundation QA Evidence

**Date:** 2026-03-12
**Branch:** `codex/memory-foundation`
**QA target tenant:** `vidacious-4` (`6c6ae22c-d682-4af6-83ff-79913d267aea`)
**Runtime target:** OpenClaw `2026.3.2`

---

## Scope

- native OpenClaw memory repair for the active tenant
- future-tenant inheritance through provisioning and workspace scaffold changes
- Mem0 graceful degradation only; live Mem0 activation remains out of scope

## Repo Implementation

- Added `api/lib/tenant-memory-settings.ts` as the shared source of truth for:
  - `memory_native_enabled` defaulting to `true`
  - `memory_mem0_enabled` defaulting to `false`
  - the validated OpenClaw `memorySearch` config fragment
- Updated tenant creation paths so new tenants persist the flat memory settings by default:
  - `api/tenants/index.ts`
  - `api/debug/test-provision.ts`
- Updated `api/inngest/functions/provision-tenant.ts` to:
  - resolve tenant memory settings for both old and new tenants
  - fail fast if native memory is enabled but `MEMORY_OPENAI_API_KEY` is missing
  - inject `MEMORY_OPENAI_API_KEY` into the droplet env file
  - emit `agents.defaults.memorySearch` with `provider: "openai"` and `remote.apiKey: "${MEMORY_OPENAI_API_KEY}"`
- `api/inngest/index.ts` also includes a small bundled operational improvement:
  - optional `INNGEST_SERVE_HOST` pass-through into `serve(...)`
  - not part of the memory behavior validated below
- Updated `api/lib/workspace-contract.ts` to scaffold:
  - `MEMORY.md`
  - `memory/business-context.md`
  - `memory/operating-model.md`
  - `memory/active-priorities.md`
  - native-memory guidance in `SOUL.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, and `status.json`
- Updated `api/lib/onboarding-bootstrap.ts` with one additive execution requirement to refresh native memory after canonical vault truth changes.
- Updated `api/agent/memory.ts` so Mem0-disabled or globally unavailable states return structured disabled/unavailable responses instead of raw config `500`s.

## Local Validation

- [x] `npx vitest run src/test/tenant-memory-settings.test.ts src/test/provision-tenant-memory.test.ts src/test/onboarding-bootstrap.test.ts src/test/workspace-contract.test.ts src/test/agent-memory-route.test.ts`
  - result: passed
- [x] `npx tsc --noEmit`
  - result: passed
- Closure pass note: no repo code changed after the original implementation pass, so the existing local validation stands as-is.

## Live Repair Proof — `vidacious-4`

Tenant:
- id `6c6ae22c-d682-4af6-83ff-79913d267aea`
- slug `vidacious-4`
- droplet `557399795` / `137.184.56.1`

Confirmed runtime truth:
- SSH reached `root@137.184.56.1`, and the host identified itself as `pixelport-vidacious-4`.
- `docker ps` returned `NAME=openclaw-gateway IMAGE=pixelport-openclaw:2026.3.2-chromium STATUS=Up 45 minutes (healthy)`.
- `docker exec openclaw-gateway openclaw --version` returned `2026.3.2`.
- `docker exec openclaw-gateway openclaw health` reported:
  - `Slack: ok`
  - `Agents: main (default)`
- `/opt/openclaw/openclaw.json` now contains:
  - `agents.defaults.memorySearch.enabled = true`
  - `provider = "openai"`
  - `remote.apiKey = "${MEMORY_OPENAI_API_KEY}"`
- `/opt/openclaw/.env` now has:
  - `MEMORY_OPENAI_API_KEY=<present len=164>`
  - `MEM0_API_KEY=<missing>`
- `/opt/openclaw/workspace-main` now has:
  - `MEMORY.md`
  - `memory/business-context.md`
  - `memory/operating-model.md`
  - `memory/active-priorities.md`

Search proof:
- `openclaw memory search "Pixie Vidacious video ads"` returned:
  - `MEMORY.md`
  - `memory/business-context.md`
- `openclaw memory search "Canonical status snapshot recorded 5 tasks created"` returned:
  - `memory/active-priorities.md`

Supporting backend truth:
- tenant settings show `memory_native_enabled=true` and `memory_mem0_enabled=false`
- backend counts at verification time:
  - `agent_tasks=5`
  - `competitors=4`
  - `vault_sections=5`
- all five vault sections were `ready`

## Fresh Canary Inheritance Proof — `linear-memory-canary-r2`

Captured before cleanup:
- email `codex.memory.canary.1773297172884@example.com`
- tenant id `267c3eac-5824-4f8b-a3e6-777b4d26f933`
- slug `linear-memory-canary-r2`
- droplet `557679536` / `167.172.155.156`

Confirmed runtime truth before cleanup:
- tenant status was `active`
- gateway health succeeded and showed `Agents: main (default)`
- `/opt/openclaw/openclaw.json` contained the same validated `agents.defaults.memorySearch` config:
  - `enabled = true`
  - `provider = "openai"`
  - `remote.apiKey = "${MEMORY_OPENAI_API_KEY}"`
- `/opt/openclaw/.env` had:
  - `MEMORY_OPENAI_API_KEY=<present len=164>`
  - `MEM0_API_KEY=<missing>`
- `/opt/openclaw/workspace-main` had:
  - `MEMORY.md`
  - `memory/business-context.md`
  - `memory/operating-model.md`
  - `memory/active-priorities.md`

Search proof before cleanup:
- `openclaw memory search "Chief Orbit Website linear.app"` returned:
  - `MEMORY.md`
- `openclaw memory search "Current strategic priorities"` returned:
  - `memory/active-priorities.md`

Truthful backend state at capture time:
- tenant settings showed `memory_native_enabled=true` and `memory_mem0_enabled=false`
- bootstrap state in `onboarding_data.bootstrap` was still `accepted`
- backend counts were:
  - `vault_sections=5`
  - `agent_tasks=0`
  - `competitors=0`
  - `workspace_events=0`
  - `sessions_log=0`

Verdict for this canary:
- native-memory inheritance and searchable indexing were proven
- broader dashboard/task write completeness was **not** proven in this local canary runtime and is documented here as a non-blocking truthfulness caveat rather than hidden

## Canary Cleanup Verification

DigitalOcean cleanup:
- `DELETE` for droplet `557679536` succeeded
- follow-up `GET /v2/droplets/557679536` returned `404 resource not found`

Database cleanup in FK-safe order:
- checked and deleted in this order:
  - `command_events`
  - `workspace_events`
  - `command_records`
  - `slack_connections`
  - `content_items`
  - `integrations`
  - `sessions_log`
  - `approvals`
  - `api_keys`
  - `competitors`
  - `agent_tasks`
  - `vault_sections`
  - `chat_messages`
  - `chat_sessions`
  - `agents`
  - `tenants`
- rows that actually existed for this canary:
  - `vault_sections=5`
  - `agents=1`
  - `tenants=1`
- all other tables in the FK list were already `0` for this tenant

Auth cleanup:
- deleted auth user `6045dabe-9c11-44e6-832c-73c818e25469`
- follow-up auth lookup returned `User not found`

Post-cleanup verification:
- no remaining tenant rows matched `linear-memory-canary%`
- no surviving auth user remained for the canary account

## Status

- Repo implementation status: complete
- Local validation status: complete
- Live `vidacious-4` repair status: complete
- Fresh-tenant native-memory inheritance status: complete, with the explicit canary truthfulness caveat above
- Cleanup status: complete
- Merge status: ready for CTO review, not yet approved for merge or deploy
