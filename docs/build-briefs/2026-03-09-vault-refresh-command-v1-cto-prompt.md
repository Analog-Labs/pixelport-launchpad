# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-09-vault-refresh-command-v1.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-architecture.md`

Review the implementation on branch `codex/vault-refresh-command-v1`.

Expected scope:
- one real dashboard command flow from the Knowledge Vault page
- section-level `vault_refresh` command creation through existing `/api/commands`
- typed command-definition validation and active-target reuse behavior
- section-level command progress and failure state in the Vault UI
- runtime execution through the existing hook path plus correlated `workspace-events`
- final section update through the existing agent vault write path

Critical constraints that must still be true:
- no replacement of existing `/api/vault`, `/api/agent/vault*`, `/api/tasks/*`, or dashboard read paths
- no `api/chat.ts` or any second command transport
- no broad command center or admin-runtime expansion in this slice
- command flow remains grounded in actual OpenClaw behavior only
- manual vault edit behavior still works

Live validation evidence already captured on this branch:
- fresh QA auth email: `codex.vault.refresh.1773039386655@example.com`
- fresh tenant: `vault-refresh-qa-20260309`
- tenant id: `1e45c138-0eca-4f08-a93e-ca817dced78b`
- droplet id/ip: `556931113` / `198.199.80.171`
- validated command id: `c69be644-fd37-4047-9883-512f90ff1637`
- validated command target: `vault_section:company_profile`
- observed lifecycle:
  - `dispatched_at: 2026-03-09T07:09:16.628Z`
  - `acknowledged_at: 2026-03-09T07:09:29.466Z`
  - `started_at: 2026-03-09T07:09:57.059Z`
  - `completed_at: 2026-03-09T07:10:14.692Z`
- correlated `workspace_events` observed:
  - `command.acknowledged`
  - `command.running`
  - `runtime.artifact.promoted`
  - `command.completed`
- droplet snapshot updated at:
  - `/opt/openclaw/workspace-main/pixelport/vault/snapshots/company_profile.md`
- UI validation on the branch:
  - Company Profile showed inline `Refresh requested`, then accepted progress, while old content stayed visible
  - `Edit` and `Refresh with Chief` disabled during active refresh and re-enabled after completion
  - refreshed Company Profile markdown rendered on the Knowledge Vault page after completion
- manual edit validation:
  - `PUT /api/vault/brand_voice` succeeded after the command canary and was restored cleanly
- adjacent authenticated reads all remained `200` on the same tenant:
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
- incorrect OpenClaw assumptions
- command idempotency or duplicate-trigger issues
- stale or misleading Vault UI states
- regressions to existing vault editing or existing dashboard reads
- command completion without actual vault truth update
- auth or tenant-scoping mistakes
