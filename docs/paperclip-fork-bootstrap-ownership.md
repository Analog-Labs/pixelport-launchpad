# Paperclip Fork Bootstrap Ownership Contract (Phase P1)

**Date:** 2026-03-17  
**Scope:** Post-P0 ownership lock for the Paperclip-primary runtime bootstrap  
**Binding context:** `docs/pixelport-pivot-plan-2026-03-16.md`

## Purpose

Define ownership for bootstrap-critical surfaces and record audit evidence for Track A without fabricating enforcement or signoff.

## Ownership Matrix (Execution Contract)

| Surface | Primary owner | Reviewer / backup | Founder approval required to close |
|---------|---------------|-------------------|------------------------------------|
| Repo admin and branch policy (`Analog-Labs/pixelport-launchpad`, Paperclip fork governance) | Technical Lead (Codex) | CTO reviewer + named human backup reviewer (pending founder confirmation) | Yes |
| CI/workflow integrity and required-check baseline | Technical Lead (Codex) | CTO reviewer | Yes for required-gate changes on `main` |
| Deploy targets and promotion ownership (Vercel launchpad, runtime surfaces) | Technical Lead (Codex) | Founder visibility + CTO reviewer | Yes |
| Launchpad -> Paperclip handoff contract ownership | Technical Lead (Codex) | CTO reviewer | Yes if user-facing/auth-flow impact |
| Secrets inventory and source-of-truth mapping | Technical Lead (Codex) | Founder visibility + CTO reviewer | Yes |
| Secret rotation execution | Technical Lead (Codex) | Founder visibility | Yes for policy/cadence decisions |
| Rollback execution authority | Technical Lead (Codex) | Founder notified immediately | Yes (authority boundary confirmation) |
| Incident escalation ownership | Technical Lead (Codex) | CTO reviewer + Founder | Yes (SLA and escalation chain confirmation) |

## Track A Audit Evidence Snapshot (2026-03-17)

### A2 — Repo/Branch Protection + CI Ownership Evidence

**PixelPort repo (`Analog-Labs/pixelport-launchpad`):**
- default branch is `main`
- `main` branch protection is now enabled (`protected: true`)
- enforced branch-protection baseline on `main`:
  - required status checks:
    - `Analyze (javascript-typescript)` (CodeQL)
    - `validate` (CI workflow)
    - strict mode: `true`
  - required pull-request approvals: `1`
  - code-owner reviews required: `true`
  - stale-review dismissal: `true`
  - required conversation resolution: `true`
  - required linear history: `true`
  - enforce admins: `false` (intentional break-glass path)
- repo rulesets remain empty (`[]`) and branch protection is currently the active enforcement layer
- reviewer backup roster is now codified on `main` via `.github/CODEOWNERS` (`@sanchalr @haider-rs @penumbra23`) from merged PR #2 (`9eb17df`)
- CI ownership baseline is now codified on `main` via `.github/workflows/ci.yml` (`npx tsc --noEmit`, `npm test -- --exclude src/test/tenants-status-route.test.ts`) from merged PR #2 (`9eb17df`)
- visible dynamic workflow/check context on `main`:
  - workflow: `CodeQL` (`dynamic/github-code-scanning/codeql`)
  - latest `main` check-run context observed: `Analyze (javascript-typescript)`

**Paperclip reference repo (`paperclipai/paperclip`):**
- default branch is `master`
- branch reports `protected: true`
- active ruleset observed on `master` includes:
  - `deletion`
  - `non_fast_forward`
  - `pull_request`
- local clone workflow files present at `/Users/sanchal/paperclip/.github/workflows/`:
  - `e2e.yml`
  - `pr-policy.yml`
  - `pr-verify.yml`
  - `refresh-lockfile.yml`
  - `release.yml`

### A3 — Deploy Ownership Evidence

**Active pivot deploy surfaces (A3 closure scope):**
- Launchpad repo signal:
  - `Analog-Labs/pixelport-launchpad` default branch: `main`
- Vercel ownership signal:
  - deploy target path includes `sanchalrs-projects/pixelport-launchpad`
  - production source signal remains `main`
- DigitalOcean ownership signal:
  - account email: `sanchal@analog.one`
  - account name: `Sanchal`
  - team: `My Team` (`ff5818a0-6b80-442d-81cb-c851fb8d17ea`)

**Legacy infra signal (out of active pivot deploy model):**
- Railway/LiteLLM service is still running (`pixelport-litellm`) but is pre-pivot legacy infra and not part of active A3 deploy ownership scope.
- It is tracked as legacy-to-decommission and should not be treated as the runtime ownership authority for Paperclip-primary provisioning.

**Named deploy ownership model (A3 closure):**
- primary deploy owner (all active pivot launch surfaces): `sanchalr` / `sanchal@analog.one`
- backup deploy owners (operational delegates): `haider-rs` (primary backup), `penumbra23` (secondary backup)
- promotion authority: primary owner by default; backup owners when founder-delegated
- rollback authority: primary owner immediate; backup owners when founder-delegated; founder notification required immediately after rollback

