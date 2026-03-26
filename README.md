# PixelPort Launchpad

PixelPort is an AI Chief of Staff SaaS for startup teams, with an initial focus on marketing operations.

This repo contains:
- the PixelPort web app (onboarding + dashboard)
- API routes for tenant onboarding/provisioning
- provisioning and runtime bridge logic for tenant droplets

## Current Production State

As of 2026-03-26, Sessions 1-3 of the onboarding refactor are live and production-validated:
- onboarding flow is now `Company -> Strategy -> Task -> Launch`
- `POST /api/tenants` creates `draft` tenants (no provisioning on company submit)
- `POST /api/tenants/launch` explicitly triggers provisioning
- launch path is idempotent and retry-safe

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
