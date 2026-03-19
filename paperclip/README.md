# PixelPort Paperclip Customizations

This directory is the source of truth for PixelPort-owned customizations layered on top of upstream Paperclip releases.

## What lives here

- `plugins/`: PixelPort runtime plugins that are applied into the Paperclip server codebase during image builds.
- `templates/upstream-default-ceo/`: Pinned upstream Paperclip default CEO markdown templates used as the deterministic baseline for tenant workspace prompt files.
- `theme/`: Placeholder for PixelPort global branding assets and theme overrides.
- `patches/`: Placeholder for curated core patches against upstream Paperclip.
- `build/`: Build runbooks for how to apply these overlays during golden image construction.

## Build and deployment boundary

- This directory is used only for DigitalOcean golden image construction.
- These files do **not** deploy to Vercel runtime routes.
- Launchpad production behavior is still controlled by repo code under `src/`, `api/`, and `infra/`.

## Golden image relation

When rebuilding the PixelPort golden image, start from a pinned upstream Paperclip release and apply this directory as an overlay (plugin/theme/patch layer), then validate and snapshot.

See `paperclip/build/golden-image-build.md` for the expected flow.

## Current runtime pin

- Paperclip release tag: `v2026.318.0`
- Paperclip commit: `78c714c29ac9aa1a8ca85aebe48f7f1ee7e57e4d`
