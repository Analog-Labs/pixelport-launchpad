# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-architecture.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-recovery.md`

Review the implementation on branch `codex/vault-refresh-recovery`.

Expected scope:
- stale recovery for non-terminal `vault_refresh` commands only
- additive `stale` metadata on `GET /api/commands` and `GET /api/commands/:id`
- additive `command_type` filtering on `GET /api/commands`
- auto-repair of stale `vault_refresh` rows in `POST /api/commands` before the existing tenant-wide reuse decision
- truthful Vault UI stalled-state behavior with founder-approved retry-directly UX

Critical constraints that must still be true:
- the tenant-wide single-active Vault refresh guard still applies to healthy active refreshes
- no generic command-center or operator-console expansion in this slice
- no replacement of existing `/api/vault`, `/api/agent/vault*`, `/api/tasks/*`, or current dashboard read paths
- stale recovery remains grounded in the real command ledger plus correlated `workspace_events`
- stale recovery is limited to `vault_refresh` targeting `vault_section`

Live validation evidence already captured on this branch:
- tenant name: `vault-refresh-qa-20260309`
- tenant id: `1e45c138-0eca-4f08-a93e-ca817dced78b`
- repaired stale command id: `2a351c7d-15b4-42f7-aca7-11b171072fa8`
- new retry command id: `638686d1-a31b-4d9f-9d5d-99e506d0300f`
- target section: `brand_voice`
- stale row evidence after repair:
  - `status: failed`
  - `last_error` explains the stale condition
  - `failed_at: 2026-03-09T08:31:51.399Z`
  - `command_events.event_type = stale_recovered`
  - payload included:
    - `reason: target_ready_after_activity`
    - `previous_status: dispatched`
    - `latest_activity_at: 2026-03-09T07:35:27.231669+00:00`
    - `target_section_updated_at: 2026-03-09T07:36:35.592435+00:00`
- observed new command lifecycle:
  - `dispatched_at: 2026-03-09T08:31:52.974Z`
  - `acknowledged_at: 2026-03-09T08:32:13.569Z`
  - `started_at: 2026-03-09T08:32:42.100Z`
  - `completed_at: 2026-03-09T08:32:55.849Z`
- correlated `workspace_events` observed:
  - `command.acknowledged`
  - `command.running`
  - `runtime.artifact.promoted`
  - `command.completed`
- Vault UI validation on the branch:
  - stale `brand_voice` surfaced as `Refresh stalled`, not as active
  - refresh remained enabled for retry
  - retry showed `Recovered a stalled refresh and requested a new run. Waiting for Chief progress...`
  - all refresh buttons were disabled again only while the new healthy command was actually active
- guard-preservation validation:
  - while the new command was active, a second refresh request for another section reused it with `reuse_reason: "active_command_type"`
- adjacent authenticated reads remained `200` on the same tenant:
  - `/api/tenants/me`
  - `/api/tenants/status`
  - `/api/tasks`
  - `/api/vault`
  - `/api/competitors`

Return your review in this exact shape:
1. `Verdict: APPROVED` or `Verdict: BLOCKED`
2. Findings first, ordered by severity
3. File references for each finding
4. What must be fixed before merge, if anything
5. What you checked
6. Residual risks
7. One explicit final line:
   - `Approved to merge and deploy.`
   - or `Blocked pending fixes.`

Focus especially on:
- stale false positives that could fail a still-running healthy refresh
- stale false negatives that would still block a tenant indefinitely
- preservation of the tenant-wide single-active Vault refresh guard
- truthful Vault UI behavior when stale and healthy-active rows coexist over time
- incorrect assumptions about `workspace_events` ordering or availability
- regressions to existing vault reads, tasks reads, or agent vault writes
- accidental scope creep toward a generic command center
