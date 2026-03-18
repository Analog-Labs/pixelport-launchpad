# QA Evidence — P5 Vercel IgnoreCommand Hotfix Merge Smoke

**Date:** 2026-03-18 (America/Chicago)  
**Scope:** Production deploy recovery after P5 merge-order closure (`#14` -> `#15`)

## Hotfix Summary

- PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/16`
- Merge commit: `4f1803c`
- Change:
  - moved long `ignoreCommand` logic from `vercel.json` into `tools/vercel-ignore-paperclip-only.sh`
  - shortened `vercel.json` `ignoreCommand` to `bash ./tools/vercel-ignore-paperclip-only.sh`
  - final `ignoreCommand` length: `45` chars

## Check + Deploy Evidence

- Required checks on merge commit `4f1803c`:
  - `validate` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23242220254`)
  - `Analyze (javascript-typescript)` -> `pass` (`https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23242219562`)
- Vercel status on merge commit:
  - `success` (`Deployment has completed`)
  - URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/99XATU4uaYxHAVSov5x7ahXA9x1h`

## Targeted Production Smoke (`https://pixelport-launchpad.vercel.app`)

- `GET /api/runtime/handoff` -> `405` (`{"error":"Method not allowed"}`)
- `POST /api/runtime/handoff` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/tenants/status` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `POST /api/tenants/scan` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/debug/test-provision` (no auth) -> `401` (`{"error":"Invalid or missing secret"}`)
- `GET /api/commands` -> `404` (`NOT_FOUND`)
- `GET /api/tasks` -> `404` (`NOT_FOUND`)

## Verdict

`pass` for P5 deploy-recovery smoke scope.

- Merge order closure is intact.
- Production deploy is healthy again.
- Retained guard surfaces and deleted legacy route behavior are stable after the hotfix.
