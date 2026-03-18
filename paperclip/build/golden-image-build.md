# Golden Image Build Overlay Guide

This runbook defines how PixelPort `paperclip/` customizations are applied when rebuilding the managed tenant golden image.

## Inputs

- Pinned upstream Paperclip release tag/commit
- Pinned OpenClaw image tag
- This repo's `paperclip/` directory overlay

## Build sequence

1. Checkout pinned upstream Paperclip source into the image build workspace.
2. Copy `paperclip/plugins/*` into the Paperclip server auth/plugin layer.
3. Apply any curated `paperclip/patches/*` core modifications (when present).
4. Apply `paperclip/theme/*` global branding assets/overrides (when present).
5. Build runtime image artifacts with explicit version pins.
6. Boot a canary droplet from the candidate image and validate:
   - Paperclip server health
   - OpenClaw gateway health
   - PixelPort handoff plugin path (`/pixelport/handoff`)
   - Onboarding launch redirect to workspace
7. Snapshot only after canary passes and record image ID in provisioning manifests.

## Notes

- `paperclip/` is an image-build overlay source only; it is not deployed by Vercel.
- If an upstream Paperclip release conflicts with this overlay, resolve in this repo first, then rebuild the image.
