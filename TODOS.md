# TODOS

## Provisioning & Bootstrap Reliability

### Bind Paperclip Project Workspace to OpenClaw Runtime Workspace

**What:** Update tenant provisioning/integration so Chief runs always resolve to a real project workspace (the same OpenClaw workspace path) instead of agent-home fallback.

**Why:** Current runs repeatedly log `No project or prior session workspace was available...`, which breaks continuity and makes workspace/memory behavior non-deterministic.

**Context:** We currently wake Chief without a usable project workspace record/cwd for execution context in fresh tenants, so Paperclip falls back to `instances/default/workspaces/<agentId>`. We need one canonical workspace per tenant that both Paperclip and OpenClaw use, with project/workspace linkage created during bootstrap and reused across runs.

**Effort:** M
**Priority:** P0
**Depends on:** None

### Remove OpenClaw Gateway Endpoint Bottleneck (Use Native Paperclip Flows)

**What:** Expand the OpenClaw gateway wake-run instructions so agents can use the full required Paperclip API surface (especially approval-aware endpoints), not just the current issue-only subset.

**Why:** The current instruction contract pushes agents into workaround behavior (for example, creating manual "approval-needed" issues) instead of using Paperclip approvals as intended.

**Context:** The gateway adapter currently says “use only endpoints listed below” and lists a narrow issue workflow. This limits orchestration even though agent runtime scopes already include approval capabilities.

**Effort:** M
**Priority:** P0
**Depends on:** None

### Fix OpenClaw Task-State Execution Contract (Checkout + Status Handling)

**What:** Correct the OpenClaw wake workflow so task pickup and completion logic is consistent with Paperclip states (including safe handling of `in_progress`) and does not hard-force `done` when work is actually blocked/review.

**Why:** Current run instructions are internally inconsistent and can cause avoidable conflicts/no-op behavior plus incorrect status transitions.

**Context:** The instructions currently prioritize `in_progress` tasks but checkout expectations are narrower, and the default completion step hard-patches status to `done`.

**Effort:** M
**Priority:** P0
**Depends on:** Remove OpenClaw Gateway Endpoint Bottleneck (Use Native Paperclip Flows)

### Remove Forced Single-Run Completion Directive

**What:** Remove/replace the hard wake instruction that forces agents to “Complete the workflow in this run.”

**Why:** Some Paperclip-native workflows are intentionally multi-step (pending approvals, blocked waits, staged execution). A forced single-run completion instruction can produce premature closures and brittle behavior.

**Context:** The current OpenClaw gateway wake text includes a strict one-run completion directive that should be replaced with status-aware continuation rules.

**Effort:** S
**Priority:** P0
**Depends on:** Fix OpenClaw Task-State Execution Contract (Checkout + Status Handling)

### Remove Forced `status=done` Default in Wake Procedure

**What:** Remove/replace the default wake instruction that tells OpenClaw to PATCH issue status to `done` as the normal terminal step.

**Why:** This can overwrite legitimate intermediate states (`in_review`, `blocked`) and diverges from native Paperclip lifecycle semantics.

**Context:** Completion status should be outcome-driven (done/review/blocked/in_progress) based on task reality, not hard-coded by the wake template.

**Effort:** S
**Priority:** P0
**Depends on:** Fix OpenClaw Task-State Execution Contract (Checkout + Status Handling)

### Remove OpenClaw Browser Tool Deny Restriction

**What:** Remove the OpenClaw agent tool policy that currently denies browser usage in provisioning/runtime defaults.

**Why:** Browser access is part of expected agent capability for parity with Paperclip workflows; denying it creates an artificial orchestration restriction.

**Context:** Provisioning currently writes `tools.deny: ['browser']` into OpenClaw agent config. This should be removed unless explicitly disabled per-tenant by product policy.

**Effort:** S
**Priority:** P0
**Depends on:** None

### Add OpenClaw↔Paperclip Orchestration Contract Canary

**What:** Add an automated canary that validates the end-to-end runtime contract after provisioning (task pickup, approval-linked behavior, status transitions, and workspace/memory continuity).

**Why:** Without a contract canary, instruction drift can silently re-introduce runtime restrictions even when individual components look healthy.

**Context:** This canary should fail fast when orchestration behavior diverges from native Paperclip expectations and should run before tenant “ready” is considered trustworthy.

**Effort:** M
**Priority:** P1
**Depends on:** Bind Paperclip Project Workspace to OpenClaw Runtime Workspace

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

### Add Launch Event Outbox + Retry Worker Hardening

**What:** Add a durable outbox for launch event dispatch from `POST /api/tenants/launch`, plus retry worker processing and delivery guarantees.

**Why:** Current flow safely rolls draft status back when event dispatch fails, but still relies on immediate in-request event send and cannot guarantee eventual delivery under prolonged queue/network incidents.

**Context:** Session 1-3 shipped rollback-based retry safety for launch. This follow-up should add persistent event records, retry/backoff policy, and observability so launch-triggered provisioning is durable without user re-click dependence.

**Effort:** M
**Priority:** P1
**Depends on:** Session 1-3 launch-triggered provisioning baseline

## Completed
