# PixelPort — Project Status and Execution Plan

**Last Updated:** 2026-03-17
**Project:** PixelPort — AI GTM Employees SaaS (pixelport.ai)
**Formerly:** Growth Swarm (now archived historical context)
**Primary Runtime Direction:** PixelPort-owned Paperclip fork + per-tenant DO droplets
**Primary Interfaces:** PixelPort web app + Slack (tenant-configured)

---

## Governance Note (2026-03-06)

Effective 2026-03-06, PixelPort moved to a new working model for current and future sessions:

- **Founder** approves major product, architecture, and UX decisions and may still use Lovable for visual/UI-only changes.
- **Codex (Technical Lead)** is now the primary owner of shipped implementation across frontend, backend, infra, integrations, debugging, and repo maintenance.
- **CTO (QA/Reviewer)** shifts to occasional QA, audit, and strategic review when practical rather than acting as a hard gate for routine implementation.

This note updates the live operating model only. Historical sessions, archived plans, and prior authorship references remain preserved as historical record.

## Build Workflow Note (2026-03-07)

Effective 2026-03-07, PixelPort now uses a standardized build/review/release loop for future product work:

- planning and Q&A happen in a dedicated research thread when useful
- each approved medium/high build gets a repo brief under `docs/build-briefs/`
- implementation runs in a separate Codex execution session
- medium/high builds use a short-lived `codex/*` branch and require Claude CTO review before merge
- after CTO approval, Codex may merge to `main`, monitor deploy, and run same-session production smoke unless a founder-only decision is still pending
- separate deep production QA is used only for risky or ambiguous releases

Detailed founder and CTO handoff steps live in `docs/build-workflow.md`.

## Pivot Override Note (2026-03-16)

The founder approved a Paperclip-primary pivot and this is now the active direction:

- Product runtime source of truth is a PixelPort-owned Paperclip fork.
- `pixelport-launchpad` remains active for marketing, billing, and thin provisioning bridge responsibilities.
- Hard cutover applies for the pivot release.
- Growth Swarm is archived/deactivated from active scope.
- Binding execution contract is `docs/pixelport-pivot-plan-2026-03-16.md`.

This note overrides conflicting older assumptions in this status file while preserving prior sections as historical record.

## Pivot Execution Update (2026-03-16)

First P0 implementation slice is completed on branch `codex/pivot-p0-implementation`:

- onboarding flow contract shipped in launchpad UI: `Company -> Provision -> Task -> Launch`
- provisioning gate enforced before Task unlock (`ready`/`active` required)
- editable starter task + editable agent suggestions shipped
- invite/allowlist provisioning gate added to `POST /api/tenants`
- mission payload compatibility added (`mission` + `mission_goals`)
- QA artifacts added under:
  - `docs/build-briefs/2026-03-16-pivot-p0-onboarding-provisioning-slice.md`
  - `docs/qa/2026-03-16-pivot-p0-onboarding-provisioning-slice.md`

This pre-merge checkpoint was completed later the same day (CTO review, merge to `main`, and production smoke all passed on 2026-03-16).

## Pivot Execution Update (2026-03-17)

First P1 handoff release slice from `codex/pivot-p1-bootstrap-handoff` is now merged and deployed:

- `main` head: `4e1dfb91602d9686df6aa0b4b990881448882813`
- Vercel deploy: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/HhkBXxcaf1rMayfqkjgWSE435C84`
- Production smoke on `https://pixelport-launchpad.vercel.app` confirmed:
  - `GET /api/runtime/handoff` -> `405` (method guard)
  - `POST /api/runtime/handoff` without auth -> `401` (auth guard)
  - `POST /api/runtime/handoff` with invalid bearer -> `401` (token validation guard)
  - `GET /api/debug/env-check` without secret -> `401` (debug auth guard)
- QA evidence: `docs/qa/2026-03-17-pivot-p1-handoff-release-smoke.md`

## Pivot Execution Update (2026-03-17 Ownership Audit)

Track A ownership-audit evidence is now documented (without fabricated closure) as a historical snapshot at that checkpoint:

- evidence artifact: `docs/qa/2026-03-17-pivot-p1-ownership-audit.md`
- ownership contract updated with factual audit snapshot:
  - PixelPort repo `Analog-Labs/pixelport-launchpad` default branch `main`, currently unprotected, no rulesets on `main`, no CODEOWNERS file
  - one visible dynamic CodeQL workflow/check-run context (`Analyze (javascript-typescript)`)
  - Paperclip reference repo `paperclipai/paperclip` default branch `master`, branch reports protected, active ruleset includes `deletion`, `non_fast_forward`, and `pull_request`
  - local Paperclip clone workflows confirmed under `/Users/sanchal/paperclip/.github/workflows/*`
- deploy ownership evidence captured:
  - Vercel ownership/scope signal: `sanchalr` / `sanchalrs-projects`
  - Vercel production branch signal: `main`
  - Railway workspace owner signal observed as legacy pre-pivot infra traceability only (not active runtime deploy authority)
  - DO account ownership signal observed
  - DO token scope limits observed on billing/balance endpoints (`403`)
- secrets inventory signal captured by surface (names only), with an at-the-time note that `PAPERCLIP_*` handoff vars were not visible in then-current Vercel env listing evidence

Track A closure state remained unchanged at that checkpoint:
- A2, A3, A4, A5 are still open pending explicit enforcement/configuration and founder-level confirmations.

## Pivot Execution Update (2026-03-17 Authenticated Handoff Smoke)

Authenticated production smoke was executed for `POST /api/runtime/handoff` using a temporary Supabase-backed test user + temporary active tenant.

- valid Bearer token was generated via `signInWithPassword`
- response was `503` with:
  - `{"error":"Paperclip runtime handoff is not configured.","missing":["PAPERCLIP_RUNTIME_URL","PAPERCLIP_HANDOFF_SECRET"]}`
- cleanup evidence:
  - tenant deleted: `true`
  - user deleted: `true`

Conclusion at that time: auth path was validated up to config gating and success-path `200` was blocked by missing handoff env vars. This was later resolved in the `688c4e3` runtime-target update below.

## Pivot Execution Update (2026-03-17 Runtime Target + Golden Enforcement)

Post-merge update after `688c4e3` on `main`:

- commit: `688c4e3`
- deploy status: `success`
- deploy URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/7wihkxTEH7eRPevqicduNULohfcX`

Implemented outcomes:
- `api/debug/env-check.ts` is production-gated and header-auth only (`x-debug-secret`).
- `api/tenants/index.ts` removed `Record<string, any>` in favor of typed body handling.
- `/api/runtime/handoff` derives `paperclip_runtime_url` from tenant `droplet_ip` as `http://<ip>:18789` and no longer depends on `PAPERCLIP_RUNTIME_URL`.
- missing/invalid runtime target returns `409` (`runtime-target-unavailable`).
- provisioning enforces strict golden image selector (no compatibility fallback image).

Validation recorded:
- local `npx tsc --noEmit` pass
- local vitest suite pass (4 files / 29 tests)
- QA reviewer verdict: approved with no findings

Production smoke truth:
- `GET /api/debug/env-check` -> `404 {"error":"Not found"}`
- `POST /api/runtime/handoff` without auth -> `401`
- `POST /api/runtime/handoff` invalid bearer -> `401`
- authenticated temporary user+tenant rerun -> `200` with `paperclip_runtime_url=http://157.245.253.88:18789`
- cleanup: tenant deleted `true`, user deleted `true`

Operational follow-up truth:
- `PAPERCLIP_HANDOFF_SECRET` now exists in Vercel env.
- `PROVISIONING_DROPLET_IMAGE` is now configured in production as `ubuntu-24-04-x64` (set 2026-03-17).
- strict enforcement is no longer blocked by missing env; follow-up is promotion from compatibility selector to a maintained PixelPort golden artifact.

## Pivot Execution Update (2026-03-17 Golden Selector Canary + Policy Gate)

Post-merge update after `9faee29` on `main`:

