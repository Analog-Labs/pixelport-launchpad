# PixelPort — Project Coordination System

**Last Updated:** 2026-03-06
**Purpose:** Keep Founder, Codex, and CTO aligned across async sessions without relying on chat memory.
**Source of Truth:** The GitHub repo.

---

## Operating Model

**Effective 2026-03-06:** PixelPort now runs under a Technical Lead model.

- **Founder**
  - Approves major product, architecture, and UX decisions.
  - May still use Lovable for visual and UI-only changes.
- **Codex (Technical Lead)**
  - Owns functional frontend work, backend, infra, integrations, repo maintenance, debugging, and release execution.
  - Keeps founder and CTO informed through the repo docs and commits.
- **CTO (QA/Reviewer)**
  - Provides occasional QA, audits, and strategic review when practical.
  - Is not a hard gate for routine implementation.

This note changes current operating rules only. Historical session ownership stays as written in archive docs and old session entries.

---

## The 4 Live Files

### 1. `AGENTS.md` / `CLAUDE.md`

Short constitutions. Every session starts here.

They should only contain:
- project identity
- session protocol
- current role boundaries
- where to find the deeper docs

Keep them short. They route work; they do not hold full history.

### 2. `docs/SESSION-LOG.md`

The handoff note. Read first at the start of a session, update last at the end.

Use it for:
- what changed
- what was validated
- what is next
- blockers or missing env/config
- decisions made during implementation

### 3. `docs/ACTIVE-PLAN.md`

The live phase checklist.

Use it for:
- current phase status
- completed vs pending work
- blockers waiting on founder or external credentials
- current implementation notes that matter to future sessions

Only one phase should be marked current.

### 4. `docs/pixelport-project-status.md`

The long-form history and decisions library.

Use it for:
- dated governance or architecture notes
- major milestones
- durable lessons learned
- deeper historical context

Do not rewrite history there. Add dated notes instead.

---

## Session Protocol

### Start

1. Read `docs/SESSION-LOG.md`
2. Read `docs/ACTIVE-PLAN.md`
3. Read deeper docs only as needed for the task
4. Confirm whether the task needs founder approval before changing direction

### During work

- Routine implementation can proceed under Technical Lead ownership.
- Major product, architecture, or UX changes still require founder approval first.
- If something is unclear and it changes user-facing behavior materially, pause and ask founder in plain language.
- If an issue is architectural but outside approved scope, document it without redesigning the system unilaterally.

### End

1. Update `docs/SESSION-LOG.md`
2. Update `docs/ACTIVE-PLAN.md`
3. Add a dated note to `docs/pixelport-project-status.md` if the session changed governance, architecture, or long-term process
4. Commit the work with a descriptive message

---

## Decision Rules

### Founder approval required

- pricing or packaging changes
- major product flow changes
- architecture pivots
- new infrastructure vendors
- major UX changes
- policy changes that affect how people collaborate on the project

### Technical Lead can decide

- implementation details inside an approved direction
- bug fixes
- data wiring
- infrastructure fixes that do not change the approved architecture
- frontend functional behavior needed to make approved product flows work
- runtime hardening, observability, deployment sequencing, and maintenance work

### CTO review usage

- request CTO QA when practical for risky changes, release checks, or strategic feedback
- do not block routine fixes on CTO availability

---

## Frontend Workflow

Lovable remains useful, but it is no longer the boundary for all frontend work.

- Founder may use Lovable for visual, layout, and UI-only exploration.
- Technical Lead owns repo-side implementation for:
  - data wiring
  - route logic
  - auth behavior
  - backend-dependent UI behavior
  - integrations
  - performance fixes
  - bug fixes in `src/`
- If founder creates a UI-only Lovable change, the repo still remains the source of truth and Technical Lead is responsible for keeping functional behavior coherent.

Use the collaboration guide in `docs/lovable-collaboration-guide.md` for the day-to-day UI workflow.

---

## Release and QA Flow

- Routine implementation may ship under Technical Lead ownership.
- Founder approval is still required before shipping major product, architecture, or UX changes.
- CTO QA is preferred when practical for high-risk or high-visibility releases.
- Validation evidence should live in:
  - `docs/SESSION-LOG.md`
  - `docs/ACTIVE-PLAN.md`
  - `docs/qa/` when a formal audit or execution brief is needed

---

## Golden Rules

1. GitHub repo is the source of truth.
2. Every session starts with `SESSION-LOG.md` and `ACTIVE-PLAN.md`.
3. Every session ends with doc updates and a commit.
4. Keep current-role docs current; preserve historical docs as history.
5. Ask founder before changing product, architecture, or UX direction.
6. Use plain language with founder. No avoidable jargon.
7. Prefer one clear operating model in live docs over half-updated role notes.
