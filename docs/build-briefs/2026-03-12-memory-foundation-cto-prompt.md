# PixelPort CTO Review Prompt

Review this PixelPort implementation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-12-memory-foundation.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-12-memory-foundation.md`

Review the implementation on branch `codex/memory-foundation` against `main`.

Expected scope:
- add one shared resolver for flat tenant memory settings with defaults for old and new tenants
- emit only the validated OpenClaw `agents.defaults.memorySearch` config path using `MEMORY_OPENAI_API_KEY`
- add standard native-memory scaffold files and guidance at `MEMORY.md` plus `memory/*.md`
- keep Mem0 optional and make `/api/agent/memory` degrade gracefully instead of returning raw config `500`s
- repair active tenant `vidacious-4`, prove future-tenant inheritance with one fresh canary, and confirm the disposable canary was cleaned up before merge

Critical constraints that must still be true:
- no dashboard UI, Slack debugging, runtime-admin, content-pipeline redesign, or Gemini/web-search widening
- no speculative OpenClaw config keys beyond the validated `memorySearch` path
- workspace files on the tenant droplet remain the runtime source of truth
- native memory remains usable without Mem0
- the onboarding bootstrap message change stays minimal and additive to the existing 8 requirements
- canary cleanup uses the real FK-safe table order:
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
  - then the auth user

Files expected in the real code diff:
- `/Users/sanchal/pixelport-launchpad/api/lib/tenant-memory-settings.ts`
- `/Users/sanchal/pixelport-launchpad/api/tenants/index.ts`
- `/Users/sanchal/pixelport-launchpad/api/debug/test-provision.ts`
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/workspace-contract.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/onboarding-bootstrap.ts`
- `/Users/sanchal/pixelport-launchpad/api/agent/memory.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/tenant-memory-settings.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/provision-tenant-memory.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/workspace-contract.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/onboarding-bootstrap.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/agent-memory-route.test.ts`
- session/build/QA docs only

Validation evidence is summarized in:
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-12-memory-foundation.md`

Important review gate:
- if the QA doc does not show searchable native memory on `vidacious-4`, searchable inheritance on one fresh canary, and completed cleanup of that disposable canary, treat the branch as not yet ready for final merge approval

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
- whether the shared settings resolver is now the single source of truth for both old and new tenants
- whether the provisioning gate prevents broken native-memory tenants from being created
- whether the emitted `memorySearch` config stays inside the validated OpenClaw `2026.3.2` schema
- whether the new memory artifacts stay derived from canonical workspace truth rather than becoming a competing store
- whether `/api/agent/memory` now degrades correctly for disabled or unavailable Mem0
- whether the live QA evidence truly proves searchable native memory on `vidacious-4` and on one fresh tenant before merge
- whether the QA doc truthfully preserves the canary caveat (`vault_sections=5`, but `agent_tasks=0`, `competitors=0`, `workspace_events=0`) instead of overstating broader dashboard completeness
- whether the FK-safe cleanup evidence for the disposable canary is complete and believable