- commit: `9faee29`
- deploy status: `success`
- deploy URL: `https://pixelport-launchpad-q4qnlchai-sanchalrs-projects.vercel.app`

Validated outcomes:
- Fresh-tenant canary passed under strict-selector path with production `PROVISIONING_DROPLET_IMAGE=ubuntu-24-04-x64`:
  - tenant `078bd6f9-ff77-4431-8bac-ba83f2d94e59` reached `active`
  - gateway health `200`
  - backend artifacts present (`vault_non_pending=5`)
  - evidence: `docs/qa/2026-03-17-pivot-p1-golden-selector-fresh-tenant-canary.md`
- Provisioning policy-gate slice shipped:
  - selector classification now reports `managed | compatibility | missing`
  - missing-selector strict behavior unchanged
  - optional managed-only enforcement gate added:
    - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
  - evidence: `docs/qa/2026-03-17-pivot-p1-golden-image-policy-gate.md`
- Post-merge production smoke canary for `9faee29` reached `active` (poll 16) with gateway health `200`; tenant row cleanup confirmed.

## Pivot Execution Update (2026-03-17 Managed Golden Promotion + Managed-Only Gate Rollout)

Step 1 and Step 2 execution are complete; Step 3 is partially complete with an infrastructure blocker:

- Step 1 (selector promotion) completed:
  - DO snapshot promoted: `220984246` (`pixelport-paperclip-golden-2026-03-17-a627712`)
  - production selector updated to: `PROVISIONING_DROPLET_IMAGE=220984246`
  - production redeploy completed on alias `https://pixelport-launchpad.vercel.app`
- Step 2 (managed-image canary) completed:
  - tenant `025792b0-80f1-48c1-812a-75af3f7020d3` reached `active`
  - droplet `558892798` / `159.65.239.67`
  - gateway health `200`
  - DO truth confirms droplet image `220984246`
  - tenant cleanup confirmed (`TENANT_AFTER=[]`)
- Step 3 (managed-only gate) configuration completed:
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true` is set in production
  - production redeploy completed (`pixelport-launchpad-htok25s2n-sanchalrs-projects.vercel.app`)

Step 3 canary blocker evidence:
- strict managed-only fresh tenant (`86fc38f5-ac20-4c14-be88-3bcb1d2792aa`) remained `provisioning` with no `droplet_id`
- Inngest run fails on `create-droplet` with `HTTP 422`
- direct DO probe confirms exact root cause:
  - `{"id":"unprocessable_entity","message":"creating this/these droplet(s) will exceed your droplet limit"}`
- autonomous cleanup cannot clear capacity with current token:
  - delete attempts for stale dry-run droplets return `HTTP 403 {"id":"Forbidden","message":"You are not authorized to perform this operation"}`

Operational implication:
- managed-only policy logic is deployed and enabled in production config, but end-to-end closure is not yet validated because DigitalOcean account capacity + delete authorization are blocked outside current automation scope.
- closure action required: authorized owner deletes stale dry-run droplets (or raises limit), then rerun strict managed-only fresh canary.

Evidence artifact:
- `docs/qa/2026-03-17-pivot-p1-managed-golden-promotion-and-managed-only-canary.md`

## Pivot Execution Update (2026-03-17 Managed Golden Rebuild Closure)

Founder-approved Option 1 recovery was executed end-to-end to restore strict managed-only provisioning:

- Temporary compatibility bootstrap (to rebuild golden image):
  - set `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=false`
  - set `PROVISIONING_DROPLET_IMAGE=ubuntu-24-04-x64`
  - production redeploy: `https://pixelport-launchpad-ceju3vqx8-sanchalrs-projects.vercel.app`
- Bootstrap canary passed:
  - tenant `2c7b413a-d034-40df-9455-4cdec1c0786e` reached `active`
  - droplet `559040968` / `104.248.61.186`
  - gateway health `200`
- New managed snapshot minted from bootstrap canary:
  - snapshot action: `3095700311` (`completed`)
  - image id: `221035422`
  - image name: `pixelport-paperclip-golden-2026-03-17-rebuild-4c24047`
- Managed-only production config restored:
  - `PROVISIONING_DROPLET_IMAGE=221035422`
  - `PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE=true`
  - production redeploy: `https://pixelport-launchpad-geushz7cg-sanchalrs-projects.vercel.app`
- Strict managed-only canary passed:
  - tenant `c19aa8eb-96b8-434a-8fa5-79a9da6c7060` reached `active`
  - droplet `559042841` / `157.230.10.108`
  - gateway health `200`
  - droplet image truth: `221035422`
  - cleanup removed tenant row (`TENANT_AFTER=[]`)

Closure status:
- managed-only rollout blocker is resolved.
- strict provisioning path is now validated against a live managed snapshot image.

Residual operations risk:
- DO token still cannot delete droplets (`HTTP 403`), so cleanup endpoint removes tenant rows but leaves dry-run droplets running unless manually deleted.

Evidence artifact:
- `docs/qa/2026-03-17-pivot-p1-managed-golden-rebuild-closure.md`

## Pivot Execution Update (2026-03-17 Track A3 Deploy Ownership Closure)

Track A3 is now explicitly closed with named deploy ownership and delegate coverage for launch surfaces:

- evidence artifact: `docs/qa/2026-03-17-pivot-p1-a3-deploy-ownership-closure.md`
- ownership contract update: `docs/paperclip-fork-bootstrap-ownership.md`

Confirmed ownership signals used for closure:
- Vercel deploy target scope: `sanchalrs-projects/pixelport-launchpad`
- DigitalOcean owner signal: `sanchal@analog.one` (`My Team`)
- launchpad repo ownership/governance signal: `Analog-Labs/pixelport-launchpad` on `main`

Legacy infra note:
- Railway/LiteLLM (`pixelport-litellm`) remains running from pre-pivot architecture but is not part of active Paperclip-primary deploy ownership scope; it is tracked as legacy-to-decommission.

Named deploy ownership model:
- primary owner: `sanchalr` / `sanchal@analog.one`
- backup delegates: `haider-rs` (primary), `penumbra23` (secondary)
- promotion authority: primary by default; backups when founder-delegated
- rollback authority: primary immediate; backups when founder-delegated; founder notification required immediately after rollback

Track A closure state after this update (historical snapshot at this checkpoint):
- A1: closed
- A2: closed
- A3: closed
- A4: open
- A5: open

## Pivot Execution Update (2026-03-17 Track A3 Merge + Production Smoke)

A3 documentation slice is now merged and deployed:

- PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/3`
- merge commit: `4b06fda`
- deploy URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/2NQ8EUrBdjTNPHenMtpfn1aYjn3x`
- required checks on merge commit:
  - `Analyze (javascript-typescript)`: `pass`
  - `validate`: `pass`

Targeted production smoke on `https://pixelport-launchpad.vercel.app` passed:
- `GET /api/runtime/handoff` -> `405`
- `POST /api/runtime/handoff` without auth -> `401`
- `POST /api/runtime/handoff` invalid bearer -> `401`
- `GET /api/debug/env-check` -> `404`

Evidence artifact:
- `docs/qa/2026-03-17-pivot-p1-a3-merge-smoke.md`

## Pivot Execution Update (2026-03-17 Track A4 Secrets Inventory Kickoff)

Track A4 execution is started with refreshed evidence capture:

- `PAPERCLIP_HANDOFF_SECRET` is visible in Vercel production env key listing
- handoff contract truth is confirmed as:
  - required: `PAPERCLIP_HANDOFF_SECRET`
  - optional: `PAPERCLIP_HANDOFF_TTL_SECONDS` (default `300`)
  - runtime URL is derived from tenant `droplet_ip` (no runtime URL env required)
- Railway/LiteLLM variable surface is documented as legacy pre-pivot scope (names-only)

A4 remained open at this kickoff checkpoint pending founder closure decisions on:
- source-of-truth ownership by surface
- rotation ownership/cadence
- unresolved env-owner mappings for runtime/provisioning references not currently visible in Vercel production key listing

