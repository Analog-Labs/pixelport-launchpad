# QA Evidence — 2026-03-18 — Pivot P4 Paperclip Handoff Auto-Login

## Scope

Validate the implementation of the authenticated handoff consumer so onboarding Launch can redirect users into Paperclip already signed in.

## Launchpad Changes (Branch `codex/p4-launchpad-handoff-redirect`)

- File: `src/pages/Onboarding.tsx`
- Added `handoff_token` handling in `RuntimeHandoffResponse`.
- Added redirect URL builder:
  - `GET /api/auth/pixelport/handoff`
  - query params: `handoff_token`, `next=/`
- Launch behavior remains:
  - call `/api/runtime/handoff`
  - save onboarding payload (`/api/tenants/onboarding`)
  - redirect after successful save
- New guard: launch fails with explicit error if `handoff_token` is missing.

Validation:
- `npx tsc --noEmit` -> pass

## Paperclip Fork Changes (Branch `codex/pixelport-handoff-autologin`)

- Added `server/src/auth/pixelport-handoff.ts`:
  - Better Auth plugin endpoint: `GET /api/auth/pixelport/handoff`
  - validates launchpad handoff contract + HMAC signature
  - ensures user + `instance_admin` role + owner memberships
  - creates Better Auth session cookie
  - redirects to safe relative `next` path (defaults to `/`)
- Wired plugin into `server/src/auth/better-auth.ts`.
- Added tests: `server/src/__tests__/pixelport-handoff.test.ts`.
- Added env sample key: `.env.example` -> `PAPERCLIP_HANDOFF_SECRET`.

Validation:
- `pnpm --filter @paperclipai/server typecheck` -> pass
- `pnpm vitest run server/src/__tests__/pixelport-handoff.test.ts` -> pass (8 tests)

## Known Release Dependency

- Deploy Paperclip consumer before enabling launchpad redirect in production to avoid redirecting users to a missing endpoint.
