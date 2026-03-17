# QA Evidence — Pivot P0 Runtime Baseline + Thin Bridge Contract Slice

**Date:** 2026-03-16  
**Branch:** `codex/pivot-p0-implementation`  
**Commits in scope:** second pivot implementation slice changes in this session.

## Scope Validated

- Provisioning droplet baseline resolver behavior:
  - canonical + legacy env selectors
  - default `s-4vcpu-8gb` / `nyc1`
  - compatibility fallback image when image env is unset
- Golden-image manifest + infra comment sync:
  - pinned component policy documented
  - canary/manual rollout guidance captured
- Thin bridge status contract:
  - `/api/tenants/status` emits contract marker + `task_step_unlocked`
  - onboarding consumes `task_step_unlocked` when present
- Migration prune planning:
  - keep/deprecate/archive route inventory and deletion order constraints.

## Validation Commands

```bash
npx tsc --noEmit
npx vitest run src/test/provision-tenant-memory.test.ts src/test/provisioning-allowlist.test.ts src/test/runtime-bridge-contract.test.ts
```

## Validation Result

- TypeScript: **clean** (`--noEmit` success)
- Vitest: **18/18 tests passed** across 3 files
- Manual code review: no remaining blocking regressions after compatibility fallback adjustment.

## Findings

- Initial QA pass found one high-risk provisioning regression risk (unverified default image selector when env unset) in `provision-tenant.ts`; this was fixed in-slice by adding `ubuntu-24-04-x64` compatibility fallback and warning log.
- No blocking findings remain in current tree.

## Residual Risk / Testing Gaps

- True golden-image enforcement still depends on setting `PROVISIONING_DROPLET_IMAGE` in deployment env.
- No fresh-tenant production canary was executed in this evidence; post-merge smoke remains required.
- Thin bridge status contract is unit/type validated; no dedicated route-level integration test yet for `/api/tenants/status` payload shape.
