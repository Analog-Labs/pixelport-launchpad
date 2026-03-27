# PixelPort — Active Plan

> Current phase checklist. Check off items as they complete. Only one program is active at a time.

---

## Current Program: Onboarding + Provisioning Sessions 1–8

**Objective:** Deliver the full new-tenant flow from draft onboarding through runtime policy/governance closure.
**Sequence:** `Session 1 → Session 2 → Session 3 → Session 4 → Session 5 → Session 6 → Session 7 → Session 8`
**Design system:** `DESIGN.md`
**Execution mode:** strict session stop rule (no forward scope inside a session)
**gstack artifacts:** `~/.gstack/projects/Analog-Labs-pixelport-launchpad/`

## Session 1 — Data Contract + Draft Tenant Foundation ✅

- [x] Added onboarding schema v2 handling with required version metadata
- [x] Shifted tenant create to draft-first behavior (`POST /api/tenants`)
- [x] Implemented one-release dual-write compatibility (nested v2 + legacy flat mirror)
- [x] Preserved behavior for already-active/legacy tenants

## Session 2 — Onboarding UI Restructure ✅

- [x] Flow order finalized to `Company -> Strategy -> Task -> Launch`
- [x] Removed old onboarding provision-step gating from step 1
- [x] Added draft-save continuity across step transitions
- [x] Kept onboarding usable without immediate provisioning

## Session 3 — Launch-Triggered Provisioning + Progress UX ✅

- [x] Provisioning now starts only from explicit Launch trigger (`POST /api/tenants/launch`)
- [x] Launch transition is retry-safe and idempotent (`draft -> provisioning`)
- [x] Failure path rolls back to `draft` when dispatch fails
- [x] Post-launch flow locks prior steps read-only and reports truthful status

**Production validation (2026-03-26):**
- [x] Merged PR #51 (`aacf8ec`) and applied two direct `main` hotfixes (`05aec88`, `67dee55`)
- [x] Live canary full pass completed on `board2@ziffyhomes.com`
- [x] Merged PR #53 (`3f76c34`) for onboarding UX uplift (identity/tone/avatar, goals cap, task policy capture, launch milestones)
- [x] Live canary full pass completed on `board3@ziffyhomes.com` with tenant `board3-s13-ux-20260326-072201`

## Session 4 — Workspace Compiler V2 + OpenClaw Config ✅

- [x] Emit deterministic root files (`AGENTS`, `SOUL`, `TOOLS`, `IDENTITY`, `USER`, `HEARTBEAT`, `BOOT`, `MEMORY`)
- [x] Write `/system/onboarding.json` and `/system/render-manifest.json`
- [x] Keep Paperclip integration-safe behavior with approved defaults
- [x] Add workspace/config contract tests

**Production validation (2026-03-26):**
- [x] Merged PR #55 (`104a8e0`) to `main`
- [x] Live canary full pass completed on `board4@ziffyhomes.com` with tenant `ziffy-homes-board4-s4-canary`
- [x] OpenClaw runtime config validated in-container (`openclaw config validate --json` returned `valid: true`)
- [x] Session 4 evidence captured: `docs/qa/2026-03-26-s4-live-canary-board4.md`

## Session 5 — Startup Trigger Routing ✅

- [x] New tenants start via Paperclip kickoff/wakeup only
- [x] Keep webhook bootstrap path for legacy/manual recovery
- [x] Add new-vs-legacy trigger path regression tests

**Production validation (2026-03-26):**
- [x] Merged PR #57 (`fa87961`) to `main`
- [x] Live canary full pass completed on `board7@ziffyhomes.com` with tenant `ziffy-homes-board7-s5-canary`
- [x] Session 5 evidence captured: `docs/qa/2026-03-26-s5-live-canary-board7.md`

## Session 6 — Knowledge Mirror + Sync Backend ✅

- [x] Add editable `onboarding_data.knowledge_mirror`
- [x] Sync approved mirror files into workspace `knowledge/*.md`
- [x] Expose sync status model (`pending` / `synced` / `failed`)

**Production validation (2026-03-26):**
- [x] Merged PR #59 (`2b0de82`) to `main`
- [x] Live canary full pass completed on `board8@ziffyhomes.com` with tenant `stripe`
- [x] `knowledge_sync` truth confirmed on `/api/tenants/status` (`revision=1`, `synced_revision=1`, `seeded_revision=1`)
- [x] Runtime knowledge mirror files verified on host-mounted path `/opt/openclaw/workspace-main/knowledge/*.md` with no leftover temp files
- [x] Session 6 evidence captured: `docs/qa/2026-03-26-s6-live-canary-board8.md`

## Session 7 — Knowledge Dashboard Surface (Planned)

- [ ] Add Knowledge route + sidebar entry
- [ ] Reuse Vault UX patterns against mirror+sync backend
- [ ] Support edits with truthful sync/error states

## Session 8 — Approval Policy Runtime Apply + Docs + Final Regression (Planned)

- [ ] Apply policy edits immediately with audit logging
- [ ] Patch managed blocks in `AGENTS` and `TOOLS` (no full-file overwrite)
- [ ] Add post-onboarding governance editor surface
- [ ] Run full regression and rollout checklist

## Release Gates (Per Session)

- [x] `npx tsc --noEmit`
- [x] `npm test`
- [x] `/review` pass
- [x] `/ship` PR flow
- [x] Production canary evidence for sessions that affect runtime provisioning

---

## Previous Programs (Historical)

- Program V1 Full Wedge Dashboard (T1→T6) — superseded by Session 1–8 sequence
- Program P6 — Reset (R1→R5) ✅ (PRs #18–#24)
- Program P5 — Monorepo Paperclip + LiteLLM Removal ✅
- Program P3 — Launchpad Runtime Prune ✅
- Program P2 — Launch Workspace Redirect ✅
- Program P1 — Paperclip Handoff / Ownership / Secrets / Boundaries ✅
- Program P0 — Pivot Foundation ✅
