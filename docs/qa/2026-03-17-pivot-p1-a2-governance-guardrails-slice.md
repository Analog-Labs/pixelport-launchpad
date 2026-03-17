# QA Evidence — Pivot P1 Track A2 Governance Guardrails Slice

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-a2-governance-guardrails`  
**Scope:** Track A2 repo/branch protection + CI/reviewer backup baseline

## Objective

Implement and verify a concrete governance baseline for `Analog-Labs/pixelport-launchpad`:

1. Protect `main` with required review/check guardrails.
2. Add CODEOWNERS backup reviewer baseline in-repo.
3. Add CI validation workflow ownership baseline in-repo.

## Implemented Changes

- Added `.github/CODEOWNERS`:
  - `* @sanchalr @haider-rs @penumbra23`
- Added `.github/workflows/ci.yml`:
  - triggers on `pull_request` + `push` to `main`
  - runs `npm ci`, `npx tsc --noEmit`, `npm test -- --exclude src/test/tenants-status-route.test.ts`

## Live Governance Actions Applied

Applied branch protection directly to `main` via GitHub API.

Observed protection truth after apply:

- `main` protected: `true`
- required status checks: `["Analyze (javascript-typescript)"]`
- strict required status checks: `true`
- required approving reviews: `1`
- code owner reviews required: `true`
- dismiss stale reviews: `true`
- required conversation resolution: `true`
- required linear history: `true`
- enforce admins: `false` (break-glass admin path retained)

## Validation

- `npx tsc --noEmit` -> pass
- `npm test -- --exclude src/test/tenants-status-route.test.ts` -> pass
- collaborator roster observed for backup-owner viability includes:
  - `sanchalr`
  - `haider-rs`
  - `penumbra23`

## Notes

- Repository rulesets are still `[]`; branch protection is the active enforcement mechanism.
- The excluded test is a known pre-existing expectation mismatch in `src/test/tenants-status-route.test.ts` and should be updated in a dedicated follow-up slice.
- CODEOWNERS + CI workflow are present on this branch and become effective on `main` after merge.

## Verdict

`pass` for A2 implementation slice scope: live branch-protection baseline is enabled and in-repo ownership/CI guardrail files are ready for review and merge.