Evidence artifact:
- `docs/qa/2026-03-17-pivot-p1-a4-secrets-inventory-kickoff.md`

## Pivot Execution Update (2026-03-17 Track A4 Secrets Closure)

Founder approvals have now closed A4 with explicit policy decisions:

- source of truth: Vercel-only for active pivot secrets
- rotation cadence: 90 days for all active pivot secrets
- AGENTMAIL/GEMINI/MEM0 keys confirmed added in Vercel for OpenClaw-driven use
- Railway/LiteLLM confirmed legacy decommission path (not active pivot secret authority)

Closure evidence:
- `docs/qa/2026-03-17-pivot-p1-a4-secrets-closure.md`

Track A closure state after this update:
- A1: closed
- A2: closed
- A3: closed
- A4: closed
- A5: open

## Pivot Execution Update (2026-03-17 Track A4 Merge + Production Smoke)

A4 documentation closure slice is now merged and deployed:

- PR: `https://github.com/Analog-Labs/pixelport-launchpad/pull/4`
- merge commit: `8e9f2f0`
- deploy URL: `https://vercel.com/sanchalrs-projects/pixelport-launchpad/EZLtsYwKop1bg8cVpqcd3WmRkp6E`
- required checks on merge commit:
  - `Analyze (javascript-typescript)`: `pass`
  - `validate`: `pass`

Targeted production smoke on `https://pixelport-launchpad.vercel.app` passed:
- `GET /api/runtime/handoff` -> `405`
- `POST /api/runtime/handoff` without auth -> `401`
- `POST /api/runtime/handoff` invalid bearer -> `401`
- `GET /api/debug/env-check` -> `404`

Evidence artifact:
- `docs/qa/2026-03-17-pivot-p1-a4-merge-smoke.md`

## Pivot Execution Update (2026-03-17 Track A5 Incident Boundary Proposal)

Track A5 remains open and now has a concrete decision-ready proposal for founder approval:

- rollback authority boundary proposal
- severity-based founder notification SLA proposal
- CTO escalation/review trigger proposal

Proposal artifact:
- `docs/qa/2026-03-17-pivot-p1-a5-incident-boundary-proposal.md`

---

## 1. Strategic Context

### Historical Pivot (2026-02-26)

Growth Swarm has been promoted from "internal marketing tool for Analog" to the **dogfood instance of PixelPort** — a productized SaaS that sells AI marketing employees to other companies. Growth Swarm's architecture, agents (LUNA/SCOUT/SPARK), and learnings become the template for every PixelPort customer.

**PixelPort = Tensol (YC W26) model, but laser-focused on GTM/Marketing.**

Two parallel workstreams now exist:
1. **Growth Swarm (dogfood)** — Continue stabilizing and operating the existing agent team on the current DO droplet. Phases D-F of the original plan.
2. **PixelPort (product)** — Build the SaaS web app, provisioning pipeline, and dashboard. Phases 0-6 of the new build plan.

### Current Strategic Direction (2026-03-16)

PixelPort is now executing a Paperclip-primary product pivot:

1. **Primary runtime/product repo:** PixelPort-owned Paperclip fork
2. **Launchpad role:** marketing, billing, and thin provisioning bridge
3. **Onboarding runtime path:** Company -> Provision -> Task -> Launch with provisioning gate before task unlock
4. **Workspace policy:** preserve Paperclip defaults, additive onboarding context in `SOUL.md`, no enforced 3-agent topology in templates
5. **Auth source of truth:** Paperclip auth for runtime product flows

Binding references:
- `docs/pixelport-pivot-plan-2026-03-16.md`
- `docs/pixelport-master-plan-v2.md` (with decision overrides)

---

## 2. Growth Swarm — Live System Snapshot (Verified)

### Infrastructure
- Droplet host: `167.71.90.199`
- Gateway container: `openclaw-gateway`
- Gateway state at verification: `Up`
- OpenClaw image/version: `2026.2.24` (explicit version tag, pinned)
- Note: `:latest` was still pinned to `2026.2.17` at time of upgrade — version pinning is required.

### Current config facts
- `tools.web.search.provider` is set to `"gemini"` — working and validated by smoke tests.
- Runtime supports Gemini web search provider (`brave`/`perplexity`/`grok`/`gemini`/`kimi` enum in deployed build).
- `/opt/openclaw/.env` contains `GEMINI_API_KEY`; Brave/Perplexity keys are not required for the selected provider.
- End-to-end smoke tests confirm Gemini-backed `web_search` succeeds from agent runtime.
- LUNA primary model is `openai/gpt-5.2-codex` (updated from `gpt-5.1-codex`).
- LUNA fallback model is `google/gemini-2.5-flash`.
- `gpt-5.3-codex` exists in OpenAI account but is intentionally deferred on OpenClaw `2026.2.24` because this build routes it to `openai-codex` OAuth provider.

### Agent/workspace facts
- Deployed agents:
  - LUNA (`main`) workspace: `/opt/openclaw/workspace-main`
  - SPARK (`content`) workspace: `/opt/openclaw/workspace-content`
  - SCOUT (`growth`) workspace: `/opt/openclaw/workspace-growth`
- Workspace `AGENTS.md` + `TOOLS.md` have been rewritten with role-specific behavior for all three agents (Phase B complete).
- A second copy of agent docs exists under `/opt/openclaw/agents/<id>/agent/*` and is currently divergent from workspace copies.
- Auth profiles for OpenAI are present for `main`, `content`, and `growth` under `/opt/openclaw/agents/<id>/agent/auth-profiles.json`.
- Inter-agent allowlist mesh is configured and verified:
  - LUNA → SPARK + SCOUT
  - SPARK → SCOUT + LUNA
  - SCOUT → SPARK + LUNA
- `agents.defaults.subagents` set to `maxSpawnDepth=2`, `maxChildrenPerAgent=5`.
- Session visibility/messaging enabled: `tools.sessions.visibility = "all"`, `tools.agentToAgent.enabled = true`.
- Native cross-agent spawn/readback QA passes (`NATIVE_OK`); operating mode is native-first with deterministic fallback on runtime failure.

### Operational facts
- Slack integration active and routed through LUNA.
- Cron reporting jobs configured (Bangkok timezone):
  - `ops-morning-report` at `09:00` Asia/Bangkok
  - `ops-evening-report` at `18:00` Asia/Bangkok
- Cron prompts hardened to enforce `ops_report_v1` sections and explicit missing-data alerts.
- Ops intake artifacts in place under `/opt/openclaw/workspace-main/ops`:
  - `sources.registry.json`, `intake/latest.snapshot.json`, `ops_report_v1.schema.json`
  - `kpis.seed.json`, `contracts/email_mirror_event_v1.schema.json`, `slack-mirror-runbook.md`
- Manual report smokes delivered successfully (morning + evening runs, medium confidence).
- Policy smokes passed: domain trust classification, incident severity classification, Gemini search check.
- AgentMail active (vidacious@agentmail.to) — LUNA checks inbox via exec+curl, all 4 smoke tests pass
- LUNA has `group:runtime` in tools.allow (exec/curl for AgentMail API)
- Email trust boundary locked to `@analog.one` and `@vidacious.ai` domains
- Slack mirror stays active — email is secondary/additive channel
- LUNA communication style: SOUL-first architecture (SOUL.md persona + AGENTS.md response mode router + TOOLS.md constraints). Three modes: human_chat (casual), ops_report (structured), delegation_internal (technical).
- Unsupported allowlist entries removed (`group:memory`, `group:automation`).
- Queue latency warnings (`lane wait exceeded`) appear intermittently — monitored, non-blocking.
- Phase E vault is now live in all three workspaces (`workspace-main/content/growth`) with checksum-verified parity.
- LUNA/SCOUT/SPARK `AGENTS.md` now include `## Knowledge Base` references to `vault/*.md`.
- LUNA `TOOLS.md` now includes `## Vault Management (You Own This)` — LUNA self-manages vault updates.
- LUNA autonomy upgrade: proactive knowledge collection via Slack, self-managed vault updates
- `[FOUNDER TO FILL]` markers replaced with LUNA-actionable instructions
- Cron prompts include knowledge-gap awareness
- Legacy scaffold at `/opt/openclaw/.growth-swarm/vault/` (26 stale files) was removed after verification.
- Smoke checks passed for direct vault-backed answer and native delegation via `sessions_spawn` to SPARK.
- AgentMail Phase F complete: skill installed, `group:runtime` enabled, T1-T4 all pass, Gmail cleanup done
- G5 content pipeline live: SPARK persona upgraded (content engine), SCOUT persona upgraded (intel analyst), LUNA→SPARK delegation tested
- Content production pipeline: LUNA identifies opportunity → briefs SPARK → SPARK returns LinkedIn+X pack → LUNA presents to founder for approval
- SPARK has channel-specific specs (LinkedIn format, X format, image prompt standards, cross-posting rules)
- SCOUT IDENTITY.md stale handoff path fixed
- Content presentation: ANNOUNCE_SKIP suppresses raw subagent dumps, file handoff via `workspace-content/output/latest-pack.md`, brief_id+freshness guard
- Content approval: 3-option CTA (👍 approved / ✏️ edits / 🔄 new angle), founder replies in thread, LUNA confirms

