# QA Evidence — Pivot P3 Runtime Prune Batch 1 Merge Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Merged PR:** `#9`  
**Merge commit:** `e39ca89`  
**Scope:** Same-session production smoke after route-prune batch 1 merge

## Deploy Evidence

- GitHub merge state:
  - PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/9` is `MERGED`
  - merged at `2026-03-18T01:55:54Z`
- Required checks on merge commit:
  - `validate` -> `pass` (run `https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23225413787`)
  - `Analyze (javascript-typescript)` -> `pass` (run `https://github.com/Analog-Labs/pixelport-launchpad/actions/runs/23225413610`)
- Vercel deploy status for merge commit:
  - `success`
  - URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/4kzuzeheRqqni7xVtWj2dq8UxHuR`

## Targeted Production Smoke (`https://pixelport-launchpad.vercel.app`)

Retained active surfaces:
- `GET /api/runtime/handoff` -> `405` (`{"error":"Method not allowed"}`)
- `POST /api/runtime/handoff` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/competitors` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)
- `GET /api/tenants/status` (no auth) -> `401` (`{"error":"Missing or invalid Authorization header"}`)

Deleted-route confirmation (batch-1 target groups):
- `GET /api/chat` -> `404` (`NOT_FOUND`)
- `GET /api/content` -> `404` (`NOT_FOUND`)
- `GET /api/approvals` -> `404` (`NOT_FOUND`)

## Notes

- This smoke confirms prune-batch behavior in production while retained thin-bridge surfaces remain guarded and available.
- `api/competitors/*` remains intentionally active pending future frontend dependency migration.

## Verdict

`pass` for P3 batch 1 merge-smoke scope. Deleted route groups are absent in production and retained guardrails remain healthy.
