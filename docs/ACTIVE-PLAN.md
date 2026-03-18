# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P6 — Integrations-First Post-Pivot Build

**Status:** Active (P5 closed on 2026-03-18).  
**Goal:** Move from pivot cleanup into account/tooling cleanup plus integrations-first build work (Google + Slack), with global PixelPort branding staged in parallel.
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/pixelport-master-plan-v2.md`

### Confirmed Inputs (Closed from P5)

- [x] PR `#14` merged (`9fe9ac7`) — monorepo `paperclip/` structure + provisioning LiteLLM removal
- [x] PR `#15` merged (`ae082eb`) — scan/status contract cleanup + LiteLLM repo decommission
- [x] PR `#16` merged (`4f1803c`) — Vercel `ignoreCommand` hotfix + production deploy recovery
- [x] Post-merge production smoke passed on retained/deleted route surfaces
- [x] Founder removed `LITELLM_URL` and `LITELLM_MASTER_KEY` from Vercel (2026-03-18 confirmation)
- [x] Founder shut down Railway LiteLLM service (2026-03-18 confirmation)

### P6 Work Checklist

#### Track A — TryClam Teardown
- [x] A1: Inventory any remaining TryClam dependencies (repo/docs/runtime/process)
- [x] A2: Create a concrete teardown runbook with explicit owner actions and verification checks
- [ ] A3: Execute repo/doc cleanup for stale TryClam references and open CTO review PR

#### Track B — Integrations-First (Google + Slack)
- [ ] B1: Map current integration/auth surfaces in launchpad and `paperclip/` overlay
- [ ] B2: Define first implementation slice for Google + Slack onboarding/runtime path improvements
- [ ] B3: Execute first approved integration slice on `codex/*` branch with CTO review

#### Track C — Global PixelPort Branding Baseline
- [ ] C1: Inventory launchpad + `paperclip/` branding touchpoints
- [ ] C2: Draft baseline branding token/theme proposal for founder approval
- [ ] C3: Implement approved baseline in first branding PR

### Notes

- Major product, architecture, and UX decisions still require founder approval before implementation.
- P5 closure evidence:
  - `docs/qa/2026-03-18-p5-merge-order-smoke.md`
  - `docs/qa/2026-03-18-p5-vercel-ignorecommand-hotfix-merge-smoke.md`
- P6 Track A inventory evidence:
  - `docs/qa/2026-03-18-p6-track-a1-tryclam-inventory.md`
- P6 Track A runbook: `docs/ops/tryclam-teardown-runbook.md`
- Immediate execution order: Track A first, then Track B, with Track C prepared in parallel as non-blocking planning.

---

## Previous Phases (Historical)

- Phase P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Phase P3 — Launchpad Runtime Prune ✅ (batches 1/2/3 merged)
- Phase P2 — Launch Workspace Redirect ✅
- Phase P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Phase P0 — Pivot Foundation ✅
