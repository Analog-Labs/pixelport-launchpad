# PixelPort — Project Constitution

## What This Is
PixelPort is an AI Chief of Staff SaaS for startup marketing teams. One visible agent per customer (customizable), invisible sub-agents behind the scenes. Pricing: $299/$999/$3K+. Full spec: `docs/pixelport-master-plan-v2.md`.

Growth Swarm is the dogfood instance running Vidacious marketing on OpenClaw (3 agents: LUNA/SPARK/SCOUT on DO droplet `167.71.90.199`).

## Session Protocol (EVERY agent, EVERY session)
1. **Start:** Read `docs/SESSION-LOG.md` → `docs/ACTIVE-PLAN.md`
2. **Work:** Execute tasks from ACTIVE-PLAN.md within your assigned scope
3. **End:** Update `docs/SESSION-LOG.md` + check off items in `docs/ACTIVE-PLAN.md`
4. **Decisions:** Ask founder before any product/architecture changes. Log all decisions.

## Who Does What
| Role | Scope | Does NOT |
|------|-------|----------|
| **Founder + Claude (chat)** | Frontend (Lovable), product decisions, instruction docs | Write backend code directly |
| **CTO (Claude Code)** | Backend, infra, API routes, integrations | Touch Lovable frontend files |
| **Codex** | Execute CTO instructions. Has full project context. Updates SESSION-LOG + ACTIVE-PLAN after every session. Actively provides feedback and observations to CTO. | Make architectural decisions unilaterally |

## Where to Find Things
| Need | File |
|------|------|
| What happened last / what's next | `docs/SESSION-LOG.md` |
| Current phase checklist | `docs/ACTIVE-PLAN.md` |
| Full project history + decisions | `docs/pixelport-project-status.md` |
| Product spec (52 locked decisions) | `docs/pixelport-master-plan-v2.md` |
| Phase-specific CTO/Codex instructions | `docs/phase0/` (or current phase folder) |
| How founder + Claude work on frontend | `docs/lovable-collaboration-guide.md` |
| OpenClaw platform reference | `docs/openclaw-reference.md` |
| Coordination system rules | `docs/project-coordination-system.md` |

## Tech Stack
Frontend: Lovable Cloud → GitHub → Vercel (web app + API routes)
Backend: Vercel serverless API routes (in `api/` directory)
LLM Gateway: LiteLLM on Railway (always-on Docker, ~$5-7/mo)
Auth: Supabase Auth (Google OAuth + email/password) — changed from Clerk 2026-03-03
Database: Supabase (PostgreSQL, provisioned by Lovable)
Agent Runtime: OpenClaw on DO Droplets (1 per customer)
Workflows: Inngest Cloud (free tier)
Memory: Mem0 managed cloud | Analytics: PostHog | Email: AgentMail | Payments: Stripe

## Operating Rules
- Source of truth = GitHub repo. If it's not committed, it doesn't exist.
- CLAUDE.md stays under 100 lines. Details go in referenced docs.
- Growth Swarm stays in maintenance mode. Modify only if needed for validation.
- Docker images: always pin explicit version tags (never `:latest`).
- Founder is non-technical. All questions and decisions must be presented in plain, everyday language with clear options. No jargon without explanation.
- Ask founder before making decisions. Present options in plain language.
- Vercel = website + API. Railway = LiteLLM gateway. Both are needed.

## Growth Swarm Quick Reference
- Droplet: `openclaw-prod` (`167.71.90.199`), container: `openclaw-gateway`
- OpenClaw version: `2026.2.24` (pinned)
- Agents: LUNA (`main`), SPARK (`content`), SCOUT (`growth`)
- LUNA model: `openai/gpt-5.2-codex`, fallback: `google/gemini-2.5-flash`
- Workspaces: `/opt/openclaw/workspace-{main,content,growth}/`
- Config: `/opt/openclaw/openclaw.json`
- Status: Phases A-F complete, G5 passed, maintenance mode
