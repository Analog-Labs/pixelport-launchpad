# CTO Review Prompt — Foundation Spine Implementation

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-architecture.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-foundation-slice.md`

Review target:
- Branch: `codex/foundation-spine`
- Commit(s): no commit was created in this execution session; review the current branch diff against `main`
- Scope: approved foundation slice only

What changed:
- Added additive Supabase migration `008_foundation_spine.sql` with:
  - `command_records`
  - `command_events`
  - `workspace_events`
- Added new APIs:
  - `POST /api/commands`
  - `GET /api/commands`
  - `GET /api/commands/:id`
  - `POST /api/agent/workspace-events`
- Added shared helper modules for:
  - command lifecycle/status mapping
  - command ledger persistence
  - workspace prompt-surface/scaffold generation
- Refactored `api/lib/onboarding-bootstrap.ts` only enough to expose a reusable hook dispatcher
- Extended fresh provisioning/bootstrap so the runtime now writes:
  - `SOUL.md`
  - `TOOLS.md`
  - `AGENTS.md`
  - `HEARTBEAT.md`
  - `BOOTSTRAP.md`
  - `pixelport/` namespace scaffolding and initial status/event files
- Refreshed `infra/provisioning/*` repo-truth references and removed stale permanent `Spark` / `Scout` assumptions
- Updated `src/integrations/supabase/types.ts`
- Added helper tests and mocked route smoke tests

Required regression focus:
1. Confirm the new schema is strictly additive and does not repurpose or break existing tables.
2. Confirm existing `/api/agent/tasks`, `/api/agent/vault*`, `/api/agent/competitors`, `/api/tasks/*`, and current dashboard read paths remain untouched in behavior.
3. Review `POST /api/commands` for auth, idempotency, failure handling, and safe dispatch through the existing proven hook path.
4. Review `POST /api/agent/workspace-events` for tenant ownership checks, dedupe behavior, and correct command lifecycle updates.
5. Review the provisioning/bootstrap changes for fresh-tenant safety:
   - full prompt surface present
   - `pixelport/` scaffold present
   - no stale permanent Spark/Scout assumptions
   - no regression to the existing onboarding bootstrap path
6. Review tests/validation sufficiency for this risk level.

Validation already run in this session:
- `npx tsc --noEmit`
- targeted `npx eslint` on all touched API/helper/test files
- `npm test` (`5` test files, `9` tests passed)

Return a strict verdict in this exact format:

```md
Verdict: APPROVED
```

or

```md
Verdict: BLOCKED
```

Then include:
- findings first, ordered by severity
- file references for each real finding
- what must be fixed before merge
- what was checked or validated
- residual risks
- if approved, this exact line:
  `Approved to merge and deploy.`

If you do not clearly approve it, it will be treated as not approved.
