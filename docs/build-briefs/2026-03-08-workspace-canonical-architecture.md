# PixelPort Build Brief

**Title:** Grounded Architecture Redesign for Workspace-Canonical PixelPort  
**Date:** 2026-03-08  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/workspace-canonical-architecture`  

---

## Goal

Replace the earlier Supabase-canonical runtime/admin direction with a technically grounded architecture that fits:
- the current repo and production reality
- official OpenClaw runtime primitives
- the founder goal that PixelPort should feel like the Chief and its workspace, not just a database-backed dashboard

The output of this brief is a replacement architecture, not feature code.

## Scope

- In scope:
  - current-state repo/runtime audit
  - canonical source-of-truth decision by subsystem
  - workspace contract design
  - command model and projection model
  - runtime/admin boundary
  - first implementation slice recommendation
- In scope:
  - explicit redesign where the earlier assumptions are weak or operationally unsafe

## Non-Goals

- Not in scope:
  - building the admin route
  - rewriting dashboard pages
  - implementing content workflow changes
  - implementing cron UI or job execution logic
- Not in scope:
  - treating prior founder preferences as untouchable when they conflict with technical reality

## Founder-Approved Decisions

- Product intent already approved:
  - PixelPort should feel like one persistent Chief with specialist sub-agents behind the scenes.
  - Slack remains the primary conversational surface.
  - The dashboard should become an organized live projection of real runtime work, not a mock control panel.
- Architecture intent already approved:
  - This session may redesign earlier assumptions if needed to make the system technically grounded.
  - Official OpenClaw capabilities should be treated as the primary feasibility constraint.

## Current-State Audit

### Repo truth today

| Surface | Current reality | Implication |
|---|---|---|
| Content UI | [Content.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/Content.tsx) reads `GET /api/tasks?task_type=draft_content` and approves via task endpoints | Content pipeline is task-backed today, not `content_items`-backed |
| Calendar UI | [CalendarPage.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/CalendarPage.tsx) reads scheduled `agent_tasks` | Calendar is task-backed today |
| Vault UI | [Vault.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/Vault.tsx) reads and writes `vault_sections` directly | Vault is already control-plane canonical for human edits today |
| Content API | [api/content/index.ts](/Users/sanchal/pixelport-launchpad/api/content/index.ts), [api/content/[id].ts](/Users/sanchal/pixelport-launchpad/api/content/%5Bid%5D.ts) still use `content_items` | Old content model exists but is not driving the live dashboard |
| Approval API | [api/approvals/index.ts](/Users/sanchal/pixelport-launchpad/api/approvals/index.ts), [api/approvals/[id]/decide.ts](/Users/sanchal/pixelport-launchpad/api/approvals/%5Bid%5D/decide.ts) still use `approvals` | Old approval model exists but is not the live approval path |
| Task API | [api/tasks/index.ts](/Users/sanchal/pixelport-launchpad/api/tasks/index.ts) plus approve/reject endpoints use `agent_tasks` | Live product activity is task-centric today |
| Vault API | [api/vault/index.ts](/Users/sanchal/pixelport-launchpad/api/vault/index.ts), [api/vault/[key].ts](/Users/sanchal/pixelport-launchpad/api/vault/%5Bkey%5D.ts) use `vault_sections` | Human edits already write directly to Supabase |
| Chief trigger path | [api/lib/onboarding-bootstrap.ts](/Users/sanchal/pixelport-launchpad/api/lib/onboarding-bootstrap.ts) uses the existing external HTTP hook mapping at `/hooks/agent` | Proven dashboard/control-plane to Chief trigger exists already |
| Runtime bridge | [api/lib/gateway.ts](/Users/sanchal/pixelport-launchpad/api/lib/gateway.ts) is plain HTTP fetch to gateway | No websocket/RPC bridge exists yet |
| Chat route | [api/chat.ts](/Users/sanchal/pixelport-launchpad/api/chat.ts) still posts to `/openclaw/chat` | Chat transport is not a valid foundation for new command architecture |
| Provisioning prompt surface | [infra/provisioning/soul-template.md](/Users/sanchal/pixelport-launchpad/infra/provisioning/soul-template.md) still references stale permanent `Spark` and `Scout` roles and provisioning writes only `SOUL.md` today | Workspace contract and full runtime prompt surface are not bootstrapped as a product-level system yet |

### OpenClaw reality that constrains the design

Grounded in [docs/openclaw-reference.md](/Users/sanchal/pixelport-launchpad/docs/openclaw-reference.md) plus current official docs:
- OpenClaw has a real persistent gateway, per-agent workspaces, sessions, sub-agents, cron, and external HTTP hook mappings.
- `SOUL.md`, `TOOLS.md`, `AGENTS.md`, `HEARTBEAT.md`, and `BOOTSTRAP.md` are distinct runtime prompt surfaces with different jobs.
- Sub-agents are real but disposable. They are good execution workers, not a replacement for a durable product state model.
- Cron is a runtime scheduler, not a full product model for approvals, dashboards, or queryable tenant history.
- OpenClaw does not give PixelPort a ready-made multi-tenant dashboard schema. PixelPort still needs its own control-plane records and projection layer.

## Replacement Architecture

### Summary decision

Do **not** force a pure workspace-canonical model across every subsystem.

Instead adopt a **three-plane architecture**:
- **Control plane canonical:** Supabase
- **Runtime plane canonical:** OpenClaw workspace + gateway + cron
- **Asset plane canonical:** object storage, with optional droplet cache

This is the smallest architecture that stays faithful to the founder goal while still being scalable and operationally sane.

### 1. Canonical truth by subsystem

| Subsystem | Canonical truth | Why |
|---|---|---|
| Tenant/auth/billing/settings | Supabase | Product control-plane data should not live only on a tenant droplet |
| Dashboard command ledger | Supabase | Commands need queryable IDs, idempotency, status, and durable audit history |
| Human approval decisions | Supabase | Slack/dashboard approvals need durable, queryable, cross-surface truth |
| Human-edited vault facts | Supabase | Human edits should become product truth immediately, without waiting for the Chief |
| Agent-authored deliverable packages | OpenClaw workspace | The Chief needs local structured artifacts and files it can reason over directly |
| Runtime/admin state | OpenClaw gateway/runtime | Health, sessions, jobs, config, and current execution truth live with the runtime |
| Scheduled execution | OpenClaw cron | Cron is the real execution substrate for recurring runtime work |
| Binary assets/media | Object storage | Droplet-only media is too fragile for recovery, serving, and tenant portability |
| Agent scratch work and sub-agent artifacts | OpenClaw workspace | Best local execution fit; not everything belongs in the control plane |

### 2. What changed from the earlier direction

This brief intentionally redesigns several earlier assumptions:
- **Not everything should be workspace-canonical.** Pure workspace truth breaks down for approvals, human edits, queryability, and multi-surface audit.
- **The Chief should not be the sole writer of every canonical record.** The Chief remains the primary runtime author, but the control plane must write deterministic human actions immediately.
- **Droplet-resident canonical media is rejected.** Use object storage as the durable source for binaries; allow droplet caching for runtime convenience.
- **Raw cron is not the full product model.** PixelPort should expose a thin wrapper over cron, but cron remains the execution substrate.

### 3. Dashboard model

The dashboard becomes a **composed live projection**:
- control-plane truth for commands, approvals, tenant settings, and human edits
- runtime projection for agent-authored artifacts, job state, runtime health, and session activity
- asset metadata and URLs from the asset plane

The UI should default to:
- showing the latest projected state immediately
- showing visible `pending`, `syncing`, or `stale` indicators when runtime truth is still catching up
- never pretending that stale data is fresh

### 4. Command model

#### Structured dashboard actions

Structured dashboard actions should:
- create a durable `command_record` in Supabase
- receive an explicit command ID and idempotency key
- dispatch to the Chief through the existing external HTTP hook mapping
- progress through `pending -> dispatched -> acknowledged -> running -> completed | failed | cancelled`

#### Slack

Slack should stay split:
- free-form conversation remains free-form
- explicit Slack actions like approve, rerun, or schedule can create structured command records

#### Human edits

Deterministic human edits should not wait on the Chief just to become true.

Recommended rule:
- user edits to product-owned structured fields write to the control plane immediately
- those edits are then mirrored into runtime snapshots for the Chief
- the Chief owns AI-authored artifacts, derived packages, and interpretive work

### 5. Workspace contract

OpenClaw root-level runtime files remain at workspace root:
- `SOUL.md`
- `TOOLS.md`
- `AGENTS.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`

PixelPort product state should live under a dedicated namespace:

```text
workspace-main/
  SOUL.md
  TOOLS.md
  AGENTS.md
  HEARTBEAT.md
  BOOTSTRAP.md
  pixelport/
    content/
      deliverables/<deliverable-id>/
        manifest.json
        draft.md
        notes.md
        approval.snapshot.json
        assets/
    vault/
      snapshots/<section-key>.md
    jobs/
      <job-id>.json
    runtime/
      snapshots/status.json
    ops/
      events/YYYY-MM-DD.jsonl
    scratch/
      subagents/<run-id>/