### A4 — Secrets Inventory Signals (Names Only)

**Launchpad (Vercel env listing evidence):**
- `API_KEY_ENCRYPTION_KEY`
- `AGENTMAIL_API_KEY`
- `DO_API_TOKEN`
- `GEMINI_API_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `LITELLM_MASTER_KEY`
- `LITELLM_URL`
- `MEM0_API_KEY`
- `MEMORY_OPENAI_API_KEY`
- `PAPERCLIP_HANDOFF_SECRET`
- `PROVISIONING_DROPLET_IMAGE`
- `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE`
- `SLACK_APP_TOKEN`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SSH_PRIVATE_KEY`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Handoff contract vars (route/contract code):**
- required: `PAPERCLIP_HANDOFF_SECRET`
- optional: `PAPERCLIP_HANDOFF_TTL_SECONDS` (defaults to `300` seconds when unset/invalid)
- no longer required as env: runtime URL (derived from tenant `droplet_ip` as `http://<ip>:18789`)

**Droplet runtime/provisioning surfaces (from provisioning/runtime codepaths):**
- `OPENCLAW_IMAGE`
- `OPENCLAW_RUNTIME_IMAGE`
- `PROVISIONING_DROPLET_IMAGE`
- `PROVISIONING_DROPLET_SIZE`
- `PROVISIONING_DROPLET_REGION`
- `PIXELPORT_DROPLET_IMAGE`
- `PIXELPORT_DROPLET_SIZE`
- `PIXELPORT_DROPLET_REGION`
- `DO_GOLDEN_IMAGE_ID`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `PIXELPORT_API_KEY`
- `AGENTMAIL_API_KEY`
- `GEMINI_API_KEY`

**Legacy LiteLLM service surface (Railway, decommission path only):**
- `LITELLM_DATABASE_URL`
- `LITELLM_MASTER_KEY`
- `LITELLM_UI_TOKEN`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

**A4 founder-approved policy decisions (2026-03-17):**
- Source of truth: Vercel is the only active pivot secret source of truth.
- Rotation cadence: 90-day rotation for all active pivot secrets.
- Runtime key stance: AGENTMAIL/GEMINI/MEM0 keys were added to Vercel and are available for active OpenClaw-driven use.
- Legacy stance: Railway/LiteLLM is marked decommission path (not active pivot secret authority).

**A4 closure notes:**
- `PAPERCLIP_HANDOFF_SECRET` is visible in Vercel production env listing evidence.
- `PAPERCLIP_HANDOFF_TTL_SECONDS` remains optional and is currently handled by default fallback.
- Some non-pivot/legacy config references (`OPENAI_API_KEY`, `OPENCLAW_IMAGE`, `OPENCLAW_RUNTIME_IMAGE`, `TENANT_PROVISIONING_ALLOWLIST`) are tracked for cleanup separately and are not blockers for Track A4 closure.

### A5 — Rollback/Incident Boundary Evidence State

- Decision-boundary text exists in this contract and in `AGENTS.md`.
- Proposed A5 policy baseline is now documented in `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-proposal.md`.
- Explicit founder-level confirmation for rollback authority boundaries and escalation closure is still pending.
- No fabricated owner signoff is recorded in this document.

## Track A Status (Do Not Close Without Explicit Confirmation)

| Item | Status | Why still open |
|------|--------|----------------|
| A1 Publish ownership contract | ✅ Closed | Contract exists with matrix + runbook ownership intent |
| A2 Repo/branch protection + CI owners/backups | ✅ Closed | `main` branch protection is enforced and requires both `Analyze (javascript-typescript)` + `validate`; CODEOWNERS + CI ownership baseline is merged on `main` via PR #2 (`9eb17df`) |
| A3 Deploy ownership confirmation | ✅ Closed | Named primary + backup deploy ownership and promotion/rollback authority are now explicitly documented for active pivot deploy surfaces (GitHub/Vercel/DO); Railway/LiteLLM is marked legacy-only |
| A4 Secrets + rotation + rollback authority | ✅ Closed | Founder-approved source-of-truth (`Vercel-only`), rotation cadence (`90d`), active runtime key availability in Vercel, and legacy Railway decommission stance are now explicitly documented |
| A5 Incident escalation + founder boundaries | ⏳ Open | Boundaries documented, but explicit founder confirmation for closure is pending |

## Founder Decisions Needed (To Close A5)

1. Approve rollback and incident-command authority boundary:
   - who can execute immediate rollback
   - founder notification SLA by severity
   - CTO escalation/review trigger points
   - confirm or edit proposal in `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-proposal.md`

## Founder Decision Boundaries (Must Stay Explicit)

- Any product-visible onboarding/auth flow change tied to runtime handoff
- Production cutover timing or rollback policy changes
- Net-new vendor/provider decisions for hosting, auth, or secrets
- UX/policy changes that alter provisioning/launch permissions

## Operating Notes

- This contract clarifies P1 bootstrap ownership; it does not replace `AGENTS.md`.
- If any conflict exists, `docs/pixelport-pivot-plan-2026-03-16.md` remains authoritative.
