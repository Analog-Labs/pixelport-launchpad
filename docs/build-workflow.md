# PixelPort — Build Workflow

**Last Updated:** 2026-03-07
**Purpose:** Standardize how a planned change moves from founder Q&A to implementation, CTO review, release, and production QA.

---

## Default Loop

1. Discuss the change in the founder Q&A/planning thread.
2. Approve one repo build brief for the next execution session.
3. Run a separate Codex build session against that brief.
4. For medium/high builds, Codex hands off to Claude Code for CTO review before merge.
5. Codex fixes any blocked findings or merges after approval.
6. Codex pushes to `main`, monitors deploy, and runs same-session production smoke.
7. Open a separate production QA session only when the release is risky or the smoke result is ambiguous.

---

## Build Sizes

- **Small**
  Low-risk tweaks, narrow bug fixes, copy/docs changes, or isolated visual polish that do not materially change product flow, auth, infra, or data contracts.

- **Medium**
  One coherent deliverable or fix bundle touching real behavior. Default expectation: use a `codex/*` branch and get Claude CTO review before merge.

- **High**
  Auth, onboarding, provisioning, infra, schema, runtime, or major UX/product-flow work. Founder approval is required before implementation, and Claude CTO review is required before merge.

---

## Founder Steps

1. Use the planning thread to decide what the next build should do.
2. Wait for Codex to turn that decision into a repo build brief under `docs/build-briefs/`.
3. Start a separate Codex execution session and point it at:
   - `AGENTS.md`
   - `docs/SESSION-LOG.md`
   - `docs/ACTIVE-PLAN.md`
   - the approved build brief
4. When Codex says the build is ready for CTO review, copy the provided CTO handoff prompt.
5. Open a fresh Claude Code session in the same repo and paste that prompt manually.
6. Wait for Claude's review result.
7. Copy Claude's full review output back into the active Codex build session.
8. If Claude blocks the change, let Codex fix it and generate a follow-up review prompt.
9. If Claude approves the change, let Codex merge, deploy, and run production smoke.

---

## Codex Responsibilities

- Create the build brief before starting a medium/high execution session.
- Use a short-lived `codex/*` branch for medium/high builds.
- Validate the change before CTO handoff.
- Prepare a review prompt that includes:
  - the build brief path
  - branch name and commit(s)
  - summary of the change
  - explicit regression areas to check
  - exact instructions for approval or block
- Interpret Claude's findings after founder pastes them back.
- Fix blocked findings, summarize changes, and generate the next review prompt when needed.
- After approval, merge to `main`, monitor deploy, and run focused production smoke.

---

## CTO Handoff Prompt Contract

Each Codex-generated CTO prompt should tell Claude to:

1. Read `AGENTS.md`, `docs/SESSION-LOG.md`, `docs/ACTIVE-PLAN.md`, and the referenced build brief.
2. Review the specific branch or final diff.
3. Focus on bugs, regression risk, missing validation, and anything that could break production.
4. Return a strict verdict in this format:

```md
Verdict: APPROVED
```

or

```md
Verdict: BLOCKED
```

The response must then include:
- findings first, ordered by severity
- file references for each real finding
- what must be fixed before merge
- what was checked or validated
- residual risks
- if approved, an explicit line:
  `Approved to merge and deploy.`

If Claude does not clearly approve, treat the review as not yet approved.

---

## Feedback Loop

- **Claude -> Founder -> Codex**
  Founder copies Claude's full review output back into the Codex build session.

- **Codex -> Founder -> Claude**
  Codex fixes issues, summarizes what changed, and produces the next review prompt.

- Repeat until Claude either:
  - approves the build, or
  - surfaces a founder-level product, architecture, or UX decision that must be resolved first

---

## Merge, Deploy, and QA Rules

- Small low-risk tweaks may ship without CTO review if no founder-only decision is involved.
- Medium/high builds require Claude CTO review before merge.
- After CTO approval, Codex may merge/deploy unless a founder-only decision is still pending.
- `main` remains the production branch and Vercel deploy source.
- Same-session production smoke is the default release check.
- Open a separate production QA session when:
  - the build is high-risk
  - auth/onboarding/provisioning changed
  - infra/runtime changed
  - smoke results are ambiguous
  - founder wants an extra release-confidence pass

---

## Required Artifacts

- **Planning thread:** founder Q&A and decision-making
- **Build brief:** `docs/build-briefs/<date>-<slug>.md`
- **Formal audit or QA evidence:** `docs/qa/` when needed
- **Live handoff tracking:** `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