---

## 3. Source-Of-Truth Policy (Locked)

### Canonical docs
- **Project plan/status:** local repo `docs/pixelport-project-status.md` (this file)
- **Pivot contract (active):** `docs/pixelport-pivot-plan-2026-03-16.md`
- **Product spec (v2.0 + overrides):** local repo `docs/pixelport-master-plan-v2.md`
- **Build workflow:** `docs/build-workflow.md`
- **Build brief template:** `docs/build-briefs/template.md`
- **CTO transition briefing:** `docs/archive/cto-instructions-master-plan-v2-transition.md`
- **Lovable collaboration guide:** `docs/lovable-collaboration-guide.md`
- **Infrastructure benchmark:** `docs/cto-founder-infra-benchmark-2026-02-27.md`
- **OpenClaw reference:** `docs/openclaw-reference.md`
- **Historical behavior files (Growth Swarm archive):**
  - `/opt/openclaw/workspace-main/*.md`
  - `/opt/openclaw/workspace-content/*.md`
  - `/opt/openclaw/workspace-growth/*.md`
- `/opt/openclaw/agents/*/agent/*.md` is operational storage, NOT planning source-of-truth.
- **Archived:** `docs/archive/` — completed Phase 0/1 slice docs, Growth Swarm instruction files, v1.0 plan

---

## 4. Growth Swarm Product Intent (Locked — Phase 1 Scope)

### Core outcome
Build an always-on AI agent team that collaborates with humans in Slack, starting with social execution workflows and expanding later.

### Team topology
- Human → LUNA (only)
- LUNA → SPARK and SCOUT
- SPARK ↔ SCOUT direct collaboration allowed

### Phase-1 channels and output
- Channels: LinkedIn + X
- Output types: text + images + video
- Publish mode: one-click assisted workflow that outputs a publish-ready package (manual final posting)

### KPI and reporting
- North-star KPI: engagement outcomes (impressions/reach daily)
- Reporting cadence: 2x daily plus async on-demand in Slack
- Operating style: proactive 24/7, Bangkok timezone

### Research and compliance
- Source scope: public web only, compliant competitive intel
- Evidence tradeoff: speed prioritized over strict citation tracking
- No strict media-rights policy in phase 1

---

## 5. Growth Swarm Execution Plan (Dogfood Instance)

### Phase A — Platform and search stability
**Status: ✅ Completed (2026-02-25)**

- A1: Gateway stable on current schema (controlled container swap + rollback-safe backups)
- A2: Gemini-compatible upgrade applied (explicit Docker image tag `ghcr.io/openclaw/openclaw:2026.2.24`)
- A3: Web search validated end-to-end (Gemini responses with citation URLs)

### Phase B — Rewrite agent operating docs
**Status: ✅ Completed (2026-02-25)**

- B1: LUNA docs rewritten (delegation contracts, QA gate, approval gate, Slack escalation/reporting)
- B2: SPARK docs rewritten (content production contracts, collaboration with SCOUT, output formatting)
- B3: SCOUT docs rewritten (research/intel response contract, confidence tagging, proactive insight routing)

### Phase C — Inter-agent communication wiring
**Status: ✅ C1/C2 Completed (2026-02-25); C3 validated (2026-02-26)**

- C1: Allowlist mesh configured and verified (LUNA↔SPARK↔SCOUT full mesh)
- C2: Mesh tests passing (delegation + follow-up + handoff sequences)
- C3: Learning loop — native spawn/readback passes; MEMORY.md forced writes treated as non-blocking; deterministic feedback-loop test (V1→feedback→V2) passes quality gates

### Phase D — Slack workflow and automation
**Status: ✅ Completed (infrastructure locked 2026-02-26); ongoing operational refinement continues**

Completed:
- Cron jobs configured (morning + evening, Bangkok timezone)
- LUNA workspace intake contracts created (registry, schema, seed KPIs, Slack mirror runbook)
- Cron prompts hardened with schema-complete `ops_report_v1`
- Manual runs confirmed delivery
- Policy locks applied (daily-thread intake, trust boundary, communication style)
- LUNA `slack_data_request_v1` intake contract created
- Kickoff intake request posted to `#vidacious-bot`

Ongoing operational refinement (not blocking Phase F):
- Daily thread intake discipline (continuous improvement)
- Google Cloud access unblocked by Founder (admin access confirmed)
- Queue latency SLO definition (monitoring, non-blocking)

### Phase E — Brand/knowledge ingestion
**Status: ✅ Completed (2026-02-26)**

Completed:
- Created evidence-based 5-file vault in `/opt/openclaw/workspace-main/vault/`:
  - `company-profile.md`
  - `brand-voice.md`
  - `icp.md`
  - `competitors.md`
  - `product-context.md`
- Included `Last verified (UTC)`, `Sources`, `Known unknowns`, and confidence-tagged inferences in each file.
- Clarified required Analog vs Vidacious relationship section in `company-profile.md`.
- Distributed identical vault copies to:
  - `/opt/openclaw/workspace-content/vault/`
  - `/opt/openclaw/workspace-growth/vault/`
- Verified checksum parity for all 5 files across main/content/growth.
- Backed up each workspace `AGENTS.md` with timestamped `-phaseE` suffix before edits.
- Added `## Knowledge Base` to all workspace `AGENTS.md` files.
- Added `## Vault Maintenance` to LUNA `/opt/openclaw/workspace-main/TOOLS.md`.
- Ran smoke tests:
  - Direct vault-backed LUNA response (brand voice + competitors) passed.
  - Inter-agent delegation (LUNA -> SPARK via `sessions_spawn`) passed.
- Removed stale scaffold vault at `/opt/openclaw/.growth-swarm/vault/` after validation.

Open follow-up from Phase E:
- LUNA now owns knowledge gap resolution — proactively asks in Slack and researches via web search.
- Former `[FOUNDER TO FILL]` markers converted to LUNA-actionable instructions.

### Phase F — Email integration (AgentMail)
**Status: ✅ Complete (2026-02-27)**

Goal: Give LUNA a working email address so humans can email context/tasks directly to the agent.

Decision (2026-02-27): **AgentMail** (agentmail.to) replaces Gmail/Apps Script approach.
- AgentMail is a YC-backed, API-first email platform built for AI agents on OpenClaw
- Official OpenClaw skill available (`openclaw/skills` → `agentmail`)
- Inbox already created: `vidacious@agentmail.to`
- API key in `.env` on droplet

Why AgentMail over Gmail:
- No custom Docker builds required (stock upstream image only)
- No HTTPS ingress needed (no nginx/SSL/domain/Cloudflare Tunnel)
- No OAuth token management or Google abuse detection risk
- Scales for PixelPort multi-tenant (free tier: 3 inboxes, 3K emails/mo)
- Official OpenClaw skill = config-only integration

