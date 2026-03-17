# QA Evidence — Pivot P1 Handoff Release Smoke

**Date:** 2026-03-17 (America/Chicago)  
**Release branch merged:** `codex/pivot-p1-bootstrap-handoff`  
**Release commit on `main`:** `4e1dfb91602d9686df6aa0b4b990881448882813`  
**Deploy target:** `https://vercel.com/sanchalrs-projects/pixelport-launchpad/HhkBXxcaf1rMayfqkjgWSE435C84`  
**Production alias smoked:** `https://pixelport-launchpad.vercel.app`

## Deploy Confirmation

- Vercel commit status: `success`
- Release route under test: `POST /api/runtime/handoff`

## Smoke Commands and Outputs

```bash
curl -sS -X GET https://pixelport-launchpad.vercel.app/api/runtime/handoff
```
- Status: `405`
- Body: `{"error":"Method not allowed"}`

```bash
curl -sS -X POST https://pixelport-launchpad.vercel.app/api/runtime/handoff
```
- Status: `401`
- Body: `{"error":"Missing or invalid Authorization header"}`

```bash
curl -sS -X POST https://pixelport-launchpad.vercel.app/api/runtime/handoff \
  -H "Authorization: Bearer invalid-token"
```
- Status: `401`
- Body: `{"error":"Invalid or expired token"}`

```bash
curl -sS -X GET https://pixelport-launchpad.vercel.app/api/debug/env-check
```
- Status: `401`
- Body: `{"error":"Unauthorized"}`

## Verdict

`pass` for targeted release smoke scope.

The merged P1 handoff slice is deployed on production and guardrail behavior is correct for method handling and auth protection.

## Residual Risks

- Authenticated success path for `POST /api/runtime/handoff` (`200` + contract payload) was not validated in this smoke.
- Production checks for `503` (missing handoff env) and `409` (tenant not ready) were not executed in this release smoke.
- Consumer-side verification in the PixelPort-owned Paperclip fork remains a separate integration risk until validated end to end.
