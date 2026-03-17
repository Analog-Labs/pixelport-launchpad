# QA Evidence — Pivot P1 Ownership Audit (Track A)

**Date:** 2026-03-17 (America/Chicago)  
**Branch audited:** `codex/pivot-p1-ownership-audit`  
**Scope:** ownership evidence only (repo/branch/CI, deploy ownership signals, secrets inventory signals)  
**Constraint:** no fabricated enforcement state, no fabricated owner signoff

## 1) Repo/Branch/CI Evidence

### PixelPort repo (`Analog-Labs/pixelport-launchpad`)

Evidence collected via `gh api`:
- default branch: `main`
- `main` reports `protected: false`
- `branches/main/protection` returns `404 Branch not protected`
- `rulesets` returns `[]`
- `rules/branches/main` returns `[]`
- workflows list returns one active dynamic workflow:
  - `CodeQL` at `dynamic/github-code-scanning/codeql`
- latest `main` check-run context observed:
  - `Analyze (javascript-typescript)` (success)
- CODEOWNERS checks:
  - `CODEOWNERS` -> `404`
  - `.github/CODEOWNERS` -> `404`
  - `docs/CODEOWNERS` -> `404`

### Paperclip reference repo (`paperclipai/paperclip`)

Evidence collected via `gh api` + local clone inspection:
- default branch: `master`
- `master` reports `protected: true`
- active ruleset on `master` includes:
  - `deletion`
  - `non_fast_forward`
  - `pull_request`
- local clone workflow files present at:
  - `/Users/sanchal/paperclip/.github/workflows/e2e.yml`
  - `/Users/sanchal/paperclip/.github/workflows/pr-policy.yml`
  - `/Users/sanchal/paperclip/.github/workflows/pr-verify.yml`
  - `/Users/sanchal/paperclip/.github/workflows/refresh-lockfile.yml`
  - `/Users/sanchal/paperclip/.github/workflows/release.yml`

## 2) Deploy Ownership Signals

### Vercel (launchpad)
- `npx vercel whoami` -> `sanchalr`
- `npx vercel project inspect pixelport-launchpad --scope sanchalrs-projects` owner signal -> `sanchalr's projects`
- `npx vercel ls pixelport-launchpad --format=json` recent production deployment signal:
  - `meta.githubCommitRef: main`
  - `meta.githubRepo: pixelport-launchpad`
  - `meta.githubOrg: Analog-Labs`
- `npx vercel teams ls` team signal -> `sanchalrs-projects`

### Railway (LiteLLM project)
- `railway whoami` -> `sanchal02@gmail.com`
- `railway list` workspace signal -> `sanchalr's Projects`
- `railway status --json` project/workspace signal:
  - project: `pixelport-litellm`
  - workspace: `sanchalr's Projects`

### DigitalOcean
- account endpoint returns owner signal (name/email/team present)
- token scope limitation confirmed:
  - balance endpoint -> `403 not authorized`
  - billing history endpoint -> `403 not authorized`

## 3) Secrets Inventory Signals (Names Only)

### Launchpad env listing signal (Vercel production listing)
- `MEMORY_OPENAI_API_KEY`
- `SLACK_APP_TOKEN`
- `SSH_PRIVATE_KEY`
- `INNGEST_SIGNING_KEY`
- `DO_API_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LITELLM_URL`
- `LITELLM_MASTER_KEY`
- `SUPABASE_PROJECT_URL`
- `INNGEST_EVENT_KEY`
- `API_KEY_ENCRYPTION_KEY`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`

### Handoff contract vars (code-defined requirement)
- `PAPERCLIP_RUNTIME_URL`
- `PAPERCLIP_HANDOFF_SECRET`
- `PAPERCLIP_HANDOFF_TTL_SECONDS`

### Droplet runtime/provisioning surfaces (codepaths)
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
- `MEMORY_OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `AGENTMAIL_API_KEY`
- `PIXELPORT_API_KEY`
- `SLACK_APP_TOKEN`

### LiteLLM surface signal (Railway variable keys)
- `LITELLM_DATABASE_URL`
- `LITELLM_MASTER_KEY`
- `LITELLM_UI_TOKEN`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

### Explicit evidence gap
- Current Vercel production env listing did not show any `PAPERCLIP_*` variables.

## 4) Track A Closure Status

- A2 (`repo/branch protection + CI owners/backups`): **open**
  - reason: PixelPort `main` currently unprotected, no rulesets on `main`, no CODEOWNERS backup mapping.
- A3 (`deploy ownership`): **open**
  - reason: ownership signals exist, but explicit founder-level approval of primary/backup ownership is not documented.
- A4 (`secrets + rotation + rollback authority`): **open**
  - reason: inventory signals captured, but source-of-truth mapping and owner signoff are not explicitly founder-closed.
- A5 (`incident escalation + founder boundaries`): **open**
  - reason: boundaries are documented, but explicit founder confirmation for closure is pending.

## Verdict

Evidence collection for Track A is complete for this slice.  
Top-level closure remains pending for A2-A5 until enforcement and founder-confirmed ownership decisions are explicit.
