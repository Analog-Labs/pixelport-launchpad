# PixelPort Launchpad

PixelPort is an AI Chief of Staff SaaS for startup teams (initial focus: marketing).
This repository contains the main app and provisioning bridge that powers onboarding,
dashboard, tenant runtime handoff, and integrations.

## What this repo includes

- Vercel app and API routes (`src/`, `api/`)
- Onboarding + tenant provisioning flow
- Dashboard UI (Home, Approvals, Tasks, Agents, Runs, Connections)
- Tenant runtime bridge to Paperclip + OpenClaw on DigitalOcean droplets
- Test coverage for proxying, bootstrap state, provisioning, and dashboard contracts

## Stack

- TypeScript
- React + Vite
- Tailwind + shadcn/ui
- Supabase (auth + tenant metadata)
- Vercel (app + API)
- Per-tenant runtime: Paperclip + OpenClaw + Postgres on DigitalOcean

## Local development

```sh
npm install
npm run dev
```

## Verification commands

```sh
npx tsc --noEmit
npm test
npx vitest run
```

## Key project docs

- Active plan: `docs/ACTIVE-PLAN.md`
- Session history: `docs/SESSION-LOG.md`
- Project status: `docs/pixelport-project-status.md`
- Design system: `DESIGN.md`
- V1 dashboard design: `docs/designs/v1-full-wedge.md`
- Dashboard API contract: `docs/paperclip-api-contract.md`

## Workflow notes

- Source of truth is GitHub. If it is not committed, it does not exist.
- Use explicit pinned image tags in provisioning and runtime config (never `:latest`).
- For medium/high-risk changes, run review and QA before merge.
