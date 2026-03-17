# PixelPort — Project Constitution

## What This Is
PixelPort is an AI Chief of Staff SaaS for startup marketing teams.

**Effective 2026-03-16 pivot:** PixelPort is now Paperclip-primary.
- Product runtime source of truth: PixelPort-owned Paperclip fork
- `pixelport-launchpad` role: marketing, billing, thin provisioning bridge
- Binding pivot plan: `docs/pixelport-pivot-plan-2026-03-16.md`

Growth Swarm is archived/deactivated and retained only as historical context.

## Session Protocol (EVERY agent, EVERY session)
1. **Start:** Read `docs/SESSION-LOG.md` -> `docs/ACTIVE-PLAN.md`
2. **Align:** Read `docs/pixelport-pivot-plan-2026-03-16.md`
3. **Work:** Execute only the current approved phase work in your role
4. **End:** Update `docs/SESSION-LOG.md` + `docs/ACTIVE-PLAN.md`
5. **Decisions:** Ask founder before any major product, architecture, or UX decision

## Who Does What
| Role | Scope | Does NOT |
|------|-------|----------|
| **Founder** | Approves major product, architecture, and UX decisions. May use Lovable for visual/UI-only changes. | Own functional implementation by default |
| **Codex (Technical Lead)** | Primary owner for frontend, backend, infra, integrations, repo maintenance, debugging, and release execution. | Make major product/architecture/UX decisions without founder approval |
| **CTO (QA/Reviewer)** | Reviews medium/high builds before merge and provides audits/strategic feedback. | Gate small low-risk tweaks |

## Where to Find Things
| Need | File |
|------|------|
| Latest handoff + next steps | `docs/SESSION-LOG.md` |
| Current execution checklist | `docs/ACTIVE-PLAN.md` |
| Locked pivot decisions | `docs/pixelport-pivot-plan-2026-03-16.md` |
| Long-form history + decisions | `docs/pixelport-project-status.md` |
| Product spec (with overrides) | `docs/pixelport-master-plan-v2.md` |
| Coordination rules | `docs/project-coordination-system.md` |
| Build/review/release workflow | `docs/build-workflow.md` |
| UI collaboration workflow | `docs/lovable-collaboration-guide.md` |

## Tech Stack (Current Operating Model)
- Product runtime: PixelPort-owned Paperclip fork (frontend + backend + auth)
- Tenant runtime: Paperclip + OpenClaw + Postgres on pre-baked DO droplets
- Control/commercial layer: `pixelport-launchpad` (marketing + billing + thin bridge)
- Workflow orchestration: Inngest
- Payments: Stripe (deferred in current v1 testing provisioning trigger)

## Working Rules
- Source of truth = GitHub repo. If it's not committed, it doesn't exist.
- AGENTS.md stays under 100 lines; details belong in referenced docs.
- If older docs conflict with the pivot plan, follow `docs/pixelport-pivot-plan-2026-03-16.md`.
- Preserve Paperclip default workspace behavior; only approved additive/customization changes.
- Docker images must use explicit pinned tags. Never use `:latest`.
- Founder is non-technical; present options in plain language with clear tradeoffs.
- Routine implementation may proceed under Technical Lead ownership.
- Medium/high builds default to `codex/*` branches and require CTO review before merge.
- After CTO approval, Codex may merge to `main`, monitor deploy, and run same-session production smoke.
