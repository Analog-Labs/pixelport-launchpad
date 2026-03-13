# PixelPort Runtime Stabilization + Onboarding Memory Fallback

**Title:** Runtime permission stabilization and non-breaking onboarding memory fallback  
**Date:** 2026-03-13  
**Owner:** Codex  
**Build Size:** `high`  
**Suggested Branch:** `codex/vidacious-runtime-permissions-stabilization`

---

## Goal

Keep tenant provisioning and runtime healthy under two failure classes:
- runtime state permission drift that breaks OpenClaw memory (`EACCES` / DB-open failures)
- missing `MEMORY_OPENAI_API_KEY` causing onboarding/provisioning hard-failure

## Scope

- In scope: persist runtime permission normalization in provisioning/cloud-init for `.openclaw` state and config files.
- In scope: replace provisioning hard-fail on missing `MEMORY_OPENAI_API_KEY` with graceful memory downgrade so onboarding still completes.
- In scope: persist a truthful downgrade warning in `tenants.onboarding_data.provisioning_memory`.
- In scope: keep Slack policy unchanged (`channels.slack.groupPolicy="open"` remains intentional in this pass).
- In scope: add focused regression tests for memory settings resolution and generated provisioning script behavior.

## Non-Goals

- Not in scope: changing Slack open-policy findings in security audit.
- Not in scope: rotating credentials or exposing secrets in repo.
- Not in scope: changing public API contracts.

## Founder-Approved Decisions

- Product decisions already approved: onboarding must not break if memory-native credentials are misconfigured.
- UX decisions already approved: no UI contract changes in this patch.
- Architecture decisions already approved: runtime can degrade native memory for that provisioning run while preserving tenant requested settings and truthful state.
- Security decisions already approved: keep Slack open-group policy unchanged for now.

## Implementation Notes

- Systems or surfaces touched:
  - `api/inngest/functions/provision-tenant.ts`
  - `api/lib/tenant-memory-settings.ts`
  - `infra/provisioning/cloud-init.yaml`
  - `src/test/provision-tenant-memory.test.ts`
  - `src/test/tenant-memory-settings.test.ts`
- Expected behavior:
  - runtime permission normalization is always applied post-container-start
  - provisioning continues when memory key is missing, with `effective_native_enabled=false`
  - warning is persisted at `onboarding_data.provisioning_memory`
- Known constraints:
  - fallback protects onboarding continuity, but native memory quality still depends on `MEMORY_OPENAI_API_KEY` existing in env
  - Slack open-policy audit warnings are expected to remain
- External credentials/dependencies:
  - `MEMORY_OPENAI_API_KEY` must remain stored in Vercel env only (never in repo)

## Acceptance Criteria

- [x] Provisioning emits runtime permission hardening and normalizes `.openclaw` state paths post-start.
- [x] Missing `MEMORY_OPENAI_API_KEY` no longer aborts provisioning.
- [x] Downgrade path is durable and truthful via `onboarding_data.provisioning_memory`.
- [x] Targeted onboarding/memory tests pass, including downgrade/no-downgrade plan resolution.
- [x] `npx tsc --noEmit` passes.
- [ ] CTO review approves merge/deploy.
- [ ] Same-session production smoke confirms fresh tenant activation on production build.

## CTO Handoff Prompt

Use the companion prompt file:
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-13-runtime-stabilization-onboarding-fallback-cto-prompt.md`

## Production Smoke Checklist

- [ ] Deploy completed successfully
- [ ] Fresh tenant provisioning reaches `active` without hard-failing on memory-key guard
- [ ] Existing runtime path still healthy (`/health`, Slack status) on target tenant
- [ ] No obvious auth/onboarding regression in dashboard status surfaces
- [ ] Inngest sync/re-registration completed if required by deploy flow

## Blockers / Required Credentials

- Required credential: `MEMORY_OPENAI_API_KEY` in Vercel production (present; should remain managed via Vercel env only).
- Process gate: Claude CTO review approval required before merge (`high` build).
