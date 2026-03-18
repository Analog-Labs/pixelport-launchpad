# Build Brief — 2026-03-18 — Pivot P4 Paperclip Handoff Auto-Login

## Objective

Complete the "press Launch and it just works" flow by adding an authenticated handoff consumer in the Paperclip fork and wiring launchpad onboarding redirect to it.

## Scope

### Launchpad (`pixelport-launchpad`)

- `src/pages/Onboarding.tsx`
  - require `handoff_token` from `/api/runtime/handoff`
  - redirect to `/api/auth/pixelport/handoff?handoff_token=...&next=/`
  - preserve existing onboarding save flow before redirect

### Paperclip Fork (`paperclip`)

- `server/src/auth/pixelport-handoff.ts` (new)
  - Better Auth plugin endpoint `GET /api/auth/pixelport/handoff`
  - token verification (`p1-v1`, issuer/audience, TTL, HMAC signature)
  - user/role/membership ensure
  - session cookie set + redirect
- `server/src/auth/better-auth.ts`
  - register plugin
- `server/src/__tests__/pixelport-handoff.test.ts` (new)
- `.env.example`
  - add `PAPERCLIP_HANDOFF_SECRET`

## Out of Scope

- Changing onboarding task model or workspace contract content.
- TLS/domain cutover for runtime URLs (still V1 HTTP on droplet IP).
- Multi-user granular RBAC redesign.

## Validation

- launchpad: `npx tsc --noEmit`
- Paperclip fork:
  - `pnpm --filter @paperclipai/server typecheck`
  - `pnpm vitest run server/src/__tests__/pixelport-handoff.test.ts`

## Risks / Notes

- Deploy order dependency: Paperclip endpoint must be live before launchpad redirect rollout.
- Secret parity required: `PAPERCLIP_HANDOFF_SECRET` must match between launchpad and each Paperclip runtime.
