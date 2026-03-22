# PixelPort — AGENTS.md

## Project
PixelPort is an AI Chief of Staff SaaS for startup teams, initial focus is on marketing. Tryclam.com is example.
Stack: TypeScript, React, Vite, Tailwind, Supabase, Clerk auth, Vercel.
Tenant runtime: Paperclip + OpenClaw + Postgres on DigitalOcean droplets.

## Your Role: Developer Agent
You implement features, fix bugs, and write production code.
A CTO agent (Claude Code) reviews your work, runs QA, and handles architecture planning.
The Founder makes all product, architecture, and UX decisions.
If a task feels like an architecture decision rather than implementation, flag it — don't decide on your own.

## Key References
| What | Where |
|------|-------|
| Session log | `docs/SESSION-LOG.md` |
| Active plan | `docs/ACTIVE-PLAN.md` |
| Project history | `docs/pixelport-project-status.md` |
| Design system | `DESIGN.md` |
| V1 Full Wedge design | `docs/designs/v1-full-wedge.md` |

Read SESSION-LOG.md if you need historical context for a specific question.

## Dev Commands
```
npm run dev          # local frontend (Vite)
npm test             # full test suite
npx tsc --noEmit     # TypeScript type check
npx vitest run       # run specific tests
```

## Communication & Quality Standards
When reporting results: explain what you did in plain, clear English. Avoid jargon. Write as if explaining to a smart person who isn't looking at the code. Your actual work stays fully technical and rigorous.

Before reporting back: verify your own work. Don't just write code and assume it's done. Run it, check the output, confirm it works. If building something visual, view the pages, click through flows, check rendering. If writing a script, run it against real input and inspect results.

Define finishing criteria before you start: what does "done" look like? Use that as your checklist. If something fails, fix it and re-test. Don't flag it and hand it back. Keep the founder out of the iteration loop. Only come back when you've confirmed things work, or when you've hit a genuine wall that requires input.

## Working Rules
- Source of truth = GitHub repo. If it's not committed, it doesn't exist.
- Docker images use explicit pinned tags. Never `:latest`.
- Always run `npx tsc --noEmit` and `npm test` before opening any PR.
- Founder is non-technical — explain in plain language with clear tradeoffs.

## gstack
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade.
If skills aren't working: `cd .agents/skills/gstack && ./setup`

Project artifacts (design docs, CEO plans, test plans, review logs) are stored in:
`~/.gstack/projects/Analog-Labs-pixelport-launchpad/`
Always read this folder for upstream context before starting implementation work.