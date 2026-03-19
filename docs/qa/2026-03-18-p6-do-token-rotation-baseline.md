# P6 DigitalOcean Token Rotation Baseline

- **Date:** 2026-03-18
- **Source:** Founder operational update in active execution session
- **Scope:** Provisioning/deletion authority baseline for new PixelPort droplet space

## Decision Captured

Founder confirmed that `DO_API_TOKEN` has been rotated in Vercel and now points to the new PixelPort droplet space. This token is expected to include droplet delete access.

## Operating Baseline (Effective Immediately)

1. Vercel `DO_API_TOKEN` is the only active provisioning/deletion token baseline for PixelPort runtime operations.
2. All forward provisioning and canary cleanup workflows should use this token context.
3. Legacy token contexts are not to be treated as active ownership surfaces.

## Verification Note

The rotation decision is founder-confirmed. Functional deletion/provisioning behavior will continue to be verified in normal D5 canary operations after merge/deploy.
