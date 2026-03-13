# QA Evidence — Runtime Stabilization + Onboarding Memory Fallback

**Date:** 2026-03-13  
**Branch:** `codex/vidacious-runtime-permissions-stabilization`  
**Commits in scope:** `25308e8`, `b48af15`

## Incident Trigger

- Inngest production run `Provision New Tenant` failed with:
  - `MEMORY_OPENAI_API_KEY is required when memory_native_enabled is true`
- Impact: provisioning aborted before droplet creation, tenant remained in `provisioning`.

## Code Behavior Changes Verified

1. Runtime permission hardening persists in generated provisioning flow:
   - host file perms tightened (`openclaw.json`, `.env`)
   - post-start permission normalization for `.openclaw` runtime state paths.
2. Provisioning no longer throws on missing `MEMORY_OPENAI_API_KEY`:
   - calculates requested vs effective memory mode
   - gracefully disables native memory for that provisioning run if key missing
   - persists warning truth at `onboarding_data.provisioning_memory`.
3. No Slack policy change in this pass:
   - intentional `groupPolicy:"open"` posture remains untouched.

## Validation Commands

```bash
npx vitest run src/test/tenant-memory-settings.test.ts \
  src/test/provision-tenant-memory.test.ts \
  src/test/tenants-bootstrap-route.test.ts \
  src/test/tenants-status-route.test.ts \
  src/test/agent-memory-route.test.ts

npx tsc --noEmit
```

## Validation Result

- Tests: **5 files passed, 20 tests passed**.
- TypeScript: **clean** (`--noEmit` success).
- Vercel env check confirmed `MEMORY_OPENAI_API_KEY` is currently present in production env.

## Residual Risk

- Fallback protects onboarding continuity, not memory feature quality.
- Native memory remains effectively disabled for a provisioning run if the key is absent in env.
- A post-deploy fresh-tenant smoke is still required for full production release confidence.
