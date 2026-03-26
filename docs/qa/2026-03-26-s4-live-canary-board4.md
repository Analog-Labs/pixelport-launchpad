# Session 4 — Live Canary (board4)

- **Date:** 2026-03-26
- **Branch tested:** `main` (post-merge PR `#55`, commit `104a8e0`)
- **Production target:** `https://pixelport-launchpad.vercel.app`
- **Account:** `board4@ziffyhomes.com`

## Goal

Validate Session 4 backend/runtime changes in production for a brand-new tenant:

1. canonical OpenClaw workspace scaffold output
2. strict OpenClaw config shape (`skipBootstrap`, narrowed heartbeat, memory `extraPaths`)
3. launch flow still reaches active tenant with truthful dashboard state

## Flow Coverage

Validated in production:

1. Login with `board4@ziffyhomes.com`
2. Complete onboarding flow `Company -> Strategy -> Task -> Launch`
3. Wait for provisioning to finish and tenant status to become `active`

## Tenant Evidence

- tenant id: `295b4d1b-5b41-4953-8208-f34bc1fe2177`
- tenant slug: `ziffy-homes-board4-s4-canary`
- tenant status: `active`
- droplet id: `560972691`
- droplet ip: `104.248.57.142`
- bootstrap status: `completed`
- provisioning checks: `12/12` complete

## Runtime Contract Checks

Validated directly on the tenant runtime:

- canonical root files present:
  - `AGENTS.md`
  - `SOUL.md`
  - `TOOLS.md`
  - `IDENTITY.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `BOOT.md`
  - `MEMORY.md`
- `BOOTSTRAP.md` is absent
- system artifacts present:
  - `system/onboarding.json`
  - `system/render-manifest.json`
- knowledge scaffold present:
  - `knowledge/company-overview.md`
- Paperclip guidance skill present:
  - `skills/paperclip/SKILL.md`

## OpenClaw Config Checks

Confirmed in generated runtime config:

- `agents.defaults.skipBootstrap = true`
- `agents.defaults.heartbeat.every = "0m"`
- `agents.defaults.memorySearch.extraPaths = ["knowledge"]`

Strict config validation smoke test passed in-container:

- `docker exec openclaw-gateway openclaw config validate --json`
- result: `{"valid":true,"path":"/home/node/.openclaw/openclaw.json"}`

## Dashboard Truth Checks

Authenticated tenant-proxy checks returned real data and `200` responses for company summary/activity/issues/agents/badges views after activation.

## Verdict

**PASS** — Session 4 shipped successfully on `main` with a full production fresh-tenant canary.

Session 5 trigger-routing changes remain out of scope for this release and were not included here.
