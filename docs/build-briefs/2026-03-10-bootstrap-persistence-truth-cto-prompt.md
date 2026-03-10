# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-10-bootstrap-persistence-truth.md`

Review the implementation on branch `codex/bootstrap-persistence-truth`.

Expected scope:
- generated workspace tooling stops sourcing `/opt/openclaw/.env` from inside the container
- bootstrap completion uses durable backend truth instead of single-write side effects
- bootstrap stays in-progress while the run is plausibly active
- bootstrap moves to `failed` only on clear timeout or failure
- `/api/tenants/me`, `/api/tenants/status`, and `/api/tenants/bootstrap` return truthful state for partial-output tenants

Critical constraints that must still be true:
- no repair or replay of existing tenant `analog-2` in this branch
- no new bootstrap-specific persistence API
- no broad onboarding or dashboard refactor
- `/api/tasks`, `/api/vault`, and `/api/competitors` remain the live durable truth sources
- bootstrap must never become `completed` from a single agent write

Live validation evidence already captured on this branch:
- QA auth email: `codex.bootstrap.truth.20260310053742@example.com`
- tenant slug: `bootstrap-truth-qa-20260310054029`
- tenant id: `39a234b7-3ca5-4668-af9f-b188f2e5ec34`
- droplet id: `557163621`
- droplet ip: `142.93.117.18`
- observed truthful partial state before completion:
  - tenant `status: active`
  - `bootstrap_status: accepted`
  - `tasks: 0`
  - `competitors: 0`
  - `vault_ready: 2/5`
- observed final durable state:
  - `bootstrap_status: completed`
  - `tasks: 5`
  - `competitors: 4`
  - `vault_ready: 5/5`
- observed bootstrap timestamps:
  - `requested_at: 2026-03-10T05:46:21.999Z`
  - `accepted_at: 2026-03-10T05:46:22.917Z`
  - `completed_at: 2026-03-10T05:47:38.491Z`
- branch validation already passed:
  - `npx vitest run src/test/bootstrap-state.test.ts src/test/tenants-status-route.test.ts src/test/tenants-bootstrap-route.test.ts src/test/agent-bootstrap-sync-route.test.ts src/test/workspace-contract.test.ts`
  - `npx vitest run src/test/onboarding-bootstrap.test.ts src/test/commands-route.test.ts src/test/command-detail-route.test.ts src/test/workspace-events-route.test.ts src/test/workspace-contract.test.ts`
  - `npx tsc --noEmit`

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
- false completion paths that could still flip bootstrap to `completed` too early
- false failure paths that could mark a healthy in-progress bootstrap as failed
- timeout logic around `dispatching` versus `accepted`
- truth drift between `/api/tenants/me`, `/api/tenants/status`, and durable backend rows
- replay behavior after a genuinely failed bootstrap
- regressions to existing agent write routes or dashboard read routes
- accidental scope creep beyond bootstrap persistence and status truth
