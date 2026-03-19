# P6 R1 — Paperclip Default Workspace Drift Correction

- **Date:** 2026-03-18
- **Branch:** `codex/p6-r1-paperclip-default-workspace`
- **Scope:** R1 workspace drift correction and terminology alignment

## Objective

Restore the pivot-approved workspace behavior baseline:

1. Source workspace prompt templates from pinned upstream Paperclip default CEO templates.
2. Apply tenant-facing terminology relabel (`CEO` -> `Chief of Staff`) in markdown templates.
3. Keep onboarding injection scoped to SOUL only via additive block.
4. Validate provisioning template behavior with tests.

## Implemented Changes

- Vendored upstream default CEO templates at pinned commit:
  - `paperclip/templates/upstream-default-ceo/AGENTS.md`
  - `paperclip/templates/upstream-default-ceo/HEARTBEAT.md`
  - `paperclip/templates/upstream-default-ceo/SOUL.md`
  - `paperclip/templates/upstream-default-ceo/TOOLS.md`
  - `paperclip/templates/upstream-default-ceo/PINNED-UPSTREAM.json`
- Added deterministic template source module:
  - `api/lib/paperclip-default-ceo-templates.ts`
- Refactored workspace contract generation:
  - `api/lib/workspace-contract.ts`
  - prompt files now generated from pinned Paperclip defaults
  - `SOUL.md` gets additive onboarding context only (company, website, mission, goals, chosen agent name)
  - no onboarding injection into `AGENTS.md`, `HEARTBEAT.md`, `TOOLS.md`
- Updated tests for new behavior:
  - `src/test/workspace-contract.test.ts`
  - `src/test/provision-tenant-memory.test.ts`

## Validation

- `npx tsc --noEmit` -> pass
- `npm test` -> pass
  - 19 files, 88 tests passing

## Notes

- Existing tenant retrofit is intentionally out of scope for R1 (new-tenant behavior only).
- D4 break-glass hardening closure remains deferred for later phase.
