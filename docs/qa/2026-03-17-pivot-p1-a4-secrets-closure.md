# QA Evidence — Pivot P1 Track A4 Secrets Closure

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-a4-secrets-ownership-closure`  
**Scope:** Founder-approved closure of Track A4 (secret inventory + source-of-truth + rotation policy)

## Founder Decisions Applied

1. Source of truth: **Vercel only** for active pivot secrets.
2. Rotation cadence: **90 days for all** active pivot secrets.
3. Active runtime keys: AGENTMAIL/GEMINI/MEM0 keys were added in Vercel for OpenClaw-driven use.
4. Legacy platform: Railway/LiteLLM marked **decommission path** (not active pivot secret authority).

## Live Inventory Revalidation (Names Only)

Vercel production key listing now includes:
- `AGENTMAIL_API_KEY`
- `API_KEY_ENCRYPTION_KEY`
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

Contract truth remains:
- required handoff secret: `PAPERCLIP_HANDOFF_SECRET`
- optional TTL: `PAPERCLIP_HANDOFF_TTL_SECONDS` (defaults to `300` when unset)

## Legacy/Out-of-Scope Note

Railway/LiteLLM variable surface remains present but is legacy-only and decommission-tracked. It is excluded from active pivot secret authority.

## Verdict

`pass` for Track A4 closure scope. Founder decisions are now explicit, evidence-backed, and recorded in planning/ownership docs.
