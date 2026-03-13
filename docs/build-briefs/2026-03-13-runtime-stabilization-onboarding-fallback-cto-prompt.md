# PixelPort CTO Review Prompt

Review this PixelPort high-risk provisioning/runtime branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-13-runtime-stabilization-onboarding-fallback.md`

Review implementation on branch:
- `codex/vidacious-runtime-permissions-stabilization`

Compare against:
- `main`

Expected scope in this diff:
- persist runtime permission hardening in provisioning/cloud-init:
  - normalize `/home/node/.openclaw`, `/home/node/.openclaw/identity`, `/home/node/.openclaw/devices` ownership/perms post-container-start
  - tighten `/opt/openclaw/openclaw.json` and `/opt/openclaw/.env` perms
- replace hard provisioning throw on missing `MEMORY_OPENAI_API_KEY` with graceful downgrade:
  - no onboarding hard-fail when `memory_native_enabled=true` but env key is missing
  - effective native memory disabled for that run only
  - persist durable warning under `tenants.onboarding_data.provisioning_memory`
- keep Slack policy behavior unchanged (`groupPolicy:"open"` remains intentional)
- add targeted tests and keep TypeScript clean

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/tenant-memory-settings.ts`
- `/Users/sanchal/pixelport-launchpad/infra/provisioning/cloud-init.yaml`
- `/Users/sanchal/pixelport-launchpad/src/test/provision-tenant-memory.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/tenant-memory-settings.test.ts`
- session/build docs updates only

Validation already run on branch:
- `npx vitest run src/test/tenant-memory-settings.test.ts src/test/provision-tenant-memory.test.ts src/test/tenants-bootstrap-route.test.ts src/test/tenants-status-route.test.ts src/test/agent-memory-route.test.ts`
- `npx tsc --noEmit`

Focus especially on:
- regression risk in `provision-tenant` control flow and whether provisioning can still progress safely to droplet creation
- correctness of requested vs effective memory behavior when key is missing
- whether downgrade truth is durable and non-misleading
- whether runtime permission hardening is persistent and non-destructive
- whether any security regressions were introduced while keeping existing intentional Slack policy posture

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