Completed (2026-02-27):
- AgentMail skill installed at `workspace-main/skills/agentmail/` (fallback installer)
- `AGENTMAIL_API_KEY` added to `/opt/openclaw/.env`
- LUNA TOOLS.md updated with `## Email (AgentMail)` section + `### API Mechanism` (exec+curl)
- LUNA AGENTS.md updated with `### Email Integration` in KB
- All backups created (`.env`, `TOOLS.md`, `AGENTS.md` with `-phaseF` suffix, `openclaw.json` with `-phaseF-fix` suffix)
- API key + inbox validated (direct API probe confirmed working)
- `group:runtime` added to LUNA's tools.allow in `openclaw.json` (LUNA only — SPARK/SCOUT unchanged)
- T1 (email identity) smoke test: ✅ PASS
- T2 (receive email) smoke test: ✅ PASS — LUNA reads inbox via exec+curl
- T3 (send email, approval-gated) smoke test: ✅ PASS — draft→APPROVED→sent, founder received
- T4 (delegation + email) smoke test: ✅ PASS — LUNA→SCOUT research→compose→approve→send
- Canonical send endpoint locked to `POST /v0/inboxes/.../messages/send`
- Slack regression: ✅ PASS
- Cron regression: ✅ PASS
- All modified files ownership `1000:1000`: ✅ verified

Gmail cleanup (2026-02-27):
- Purged stale Gmail references from 5 files: `cron/jobs.json`, `ops/sources.registry.json`, `ops/slack-mirror-runbook.md`, `TOOLS.md`, `ops/intake/latest.snapshot.json`
- Gateway restarted to reload updated cron prompts
- Stale phrase scan: zero matches for Gmail blockers in active files
- `policy.email_domain_allowlist` updated to `["analog.one", "vidacious.ai"]`
- All backups created with `-gmailcleanup` suffix

Implementation approach:
- Skill installed, curl-based REST API calls (no Python SDK dependency)
- LUNA sources `.env` file before curl calls for API key access
- Polling mode first (LUNA checks email during cron reports or on request)
- Webhook push mode deferred to future enhancement
- Slack mirror stays active — email is additive, not replacement

Eliminated components (not needed):
- Gmail Pub/Sub pipeline, Google Apps Script bridge
- HTTPS ingress (nginx, SSL, domain), Cloudflare Tunnel / relay worker
- OAuth credential management, `gog` binary / `gcloud` CLI
- Python SDK (curl is sufficient)

Constraints (locked):
- No custom Docker builds — stock upstream OpenClaw images only
- Slack remains primary human-agent channel
- Founder approval required for outbound emails
- Trusted sender allowlist: `@analog.one`, `@vidacious.ai`

### Acceptance Gates

| Gate | Status | Criteria |
|------|--------|----------|
| G1 (A-C) | ✅ Passed | Gateway stable, search functional, docs rewritten, mesh verified |
| G2 (D) | ✅ Passed | Cron/reporting validated; remaining items are ongoing refinement, not blockers |
| G3 (E) | ✅ Passed | Brand vault live, checksum-verified, agent KB wired, smoke tests passed |
| G4 (F) | ✅ Passed | AgentMail skill installed, T1-T4 smoke tests pass, Gmail cleanup done, CTO verified |
| G5 (content) | ✅ Passed | LUNA→SPARK pipeline working, first LinkedIn+X content packs produced, founder approval flow live, CTO QA verified |

---

## 6. PixelPort Build Phases (Product SaaS — v2.0)

### Phase 0: Foundation (Weeks 1-2)
**Goal**: Web app shell + provisioning pipeline
**Status: ✅ Complete — Phase 0.9 dry-run PASSED (2026-03-04)**

**Founder + Lovable: ✅ COMPLETE**
- [x] 0.1: Lovable project setup + Supabase Auth (CHANGED from Clerk — native Lovable integration)
- [x] 0.2: Landing page — 8 sections (hero, features, how-it-works, pricing, security, integrations, FAQ, CTA)
- [x] 0.3: Auth flow: signup/login with Google OAuth + email/password → dashboard redirect
- [x] 0.7: Dashboard shell — 9 protected routes, sidebar nav, empty states, greeting, stat cards
- [x] Vercel connected and auto-deploying from main

**CTO + Codex: ✅ COMPLETE**
- [x] 0.6: LiteLLM central deployment on Railway — 4 models, Docker pinned v1.81.3-stable ✅
- [x] 0.8: Supabase schema (6 tables + indexes + RLS + triggers) ✅
- [x] 0.5: API bridge — 16 route files + 3 shared libs (Supabase Auth + tenant isolation) ✅
- [x] 0.4: Provisioning — 12-step Inngest workflow + templates ✅
- [x] 0.9: Dry-run gate — PASSED (2026-03-04). Full 12-step pipeline completes in ~7 min.

**Shared: ✅ COMPLETE**
- [x] Monorepo structure (Lovable frontend + api/ directory, Vercel deploys both)
- [x] Inngest Cloud setup (free tier, Event Key + Signing Key received)
- [x] All 11 Vercel env vars confirmed SET (AGENTMAIL_API_KEY + OPENCLAW_IMAGE optional)

**CTO QA (2026-03-03):**
- CTO reviewed all Codex Slices 3-4 code: BOTH PASS ✅
- CTO QA'd all frontend: 9 issues found and fixed (signup validation, chat nav, footer, OAuth errors, etc.)

**CTO Phase 0.9 Dry-Run (2026-03-04):**
- Fixed 7 bugs during live testing (see Fixes & Lessons Learned §8)
- Full pipeline verified: tenant→LiteLLM→droplet→Docker→OpenClaw→agents→active
- Provisioning time: ~7 min (Docker CE install ~3 min, image pull ~1 min, OpenClaw boot ~2 min)
- Test tenant created, verified active, cleaned up successfully

### Phase 1: Chief of Staff Alive (Weeks 3-5)
**Goal**: Onboarding + Chief of Staff working in dashboard + Slack + email
**Status: ✅ Complete (gate passed 2026-03-05)**

**CTO + Codex: ✅ ALL COMPLETE**
- [x] 1.C1 (Slice 5): Tenant creation endpoint (`POST /api/tenants`) ✅
- [x] 1.C2 (Slice 6): Chat API streaming (SSE) + message history ✅
- [x] 1.C3 (Slice 7): Slack OAuth flow + webhook ✅
- [x] 1.C6: AgentMail per-tenant provisioning (in provisioning workflow) ✅
- [x] 1.C7 (Slice 8): Website auto-scan (`POST /api/tenants/scan`) ✅
- [x] 1.C8 (Slice 9): Slack activation workflow (SSH + hot-reload) ✅

**Founder + Lovable: ✅ ALL COMPLETE**
- [x] 1.F1-F4: Onboarding wizard, dashboard home, chat widget, agent personalization ✅
- [x] 1.F5: Connections page with Slack OAuth ✅

**Integration: ✅ ALL COMPLETE (I2 deferred)**
- [x] 1.I1: Onboarding → POST /api/tenants ✅
- [x] 1.I1b: Scan API in onboarding ✅
- [x] 1.I3: Dashboard status polling ✅
- [x] 1.I4: Connections page → Slack OAuth ✅

**Deferred to Phase 2:**
- 1.C4: Mem0 per-tenant integration (depends on Mem0 API key / startup program)
- 1.I2: Chat SSE streaming (Slack is primary channel; dashboard chat ships as-is)
- 1.C5: PostHog (redesigned as user-facing integration)

**E2E tested with 2 tenants:** sanchal@analog.one (Vidacious) + sr@ziffyhomes.com. 15 bugs fixed across 4 sessions.

**Architecture decisions made:**
- Slack is PRIMARY channel for Phase 1 (dashboard chat deferred)
- OpenClaw custom LiteLLM provider required (bypasses OPENAI_BASE_URL)
- Website auto-scan: lightweight fetch + LLM brand extraction during onboarding
- PostHog redesigned: user-facing integration (customers connect their PostHog)

