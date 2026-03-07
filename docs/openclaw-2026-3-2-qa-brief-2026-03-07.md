# OpenClaw 2026.3.2 Post-Rollout QA Brief

Use this prompt in a new Codex session.

## Prompt

Read `AGENTS.md`, `docs/SESSION-LOG.md`, and `docs/ACTIVE-PLAN.md` first.

We rolled PixelPort's fresh-tenant OpenClaw default from `2026.2.24` to `2026.3.2` on March 7, 2026, after a successful canary. Founder explicitly approved rollout even though browser tooling is still a non-blocking follow-up.

Please run a focused production QA on the live rollout.

### Scope
- Backend/infra first
- No frontend redesign
- Keep current architecture:
  - OpenClaw on DO droplets
  - LiteLLM on Railway
  - Supabase as the product database/dashboard source

### Important context
- Official target release: `v2026.3.2`
- Browser tool timeout is known and currently non-blocking
- `GEMINI_API_KEY` was still missing from Vercel during the canary, so explicit Gemini-backed `tools.web` may still be absent
- The Chief still proved useful onboarding work through the website scan plus shell/web-fetch path
- `sessions_log` is nice to have, not a hard pass gate

### Required QA flow
1. Create one brand-new tenant through the real onboarding flow, not a debug shortcut.
2. Validate provisioning end to end:
   - droplet provisions successfully
   - cloud-init completes
   - gateway becomes healthy
   - bootstrap is accepted
   - tenant reaches `active`
3. Validate runtime/config details on the droplet:
   - running OpenClaw version is `2026.3.2`
   - `config-validate.json` exists and shows a successful pre-start validation
   - generated `openclaw.json` is compatible
   - ACP dispatch is disabled, unless provisioning had to fall back because validate rejected ACP keys
   - hooks mapping remains intact
   - generated `SOUL.md` contains valid task-type guidance
4. Validate backend truthfulness:
   - real rows exist in `agent_tasks`
   - real rows exist in `vault_sections`
   - real rows exist in `competitors`
   - note whether `sessions_log` has anything, but do not fail solely on that
5. Validate dashboard truthfulness:
   - verify the authenticated dashboard/API surfaces are reading the real backend rows, not placeholders
   - prefer checking the same endpoints the UI calls if full browser QA is inconvenient:
     - `/api/tenants/status`
     - `/api/tasks`
     - `/api/vault`
     - `/api/competitors`
6. Check likely regression areas carefully:
   - `openclaw.json` schema/config compatibility
   - hooks/bootstrap flow
   - LiteLLM provider transport
   - browser/runtime image behavior
   - generated `SOUL.md`
   - health/readiness checks
   - any old assumptions tied to `2026.2.24`

### Reporting format
Report back briefly with:
- what passed
- what failed
- what looks risky
- whether the live rollout should stay in place or be reverted

If you use the available skills, the most relevant are:
- `pixelport-fresh-tenant-canary`
- `pixelport-openclaw-upgrade`
- `pixelport-release-smoke`
