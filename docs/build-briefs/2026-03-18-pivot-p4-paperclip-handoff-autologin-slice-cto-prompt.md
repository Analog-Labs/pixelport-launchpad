# CTO Review Prompt — P4 Paperclip Handoff Auto-Login (2026-03-18)

Please review this slice for correctness and release readiness.

## Repos / Branches

- Launchpad: `Analog-Labs/pixelport-launchpad` branch `codex/p4-launchpad-handoff-redirect`
- Paperclip fork: branch `codex/pixelport-handoff-autologin`

## What Changed

### Launchpad

- `src/pages/Onboarding.tsx`
  - keeps existing `/api/runtime/handoff` call and onboarding save flow
  - now requires `handoff_token`
  - redirects to `/api/auth/pixelport/handoff?handoff_token=...&next=/`

### Paperclip

- New Better Auth handoff consumer endpoint:
  - `GET /api/auth/pixelport/handoff`
  - verifies launchpad HMAC token contract (`p1-v1`, iss/aud, iat/exp, signature)
  - ensures user principal + `instance_admin` + owner memberships
  - creates Better Auth session cookie and redirects
- Wired plugin in auth bootstrap (`server/src/auth/better-auth.ts`)
- Added tests:
  - `server/src/__tests__/pixelport-handoff.test.ts`
- Added env sample var:
  - `.env.example` -> `PAPERCLIP_HANDOFF_SECRET`

## Requested Review Focus

1. Token verification security checks and failure behavior.
2. Session creation/cookie handling correctness via Better Auth APIs.
3. Authorization bootstrap side effects (`instance_admin` + memberships).
4. Launchpad redirect construction and preservation of onboarding save behavior.
5. Backward compatibility and failure UX if token/secret is missing.

## Validation Evidence

- Launchpad: `npx tsc --noEmit` (pass)
- Paperclip:
  - `pnpm --filter @paperclipai/server typecheck` (pass)
  - `pnpm vitest run server/src/__tests__/pixelport-handoff.test.ts` (pass)
- QA artifact:
  - `docs/qa/2026-03-18-pivot-p4-paperclip-handoff-autologin.md`

## Release Note

- Deploy Paperclip fork changes before launchpad redirect rollout.
