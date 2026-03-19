# Golden Image Build Overlay Guide

This runbook defines how PixelPort `paperclip/` customizations are applied when rebuilding the managed tenant golden image.

## Inputs

- Pinned upstream Paperclip release tag/commit
- Pinned OpenClaw image tag
- This repo's `paperclip/` directory overlay
- Pinned upstream default CEO templates copied under `paperclip/templates/upstream-default-ceo/` (`PINNED-UPSTREAM.json`)

## Build sequence

1. Checkout pinned upstream Paperclip source into the image build workspace.
2. Copy `paperclip/plugins/*` into the Paperclip server auth/plugin layer.
3. Ensure workspace prompt template baseline is sourced from `paperclip/templates/upstream-default-ceo/` and that `PINNED-UPSTREAM.json` matches the intended upstream commit.
4. Apply any curated `paperclip/patches/*` core modifications (when present).
5. Apply `paperclip/theme/*` global branding assets/overrides (when present).
6. Build runtime image artifacts with explicit version pins.
7. Boot a canary droplet from the candidate image and validate:
   - Paperclip server health
   - OpenClaw gateway health
   - PixelPort handoff plugin path (`/pixelport/handoff`)
   - Onboarding launch redirect to workspace
8. Snapshot only after canary passes and record image ID in provisioning manifests.

## Notes

- `paperclip/` is an image-build overlay source only; it is not deployed by Vercel.
- If an upstream Paperclip release conflicts with this overlay, resolve in this repo first, then rebuild the image.