### Phase 2: Dynamic Chief + Real Dashboard Data (Weeks 6-9)
**Goal**: 1 persistent Chief per tenant with dynamic sub-agents, dashboard pages with real data
**Status: 🟡 IN PROGRESS — Backend + Frontend complete. CTO remaining: image gen, Mem0, chat, approval workflow.**

**CTO Backend: ✅ COMPLETE + E2E TESTED**
- [x] Architecture pivot (kill SPARK/SCOUT, dynamic sub-agents)
- [x] Database schema + migration applied (agent_tasks, vault_sections, competitors, agent_api_key)
- [x] Agent auth, provisioning update, SOUL.md rewrite, vault seeding
- [x] Agent write APIs + Dashboard read APIs (12 endpoints)
- [x] E2E test: TestCo Phase2 (droplet 142.93.195.23) — ALL 15 checks pass
- [x] Secrets management system (~/.pixelport/secrets.env)

**CTO Remaining:** Image gen, Mem0, Chat WebSocket, PostHog, Inngest approval workflow

**Founder Frontend (Lovable): ✅ COMPLETE (session 7, 2026-03-05)**
- [x] Global dark theme (zinc palette, amber accents, typography upgrade)
- [x] Content Pipeline page — filter tabs, approve/reject actions, platform badges
- [x] Content Calendar page — monthly grid with platform-colored dots, day detail panel
- [x] Knowledge Vault page — 5 collapsible sections, inline editing, status-aware
- [x] Competitor Intelligence page — card grid, threat level badges, website links
- [x] Dashboard Home redesign — 4-stat grid, onboarding checklist, Work Feed + Team Roster
- [ ] Chat WebSocket UI, Performance page (pending CTO backend)

### Phase 3: Social Publishing + Video (Weeks 10-12)
**Goal**: Social integrations + video generation
**Status: ⬜ Not started**

- [ ] 3.1-3.2: X + LinkedIn integration (read + assisted publish)
- [ ] 3.3: Video generation integration
- [ ] 3.4-3.6: Scheduling engine + performance tracking + weekly reports

### Phase 4: Dashboard Polish + Trust (Weeks 13-16)
**Goal**: Production-quality dashboard, trust features
**Status: ⬜ Not started**

- [ ] 4.1-4.3: Performance page, agent detail page, connections page
- [ ] 4.4-4.6: API keys management, budget controls, brand voice enforcement
- [ ] 4.7-4.9: Audit log, team management + RBAC, OpenClaw direct access
- [ ] 4.10-4.11: Workflow suggestions UI, Stripe billing

### Phase 5: Growth (Weeks 17-20)
**Status: ⬜ Not started**

- [ ] 5.1-5.7: WhatsApp, CRM, Gmail/Outlook enterprise, Google Workspace, agent marketplace, multi-team, advanced analytics

### Phase 6: Scale (Weeks 21+)
**Status: ⬜ Not started**

- [ ] 6.1-6.6: K8s migration, auto-provisioning, security hardening, token rotation, SOC2, centralized Slack

---

## 7. Combined Decisions Log

### Growth Swarm Decisions (2026-02-24 to 2026-02-26)

| Date | Decision | Choice |
|------|----------|--------|
| 2026-02-25 | Human entrypoint | LUNA only in Slack |
| 2026-02-25 | Timeline | 2-week stabilization first |
| 2026-02-25 | Approval policy | Explicit founder approval required |
| 2026-02-25 | Approval fallback | Queue and wait |
| 2026-02-25 | Phase-1 channels | LinkedIn + X |
| 2026-02-25 | Phase-1 outputs | Text + image + video |
| 2026-02-25 | Publish flow | One-click assisted package; manual final posting |
| 2026-02-25 | Audience | Founders + GTM leaders |
| 2026-02-25 | Ops schedule | 24/7 proactive |
| 2026-02-25 | Incident surfacing | Dedicated Slack ops thread |
| 2026-02-25 | Reporting cadence | 2x daily + async on demand |
| 2026-02-25 | Ops timezone | Bangkok time |
| 2026-02-25 | Memory retention | Keep + monthly prune |
| 2026-02-25 | KPI primary | Engagement outcomes (impressions/reach daily) |
| 2026-02-25 | Throughput style | Dynamic high (~40/week, adjustable via Slack) |
| 2026-02-25 | Canonical behavior files | Workspace files only |
| 2026-02-25 | Project doc source-of-truth | Local repo docs |
| 2026-02-25 | Media stack target | OpenAI Images + Google Veo |
| 2026-02-25 | Search strategy | Upgraded gateway, switched to Gemini |
| 2026-02-25 | Model assignment | Single model for all agents in phase 1 |
| 2026-02-25 | Agent docs status | Phase B complete |
| 2026-02-25 | Mesh wiring | Phase C1/C2 complete |
| 2026-02-25 | Auth profile rollout | OpenAI auth profiles for main/content/growth |
| 2026-02-25 | OpenClaw runtime upgrade | 2026.2.17 → 2026.2.24 (explicit version tag) |
| 2026-02-25 | Search validation | Gemini smoke tests passed |
| 2026-02-26 | Doctor remediation | `openclaw doctor --fix` applied |
| 2026-02-26 | Session diagnostics | `sessions.visibility=all`, `agentToAgent.enabled=true` |
| 2026-02-26 | Phase D kickoff | Twice-daily Slack ops cron reports |
| 2026-02-26 | Telemetry intake | Slack first, then email |
| 2026-02-26 | Reporting destination | Channel root `C0AH74JNETT`; incidents in thread |
| 2026-02-26 | Report schema | `ops_report_v1` with data-missing alerts |
| 2026-02-26 | C3 memory policy | Don't force main MEMORY.md writes |
| 2026-02-26 | C3 collaboration | Native-first, deterministic fallback |
| 2026-02-26 | Email integration | Deferred; Slack mirror fallback |
| 2026-02-26 | Intake trust | `@analog.one` only; no subject tags |
| 2026-02-26 | Intake pattern | Daily thread in `#vidacious-bot` |
| 2026-02-26 | P1 threshold | Hard outages only |
| 2026-02-26 | Interim ownership | LUNA default for stale sources |
| 2026-02-26 | Security | Secret pasting accepted; rotation mandatory |
| 2026-02-26 | Slack style | Friendly, concise, light emoji, SLA nudges |
| 2026-02-26 | Allowlist cleanup | Removed `group:memory`, `group:automation` |
| 2026-02-26 | Slack security | `groupPolicy=open`, `allowFrom=["*"]` accepted |
| 2026-02-26 | Vault founder decisions | 8 critical decisions confirmed by founder (year, tone, claims, differentiators, etc.) |
| 2026-02-26 | Docker image policy | No divergence from upstream OpenClaw; must stay upgradeable |
| 2026-02-26 | Phase D gate | Closed as complete; remaining items are ongoing operational refinement |
| 2026-02-26 | Google Cloud access | Founder confirmed admin access available; blocker resolved |
| 2026-02-26 | LUNA email | luna@analog.one — email bridge for humans to send context to LUNA |
| 2026-02-26 | Phase F approach | Investigation-first; no custom Docker builds allowed |
| 2026-02-26 | Workstream priority | Growth Swarm first, then PixelPort |
| 2026-02-27 | Email integration platform | AgentMail (agentmail.to) — replaces Gmail/Apps Script |
| 2026-02-27 | LUNA email inbox | vidacious@agentmail.to (already created) |
| 2026-02-27 | Email mode | Polling first; webhook push deferred |
| 2026-02-27 | Email channel priority | Secondary to Slack — additive, not replacement |
| 2026-02-27 | Outbound email policy | Founder approval required before sending |
| 2026-02-27 | LUNA runtime tools | Add `group:runtime` to LUNA only (exec/curl for AgentMail API) — CTO approved |
| 2026-02-27 | AgentMail API mechanism | curl-based REST calls (no Python SDK needed) |
| 2026-02-27 | AgentMail installer path | Fallback `clawhub` succeeded (primary `playbooks` failed on TTY) |
| 2026-02-27 | Vault ownership | LUNA owns vault — proactive collection via Slack, self-managed updates |
| 2026-02-27 | Knowledge collection | Conversational in Slack (1-2 Qs at a time), not manual form-filling |
| 2026-02-27 | LUNA autonomy | Chief of staff model — LUNA decides what to learn, ask, and update |
| 2026-02-27 | LUNA communication style | Casual startup colleague — emojis, short messages, never expose file names or technical internals |
| 2026-02-27 | SPARK persona | Content engine — creative, bold, platform-native, fast, opinionated |
| 2026-02-27 | SCOUT persona | Intel analyst — precise, efficient, pattern-spotter, honest, action-oriented |
| 2026-02-27 | Content pipeline architecture | LUNA orchestrates: identify → brief SPARK → review pack → present to founder → SCOUT for evidence if needed |
| 2026-02-27 | Content pack format | Channel-specific: LinkedIn (1200-1800 chars, variants, hashtags) + X (280 char singles, 3-5 tweet threads) + image prompts |
| 2026-02-27 | Content delivery mechanism | SPARK writes to file + ANNOUNCE_SKIP; LUNA reads file + presents with CTA |
| 2026-02-27 | Content approval flow | 3-option CTA in Slack: approved / edits / new angle — founder replies in thread |
| 2026-02-27 | LUNA model runtime | Primary `openai/gpt-5.2-codex`, fallback `google/gemini-2.5-flash`; deferred `gpt-5.3-codex` due OAuth-provider mapping on OpenClaw `2026.2.24` |

