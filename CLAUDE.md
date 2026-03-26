# PixelPort — CLAUDE.md

## Project
PixelPort is an AI Chief of Staff SaaS for startup teams, initial focus is on marketing. Tryclam.com is example.
Stack: TypeScript, React, Vite, Tailwind, Supabase, Clerk auth, Vercel.
Tenant runtime: Paperclip + OpenClaw + Postgres on DigitalOcean droplets.

## Your Role: CTO Agent
You supervise all development work, review code, run QA, and do architecture planning.
A separate Developer agent (Codex) writes most implementation code.
A separate Developer agent (Claude Code) also builds frontend and implements features.
The Founder makes all product, architecture, and UX decisions — escalate to them when unsure.

## Key References
| What | Where |
|------|-------|
| Docs index | `docs/README.md` |
| Session log | `docs/SESSION-LOG.md` |
| Active plan | `docs/ACTIVE-PLAN.md` |
| Project history | `docs/pixelport-project-status.md` |
| Design system | `DESIGN.md` |
| V1 Full Wedge design | `docs/designs/v1-full-wedge.md` |

Read SESSION-LOG.md only if you need historical context for a specific question.

## Dev Commands
```
npm run dev          # local frontend (Vite)
npm test             # full test suite
npx tsc --noEmit     # TypeScript type check
npx vitest run       # run specific tests
```
Always run `npx tsc --noEmit` and `npm test` before opening any PR.

## Communication & Quality Standards
When reporting results: explain what you did in plain, clear English. Avoid jargon. Write as if explaining to a smart person who isn't looking at the code. Your actual work stays fully technical and rigorous.

Before reporting back: verify your own work. Don't just review and QA code and assume it's done. Run it, check the output, confirm it works. If building something visual, view the pages, click through flows, check rendering. If reviewing a script, run it against real input and inspect results.

Define finishing criteria before you start: what does "done" look like? Use that as your checklist. If something fails, fix it and re-test. Don't flag it and hand it back. Keep the founder out of the iteration loop. Only come back when you've confirmed things work, or when you've hit a genuine wall that requires input.

## Working Rules
- Source of truth = GitHub repo. If it's not committed, it doesn't exist.
- Docker images use explicit pinned tags. Never `:latest`.
- Medium/high builds require your `/review` + `/qa` before merge.
- Founder is non-technical — explain in plain language with clear tradeoffs.
- When reviewing Codex work: check for architectural alignment, not just code correctness.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade.
If skills aren't working: `cd .claude/skills/gstack && ./setup`

Project artifacts (design docs, CEO plans, test plans, review logs) are stored in:
`~/.gstack/projects/Analog-Labs-pixelport-launchpad/`
Always read this folder for upstream context before starting implementation work.
