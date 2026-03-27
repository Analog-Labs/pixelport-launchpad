# PixelPort Launchpad

PixelPort is an AI Chief of Staff SaaS for startup teams, with an initial focus on marketing operations.

This repo contains:
- the PixelPort web app (onboarding + dashboard)
- API routes for tenant onboarding/provisioning
- provisioning and runtime bridge logic for tenant droplets

## Current Production State

As of 2026-03-27, Sessions 1-7 of the onboarding/provisioning program are live and production-validated:
- onboarding flow is `Company -> Strategy -> Task -> Launch`
- `POST /api/tenants` creates `draft` tenants (no provisioning on company submit)
- `POST /api/tenants/launch` explicitly triggers provisioning with idempotent/retry-safe behavior
- Session 4 workspace/runtime contract is live for new tenants:
  - canonical root files: `AGENTS`, `SOUL`, `TOOLS`, `IDENTITY`, `USER`, `HEARTBEAT`, `BOOT`, `MEMORY`
  - deterministic `/system/onboarding.json` and `/system/render-manifest.json`
  - config defaults: `agents.defaults.skipBootstrap=true`, heartbeat narrowed (`every: "0m"`), and memory `extraPaths=["knowledge"]`
- Session 5 startup trigger routing is live for new tenants (Paperclip kickoff/wakeup path)
- Session 6 knowledge mirror sync is live with truthful `pending/synced/failed` status projection on `/api/tenants/status`
- Session 7 Knowledge dashboard is live (`/dashboard/knowledge`) with:
  - sidebar navigation entry + dedicated route
  - five collapsible Knowledge sections with markdown read mode
  - single-section edit flow (`Save` / `Cancel`) with conflict-safe save guard
  - explicit manual sync retry support (`force_knowledge_sync`) on failure paths
- latest live canary pass completed on `board11@ziffyhomes.com` (`board11-stripe-canary`) with a fresh tenant reaching `active` and Knowledge sync finalized at `synced`

## Local Development

Requirements:
- Node.js + npm

Run locally:

```sh
npm i
npm run dev
```

Validation gates:

```sh
npx tsc --noEmit
npm test
```

## Core Docs

Start here:
- [Docs Index](./docs/README.md)
- [Session Log](./docs/SESSION-LOG.md)
- [Active Plan](./docs/ACTIVE-PLAN.md)
- [Project Status](./docs/pixelport-project-status.md)
- [Design System](./DESIGN.md)
- [Changelog](./CHANGELOG.md)
- [Open TODOs](./TODOS.md)
- [Agent Operating Guide](./AGENTS.md)
- [CTO Operating Guide](./CLAUDE.md)

## Production URL

- [pixelport-launchpad.vercel.app](https://pixelport-launchpad.vercel.app)
