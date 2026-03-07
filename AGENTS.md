# PixelPort — Project Constitution

## What This Is
PixelPort is an AI Chief of Staff SaaS for startup marketing teams. One visible agent per customer (customizable), invisible sub-agents behind the scenes. Pricing: $299/$999/$3K+. Full spec: `docs/pixelport-master-plan-v2.md`.

Growth Swarm is the dogfood instance running Vidacious marketing on OpenClaw (3 agents: LUNA/SPARK/SCOUT on DO droplet `167.71.90.199`).

## Session Protocol (EVERY agent, EVERY session)
1. **Start:** Read `docs/SESSION-LOG.md` → `docs/ACTIVE-PLAN.md`
2. **Work:** Execute the current phase work within your role
3. **End:** Update `docs/SESSION-LOG.md` + `docs/ACTIVE-PLAN.md`
4. **Decisions:** Ask founder before any major product, architecture, or UX decision. Log all decisions.

## Who Does What
| Role | Scope | Does NOT |
|------|-------|----------|
| **Founder** | Approves major product, architecture, and UX decisions. May still use Lovable for visual/UI-only changes. | Own functional implementation by default |
| **Codex (Technical Lead)** | Primary owner for frontend, backend, infra, integrations, repo maintenance, debugging, and release execution. Keeps founder + CTO in loop. | Make major product/architecture/UX decisions without founder approval |
| **CTO (QA/Reviewer)** | Reviews medium/high builds before merge, plus audits and strategic feedback when needed. | Gate small low-risk tweaks |

## Where to Find Things
| Need | File |
|------|------|
| What happened last / what's next | `docs/SESSION-LOG.md` |
| Current phase checklist | `docs/ACTIVE-PLAN.md` |
| Full project history + decisions | `docs/pixelport-project-status.md` |
| Product spec (52 locked decisions) | `docs/pixelport-master-plan-v2.md` |
| Frontend/UI collaboration workflow | `docs/lovable-collaboration-guide.md` |
| Coordination system rules | `docs/project-coordination-system.md` |
| Build/review/release workflow | `docs/build-workflow.md` |
| OpenClaw platform reference | `docs/openclaw-reference.md` |

## Tech Stack
Frontend: Lovable Cloud + repo-managed React/Vite → Vercel
Backend: Vercel serverless API routes (`api/`)
LLM Gateway: LiteLLM on Railway
Auth + DB: Supabase
Agent Runtime: OpenClaw on DO droplets (1 per customer)
Workflows: Inngest Cloud
Memory: Mem0 | Analytics: PostHog | Email: AgentMail | Payments: Stripe

## Working Rules
- Source of truth = GitHub repo. If it's not committed, it doesn't exist.
- AGENTS.md stays under 100 lines. Details go in referenced docs.
- Growth Swarm stays in maintenance mode unless validation requires changes.
- Docker images: always pin explicit version tags. Never use `:latest`.
- Founder is non-technical. Present choices in plain language with clear tradeoffs.
- Routine implementation can proceed under Technical Lead ownership.
- Major product, architecture, and UX decisions require founder approval first.
- Planning/Q&A can happen in dedicated research sessions; approved build work runs in separate execution sessions.
- Medium/high builds default to `codex/*` branches and require Claude CTO review before merge. Small low-risk tweaks do not.
- After CTO approval, Codex may merge to `main`, monitor deploy, and run same-session production smoke. See `docs/build-workflow.md`.
- Founder may keep using Lovable for visual/UI-only changes, but all functional frontend changes are repo-managed by Technical Lead.
- Vercel = website + API. Railway = LiteLLM gateway. Both are required.

## Growth Swarm Quick Reference
- Droplet: `openclaw-prod` (`167.71.90.199`), container: `openclaw-gateway`
- OpenClaw version: `2026.2.24` (pinned)
- Agents: LUNA (`main`), SPARK (`content`), SCOUT (`growth`)
- LUNA model: `openai/gpt-5.2-codex`, fallback: `google/gemini-2.5-flash`
- Workspaces: `/opt/openclaw/workspace-{main,content,growth}/`
- Config: `/opt/openclaw/openclaw.json`
- Status: Phases A-F complete, G5 passed, maintenance mode
