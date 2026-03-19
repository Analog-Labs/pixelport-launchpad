# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P6 Reset — Drift Correction + Runtime Upgrades + Branding Baseline

**Status:** Active  
**Goal:** Close workspace-policy drift first, then safely upgrade OpenClaw and Paperclip with canary-first validation, then finish a baseline branding pass without regressing Launch reliability.  
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/pixelport-master-plan-v2.md`

### Locked Execution Order

- [ ] R1: Workspace drift correction + Paperclip-default template sourcing + Chief of Staff terminology alignment
- [ ] R2: OpenClaw upgrade to `2026.3.13` line (`v2026.3.13-1`) with managed-image canaries
- [ ] R3: Paperclip upgrade to `v2026.318.0` (compatibility-only) with managed-image canaries
- [ ] R4: Combined regression proof (`signup -> onboarding -> provision -> launch -> auto-login -> agent responds`)
- [ ] R5: Baseline branding pass (identity/copy/theme baseline on critical surfaces)

### Current Slice (R1)

- [x] R1.1 Pull upstream default CEO templates from `paperclipai/companies/default/ceo` at pinned commit and vendor in repo
- [x] R1.2 Refactor workspace contract generation to use Paperclip defaults + SOUL-only onboarding additive block
- [x] R1.3 Ensure onboarding data injection is scoped to SOUL only (no AGENTS/HEARTBEAT/TOOLS injection)
- [x] R1.4 Add/update provisioning template tests + workspace contract tests
- [x] R1.5 Validate local gates (`npx tsc --noEmit`, `npm test`)
- [ ] R1.6 Open CTO-review PR and await approval/merge

### Release and QA Gates (Per Phase)

- [ ] CTO review + approval before merge
- [ ] Merge to `main`
- [ ] Post-merge production smoke
- [ ] Evidence doc + rollback notes updated

### Deferred by Founder Decision

- TryClam scrub and cleanup work
- Integrations track (Google + Slack)

### Notes

- Existing tenant workspace retrofit is out of scope for this reset cycle (new-tenant behavior only).
- D4 control-ui device-auth break-glass closure is deferred.
- Version pins must be recorded as tag + immutable commit/image digest.
- Production managed image guard (`PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`) should be re-enabled immediately after the first stable upgraded managed image is promoted.

---

## Previous Phases (Historical)

- Phase P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Phase P3 — Launchpad Runtime Prune ✅ (batches 1/2/3 merged)
- Phase P2 — Launch Workspace Redirect ✅
- Phase P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Phase P0 — Pivot Foundation ✅
