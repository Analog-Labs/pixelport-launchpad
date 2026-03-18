# QA Evidence — Pivot P1 Track A5 Incident Boundary Proposal

**Date:** 2026-03-17 (America/Chicago)  
**Branch:** `codex/p1-a5-incident-boundary-closure`  
**Scope:** Founder-approval proposal for incident escalation and rollback authority closure

## Resolution

Founder approved the recommended policy set on 2026-03-17:
- `1A` rollback authority
- `2A` severity + founder notification SLA
- `3A` CTO escalation triggers

This proposal is now resolved and superseded by:
- `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-closure.md`

## Objective

Convert A5 from "documented but unconfirmed" into an explicit, founder-approved incident command and rollback policy.

## Current State

- A1-A4 are closed.
- At this proposal checkpoint, A5 was open pending explicit founder confirmation of:
  - rollback execution authority
  - founder notification SLA by severity
  - CTO escalation/review trigger points

## Proposed A5 Policy (Recommended)

### 1) Rollback Authority

- Primary immediate rollback authority:
  - Founder (`sanchalr`) and Technical Lead (Codex acting under project constitution)
- Delegated rollback authority:
  - `haider-rs` (primary backup) and `penumbra23` (secondary backup), only when founder-delegated
- Post-rollback rule:
  - founder notification is required immediately after execution

### 2) Incident Severity + Founder Notification SLA

- **SEV-0** (security/data exposure, irreversible data risk, billing/system compromise):
  - founder notified within **5 minutes**
  - CTO notified within **5 minutes**
- **SEV-1** (production outage or critical onboarding/provisioning/handoff break):
  - founder notified within **10 minutes**
  - CTO notified within **15 minutes**
- **SEV-2** (degraded behavior with viable workaround):
  - founder notified within **60 minutes**
  - CTO notified same working block (target <= **4 hours**)
- **SEV-3** (minor/no customer-impact defect):
  - batch into daily ops update unless escalation signal appears

### 3) CTO Escalation / Review Triggers

CTO review is mandatory when any of the following occurs:
- production rollback executed
- SEV-0 or SEV-1 incident
- security, auth, or secrets handling incident
- repeated SEV-2 pattern (>=2 incidents in 7 days)

CTO review is optional for isolated SEV-3 doc/config issues without runtime impact.

## Verdict

Resolved proposal artifact. Final closure truth is recorded in the A5 closure evidence file.
