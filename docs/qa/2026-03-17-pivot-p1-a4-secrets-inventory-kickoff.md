# QA Evidence — Pivot P1 Track A4 Secrets Inventory Kickoff

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-a4-secrets-ownership-closure`  
**Scope:** Capture current secret/config surfaces and identify closure decisions for A4

## Objective

Produce an evidence-backed A4 baseline for:
- source-of-truth ownership by surface
- rotation ownership/cadence decisions
- unresolved secret/config owner mappings before closure

## Live Evidence Captured

### 1) Vercel production env names (active launchpad surface)

Observed keys include:
- `API_KEY_ENCRYPTION_KEY`
- `DO_API_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `LITELLM_MASTER_KEY`
- `LITELLM_URL`
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

### 2) Runtime handoff contract env truth (code)

From `api/lib/paperclip-handoff-contract.ts` and `api/runtime/handoff.ts`:
- required: `PAPERCLIP_HANDOFF_SECRET`
- optional: `PAPERCLIP_HANDOFF_TTL_SECONDS` (default `300`)
- runtime URL is derived from tenant `droplet_ip` (not a required env var)

### 3) GitHub repo-level automation config surface

- `gh secret list -R Analog-Labs/pixelport-launchpad` returned no entries.
- `gh variable list -R Analog-Labs/pixelport-launchpad` returned no entries.

### 4) Legacy Railway/LiteLLM surface (pre-pivot, non-active)

Railway project `pixelport-litellm` still exists. Observed variable names include:
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `LITELLM_DATABASE_URL`
- `LITELLM_MASTER_KEY`
- `LITELLM_UI_TOKEN`
- `OPENAI_API_KEY`

Values were intentionally excluded from this artifact.

## A4 Gaps Needing Founder Closure

1. `PAPERCLIP_HANDOFF_TTL_SECONDS` is not visible in current Vercel production env listing.
   - This is currently non-blocking because code defaults to `300` seconds.
2. Runtime/provisioning-referenced env names not visible in current Vercel production env listing require explicit owner truth:
   - `AGENTMAIL_API_KEY`
   - `GEMINI_API_KEY`
   - `MEM0_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENCLAW_IMAGE`
   - `OPENCLAW_RUNTIME_IMAGE`
   - `TENANT_PROVISIONING_ALLOWLIST`
3. Legacy Railway/LiteLLM secret lifecycle is not yet closure-defined (retain for fallback vs rotate+decommission timetable).

## Closure Read

A4 is **not yet closed**. Inventory evidence is now current and actionable; final closure requires founder approval of source-of-truth ownership, rotation policy, and legacy decommission handling.
