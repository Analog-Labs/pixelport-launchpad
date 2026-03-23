# TODOS

## Provisioning & Bootstrap Reliability

### Throttle Provisioning Recovery in Status Poll Path

**What:** Add per-tenant throttling and eligibility guards for recovery attempts in `/api/tenants/status` via `api/lib/provisioning-recovery.ts`.

**Why:** Onboarding polls every 5 seconds; repeated recovery attempts can trigger unnecessary external calls and DB writes, increasing race and load risk.

**Context:** Current behavior allows frequent recovery attempts while users sit on onboarding. Introduce a bounded cadence (for example, max one recovery attempt per tenant per short window) and explicit eligibility checks before running recovery work.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Expand Active-Status Ordering Regression Coverage

**What:** Add full tests that assert tenant status is only moved to `active` after readiness proof succeeds, and remains non-active on failure paths.

**Why:** The onboarding contract depends on this ordering to avoid exposing a “ready” tenant that still cannot run cleanly.

**Context:** Current review accepted smoke-only coverage for this area. Add explicit success and failure ordering checks around the provisioning flow so future refactors cannot silently regress the contract.

**Effort:** M
**Priority:** P1
**Depends on:** Final readiness helper behavior in provisioning flow

### Deepen Replay + Structured Error Contract Tests

**What:** Add broader replay-route and structured bootstrap-error tests beyond single-field checks.

**Why:** Replay behavior and error contracts are operationally important during incidents; partial coverage can miss schema drift and edge-path regressions.

**Context:** Current review intentionally selected limited coverage (`TR3-B`, `TR4-B`). Follow-up should verify multi-field error shape, replay failure branches, and stable propagation across route responses/state writes.

**Effort:** M
**Priority:** P2
**Depends on:** Structured bootstrap error metadata implementation

## Completed
