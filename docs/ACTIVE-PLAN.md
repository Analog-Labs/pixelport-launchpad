# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P5 — Monorepo Paperclip + LiteLLM Removal

**Status:** Active (PR A opened: `#14`; PR B opened: `#15`).  
**Goal:** Consolidate Paperclip customizations into this repo and remove LiteLLM from active provisioning/runtime architecture.
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, P5 founder decisions (2026-03-18)

### Locked Decisions (Carry Forward)

- [x] `paperclip/` lives inside `pixelport-launchpad` (no separate customization repo)
- [x] LiteLLM is removed from active provisioning/runtime paths
- [x] Status contract gets a clean break: remove `has_litellm`
- [x] Thin bridge contract version bumps to `pivot-p0-v2`
- [x] Existing tenants are test-only; no migration track required
- [x] Platform-managed LLM keys remain the active policy (BYOK deferred)
- [x] LiteLLM infra is decommissioned now (delete repo artifacts)
- [x] Vercel `ignoreCommand` is allowed with strict safety guard (skip only when all changes are under `paperclip/`)

### P5 Work Checklist

#### Track A — Monorepo Structure + Provisioning Cutover (PR A)
- [x] A1: Create `paperclip/` customization structure (`README`, `plugins`, `theme`, `patches`, `build`)
- [x] A2: Copy `pixelport-handoff.ts` and reference test from local Paperclip customization source
- [x] A3: Add safe `vercel.json` `ignoreCommand` guard for `paperclip/**`-only changes
- [x] A4: Remove LiteLLM team/key generation from provisioning function
- [x] A5: Pass direct `OPENAI_API_KEY` into droplet env and remove `OPENAI_BASE_URL`
- [x] A6: Switch generated OpenClaw model refs from `litellm/*` to `openai/*` + `google/*`
- [x] A7: Sync provisioning templates and tests for direct-provider mode
- [x] A8: Run local validation (`npx tsc --noEmit`, `npm test`)
- [x] A9: Open CTO review PR (`#14`)

#### Track B — Scan + Contract + Decommission Cleanup (PR B)
- [x] B1: Migrate `/api/tenants/scan` to direct provider calls (OpenAI primary, Gemini fallback)
- [x] B2: Remove `has_litellm` from `/api/tenants/status` payload
- [x] B3: Bump thin bridge contract version to `pivot-p0-v2` in backend/frontend contract markers
- [x] B4: Update affected tests (`tenants-status`, contract marker, scan fallback coverage)
- [x] B5: Update `/api/debug/test-provision` expected env checks/step list for direct mode
- [x] B6: Remove `infra/litellm/*` from repo (decommission path complete)
- [x] B7: Update golden image manifest for monorepo overlay + no LiteLLM dependency
- [x] B8: Full doc sync (`SESSION-LOG`, `pixelport-project-status`, ownership/deploy docs)
- [x] B9: Run local validation (`npx tsc --noEmit`, `npm test`)
- [x] B10: Open CTO review PR (`#15`)

#### Track C — Merge + Production Closure
- [ ] C1: Merge PR A after CTO approval
- [ ] C2: Merge PR B after CTO approval
- [ ] C3: Run same-session production smoke on retained active surfaces
- [ ] C4: Founder manually remove `LITELLM_URL` + `LITELLM_MASTER_KEY` from Vercel
- [ ] C5: Shut down Railway LiteLLM service

### Notes

- Immediate next phase after P5 closure: full TryClam teardown (account-level), then integrations-first track (`Google + Slack`) with global PixelPort branding layer.
- `tenants.litellm_team_id` remains in schema temporarily (cleanup deferred to later DB migration pass).

---

## Previous Phases (Historical)

- Phase P3 — Launchpad Runtime Prune ✅ (batches 1/2/3 merged)
- Phase P2 — Launch Workspace Redirect ✅
- Phase P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Phase P0 — Pivot Foundation ✅
