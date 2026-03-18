# QA Evidence — P5 Merge Order + Production Smoke

**Date:** 2026-03-18 (America/Chicago)  
**Scope:** Merge closure for P5 (`#14` then `#15`) and same-session targeted production smoke

## Merge Order Evidence

- PR `#14` merged first:
  - PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/14`
  - merge commit: `9fe9ac7`
  - merged at: `2026-03-18T11:06:57Z`
- PR `#15` merged second:
  - PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/15`
  - merge commit: `ae082eb`
  - merged at: `2026-03-18T11:07:38Z`

## Required Check Evidence

- `9fe9ac7`:
  - `validate` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23241707537`)
  - `Analyze (javascript-typescript)` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23241706984`)
- `ae082eb`:
  - `validate` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23241733480`)
  - `Analyze (javascript-typescript)` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23241732780`)

## Deploy Evidence

- `9fe9ac7` Vercel context: `failure`
  - target: `https://vercel.com/docs/concepts/projects/project-configuration`
- `ae082eb` Vercel context: `failure`
  - target: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/8ciZaPmC9HjoV8C7SKE3bb3oD9H5`

## Targeted Production Smoke (`https://pixelport-launchpad.vercel.app`)

- `GET /api/runtime/handoff` -> `405` (`{"error":"Method not allowed"}`)
- `POST /api/runtime/handoff` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/tenants/status` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `POST /api/tenants/scan` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/debug/test-provision` (no auth) -> `401` (`{"error":"Invalid or missing secret"}`)
- `GET /api/commands` -> `404` (`NOT_FOUND`)
- `GET /api/tasks` -> `404` (`NOT_FOUND`)

## Verdict

`partial-pass` for requested sequence execution:
- merge order completed exactly (`#14` then `#15`)
- required GitHub checks are green
- smoke guard/deletion signals are healthy on the live alias

`release-blocked` for full P5 production closure because Vercel production deploy is failing for both merge commits. A post-deploy smoke rerun is required.
