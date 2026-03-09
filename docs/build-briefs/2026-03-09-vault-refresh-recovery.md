# PixelPort Build Brief

**Title:** Vault Refresh Stale-Recovery Hardening  
**Date:** 2026-03-09  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/vault-refresh-recovery`  

---

## Goal

Harden the already-live Vault refresh flow so stale non-terminal `vault_refresh` commands do not block future refreshes for a tenant, while keeping the existing tenant-wide single-active guard intact for healthy active commands.

This build must make the system truthful in three places at once:
- the command ledger can distinguish a genuinely active refresh from a stale stuck row
- `POST /api/commands` can repair stale stuck rows before deciding whether a new refresh is allowed
- the Vault page can show `Refresh stalled` instead of pretending an old stuck command is still running

## Scope

- In scope:
  - Add a dedicated stale detection and recovery helper for non-terminal `vault_refresh` commands targeting `vault_section`.
  - Compute `latest_activity_at` from the real command ledger plus correlated `workspace_events`.
  - Auto-repair stale non-terminal `vault_refresh` rows before the existing active-command reuse decision in `POST /api/commands`.
  - Extend `GET /api/commands` and `GET /api/commands/:id` additively with `stale` metadata.
  - Add optional `command_type` filtering to `GET /api/commands`.
  - Update the Vault page to show stale rows as stalled, clear stale persisted active-command state, and keep retry enabled.
  - Validate the exact stale-row scenario on the real QA tenant that already has a real stuck row.

## Non-Goals

- Not in scope:
  - generic command-center UI
  - generic stale recovery for all command types
  - removal or weakening of the tenant-wide single-active Vault refresh guard
  - replacement of existing `/api/vault`, `/api/agent/vault*`, `/api/tasks/*`, or current dashboard read paths
  - a new operator-only repair surface
  - broader command-backed UX beyond Vault refresh recovery

## Founder-Approved Decisions

- Approved before this build:
  - Vault refresh is already live and remains the first real command-backed dashboard flow.
  - Healthy Vault refreshes remain single-active per tenant.
  - This follow-up slice must stay narrowly scoped to Vault refresh stale recovery and truthful retry behavior.
- Approved for this build on 2026-03-09:
  - stale Vault rows should use the founder-approved `Retry directly` UX
  - there is no separate repair-only button in this slice
  - old stale rows should be auto-repaired by the backend before allowing a fresh Vault refresh

## Implementation Notes

- Systems or surfaces touched:
  - [commands.ts](/Users/sanchal/pixelport-launchpad/api/lib/commands.ts)
  - [vault-refresh-recovery.ts](/Users/sanchal/pixelport-launchpad/api/lib/vault-refresh-recovery.ts)
  - [index.ts](/Users/sanchal/pixelport-launchpad/api/commands/index.ts)
  - [[id].ts](/Users/sanchal/pixelport-launchpad/api/commands/%5Bid%5D.ts)
  - [Vault.tsx](/Users/sanchal/pixelport-launchpad/src/pages/dashboard/Vault.tsx)
- Stale classification rules:
  - `target_ready_after_activity`
    - target `vault_sections` row is `ready`
    - `vault_sections.updated_at` is at least 60 seconds newer than the command's latest activity
  - `awaiting_runtime_ack`
    - command is `pending` or `dispatched`
    - no acknowledgement has happened 10 minutes after latest activity
  - `runtime_activity_timeout`
    - command is `acknowledged` or `running`
    - there has been no command/workspace activity for 15 minutes
- Recovery behavior:
  - set the stale command to `failed`
  - set `last_error` to a human-readable stale summary
  - stamp `failed_at`
  - append `command_events.event_type = "stale_recovered"` with the stale reason and timestamp evidence
- UI behavior:
  - stale rows are treated as `stalled`, not active
  - stale rows do not disable the rest of the Vault page
  - clicking `Refresh with Chief` on a stalled row starts a new refresh while the backend auto-repairs the stale row
  - healthy active tenant-wide refreshes still disable all refresh buttons exactly as before

## Acceptance Criteria

- [ ] Non-terminal `vault_refresh` rows can be classified as healthy or stale using real command timestamps, current vault truth, and correlated `workspace_events`.
- [ ] Repairing a stale `vault_refresh` row marks it failed and records a `stale_recovered` command event with the stale reason payload.
- [ ] `GET /api/commands` supports optional `command_type` and returns additive per-command `stale` metadata.
- [ ] `GET /api/commands/:id` returns additive `stale` metadata.
- [ ] `POST /api/commands` auto-repairs stale non-terminal `vault_refresh` rows before deciding whether to reuse a healthy active tenant-wide refresh or create a new one.
- [ ] The Vault page shows `Refresh stalled` for stale rows, keeps retry enabled, and still disables refresh controls during a genuinely active healthy refresh.
- [ ] Real QA validation proves that the known stale command can be repaired and retried successfully without regressing adjacent authenticated reads.

## Validation Evidence

- Local validation:
  - `npx vitest run src/test/vault-refresh-recovery.test.ts src/test/commands-route.test.ts src/test/command-detail-route.test.ts src/test/workspace-events-route.test.ts src/pages/dashboard/Vault.test.tsx`
  - `npx tsc --noEmit`
  - targeted `npx eslint` on touched files
- Real QA tenant:
  - tenant name: `vault-refresh-qa-20260309`
  - tenant id: `1e45c138-0eca-4f08-a93e-ca817dced78b`
  - stale command repaired: `2a351c7d-15b4-42f7-aca7-11b171072fa8`
  - new retry command: `638686d1-a31b-4d9f-9d5d-99e506d0300f`
  - target section: `brand_voice`
  - observed new command lifecycle:
    - `dispatched_at: 2026-03-09T08:31:52.974Z`
    - `acknowledged_at: 2026-03-09T08:32:13.569Z`
    - `started_at: 2026-03-09T08:32:42.100Z`
    - `completed_at: 2026-03-09T08:32:55.849Z`
  - observed stale recovery evidence on the old row:
    - `status: failed`
    - `event_type: stale_recovered`
    - `reason: target_ready_after_activity`
  - adjacent authenticated reads re-checked successfully:
    - `/api/tenants/me`
    - `/api/tenants/status`
    - `/api/tasks`
    - `/api/vault`
    - `/api/competitors`

## CTO Review

Use [2026-03-09-vault-refresh-recovery-cto-prompt.md](/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-recovery-cto-prompt.md) for the required review before merge.

## Production Smoke Checklist

- [ ] Deploy completed successfully
- [ ] Live Vault page surfaces a previously stale row as stalled instead of active
- [ ] Clicking `Refresh with Chief` on a stalled row creates a fresh command and no longer leaves the tenant blocked by the old row
- [ ] Healthy active tenant-wide reuse still returns `reuse_reason: "active_command_type"`
- [ ] `GET /api/commands` and `GET /api/commands/:id` return the additive `stale` metadata on the live deployment
- [ ] Refreshed section content becomes visible on the live Vault page after completion
- [ ] Adjacent live reads remain healthy: `/api/tenants/me`, `/api/tenants/status`, `/api/tasks`, `/api/vault`, `/api/competitors`

## Blockers / Required Credentials

- Blocking item:
  - CTO review is required before merge because this is a high-risk hardening build on a live command path
- Required credential:
  - no new third-party credential is required beyond the normal project QA access already in use
