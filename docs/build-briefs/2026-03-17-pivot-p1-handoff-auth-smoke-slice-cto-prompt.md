# PixelPort CTO Review Prompt

Review this PixelPort pivot small-risk documentation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-handoff-auth-smoke-slice.md`

Review implementation on branch:
- `codex/pivot-p1-handoff-auth-smoke`

Compare against:
- `main`

Expected scope in this diff:
- session log records authenticated smoke on production `POST /api/runtime/handoff`
- smoke context is truthful:
  - temporary Supabase-backed test user + temporary active tenant
  - valid bearer token from `signInWithPassword`
- response is captured exactly:
  - status `503`
  - body `{"error":"Paperclip runtime handoff is not configured.","missing":["PAPERCLIP_RUNTIME_URL","PAPERCLIP_HANDOFF_SECRET"]}`
- cleanup evidence is explicit:
  - tenant deleted `true`
  - user deleted `true`
- active plan includes concrete blocker for missing `PAPERCLIP_RUNTIME_URL` and `PAPERCLIP_HANDOFF_SECRET`
- project status immediate actions reflect:
  - authenticated path validated up to config gate
  - `200` success-path still blocked pending env configuration
- no claim of `200` success validation
- no secret values are exposed

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/pixelport-project-status.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-17-pivot-p1-handoff-authenticated-smoke.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-handoff-auth-smoke-slice.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-handoff-auth-smoke-slice-cto-prompt.md`

Validation expectation for this slice:
- statements must be internally consistent across session log, active plan, project status, and QA evidence doc
- blocker language must explicitly tie missing `PAPERCLIP_RUNTIME_URL` + `PAPERCLIP_HANDOFF_SECRET` to lack of `200` validation
- this slice remains documentation-only

Focus especially on:
- factual integrity of production smoke statements
- accidental over-claiming beyond observed `503` auth+config-gate behavior
- clarity of remaining next step to reach `200` proof

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
