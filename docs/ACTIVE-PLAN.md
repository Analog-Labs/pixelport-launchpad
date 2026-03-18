# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one phase is active at a time.

---

## Current Phase: Phase P6 — Launch-Critical Handoff Stabilization + Integrations

**Status:** Active (P5 closed on 2026-03-18).  
**Goal:** Restore true end-to-end Launch flow first (signup -> onboarding -> provision -> launch -> authenticated runtime -> agent response), then resume integrations-first build work.
**Binding specs:** `docs/pixelport-pivot-plan-2026-03-16.md`, `docs/pixelport-master-plan-v2.md`

### Confirmed Inputs (Closed from P5)

- [x] PR `#14` merged (`9fe9ac7`) — monorepo `paperclip/` structure + provisioning LiteLLM removal
- [x] PR `#15` merged (`ae082eb`) — scan/status contract cleanup + LiteLLM repo decommission
- [x] PR `#16` merged (`4f1803c`) — Vercel `ignoreCommand` hotfix + production deploy recovery
- [x] Post-merge production smoke passed on retained/deleted route surfaces
- [x] Founder removed `LITELLM_URL` and `LITELLM_MASTER_KEY` from Vercel (2026-03-18 confirmation)
- [x] Founder shut down Railway LiteLLM service (2026-03-18 confirmation)

### P6 Work Checklist

#### Track 0 — Launch-Critical E2E (Highest Priority)
- [x] D1: Apply CTO medium fixes (scan fetch timeouts, `docs/` Vercel skip path, missing scan tests)
- [x] D2: Implement runtime launch URL contract for gateway-token auto-login (`workspace_launch_url`) in handoff + frontend launch paths
- [x] D3: Add local fail-safe golden image backup runbook and capture first local archive + checksum + manifest
- [ ] D4: Resolve Control UI secure-context/device-identity blocker on raw droplet HTTP runtime URLs (HTTPS runtime-targeting slice landed in `0c60680`; auth-mode decision gate remains)
- [ ] D5: Merge PR `#17`, deploy to production, and run full canary flow proof (`signup -> onboarding -> provision -> launch -> auto-login -> agent responds`)

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
- Launch-critical QA evidence:
  - `docs/qa/2026-03-18-p6-handoff-runtime-canary.md`
  - `docs/qa/2026-03-18-p6-runtime-ingress-https-resolution.md`
- P5 closure evidence:
  - `docs/qa/2026-03-18-p5-merge-order-smoke.md`
  - `docs/qa/2026-03-18-p5-vercel-ignorecommand-hotfix-merge-smoke.md`
- P6 Track A inventory evidence:
  - `docs/qa/2026-03-18-p6-track-a1-tryclam-inventory.md`
- P6 Track A runbook: `docs/ops/tryclam-teardown-runbook.md`
- P6 golden-image backup runbook: `docs/ops/golden-image-backup-runbook.md`
- OpenClaw upgrade note:
  - candidate bump to latest upstream tag (`v2026.3.13-1`) is queued only after D5 passes and one stable golden image canary is confirmed.
- Immediate execution order: Track 0 first. Resume Track A/B/C only after launch-critical D4/D5 closure.

---

## Previous Phases (Historical)

- Phase P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Phase P3 — Launchpad Runtime Prune ✅ (batches 1/2/3 merged)
- Phase P2 — Launch Workspace Redirect ✅
- Phase P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Phase P0 — Pivot Foundation ✅
