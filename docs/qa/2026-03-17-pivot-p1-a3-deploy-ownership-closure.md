# QA Evidence — Pivot P1 Track A3 Deploy Ownership Closure

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-a3-deploy-ownership-closure`  
**Scope:** Track A3 explicit deploy ownership confirmation for active pivot staging/production runtime targets

## Objective

Close A3 by recording a concrete, named deploy ownership model grounded in active pivot ownership signals from GitHub, Vercel, and DigitalOcean.

## Ownership Signals Captured

- Launchpad repo:
  - `Analog-Labs/pixelport-launchpad` default branch `main`
- Vercel deploy target (from merge commit status context):
  - `https://vercel.com/sanchalrs-projects/pixelport-launchpad/...`
  - ownership signal: `sanchalrs-projects`
- DigitalOcean account/runtime surface:
  - account email: `sanchal@analog.one`
  - account name: `Sanchal`
  - team: `My Team` (`ff5818a0-6b80-442d-81cb-c851fb8d17ea`)

Legacy-but-non-scope signal:
- Railway/LiteLLM (`pixelport-litellm`) still exists from pre-pivot architecture and is recorded as legacy infra only (not active A3 deploy ownership scope).

## Named Deploy Ownership Model (A3)

- **Primary deploy owner (all launch surfaces):**
  - `sanchalr` / `sanchal@analog.one` (founder-operated owner identity)
- **Backup deploy owners (operational delegates):**
  - `haider-rs` (primary backup)
  - `penumbra23` (secondary backup)
- **Promotion authority:**
  - primary owner executes standard production promotion
  - backup owners may execute promotion when delegated by founder
- **Rollback authority:**
  - primary owner may execute immediate rollback
  - backup owners may execute immediate rollback when delegated
  - founder notification is required immediately after rollback execution

## Notes

- Active pivot platform evidence resolves directly to founder-owned identities; backup owners are recorded as operational delegates for closure and incident readiness.
- Railway/LiteLLM is intentionally excluded from active deploy ownership because it is legacy pre-pivot infra.
- This slice closes deploy ownership confirmation scope only (A3). Secret rotation/source-of-truth (A4) and incident-command boundary confirmation (A5) remain separate.

## Verdict

`pass` for A3 closure scope: deploy ownership is now explicit, named, and documented across launchpad/runtime targets.
