# Post-P6 Next Program Draft (Approval Pending)

- **Date:** 2026-03-19
- **Status:** draft for founder approval
- **Context:** P6 reset is complete and merged through R5 (`PR #23`) plus closeout docs (`PR #24`).

## Proposed Program Objective

Move from reset/stabilization into deliberate growth execution without reintroducing architecture drift.

## Recommended Sequence

1. **P7-S0 — Decision Lock + Drift Cleanup (docs-only, fast)**
2. **P7-S1 — Upgrade Track (canary-first, only if newer stable versions exist)**
3. **P7-S2 — Integrations Track (Google + Slack hardening)**
4. **P7-S3 — Deferred Policy/Commercial Backlog (stripe trigger, SSH, rotation policies)**

This order keeps the system stable, then upgrades core runtime safely, then expands integrations on a known-good base.

## Scope Draft by Slice

### P7-S0 — Decision Lock + Drift Cleanup

- Normalize planning drift in `docs/pixelport-project-status.md` where older “immediate next actions” conflict with already-closed tracks.
- Lock next active program in `docs/ACTIVE-PLAN.md` with approved order and explicit out-of-scope list.
- Record all founder decisions in `docs/SESSION-LOG.md` before implementation starts.

### P7-S1 — Upgrade Track (Conditional)

- Check latest upstream versions (OpenClaw and Paperclip) against current pinned baseline:
  - OpenClaw: `2026.3.13-1`
  - Paperclip: `v2026.318.0`
- If newer stable tags exist, run canary-first upgrade slices with rollback evidence and managed image promotion gate.
- Carryover fix decision:
  - treat `onboarding_data.bootstrap.status=failed (Unauthorized)` as either:
    - launch-nonblocking known caveat, or
    - required fix in this track.
- Carryover route decision:
  - `/pixelport/handoff` stays out-of-scope (gateway-token path remains standard), or
  - include explicit handoff route activation/fix.

### P7-S2 — Integrations Track

- Slack hardening pass (including URL-token exposure cleanup from earlier QA note).
- Google integration mapping + first implementation slice (auth, scopes, health checks, smoke path).
- Keep this integrations-first track constrained to verified production-safe slices with CTO review gates.

### P7-S3 — Deferred Policy/Commercial Backlog

- Stripe-trigger provisioning policy and implementation timing.
- Customer SSH policy decision.
- Deferred risk closures:
  - secret/token rotation policy closure
  - media rights/licensing policy closure
- TryClam teardown final account closure confirmation (founder-owned external action), then docs confirmation.

## Decision Gates Needed From Founder

1. Choose next active execution mode:
   - **Upgrade-first (recommended)**
   - Integrations-first
2. Should `bootstrap Unauthorized` be upgraded from caveat to blocker in the next program?
3. Should `/pixelport/handoff` be included in next implementation scope or remain out-of-scope?
4. Should TryClam teardown be executed immediately in the next slice or deferred behind upgrades/integrations?

## Exit Criteria for Program Kickoff

- Active sequence approved and written in `docs/ACTIVE-PLAN.md`.
- Decision gates documented in `docs/SESSION-LOG.md`.
- First execution branch opened with explicit slice scope and test gates.