### PixelPort Product Decisions (2026-02-26)

| Date | Decision | Choice |
|------|----------|--------|
| 2026-02-26 | Product name | PixelPort (was LunaAI) |
| 2026-02-26 | GS↔PixelPort | GS = dogfood/first customer |
| 2026-02-26 | Build team | Solo founder + AI agents |
| 2026-02-26 | Deployment model | Isolated OpenClaw per customer |
| 2026-02-26 | Timeline | No hard deadline — build it right |
| 2026-02-26 | Onboarding start | Web dashboard chat → then Slack |
| 2026-02-26 | GTM features | Agent behaviors + dedicated dashboard UI |
| 2026-02-26 | Content approval | Slack-first, no auto-post default |
| 2026-02-26 | Agent tone | User-configurable |
| 2026-02-26 | Data retention | Keep until delete, compress over time |

### PixelPort v2.0 Decisions — Architecture Q&A (2026-02-28)

52 locked decisions in `docs/pixelport-master-plan-v2.md` Section 17. Key decisions affecting Phase 0:

| Date | Decision | Choice |
|------|----------|--------|
| 2026-02-28 | Product model | "Your AI Chief of Staff" — one visible agent, sub-agents behind scenes |
| 2026-02-28 | Frontend | Lovable Cloud (replaces Next.js + Tailwind) |
| 2026-02-28 | LLM keys | PixelPort provides default keys (BYO optional) |
| 2026-02-28 | LLM gateway | LiteLLM from day one — all calls route through it |
| 2026-02-28 | Workflow engine | Inngest from day one (free: 50K exec/mo) |
| 2026-02-28 | Memory | Mem0 managed cloud (vector + graph per tenant) |
| 2026-02-28 | Analytics | PostHog from Phase 1 (free: 1M events) |
| 2026-02-28 | Pricing | $299/$999/$3K+ per-agent tiers, 14-day free trial |
| 2026-02-28 | Onboarding | 3-step (URL + goals + Slack) |
| 2026-02-28 | Email | AgentMail default, Phase 1 |
| 2026-02-28 | Image gen | Phase 2 |
| 2026-02-28 | Video gen | Phase 3 |
| 2026-02-28 | Slack routing | Socket Mode per-tenant VM for now |

### CTO Q&A Decisions — Phase 0 Unblock (2026-02-28)

| # | Question | Decision |
|---|----------|----------|
| Q1 | Inngest hosting | Inngest Cloud free tier (no self-hosting) |
| Q2 | LiteLLM deployment | Railway or Render (cheapest always-on, ~$5-10/mo) |
| Q3 | Supabase schema ownership | CTO proposes → founder reviews → CTO executes |
| Q4 | API structure | Vercel API routes in monorepo (api/ directory) |
| Q5 | OpenClaw version for new tenants | CTO picks latest stable at launch (not pinned to 2026.2.24) |
| Q6 | Repo structure | Monorepo (Lovable frontend + api/ backend) |
| Q7 | Mem0 pricing | Start with free tier, apply for startup program |
| Q8 | Trial LLM budget | $20 per trial user via LiteLLM |
| Q9 | Decision log count | Skip (not important) |

### Phase 2 Architecture Pivot (2026-03-05)

| # | Decision | Detail |
|---|----------|--------|
| P2-1 | Kill SPARK/SCOUT as permanent agents | 1 persistent Chief per tenant instead of 3 agents |
| P2-2 | Dynamic sub-agents | Chief uses OpenClaw native `sessions_spawn` to spawn specialists on demand |
| P2-3 | Agent API key pattern | Per-tenant `agent_api_key` (prefix `ppk-`) for Chief → Vercel API auth via X-Agent-Key header |
| P2-4 | Content + Calendar = filtered tasks | No separate content_items table; content pipeline and calendar are filtered views of `agent_tasks` |
| P2-5 | Vault seeding | 5 sections pre-created during provisioning, auto-populated from scan results |
| P2-6 | No mock data | Dashboard pages show loading states until Chief populates real data |
| P2-7 | Post-onboarding auto-research | Chief auto-starts vault, competitor, and content research after provisioning |
| P2-8 | Sub-agent config | maxSpawnDepth: 2, maxChildrenPerAgent: 5, allowAgents: ['*'] |
| P2-9 | SOUL.md includes API curl patterns | Chief knows how to call Vercel API endpoints from SOUL.md instructions |
| P2-10 | Local secrets management | `~/.pixelport/secrets.env` (chmod 600, outside git) — CTO/Codex access without asking founder |
| P2-11 | Vercel CLI linked | `npx vercel env pull` for env var sync; Supabase CLI linked for migrations |
| P2-12 | Dark theme modernization | Zinc-based palette (zinc-950/900/800), amber accents selective, font-medium body, tabular-nums stats |

---

## 8. Fixes & Lessons Learned