```

Contract rules:
- JSON files are machine-readable projection sources
- Markdown files are human-readable working documents
- event logs are append-only JSONL
- sub-agents may write scoped artifacts in `scratch/`
- the Chief is responsible for promoting runtime artifacts into canonical `pixelport/content/...` packages

### 6. Vault model

Vault should be **split on purpose**:
- canonical structured vault facts and human edits live in Supabase
- the workspace keeps synced Markdown snapshots for the Chief

This preserves:
- immediate truthful user edits
- agent access to local context
- a product-grade source of truth for tenant-managed information

### 7. Approval model

Approval truth should be **control-plane canonical**, not workspace-only.

Recommended shape:
- approval decisions and audit history live in Supabase
- deliverable folders keep an `approval.snapshot.json` for agent context
- Slack and dashboard both read the same underlying approval truth

This explicitly replaces the earlier idea that approvals should be canonically adjacent in the workspace alone.

### 8. Scheduled Jobs model

Recommended shape:
- OpenClaw cron is the execution substrate
- PixelPort exposes a thin wrapper over cron for tenant UI
- job definitions and last-known snapshots are mirrored into the control plane
- runtime instructions for jobs live in workspace files the Chief can follow

This keeps the UI stable without inventing a heavy second scheduler.

### 9. Runtime/admin boundary

Use a mixed model:
- **direct runtime bridge** for read/status surfaces and a narrow set of safe operational controls
- **Chief commands** for business/workflow actions

Safe v1 tenant-admin controls:
- runtime status
- session list and basic inspection
- job list/runs
- rerun failed commands or jobs
- sync context snapshots
- pause/resume scheduled jobs

Do not expose in v1:
- raw shell
- arbitrary config editing
- unrestricted tool allowlist changes

### 10. Projection model

Projection should be push-first with repair:
- runtime artifacts and command results push structured events back to PixelPort
- Supabase stores queryable read models and command history
- periodic reconcile repairs drift when runtime and projection diverge
- when drift is detected, workspace/runtime truth wins for runtime-owned entities

This brief intentionally defers the exact reconciliation mechanism and cadence. The foundation slice should only create the ingest/projection spine, not a full drift-repair engine.

### 11. Existing tenant coexistence

This architecture is forward-looking. The first implementation slice must be additive:
- existing active tenants remain on the current direct-write model until a separate migration brief exists
- current `/api/agent/tasks`, `/api/agent/vault`, `/api/agent/competitors`, `/api/tasks/*`, and dashboard pages remain the live path
- the new command ledger and `workspace-events` ingest are additive control-plane and runtime surfaces
- no existing tables should be dropped or repurposed in the foundation slice

### 12. Recovery posture

This architecture assumes:
- control-plane truth survives tenant droplet loss
- runtime-authored workspace artifacts may need reconstruction after a rebuild

Workspace reconstruction from control-plane state is a required future design, but is explicitly deferred out of the foundation slice.

### 13. Rejected alternatives

- **Pure workspace-canonical everything**
  - Rejected because approvals, deterministic human edits, and durable product audit do not fit cleanly on a tenant droplet alone.
- **Pure Supabase-canonical everything**
  - Rejected because it collapses the product back into a control-plane app with an attached agent, which does not match the founder goal.
- **Chief writes every canonical fact**
  - Rejected because deterministic human product edits should not remain pending until the Chief rewrites them.
- **Droplet-only binary assets**
  - Rejected because recovery, serving, and portability get too fragile too quickly.

## Implementation Notes

- Systems or surfaces touched:
  - future control-plane schema
  - agent ingest/projection endpoints
  - bootstrap workspace scaffolding
  - SOUL/TOOLS/AGENTS/HEARTBEAT/BOOTSTRAP generation
  - runtime bridge endpoints
- Expected data flow:
  - dashboard action -> command ledger -> Chief dispatch
  - runtime artifact/event -> PixelPort ingest -> Supabase projection
  - human vault edit -> Supabase canonical update -> workspace snapshot sync
- Known constraints:
  - `api/chat.ts` is not a valid command path
  - current live dashboard remains task/vault-backed
  - current repo already has dormant `content_items` and `approvals` surfaces
  - existing active tenants require coexistence before any migration
- External dependencies:
  - official OpenClaw runtime behavior on pinned version
  - future object storage choice

## Future Interfaces To Lock

- `POST /api/commands`
- `GET /api/commands`
- `POST /api/agent/workspace-events`
- `GET /api/runtime/status`
- `GET /api/runtime/sessions`
- `GET /api/runtime/jobs`
- `POST /api/runtime/jobs/:id/run`
- `POST /api/runtime/sync-context`

These are directionally locked by this architecture, but the first code slice should implement only the minimum subset it needs.

## Acceptance Criteria

- [x] The replacement architecture is explicit about which plane is canonical for each subsystem.
- [x] The brief clearly explains which earlier assumptions were kept and which were redesigned.
- [x] The workspace contract is concrete enough to bootstrap and project later.
- [x] The command and projection models are concrete enough to guide the first implementation slice.
- [x] The brief rejects technically weak alternatives instead of preserving them for sentiment.

## CTO Handoff Prompt

Use the separate prompt at:
- [2026-03-08-workspace-canonical-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-cto-prompt.md)

## Production Smoke Checklist

- [ ] Not applicable in this architecture-only session

## Blockers / Required Credentials

- Blocking item:
  - none for the brief itself
- Required credential:
  - none for the brief itself
