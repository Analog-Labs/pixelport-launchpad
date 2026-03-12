# PixelPort Native Memory Foundation

**Title:** Native OpenClaw memory for `vidacious-4` plus future-tenant inheritance
**Date:** 2026-03-12
**Owner:** Codex
**Build Size:** `high`
**Suggested Branch:** `codex/memory-foundation`

---

## Goal

Repair native OpenClaw memory on active tenant `vidacious-4`, make future tenants inherit the same working native memory baseline, and keep Mem0 optional and non-blocking.

## Scope

- In scope: add a shared tenant-memory settings resolver with flat keys `memory_native_enabled` and `memory_mem0_enabled`.
- In scope: wire the validated OpenClaw `agents.defaults.memorySearch` config path through provisioning with `MEMORY_OPENAI_API_KEY`.
- In scope: extend workspace scaffolding and guidance with standard OpenClaw native-memory artifacts only at `MEMORY.md` and `memory/*.md`.
- In scope: make `/api/agent/memory` degrade gracefully when Mem0 is disabled or unavailable.
- In scope: repair the live `vidacious-4` droplet in-session and run one fresh-tenant canary before merge.

## Non-Goals

- Not in scope: dashboard UI work, Slack debugging, content-pipeline redesign, runtime-admin work, or Gemini/web-search changes.
- Not in scope: speculative OpenClaw memory config keys beyond the live-validated `memorySearch` path.
- Not in scope: making Mem0 required for any tenant.

## Founder-Approved Decisions

- Product decisions already approved: native OpenClaw memory is the default fast-recall layer; Mem0 stays optional and default-off.
- UX decisions already approved: the dashboard remains a projection of backend and workspace truth, not a second source of truth.
- Architecture decisions already approved: the tenant droplet workspace is the runtime source of truth, native memory is derived from canonical truth, and memory config must stay inside the validated OpenClaw `2026.3.2` schema.

## Implementation Notes

- Systems or surfaces touched: `api/inngest/functions/provision-tenant.ts`, `api/lib/workspace-contract.ts`, `api/lib/onboarding-bootstrap.ts`, `api/agent/memory.ts`, tenant creation paths, and focused tests.
- Expected data flow or integration behavior: new tenants persist flat memory settings, provisioning emits `agents.defaults.memorySearch` with `remote.apiKey: "${MEMORY_OPENAI_API_KEY}"`, workspace scaffolding writes native-memory artifacts, and Mem0-disabled tenants no longer hit raw config `500`s.
- Known constraints or existing caveats: `OPENAI_API_KEY` on tenant droplets still points to LiteLLM for general model routing, so native memory must keep using direct `MEMORY_OPENAI_API_KEY`. The disposable fresh canary proved native-memory inheritance and indexing, but its local runtime did not complete task/competitor/workspace-event writes before cleanup.
- External credentials or dependencies: `MEMORY_OPENAI_API_KEY` has already been provided and validated on the repaired live tenant and the disposable canary. No additional credential is required for review.
- Bundled out-of-scope note: `api/inngest/index.ts` also adds optional `INNGEST_SERVE_HOST` support for `serve(...)`. This is not part of the memory foundation itself, but it is harmless and intentionally documented if committed in the same branch.

## Acceptance Criteria

- [x] Shared tenant-memory settings resolution defaults old and new tenants consistently.
- [x] Provisioning emits only the live-validated OpenClaw native-memory config path and fails fast if native memory is enabled without `MEMORY_OPENAI_API_KEY`.
- [x] Workspace scaffolding and Chief guidance include standard native-memory artifacts and refresh rules derived from canonical truth.
- [x] `/api/agent/memory` degrades gracefully for disabled or unavailable Mem0 instead of returning raw config `500`s.
- [x] Targeted tests plus `npx tsc --noEmit` pass locally.
- [x] Live `vidacious-4` repair proves real native memory search hits after reindex.
- [x] One fresh-tenant canary inherits working native memory and is cleaned up in the same session.

## CTO Handoff Prompt

Use the companion prompt file:
- `docs/build-briefs/2026-03-12-memory-foundation-cto-prompt.md`

## Production Smoke Checklist

- [ ] Deploy completed successfully
- [ ] `vidacious-4` native memory works on the live runtime after reindex
- [ ] Mem0-disabled behavior no longer returns raw config `500`s
- [ ] Fresh-tenant inheritance of native memory is proven on one real canary
- [ ] Canary cleanup completed with FK-safe database deletes plus droplet cleanup

## Blockers / Required Credentials

- Resolved credential: `MEMORY_OPENAI_API_KEY` was provided and validated during the live repair and fresh-canary proof.
- Remaining gate: CTO review must complete before merge/deploy.
