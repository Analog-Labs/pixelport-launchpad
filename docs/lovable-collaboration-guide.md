# PixelPort — Lovable Collaboration Guide

**Last Updated:** 2026-03-16
**Audience:** Founder + Codex (Technical Lead)

---

## What Lovable Is For Now

Pivot context (2026-03-16): runtime product work is now Paperclip-primary per `docs/pixelport-pivot-plan-2026-03-16.md`. This guide still applies to UI collaboration, but functional product behavior should stay aligned with Paperclip-default behavior plus approved PixelPort additions.

Lovable is still useful for fast visual exploration, page composition, and UI-only tweaks.

It is **not** the system boundary for functional frontend work anymore.

### Founder may use Lovable for

- visual direction
- layout changes
- copy refinement
- component styling
- page structure experiments
- screenshots and design review loops

### Technical Lead owns in-repo frontend work for

- data wiring
- route behavior
- auth behavior
- onboarding logic
- state management
- integrations
- API-dependent UI
- bug fixes in `src/`
- performance and runtime fixes

If a change affects real behavior, data, auth, or infra, it belongs in the repo under Technical Lead ownership even if the UI started in Lovable.

---

## Recommended Workflow

### 1. Founder explores the UI direction

Use Lovable when the goal is primarily visual:
- new layout
- better hierarchy
- polish pass
- empty states
- copy and CTA refinement

Good handoff inputs for Technical Lead:
- screenshots
- live route URL
- short notes on what changed
- any intended behavior changes that need founder approval

### 2. Technical Lead wires the functionality in-repo

Use the repo for:
- actual route additions
- backend integration
- auth and onboarding logic
- dashboard behavior
- connection flows
- anything touching `api/`, `src/`, infra, or deployment state

### 3. Founder reviews the shipped behavior

Review in the live app or preview deployment.

If the change is:
- visual only: iterate in Lovable or directly in repo as needed
- product-changing: founder approves before the functional change ships

---

## Page-Per-Chat Still Works

If founder wants to use Claude/Lovable for design exploration, the old page-per-chat pattern still works well.

Recommended structure:
- one chat per page or focused UI problem
- keep a short status note with completed pages and current design decisions
- use screenshots instead of long textual descriptions whenever possible

The difference now is simple:
- design exploration may start in Lovable
- shipped functionality remains repo-owned

---

## Handoff Format

When founder wants Technical Lead to implement or reconcile a Lovable change, send:

1. Route or screen name
2. Screenshot or live URL
3. What is visual-only vs what must actually work
4. Whether any product behavior changed

Example:

> Update `/dashboard/home` to match this screenshot. Visual direction is approved. Keep existing stats cards, but change the layout and hierarchy only.

Example with product approval:

> Update onboarding so Step 3 becomes a post-provisioning checklist instead of a connection step. This is an approved product-flow change.

---

## Guardrails

- Repo is the source of truth.
- Do not assume Lovable output is production-correct just because it looks right.
- Any auth, routing, integration, or backend-coupled change must be reviewed in-repo.
- If a visual change implies a product or UX decision, founder approval comes first.
- Keep screenshots and concrete routes in the handoff. They are faster and clearer than long prose.

---

## Practical Default

Use Lovable for visual exploration.
Use the repo for everything functional.
Use founder approval for major product, architecture, and UX decisions.
