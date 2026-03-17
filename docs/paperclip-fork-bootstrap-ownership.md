# Paperclip Fork Bootstrap Ownership Contract (Phase P1)

**Date:** 2026-03-16  
**Scope:** Post-P0 ownership lock for the Paperclip-primary runtime bootstrap  
**Binding context:** `docs/pixelport-pivot-plan-2026-03-16.md`

## Purpose

Define who owns each critical bootstrap function for the PixelPort-owned Paperclip fork so Phase P1 execution can proceed without decision ambiguity.

## Ownership Matrix

| Surface | Primary owner | Reviewer / backup | Founder approval required |
|---------|---------------|-------------------|---------------------------|
| Paperclip fork repo administration (default branch, protected branches, required checks) | Technical Lead (Codex) | CTO reviewer | Yes, for any policy or workflow change that alters release gates |
| CI workflow integrity for runtime repo (build/test/check jobs) | Technical Lead (Codex) | CTO reviewer | No, unless CI policy changes affect release risk posture |
| Runtime deploy environments (staging/prod targets, domain wiring, release promotion) | Technical Lead (Codex) | Founder informed; CTO reviewer on medium/high changes | Yes, for production target changes or cutover timing |
| Launchpad -> Paperclip thin handoff contract | Technical Lead (Codex) | CTO reviewer | Yes, if contract changes alter user-visible flow or auth model |
| Secret inventory and source-of-truth mapping (launchpad, Paperclip runtime, droplet bootstrap) | Technical Lead (Codex) | Founder visibility + CTO review | Yes, for key vendor/account changes |
| Secret rotation execution and cadence | Technical Lead (Codex) | Founder visibility | No for routine rotations; yes for emergency incident policy changes |
| Rollback command authority (runtime rollback / bridge rollback) | Technical Lead (Codex) | Founder notified immediately; CTO reviewer for postmortem | No for emergency rollback execution |
| Incident commander for runtime bootstrap failures | Technical Lead (Codex) | Founder escalation path + CTO reviewer | No for incident response; yes for strategy/policy changes post-incident |

## Runbook Owners

### 1) Repo and branch protection runbook
- Owner: Technical Lead (Codex)
- Coverage:
  - ensure protected `main`
  - required status checks and review gates for medium/high risk changes
  - branch naming and merge strategy alignment

### 2) Deploy environment runbook
- Owner: Technical Lead (Codex)
- Coverage:
  - staging/prod environment mapping
  - deploy promotion sequence
  - release verification and smoke expectations

### 3) Secrets source-of-truth and rotation runbook
- Owner: Technical Lead (Codex)
- Coverage:
  - per-surface secret inventory (launchpad API, Paperclip runtime API/auth, droplet provisioning)
  - storage-of-record and sync rules
  - rotation checklist and evidence logging

### 4) Rollback runbook
- Owner: Technical Lead (Codex)
- Coverage:
  - rollback triggers (failed deploy, failing canary, truthfulness regression, auth mismatch)
  - rollback execution order (runtime first, bridge second when needed)
  - validation checks after rollback

### 5) Incident escalation runbook
- Owner: Technical Lead (Codex)
- Coverage:
  - detection channels and severity classes
  - founder notification SLA by severity
  - CTO review handoff for medium/high incidents

## Acceptance Gates for P1 Bootstrap Ownership Lock

- [ ] Canonical Paperclip fork repo URL and default branch are documented in runtime handoff docs.
- [ ] Branch protection and required checks are enabled for the Paperclip runtime repo.
- [ ] Deploy ownership is assigned for staging + production runtime targets.
- [ ] Launchpad-to-Paperclip handoff contract owner and reviewer are explicitly assigned.
- [ ] Secret inventory lists each key, storage system, owner, and rotation owner.
- [ ] Rollback authority and incident escalation path are confirmed.
- [ ] Founder-approved decision boundaries are acknowledged before cutover work begins.

## Founder Decision Boundaries (Must Be Explicitly Approved)

- Any change to product-visible onboarding/auth flow tied to Paperclip runtime handoff.
- Any production cutover timing decision or rollback policy change.
- Any net-new vendor/provider decision for auth, hosting, or secret management.
- Any UX/policy change that alters who can provision or launch runtime workspaces.

## Operating Notes

- This contract does not replace `AGENTS.md`; it clarifies execution ownership for P1 bootstrap only.
- If any conflict exists, pivot lock decisions in `docs/pixelport-pivot-plan-2026-03-16.md` win.
