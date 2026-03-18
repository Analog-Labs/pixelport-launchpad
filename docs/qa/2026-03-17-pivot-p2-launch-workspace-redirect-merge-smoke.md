# QA Evidence — Pivot P2 Launch Workspace Redirect Merge Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Merged PR:** `#7`  
**Merge commit:** `a2d179d`  
**Scope:** Same-session production smoke after P2 launch-redirect merge

## Deploy Evidence

- GitHub merge state:
  - PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/7` is `MERGED`
  - merged at `2026-03-18T01:33:20Z`
- Required checks for merge commit:
  - `validate` -> `pass` (run `https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23224822531`)
  - `Analyze (javascript-typescript)` -> `pass` (run `https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23224822091`)
- Vercel deploy status for merge commit:
  - `success`
  - URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/BXb3BQFGyZw5J8w1GoVr4ygcNW3S`

## Targeted Production Smoke (`https://pixelport-launchpad.vercel.app`)

- `GET /api/runtime/handoff` -> `405` (`{"error":"Method not allowed"}`)
- `POST /api/runtime/handoff` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `POST /api/runtime/handoff` (invalid bearer) -> `401` (`{"error":"Invalid or expired token"}`)
- `GET /api/debug/env-check` -> `404` (`NOT_FOUND`)

## Notes

- This smoke scope validates post-merge route guards and deploy health.
- Frontend launch redirect behavior (`window.location.assign(paperclip_runtime_url)`) was validated pre-merge with type/test checks and independent QA review in:
  - `docs/qa/2026-03-17-pivot-p2-launch-workspace-redirect.md`

## Verdict

`pass` for same-session merge-smoke scope. P2 launch-redirect slice is merged, deployed, and handoff/debug guardrails remain intact in production.
