# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk documentation branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-ownership-audit-slice.md`

Review implementation on branch:
- `codex/pivot-p1-ownership-audit`

Compare against:
- `main`

Expected scope in this diff:
- Track A ownership-audit evidence is documented with factual command/API-grounded statements
- no fabricated enforcement claims or owner signoffs are introduced
- PixelPort repo facts are explicit:
  - default `main`
  - `main` unprotected
  - no rulesets on `main`
  - no CODEOWNERS
  - one visible dynamic CodeQL check-run context
- Paperclip reference facts are explicit:
  - default `master`
  - protected branch signal with active ruleset (`deletion`, `non_fast_forward`, `pull_request`)
  - local workflow files confirmed in `/Users/sanchal/paperclip/.github/workflows/*`
- deploy ownership signals are documented:
  - Vercel (`sanchalr` / `sanchalrs-projects`, production branch `main`)
  - Railway workspace signal
  - DO account signal plus limited token scope on some endpoints
- secrets inventory key names are listed by surface with explicit note that `PAPERCLIP_*` vars are not visible in current Vercel env listing evidence
- top-level Track A items A2-A5 remain unchecked/open pending enforcement and founder confirmations

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/docs/paperclip-fork-bootstrap-ownership.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/pixelport-project-status.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-ownership-audit-slice.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-ownership-audit-slice-cto-prompt.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa/2026-03-17-pivot-p1-ownership-audit.md`

Validation expectation for this slice:
- Document claims must be internally consistent across ownership contract, active plan, project status, and QA artifact.
- No claims should imply A2-A5 closure unless a closure condition is explicitly met and evidenced.

Focus especially on:
- factual integrity of governance/security statements
- accidental over-claiming of branch protections/reviewer gates
- accidental exposure of secret values (only key names should appear)
- whether "Founder decisions needed" is concrete enough to close A2-A5 without ambiguity

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