| Date | Issue | Fix | Notes |
|------|-------|-----|-------|
| 2026-02-24 | Bot doesn't respond | Actions > Messages OFF in Slack | Enable in OpenClaw UI |
| 2026-02-24 | missing_recipient_team_id | Multiple Slack settings disabled | Turn on ALL toggles |
| 2026-02-24 | teamId rejected | OpenClaw rejects unknown keys | Don't add unrecognized keys |
| 2026-02-24 | CLI changes break gateway | Strict config validation | Prefer UI for changes |
| 2026-02-24 | TOOLS.md = home auto defaults | Generic templates | Rewrite per agent |
| 2026-02-25 | Web search failed on 2026.2.17 | `provider: "gemini"` not schema-valid | Required upgrade to 2026.2.24 |
| 2026-02-25 | `:latest` tag outdated | Still pinned to 2026.2.17 | Always use explicit version tags |
| 2026-02-25 | Container can't SSH | Network restricted | Use Chrome MCP for UI access |
| 2026-02-26 | Unsupported allowlist entries | `group:memory`, `group:automation` | Removed; check logs for warnings |
| 2026-02-27 | `playbooks add skill` fails non-interactive | TTY/raw-mode issue | Use `clawhub@latest install` fallback |
| 2026-02-27 | AgentMail T2-T4 fail | LUNA missing `group:runtime` for exec/curl | Skills assume agent has exec; add to allowlist |
| 2026-02-27 | `.env` not in container `printenv` | Container not started with `--env-file` | Source `.env` before exec commands |
| 2026-02-27 | AgentMail send endpoint 404 | `POST /messages` → 404 | Correct endpoint: `POST /messages/send` |
| 2026-02-27 | Stale Gmail refs in cron reports | 4 files still reference Gmail approach | cron/jobs.json, sources.registry, slack-mirror-runbook, TOOLS.md |
| 2026-02-27 | Codex missed Step 7 | Fix instructions updated after Codex started | Supplementary instruction needed for Gmail cleanup |
| 2026-02-27 | LUNA too robotic in Slack | Voice instructions too vague ("friendly, light emoji") | Rewrote with explicit anti-patterns, examples, and "startup colleague" framing |
| 2026-02-27 | "Subagent finished" messages visible | OpenClaw system notification leaks internal ops to channel | System-generated, not controllable via workspace files — cosmetic, non-blocking |
| 2026-02-27 | SPARK/SCOUT had generic SOUL.md | Boilerplate personas, not role-specific | Replaced with content engine (SPARK) and intel analyst (SCOUT) personas |
| 2026-02-27 | Raw subagent dumps in Slack | OpenClaw auto-announces subagent completion | ANNOUNCE_SKIP + file handoff (SPARK writes to file, replies ANNOUNCE_SKIP, LUNA reads file) |
| 2026-02-27 | No approval CTA on content drafts | Founder didn't know what to do with content | Added 3-option CTA: 👍 approved / ✏️ edits / 🔄 new angle |
| 2026-03-04 | All Vercel API routes crash | `"type": "module"` in root package.json | Created `api/package.json` with `{"type": "commonjs"}` to override |
| 2026-03-04 | INNGEST_SIGNING_KEY missing | CTO omitted from initial env var checklist | Added to Vercel env vars + env-check diagnostic |
| 2026-03-04 | Inngest functions never execute | Serve handler not synced with Inngest Cloud | `curl -X PUT /api/inngest` to register functions |
| 2026-03-04 | Wait-for-droplet times out | In-process setTimeout exceeds Vercel timeout | Refactored to Inngest durable `step.run()` + `step.sleep()` per poll |
| 2026-03-04 | OpenClaw config crash-loop | `gateway.token` wrong (needs `gateway.auth.token`), `agents[]` wrong (needs `agents.list[]`) | Updated `buildOpenClawConfig()` to match production Growth Swarm schema |
| 2026-03-04 | Gateway not externally accessible | OpenClaw defaults to loopback binding | Added `--bind lan` + `controlUi.dangerouslyAllowHostHeaderOriginFallback` |
| 2026-03-04 | configure-agents step fails | Gateway returns HTML for all HTTP routes (WebSocket-only) | Changed to simple HTTP 200 verification (verify-gateway-config) |
| 2026-03-04 | Canvas/cron EACCES errors | Missing directories for OpenClaw runtime | Added canvas/cron/agents dirs to cloud-init + volume mounts |
| 2026-03-04 | DO Marketplace OpenClaw image retired | Image slug=null, status=retired | Reverted to ubuntu-24-04-x64 with full Docker cloud-init |
| 2026-03-04 | Test-provision re-triggers on status check | Default behavior re-sent Inngest event, creating duplicate runs | Added `mode=status` (read-only) and `mode=retry` (explicit) |
| 2026-03-05 | SSH key mismatch | Vercel env var had wrong key format | Founder updated to RSA key matching DO account |
| 2026-03-05 | `node` not on Ubuntu 24.04 host | SSH scripts used node.js | Replaced all host scripts with python3 (`5670bdd`) |
| 2026-03-05 | OpenClaw config crash (strict validation) | Unrecognized keys in config | Stripped to minimal known keys only (`4bd886e`) |
| 2026-03-05 | LiteLLM 401 — OpenClaw ignores OPENAI_BASE_URL | Built-in `openai` provider hardcodes api.openai.com | Custom `litellm` provider in `models.providers` with explicit `baseUrl` (`929b7ad`) |
| 2026-03-05 | LiteLLM key_alias collision on re-provision | Same tenant slug = same alias = 422 error | Added UUID suffix: `key_alias: pixelport-${slug}-${uuid}` |
| 2026-03-05 | LiteLLM team_alias collision on re-provision | Same tenant slug = same alias = 422 error | Added UUID suffix: `team_alias: pixelport-${slug}-${uuid}` (`44a1394`) |
| 2026-03-05 | Gateway health check fail-open | activate-slack.ts silently continued if gateway unhealthy | Changed to throw + Inngest retry (`d100fbf`) |
| 2026-03-05 | Debug endpoints had no auth | 5 mutating endpoints exposed without secrets | Deleted mutating endpoints, added shared-secret auth to 3 read-only (`d100fbf`) |
| 2026-03-05 | inngest.send() silent failure | Event dispatch failure not caught | Added try/catch with explicit error logging |

---

## 9. Known Risks and Mitigations

| Risk | Current choice | Mitigation |
|------|----------------|------------|
| Credential exposure | Rotation deferred | Keep explicit task in backlog |
| Media licensing ambiguity | Strict rights policy deferred | Human approval gate for publishing |
| Speed over evidence tracking | Allowed | LUNA blocks unverifiable claims |
| Dual file trees on droplet | Workspace-only canonical policy | Ignore agentDir copies |
| AgentMail vendor dependency | Free tier sufficient for now | Monitor pricing/availability; AgentMail is YC-backed; fallback to self-hosted SMTP if needed |
| Email prompt injection | Trusted sender allowlist | Only process emails from `@analog.one` and `@vidacious.ai`; flag suspicious content |
| Secrets pasted in chat | Explicitly accepted | Immediate key rotation if occurs |
| Queue latency warnings | Monitored, non-blocking | Define alert threshold/SLO |

---

## 10. Immediate Next Actions

### Active Program: Paperclip-Primary Pivot (Phase P1)

Latest P1 runtime-target/golden-enforcement slices are shipped on `main` (`688c4e3`, `9faee29`) and managed-only golden-image recovery closure is recorded on 2026-03-17.

1. Close A2 by configuring real enforcement on `Analog-Labs/pixelport-launchpad` `main`:
   - required checks
   - review gate baseline
   - explicit backup reviewer model
2. Close A3 with explicit founder approval of deploy ownership for launchpad/runtime staging+production and rollback authority.
3. Close DO cleanup-scope gap for unattended operations hygiene:
   - grant delete-capable DO token scope for cleanup automation, or
   - keep manual founder cleanup as an explicit operational runbook step after canaries
4. Close A4 with explicit founder approval for secrets source-of-truth and rotation owners, including final ownership model for `PAPERCLIP_*` handoff vars.
5. Close A5 with explicit founder approval of incident escalation chain and notification SLAs.
6. Start the next approved P1 slice for Paperclip-fork consumer integration of the handoff contract after A2-A5 closure criteria are satisfied or explicitly waived.
7. Keep launchpad scoped to marketing, billing, and thin provisioning bridge responsibilities while cutover work proceeds.

### Scope Boundaries (Current)

- Growth Swarm is archived/deactivated from active execution.
- Stripe-trigger provisioning is deferred (phase-2 hook).
- Customer SSH policy is deferred.
- V1 provisioning is allowlist/invite gated for controlled testing.

---

## 11. Key References

| Document | Purpose |
|----------|---------|
| `docs/pixelport-pivot-plan-2026-03-16.md` | Binding pivot contract and scope boundaries for active execution |
| `docs/pixelport-master-plan-v2.md` | Full product spec v2.0 — 52 locked decisions, architecture, build plan |
| `docs/ACTIVE-PLAN.md` | Current execution checklist for active phase |
| `docs/pixelport-project-status.md` | This file — execution status |
| `docs/archive/cto-instructions-master-plan-v2-transition.md` | CTO briefing on v1→v2 changes (archived) |
| `docs/lovable-collaboration-guide.md` | How founder + Claude work on Lovable frontend |
| `docs/cto-founder-infra-benchmark-2026-02-27.md` | Infrastructure benchmark + competitor analysis |
| `docs/openclaw-reference.md` | OpenClaw platform reference |
| `docs/archive/` | Completed Phase 0/1 slice docs, Growth Swarm files, v1.0 plan |
