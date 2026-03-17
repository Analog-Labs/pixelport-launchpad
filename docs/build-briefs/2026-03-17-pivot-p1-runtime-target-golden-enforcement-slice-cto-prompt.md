# PixelPort CTO Review Prompt

Review this PixelPort pivot medium-risk branch as CTO QA.

Read these first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/qa-policy.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-17-pivot-p1-runtime-target-golden-enforcement-slice.md`

Review implementation on branch:
- `codex/pivot-p1-runtime-target-golden-enforcement`

Compare against:
- `main`

Expected scope in this diff:
- `api/debug/env-check.ts` is production-gated and accepts only header auth via `x-debug-secret`
- `api/tenants/index.ts` removes `Record<string, any>` and uses proper typing
- `/api/runtime/handoff` derives `paperclip_runtime_url` from tenant `droplet_ip` (`http://<ip>:18789`)
- runtime handoff no longer depends on `PAPERCLIP_RUNTIME_URL`
- missing/invalid runtime target returns `409` with `runtime-target-unavailable`
- provisioning baseline enforces strict golden image selector and removes compatibility fallback image path
- size/region defaulting remains intact

Files expected in branch diff:
- `/Users/sanchal/pixelport-launchpad/api/debug/env-check.ts`
- `/Users/sanchal/pixelport-launchpad/api/tenants/index.ts`
- `/Users/sanchal/pixelport-launchpad/api/lib/paperclip-handoff-contract.ts`
- `/Users/sanchal/pixelport-launchpad/api/runtime/handoff.ts`
- `/Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/debug-env-check-route.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/paperclip-handoff-contract.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/runtime-handoff-route.test.ts`
- `/Users/sanchal/pixelport-launchpad/src/test/provision-tenant-memory.test.ts`

Validation already recorded for this slice:
- `npx tsc --noEmit`
- vitest suite: 4 files / 29 tests

Focus especially on:
- no auth leakage paths through debug endpoint in production mode
- correctness of runtime target derivation from tenant `droplet_ip`
- strict `409` behavior for missing/invalid runtime target
- strict golden-enforcement behavior and actionable error messaging
- regression risk to provisioning defaults for size/region

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
