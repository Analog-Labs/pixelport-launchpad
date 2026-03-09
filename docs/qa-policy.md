# PixelPort — QA Policy

**Last Updated:** 2026-03-09  
**Purpose:** Standardize how PixelPort sessions validate builds, what counts as real proof, and when founder help is required for external integrations.

---

## Core Rule

PixelPort QA should prefer **real-world inputs with controlled test destinations**.

That means:
- use real public company websites or real dogfood brands when validating onboarding, scanning, vault/context generation, command flows, or Chief behavior
- use controlled test workspaces, test social accounts, test analytics properties, and test inboxes for external integration QA
- do not rely only on mocks for medium/high builds that change real runtime or product behavior
- do not use real customer tenants as the default QA target

## QA Levels

### 1. Local and fixture QA

Use for:
- unit tests
- route tests
- schema and type validation
- narrow UI or copy changes
- fast debugging before deployment

This is necessary but not sufficient for medium/high builds.

### 2. Fresh-tenant canary with real public data

Use for medium/high builds that touch:
- onboarding
- provisioning
- Chief bootstrap behavior
- vault/context population
- command flows
- scheduling
- dashboard truthfulness for runtime-backed features

Default rule:
- validate on a **fresh tenant**
- use a **real public company URL** or approved dogfood site
- prefer disposable QA tenants over old seeded tenants

### 3. Controlled integration QA

Use when the build touches external systems such as:
- Slack
- X
- LinkedIn
- GA4
- PostHog
- AgentMail / inbox flows
- OAuth or token refresh logic

Default rule:
- use controlled test accounts or test properties
- do not claim end-to-end validation without real connected accounts
- if the required access is missing, say so explicitly and mark the validation as partial

### 4. Production smoke

Use after deploy for the changed surface.

Default rule:
- validate the changed route/API/flow on production
- validate the highest-risk adjacent flow
- keep smoke targeted; do not turn every release into a full-app audit

## Evidence Expectations By Build Size

- **Small**
  - local validation is usually enough
  - production smoke only if the change touches a live path

- **Medium**
  - local validation
  - targeted production smoke
  - fresh-tenant canary if runtime-backed behavior changed

- **High**
  - local validation
  - CTO review before merge
  - fresh-tenant canary for runtime-backed changes
  - controlled integration QA if external systems are involved
  - production smoke after deploy

## Founder Access Rule

Some integration QA cannot be completed without founder-provided access, setup, or approvals.

Sessions are allowed and expected to ask the founder for access when needed for:
- Slack workspace install or admin approval
- X or LinkedIn app/account auth
- GA4 property access
- PostHog project access
- AgentMail or other inbox credentials
- any OAuth consent, 2FA, or admin-gated setup step

Founder instruction:
- when a session asks for required integration access for QA, provide it if you want that end-to-end check completed
- if access is not yet available, the session should continue with the best partial validation possible and clearly state what remains unverified

## What Sessions Must Not Do

- Do not call a build “fully QA’d” if external integration reality was not actually tested.
- Do not silently downgrade an end-to-end QA requirement to mocks only.
- Do not use random live customer tenants as the default QA surface.
- Do not use stale disposable tenants as proof when a fresh tenant canary is the right validation target.

## Recommended QA Targets

- **Dogfood brand**
  - stable internal company or brand we control
  - useful for repeatable validation

- **Fresh disposable QA tenant**
  - created after major runtime/provisioning changes
  - proves new-customer reality

- **Controlled integration environment**
  - test Slack workspace
  - test social accounts
  - test analytics properties
  - test inboxes

## Reporting Rule

Every execution session should state:
- what was validated locally
- whether a fresh-tenant canary was run
- whether controlled integration QA was run
- whether founder access was needed or missing
- what remains unverified

Record the result in:
- `docs/SESSION-LOG.md`
- `docs/ACTIVE-PLAN.md` when it affects phase status or blockers
- `docs/qa/` if a formal QA artifact is needed
