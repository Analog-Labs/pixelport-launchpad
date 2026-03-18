# TryClam Teardown Runbook (P6 Track A)

**Owner:** Founder (account actions) + Codex (repo/docs cleanup)  
**Status:** Drafted for execution  
**Last updated:** 2026-03-18

## Goal

Fully retire TryClam from PixelPort operations and documentation so no active runtime, billing, or support path depends on it.

## Scope

- Account-level teardown steps in TryClam (founder-owned)
- Repo/docs cleanup for stale references (codex-owned)
- Verification evidence that teardown is complete

## Preconditions

- P5 closure complete (LiteLLM removed from active architecture)
- Founder confirms no active customer workflows depend on TryClam

## Repository Inventory (2026-03-18)

Command used:

```bash
rg -n "tryclam|clam" docs api src infra --hidden -g '!node_modules'
```

Result:

- No operational TryClam references found in active code/docs.
- One unrelated UI utility class contains `line-clamp` (not TryClam).

## Founder Account Teardown Checklist

1. Confirm there are no active API keys/secrets still used by PixelPort.
2. Remove any webhook endpoints pointing to PixelPort domains.
3. Disable or delete any scheduled jobs/automations in TryClam.
4. Export any final compliance/billing records needed for bookkeeping.
5. Cancel subscription and confirm account deactivation state.

## Repo/Docs Cleanup Checklist (Codex)

1. Re-run TryClam reference scan in repo (`rg -n "tryclam|clam"`).
2. Remove any newly discovered stale references from active docs/configs.
3. Record evidence in `docs/qa/` with exact command output summary.
4. Update `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`.

## Verification Exit Criteria

- Zero active TryClam dependencies in runtime/config/docs.
- Founder confirms account teardown completed.
- QA evidence doc recorded with scan results and closure verdict.

## Rollback

No technical rollback expected. If business/legal needs require re-access, founder can reactivate account independently without repo changes.
