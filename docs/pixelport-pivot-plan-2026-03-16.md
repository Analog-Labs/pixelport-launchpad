# PixelPort Pivot Plan (Approved 2026-03-16)

## Purpose
This document is the binding pivot plan for current execution. It supersedes older launchpad runtime assumptions where conflicts exist.

## Locked Direction
- PixelPort runtime is now a PixelPort-owned Paperclip fork (primary source of truth for product behavior).
- Paperclip auth is the runtime auth source of truth.
- `pixelport-launchpad` remains active for marketing, billing, and a thin provisioning bridge.
- Hard cutover strategy; no long dual-run.
- Growth Swarm is archived/deactivated and not active scope.

## Workspace Contract (Paperclip-Default First)
- Keep Paperclip default workspace structure and default behavior.
- Do not remove existing Paperclip template content.
- Do not enforce a fixed 3-agent topology in workspace templates.
- Do not rewrite `AGENTS.md` and `HEARTBEAT.md` behavior from PixelPort side.
- Additive change allowed: enrich `SOUL.md` with onboarding-captured context:
  - company name
  - website
  - mission
  - goals
  - chosen agent name
- Terminology alignment is allowed (`CEO` -> `Chief of Staff`) across user-facing UI/copy/markdown templates as long as behavior remains unchanged.

## Onboarding and Provisioning Flow (V1)
- Entry: `app.pixelport.app` (central auth), then onboarding.
- Onboarding tabs: `Company -> Provision -> Task -> Launch`.
- Company step captures: company name, website, mission/goals, agent name.
- Provisioning begins immediately after Company submit.
- Provision step is explicit and resumable; users auto-resume here until ready.
- Task step unlocks only when provisioning state is `ready`.
- Task is auto-seeded with one editable goal-based starter task.
- Agent setup in Task/Launch uses prefilled but editable suggestions (not enforced):
  - Chief of Staff
  - Content specialist
  - Growth specialist
  - users can edit/remove/add before launch.

## VM Image and Runtime Policy
- One pre-baked per-tenant droplet image.
- Baseline size: `4 vCPU / 8 GB`.
- Image includes Paperclip runtime, OpenClaw runtime, and Postgres with pinned versions.
- Upgrade policy: pinned + manual rollout with canary-first validation.
- Backup policy for v1 testing: minimal.

## V1 Scope Boundaries
- Stripe-triggered provisioning is deferred (phase-2 hook only).
- Customer SSH policy is deferred.
- Testing provisioning is allowlist/invite gated.
- Keep near-full Paperclip UI parity for now; streamline provisioning UI within existing shell.

## Migration Rules
- Archive legacy launchpad runtime code paths in branch/tag history.
- Aggressively prune unused legacy runtime APIs/routes from active path after cutover.
- No historical task/vault migration; only required account/company identity linkage metadata.

## Execution Notes
- Medium/high builds remain `codex/*` with CTO review before merge.
- Major product, architecture, and UX decisions still require founder approval.
- If this file conflicts with older docs, this file wins until those docs are updated.
