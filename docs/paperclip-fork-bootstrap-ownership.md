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
  - required status checks: `Analyze (javascript-typescript)` (`strict: true`)
  - required pull-request approvals: `1`
  - code-owner reviews required: `true`
  - stale-review dismissal: `true`
  - required conversation resolution: `true`
  - required linear history: `true`
  - enforce admins: `false` (intentional break-glass path)
- repo rulesets remain empty (`[]`) and branch protection is currently the active enforcement layer
- reviewer backup roster is now codified in branch slice `codex/p1-a2-governance-guardrails` via `.github/CODEOWNERS` (`@sanchalr @haider-rs @penumbra23`) and is pending merge
- CI ownership baseline is now codified in branch slice `codex/p1-a2-governance-guardrails` via `.github/workflows/ci.yml` (`npx tsc --noEmit`, `npm test`) and is pending merge
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

- Vercel user signal: `npx vercel whoami` -> `sanchalr`
- Vercel team scope signal: project owner is `sanchalr's projects` (`sanchalrs-projects`)
- Vercel production source signal: recent production deployments show `githubCommitRef: main`
- Railway ownership signal:
  - `railway whoami` -> `sanchal02@gmail.com`
  - workspace listed as `sanchalr's Projects`
  - project signal: `pixelport-litellm`
- DigitalOcean ownership signal:
  - account name/email/team are visible from account endpoint
  - token scope is limited on some endpoints (billing/balance endpoints return `403`)

### A4 — Secrets Inventory Signals (Names Only)

**Launchpad (Vercel env listing evidence):**
- `API_KEY_ENCRYPTION_KEY`
- `DO_API_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `LITELLM_MASTER_KEY`
- `LITELLM_URL`
- `MEMORY_OPENAI_API_KEY`
- `SLACK_APP_TOKEN`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SSH_PRIVATE_KEY`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Handoff contract vars (required by route/contract code):**
- `PAPERCLIP_RUNTIME_URL`
- `PAPERCLIP_HANDOFF_SECRET`
- `PAPERCLIP_HANDOFF_TTL_SECONDS`

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

**LiteLLM service surface (Railway variable names observed):**
- `LITELLM_DATABASE_URL`
- `LITELLM_MASTER_KEY`
- `LITELLM_UI_TOKEN`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

**Important evidence gap:**
- `PAPERCLIP_*` handoff vars are **not visible** in current Vercel production env listing evidence.

### A5 — Rollback/Incident Boundary Evidence State

- Decision-boundary text exists in this contract and in `AGENTS.md`.
- Explicit founder-level confirmation for rollback authority boundaries and escalation closure is still pending.
- No fabricated owner signoff is recorded in this document.

## Track A Status (Do Not Close Without Explicit Confirmation)

| Item | Status | Why still open |
|------|--------|----------------|
| A1 Publish ownership contract | ✅ Closed | Contract exists with matrix + runbook ownership intent |
| A2 Repo/branch protection + CI owners/backups | 🚧 In Progress | `main` protection baseline is now live; CODEOWNERS + CI workflow ownership files are implemented on `codex/p1-a2-governance-guardrails` and pending merge + CTO review |
| A3 Deploy ownership confirmation | ⏳ Open | Ownership signals exist, but explicit founder confirmation of named owners/backups is pending |
| A4 Secrets + rotation + rollback authority | ⏳ Open | Inventory signal captured, but source-of-truth/rotation ownership and handoff var placement are not founder-closed |
| A5 Incident escalation + founder boundaries | ⏳ Open | Boundaries documented, but explicit founder confirmation for closure is pending |

## Founder Decisions Needed (To Close A2-A5)

1. Approve exact `main` protection policy on `Analog-Labs/pixelport-launchpad`:
   - required checks
   - required PR review baseline
   - named reviewer backup path in `.github/CODEOWNERS`
2. Approve deploy ownership model across launchpad/runtime surfaces:
   - primary owner
   - backup owner
   - who can promote/rollback production
3. Approve secrets source-of-truth and rotation model:
   - where handoff vars (`PAPERCLIP_*`) are stored
   - rotation owner and cadence
   - escalation policy for missing/misaligned secrets
4. Approve rollback and incident-command authority boundary:
   - who can execute immediate rollback
   - founder notification SLA by severity
   - CTO escalation/review trigger points

## Founder Decision Boundaries (Must Stay Explicit)

- Any product-visible onboarding/auth flow change tied to runtime handoff
- Production cutover timing or rollback policy changes
- Net-new vendor/provider decisions for hosting, auth, or secrets
- UX/policy changes that alter provisioning/launch permissions

## Operating Notes

- This contract clarifies P1 bootstrap ownership; it does not replace `AGENTS.md`.
- If any conflict exists, `docs/pixelport-pivot-plan-2026-03-16.md` remains authoritative.
